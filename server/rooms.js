// 房间状态机
// 对抗(pvp)：各自答案，同时玩，先破解者胜
// 合作(coop)：共享等式，轮流猜，破解则团队胜（不设步数上限，10 分钟超时判负）
// 服务端权威：生成等式、校验猜测、计算反馈，客户端只负责展示与输入
import { generateEquation, getAnswer } from '../src/lib/equationGenerator.js';
import { getSymbolType } from '../src/lib/constants.js';
import { validateGuess } from './validate.js';

const GAME_TIMEOUT_MS = 10 * 60 * 1000; // 全局时限 10 分钟
const COOP_TURN_MS = 60 * 1000;         // 合作单步时限 60s，超时自动过回合
const SLOT_RETRY = 20;                  // 对抗式下两题槽位数对齐的最大尝试次数

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
  }

  roomOf(client) {
    const id = this.memberOf.get(client.id);
    return id ? this.rooms.get(id) || null : null;
  }

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
    const res = validateGuess({ symbols, difficulty: room.difficulty, answer: me.eq.answer });
    if (!res.ok) return client.send({ type: 'error', message: res.reason });

    if (room.mode === 'coop') {
      // 合作：共享历史，步数=团队已猜次数（无步数上限）
      room.sharedHistory.push({ guess: symbols, feedback: res.feedback });
      const steps = room.sharedHistory.length;
      if (res.correct) { room.winner = 'team'; return this.end(room, 'coop_win'); }

      room.turnIndex = 1 - myIdx;
      this.broadcast(room, {
        type: 'room_state',
        history: room.sharedHistory.map((h) => ({ guess: h.guess, feedback: h.feedback })),
        steps,
        turnIndex: room.turnIndex,
      });
      this.scheduleTurnPass(room);
    } else {
      // 对抗：各自历史，反馈只发给本人，对手只看到进度
      me.steps++;
      me.history.push({ guess: symbols, feedback: res.feedback });
      if (res.correct) { room.winner = myIdx; return this.end(room, 'pvp_win'); }

      client.send({ type: 'guess_result', feedback: res.feedback, steps: me.steps, correct: false });
      const opp = room.players[1 - myIdx];
      if (opp.client.ws.readyState === 1) {
        opp.client.send({ type: 'opponent_update', steps: me.steps, status: 'playing' });
      }
    }
  }

  // 玩家离开（主动 leave 或断线）
  leave(client) {
    const room = this.roomOf(client);
    if (!room) return;
    if (room.status !== 'playing') return this.cleanup(room);

    const myIdx = room.players.findIndex((p) => p.client.id === client.id);
    if (room.mode === 'coop') {
      // 合作中途离场 → 对局作废，不记成绩
      room.status = 'done';
      const other = room.players[1 - myIdx];
      other.client.send({
        type: 'game_over',
        outcome: 'aborted',
        reason: '队友离开，对局取消',
        steps: room.sharedHistory.length,
        answer: other.eq.answer,
        seed: other.eq.seed,
      });
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

    const [a, b] = room.players;
    const sendOver = (p, outcome, reason) => {
      p.client.send({
        type: 'game_over',
        outcome,
        reason,
        mode: room.mode,
        difficulty: room.difficulty,
        steps: room.mode === 'coop' ? room.sharedHistory.length : p.steps,
        opponentSteps: room.mode === 'coop' ? room.sharedHistory.length : room.players.find((x) => x !== p).steps,
        answer: p.eq.answer,
        seed: p.eq.seed,
        winner: room.winner,
      });
    };

    switch (kind) {
      case 'pvp_win': {
        const w = room.players[room.winner];
        const l = room.players[1 - room.winner];
        sendOver(w, 'win', '你破解了等式');
        sendOver(l, 'lose', '对手先破解了等式');
        break;
      }
      case 'coop_win':
        sendOver(a, 'win', '合作成功');
        sendOver(b, 'win', '合作成功');
        break;
      case 'timeout': {
        if (room.mode === 'pvp') {
          if (a.steps === b.steps) {
            sendOver(a, 'draw', '时间到，双方平局');
            sendOver(b, 'draw', '时间到，双方平局');
          } else {
            const w = a.steps < b.steps ? 0 : 1;
            const l = 1 - w;
            sendOver(room.players[w], 'win', '时间到，你步数更少');
            sendOver(room.players[l], 'lose', '时间到，对手步数更少');
          }
        } else {
          sendOver(a, 'lose', '时间到');
          sendOver(b, 'lose', '时间到');
        }
        break;
      }
      case 'forfeit': {
        const w = room.players[room.winner];
        const l = room.players[1 - room.winner];
        sendOver(w, 'win', '对手离开了，你获胜');
        if (l.client.ws.readyState === 1) sendOver(l, 'lose', '你离开了对局');
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
      room.turnIndex = 1 - room.turnIndex;
      this.broadcast(room, {
        type: 'room_state',
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
    for (const p of room.players) this.memberOf.delete(p.client.id);
    this.rooms.delete(room.id);
  }
}
