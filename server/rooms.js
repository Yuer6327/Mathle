// 房间状态机
// 对抗(pvp)：各自答案，同时玩，先破解者胜（仅匹配 2 人）
// 合作(coop)：共享等式，轮流猜，破解则团队胜（匹配 2 人 / 好友房间 N 人）
// 好友房间：房主 create_room 拿房号，好友 join_room 加入（大厅 → 房主 start → 开始）
// 服务端权威：生成等式、校验猜测、计算反馈，客户端只负责展示与输入
import { generateEquation, getAnswer } from '../src/lib/equationGenerator.js';
import { getSymbolType } from '../src/lib/constants.js';
import { validateGuess } from './validate.js';

const GAME_TIMEOUT_MS = 10 * 60 * 1000; // 全局时限 10 分钟
const COOP_TURN_MS = 60 * 1000;         // 合作单步时限 60s，超时自动过回合
const SLOT_RETRY = 60;                  // 对抗式下两题槽位数对齐的最大尝试次数（极难槽位集中在 35-45，单次匹配率 ~13%，60 次失败率 <0.1%）
const DIFFICULTIES = ['beginner', 'easy', 'medium', 'hard', 'expert'];
const PRIVATE_MAX_PLAYERS = 8;          // 好友房间人数上限
const CODE_LEN = 6;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混淆的 I O 0 1

function makeEq(difficulty, seed) {
  const eq = generateEquation(difficulty, seed);
  return { ...eq, answer: getAnswer(eq) };
}

function randSeed() {
  return Math.random().toString(36).substring(2, 12).toUpperCase();
}

// 下发给客户端的等式：隐藏槽位的 symbol 用 null 抹掉（防作弊），附 symbolType 供样式
// 注意：不下发 seed（seed 可反推答案），seed 只在 game_over 时随答案一起下发供统计
function serializeEquation(eq) {
  return {
    difficulty: eq.difficulty,
    answerLength: eq.answer.length,
    tokens: eq.tokens.map((t) => ({
      type: t.type,
      symbol: t.hidden ? null : t.symbol,
      hidden: t.hidden,
      slotIndex: t.slotIndex,
      symbolType: t.hidden ? getSymbolType(t.symbol) : undefined,
    })),
  };
}

export class Rooms {
  constructor() {
    this.rooms = new Map();     // roomId -> room
    this.memberOf = new Map();  // client.id -> roomId
    this.byCode = new Map();    // 房号 -> roomId（仅好友房间）
  }

  roomOf(client) {
    const id = this.memberOf.get(client.id);
    return id ? this.rooms.get(id) || null : null;
  }

  // ── 匹配开房（保留：随机匹配）──
  create(pair, info) {
    const [a, b] = pair;
    const { mode, difficulty } = info;

    let eqs;
    if (mode === 'coop') {
      const eq = makeEq(difficulty, randSeed());
      eqs = [eq, eq];
    } else {
      // 对抗：各自答案，尽量让槽位数一致（公平）
      let tries = 0;
      do {
        eqs = [makeEq(difficulty, randSeed()), makeEq(difficulty, randSeed())];
        tries++;
      } while (eqs[0].answer.length !== eqs[1].answer.length && tries < SLOT_RETRY);
    }

    const roomId = Math.random().toString(36).slice(2, 10);
    const players = pair.map((c, idx) => ({
      client: c,
      id: c.id,
      nickname: c.nickname,
      eq: eqs[idx],
      steps: 0,
      history: [],          // pvp：本人历史；coop：共享历史只挂在先手身上
      status: 'playing',
    }));

    const room = {
      id: roomId,
      private: false,
      mode,
      difficulty,
      players,
      sharedHistory: [],    // coop 共享历史
      turnIndex: 0,         // coop 当前回合玩家索引
      status: 'playing',
      winner: null,         // pvp: 玩家索引；coop: 'team'
      timers: [],           // {handle, kind}
      createdAt: Date.now(),
    };
    this.rooms.set(roomId, room);
    for (const p of players) this.memberOf.set(p.client.id, roomId);

    for (const p of players) {
      const opp = players.find((x) => x !== p);
      p.client.send({
        type: 'match_found',
        roomId,
        mode,
        difficulty,
        yourIndex: players.indexOf(p),
        opponent: { id: opp.id, nickname: opp.nickname },
        equation: serializeEquation(p.eq),
        startAt: room.createdAt,
      });
    }

    this.schedule(room, GAME_TIMEOUT_MS, 'overall', () => this.end(room, 'timeout'));
    if (mode === 'coop') this.scheduleTurnPass(room);
    return room;
  }

  // ── 好友房间 ──
  _genCode() {
    let code;
    do {
      code = Array.from(
        { length: CODE_LEN },
        () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
      ).join('');
    } while (this.byCode.has(code));
    return code;
  }

  createPrivate(client, msg) {
    const { mode, difficulty } = msg || {};
    if (mode !== 'coop' || !DIFFICULTIES.includes(difficulty)) {
      return client.send({ type: 'error', message: '房间参数不合法' });
    }
    // 已在其它房间则先离开
    const existing = this.roomOf(client);
    if (existing) this.leave(client);

    const roomId = 'r' + Math.random().toString(36).slice(2, 10);
    const code = this._genCode();
    const room = {
      id: roomId,
      code,
      private: true,
      mode,
      difficulty,
      status: 'lobby',      // lobby -> playing -> done
      hostId: client.id,
      players: [this._mkPlayer(client)],
      sharedHistory: [],
      turnIndex: 0,
      equation: null,
      winner: null,
      timers: [],
      createdAt: Date.now(),
    };
    this.rooms.set(roomId, room);
    this.byCode.set(code, roomId);
    this.memberOf.set(client.id, roomId);

    client.send({ type: 'room_created', code, roomId, mode, difficulty });
    this.broadcastRoom(room);
    return room;
  }

  joinPrivate(client, code) {
    const roomId = this.byCode.get(String(code || '').toUpperCase());
    const room = roomId ? this.rooms.get(roomId) : null;
    if (!room) return client.send({ type: 'error', message: '房间不存在或已结束' });
    if (room.status !== 'lobby') return client.send({ type: 'error', message: '对局已开始，无法加入' });
    if (room.players.length >= PRIVATE_MAX_PLAYERS) return client.send({ type: 'error', message: '房间已满' });
    if (room.players.some((p) => p.id === client.id)) {
      return client.send({ type: 'error', message: '你已在房间中' });
    }
    const existing = this.roomOf(client);
    if (existing && existing.id !== room.id) this.leave(client);

    room.players.push(this._mkPlayer(client));
    this.memberOf.set(client.id, room.id);
    client.send({ type: 'room_joined', code: room.code, roomId: room.id, mode: room.mode, difficulty: room.difficulty });
    this.broadcastRoom(room);
  }

  startPrivate(client) {
    const room = this.roomOf(client);
    if (!room || room.private !== true) return client.send({ type: 'error', message: '你不在房间中' });
    if (room.status !== 'lobby') return client.send({ type: 'error', message: '对局已开始' });
    if (room.hostId !== client.id) return client.send({ type: 'error', message: '只有房主可以开始' });
    if (room.players.length < 2) return client.send({ type: 'error', message: '至少需要 2 名玩家' });

    room.equation = makeEq(room.difficulty, randSeed());
    room.status = 'playing';
    room.sharedHistory = [];
    room.turnIndex = 0;
    for (const p of room.players) { p.status = 'playing'; p.steps = 0; }

    for (const p of room.players) {
      p.client.send({
        type: 'room_started',
        roomId: room.id,
        mode: room.mode,
        difficulty: room.difficulty,
        yourIndex: room.players.indexOf(p),
        hostIndex: room.players.findIndex((x) => x.id === room.hostId),
        players: room.players.map((x) => ({ id: x.id, nickname: x.nickname })),
        turnIndex: room.turnIndex,
        equation: serializeEquation(room.equation),
        startAt: Date.now(),
      });
    }
    this.schedule(room, GAME_TIMEOUT_MS, 'overall', () => this.end(room, 'timeout'));
    this.scheduleTurnPass(room);
  }

  _mkPlayer(client) {
    return {
      client,
      id: client.id,
      nickname: client.nickname || '玩家',
      steps: 0,
      history: [],
      status: 'lobby',
    };
  }

  // 广播房间当前状态（大厅/进行中）给所有人
  broadcastRoom(room) {
    this.broadcast(room, {
      type: 'room_state',
      code: room.code,
      status: room.status,
      hostId: room.hostId,
      players: room.players.map((p) => ({ id: p.id, nickname: p.nickname })),
      turnIndex: room.status === 'playing' ? room.turnIndex : undefined,
      history: room.status === 'playing'
        ? room.sharedHistory.map((h) => ({ guess: h.guess, feedback: h.feedback }))
        : [],
      steps: room.sharedHistory.length,
    });
  }

  _answerOf(room, player) {
    return (room.private ? room.equation : player.eq).answer;
  }

  _seedOf(room, player) {
    return (room.private ? room.equation : player.eq).seed;
  }

  guess(client, msg) {
    const room = this.roomOf(client);
    if (!room) return client.send({ type: 'error', message: '你不在对局中' });
    if (room.status !== 'playing') return client.send({ type: 'error', message: '对局已结束' });

    const myIdx = room.players.findIndex((p) => p.client.id === client.id);
    const me = room.players[myIdx];

    if (room.mode === 'coop' && room.turnIndex !== myIdx) {
      return client.send({ type: 'error', message: '还没轮到你的回合' });
    }

    const { symbols } = msg || {};
    const res = validateGuess({
      symbols,
      difficulty: room.difficulty,
      answer: this._answerOf(room, me),
    });
    if (!res.ok) return client.send({ type: 'error', message: res.reason });

    if (room.mode === 'coop') {
      // 合作：共享历史，步数=团队已猜次数（无步数上限）
      room.sharedHistory.push({ guess: symbols, feedback: res.feedback });
      const steps = room.sharedHistory.length;
      if (res.correct) { room.winner = 'team'; return this.end(room, 'coop_win'); }

      room.turnIndex = (room.turnIndex + 1) % room.players.length;
      this.broadcast(room, {
        type: 'room_state',
        status: 'playing',
        history: room.sharedHistory.map((h) => ({ guess: h.guess, feedback: h.feedback })),
        steps,
        turnIndex: room.turnIndex,
      });
      this.scheduleTurnPass(room);
    } else {
      // 对抗（仅匹配 2 人）：各自历史，反馈只发给本人，对手只看到进度
      me.steps++;
      me.history.push({ guess: symbols, feedback: res.feedback });
      if (res.correct) { room.winner = myIdx; return this.end(room, 'pvp_win'); }

      client.send({ type: 'guess_result', feedback: res.feedback, steps: me.steps, correct: false });
      const opp = room.players[1 - myIdx];
      if (opp.client.ws.readyState === 1) {
        opp.client.send({
          type: 'opponent_update',
          steps: me.steps,
          status: 'playing',
          // 竞速进度：只给对手反馈颜色（绿/黄/灰），不给具体猜的符号，防止看到对方答案
          history: me.history.map((h) => h.feedback),
        });
      }
    }
  }

  // 玩家离开（主动 leave 或断线）
  leave(client) {
    const room = this.roomOf(client);
    if (!room) return;

    // 好友房间大厅阶段：移除玩家，房主转移，空房删除
    if (room.private && room.status === 'lobby') {
      const idx = room.players.findIndex((p) => p.id === client.id);
      if (idx >= 0) room.players.splice(idx, 1);
      if (room.hostId === client.id && room.players.length > 0) {
        room.hostId = room.players[0].id;
      }
      this.memberOf.delete(client.id);
      if (room.players.length === 0) {
        this.cleanup(room);
      } else {
        this.broadcastRoom(room);
      }
      return;
    }

    if (room.status !== 'playing') return this.cleanup(room);

    const myIdx = room.players.findIndex((p) => p.client.id === client.id);
    if (room.mode === 'coop') {
      // 合作中途离场 → 对局作废，不记成绩
      room.status = 'done';
      this.clearTimers(room);
      for (const p of room.players) {
        if (p.id === client.id) continue;
        p.client.send({
          type: 'game_over',
          outcome: 'aborted',
          reason: '有玩家离开，对局取消',
          steps: room.sharedHistory.length,
          answer: this._answerOf(room, p),
          seed: this._seedOf(room, p),
        });
      }
      return this.cleanup(room);
    }
    // 对抗离场 → 对方直接获胜
    room.winner = 1 - myIdx;
    this.end(room, 'forfeit');
  }

  end(room, kind) {
    if (room.status !== 'playing') return;
    room.status = 'done';
    this.clearTimers(room);

    const sendOver = (p, outcome, reason, opponentSteps = 0) => {
      const opp = room.players.find((x) => x !== p);
      p.client.send({
        type: 'game_over',
        outcome,
        reason,
        mode: room.mode,
        difficulty: room.difficulty,
        steps: room.mode === 'coop' ? room.sharedHistory.length : p.steps,
        opponentSteps,
        // 竞速结算：把对方完整反馈颜色一并下发，保证对方最终进度（含决胜步）可见
        opponentHistory: room.mode === 'pvp' && opp ? opp.history.map((h) => h.feedback) : undefined,
        answer: this._answerOf(room, p),
        seed: this._seedOf(room, p),
        winner: room.winner,
      });
    };

    switch (kind) {
      case 'pvp_win': {
        const w = room.players[room.winner];
        const l = room.players[1 - room.winner];
        sendOver(w, 'win', '你破解了等式', l.steps);
        sendOver(l, 'lose', '对手先破解了等式', w.steps);
        break;
      }
      case 'coop_win':
        for (const p of room.players) sendOver(p, 'win', '合作成功');
        break;
      case 'timeout': {
        if (room.mode === 'pvp') {
          const [a, b] = room.players;
          if (a.steps === b.steps) {
            sendOver(a, 'draw', '时间到，双方平局');
            sendOver(b, 'draw', '时间到，双方平局');
          } else {
            const w = a.steps < b.steps ? 0 : 1;
            const l = 1 - w;
            sendOver(room.players[w], 'win', '时间到，你步数更少', room.players[l].steps);
            sendOver(room.players[l], 'lose', '时间到，对手步数更少', room.players[w].steps);
          }
        } else {
          for (const p of room.players) sendOver(p, 'lose', '时间到');
        }
        break;
      }
      case 'forfeit': {
        const w = room.players[room.winner];
        const l = room.players[1 - room.winner];
        sendOver(w, 'win', '对手离开了，你获胜', 0);
        if (l.client.ws.readyState === 1) sendOver(l, 'lose', '你离开了对局', w.steps);
        break;
      }
    }
    this.cleanup(room);
  }

  broadcast(room, msg) {
    const s = JSON.stringify(msg);
    for (const p of room.players) {
      if (p.client.ws.readyState === 1) p.client.ws.send(s);
    }
  }

  scheduleTurnPass(room) {
    this.clearTimers(room, 'turn');
    this.schedule(room, COOP_TURN_MS, 'turn', () => {
      if (room.status !== 'playing') return;
      room.turnIndex = (room.turnIndex + 1) % room.players.length;
      this.broadcast(room, {
        type: 'room_state',
        status: 'playing',
        history: room.sharedHistory.map((h) => ({ guess: h.guess, feedback: h.feedback })),
        steps: room.sharedHistory.length,
        turnIndex: room.turnIndex,
        timeoutNotice: true,
      });
      this.scheduleTurnPass(room);
    });
  }

  schedule(room, ms, kind, fn) {
    const t = setTimeout(fn, ms);
    t._kind = kind;
    room.timers.push(t);
  }

  clearTimers(room, kind) {
    room.timers = room.timers.filter((t) => {
      if (kind && t._kind !== kind) return true;
      clearTimeout(t);
      return false;
    });
  }

  cleanup(room) {
    this.clearTimers(room);
    if (room.private) this.byCode.delete(room.code);
    for (const p of room.players) this.memberOf.delete(p.client.id);
    this.rooms.delete(room.id);
  }
}
