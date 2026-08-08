// 好友房间冒烟测试（本地）：游客身份 → 建房 → 加入 → 开始 → 多人回合轮转 → 房主转移 → 合作获胜
// 用法: cd server && node room-smoke.mjs
import assert from 'node:assert';
import { WebSocket } from 'ws';
import { signJWT } from '../functions/api/_lib/jwt.js';
import { botGuess } from '../src/lib/bot.js';
import { createRNG, makeRNGHelpers } from '../src/lib/seededRandom.js';

process.env.JWT_SECRET = 'smoke-test-secret';
process.env.PORT = '8098';
process.env.ALLOWED_ORIGINS = 'http://localhost:8090';
await import('./index.js');
await new Promise((r) => setTimeout(r, 400));

const SECRET = 'smoke-test-secret';
const WS_URL = (tk) => `ws://127.0.0.1:8098/ws?ticket=${encodeURIComponent(tk)}`;
const ticket = (sub, nickname) =>
  signJWT({ sub, nickname, scope: 'ws', iat: Date.now(), exp: Date.now() + 60000 }, SECRET);

let step = 0;
const ok = (name) => console.log(`  ✓ ${++step}. ${name}`);

async function connect(sub, nickname) {
  const tk = await ticket(sub, nickname);
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL(tk));
    const state = { msgs: [], waiters: [], closed: false };
    const api = {
      ws,
      send: (m) => ws.send(JSON.stringify(m)),
      // 按类型消费（首个匹配，可能是旧消息）
      waitFor: (type, timeout = 8000) =>
        new Promise((res, rej) => {
          const idx = state.msgs.findIndex((m) => m.type === type);
          if (idx >= 0) return res(state.msgs.splice(idx, 1)[0]);
          const t = setTimeout(() => rej(new Error(`等待 ${type} 超时; 已收到: ${state.msgs.map((m) => m.type).join(',')}`)), timeout);
          state.waiters.push((m) => {
            if (m.type === type) { clearTimeout(t); res(m); return true; }
            return false;
          });
        }),
      // 按条件消费（会跳过不匹配的旧消息，直到命中）
      waitForCond: (pred, timeout = 8000, label = '条件') =>
        new Promise((res, rej) => {
          const idx = state.msgs.findIndex(pred);
          if (idx >= 0) return res(state.msgs.splice(idx, 1)[0]);
          const t = setTimeout(() => rej(new Error(`等待${label}超时; 已收到: ${state.msgs.map((m) => `${m.type}:${JSON.stringify(m).slice(0, 40)}`).join(',')}`)), timeout);
          state.waiters.push((m) => {
            if (pred(m)) { clearTimeout(t); res(m); return true; }
            return false;
          });
        }),
      on: (type, fn) => {
        state.waiters.push((m) => {
          if (m.type === type) fn(m);
          return false;
        });
      },
    };
    ws.on('message', (d) => {
      let m; try { m = JSON.parse(d.toString()); } catch { return; }
      const keep = [];
      let consumed = false;
      for (const w of state.waiters) {
        if (consumed) { keep.push(w); continue; }
        if (w(m)) consumed = true; else keep.push(w);
      }
      state.waiters = keep;
      if (!consumed) state.msgs.push(m);
    });
    ws.on('open', () => resolve(api));
    ws.on('error', reject);
  });
}

const waitTurn = (c, turn) => c.waitForCond((m) => m.type === 'room_state' && m.turnIndex === turn, 8000, `轮到${turn}`);
const waitLobby = (c, n) => c.waitForCond((m) => m.type === 'room_state' && m.status === 'lobby' && m.players?.length === n, 8000, `大厅${n}人`);

console.log('== 1. 游客身份可连接 ==');
const G = await connect('anon:guest-test-0001', '游客ABCD');
const connMsg = await G.waitFor('connected');
assert.equal(connMsg.id, 'anon:guest-test-0001');
assert.equal(connMsg.nickname, '游客ABCD');
ok('游客 ticket（anon 身份）可建立连接并拿到 id');

console.log('== 2. 建房 + 加入（3 人）==');
const H = await connect('user-host', '房东');
await H.waitFor('connected');
H.send({ type: 'create_room', mode: 'coop', difficulty: 'hard' });
const rc = await H.waitFor('room_created');
assert.match(rc.code, /^[A-Z2-9]{6}$/, '房号应为 6 位');
await waitLobby(H, 1);
ok(`创建房间成功，房号 ${rc.code}，大厅 1 人`);

G.send({ type: 'join_room', code: rc.code });
await G.waitFor('room_joined');
await waitLobby(H, 2);
await waitLobby(G, 2);
ok('第二位加入，双方看到 2 名玩家');

const F = await connect('user-friend', '朋友F');
await F.waitFor('connected');
F.send({ type: 'join_room', code: rc.code });
await F.waitFor('room_joined');
await waitLobby(H, 3);
await waitLobby(G, 3);
const rsF = await waitLobby(F, 3);
assert.deepEqual(rsF.players.map((p) => p.nickname), ['房东', '游客ABCD', '朋友F']);
ok('第三位加入，3 名玩家');

console.log('== 3. 非法操作被拒 / 房主开始 ==');
const BAD = await connect('user-bad', '路人');
await BAD.waitFor('connected');
BAD.send({ type: 'join_room', code: 'XXXXXX' });
assert.equal((await BAD.waitFor('error')).message, '房间不存在或已结束');
BAD.ws.close();
ok('错误房号被拒绝');

G.send({ type: 'start_room' });
assert.equal((await G.waitFor('error')).message, '只有房主可以开始');
ok('非房主 start 被拒绝');

H.send({ type: 'start_room' });
const [hs, gs, fs] = await Promise.all([
  H.waitFor('room_started'),
  G.waitFor('room_started'),
  F.waitFor('room_started'),
]);
assert.equal(hs.yourIndex, 0); assert.equal(gs.yourIndex, 1); assert.equal(fs.yourIndex, 2);
assert.equal(hs.equation.answerLength, gs.equation.answerLength);
assert.deepEqual(hs.equation.tokens, gs.equation.tokens, '房间内共享同一等式');
assert.equal(hs.turnIndex, 0);
const hidden = hs.equation.tokens.filter((t) => t.hidden);
assert.ok(hidden.length > 0);
assert.ok(hidden.every((t) => t.symbol === null), '隐藏槽 symbol 应为 null');
assert.ok(!('seed' in hs.equation));
ok('房主开始，3 人共享等式且答案隐藏');

console.log('== 4. 多人回合轮转 ==');
const len = hs.equation.answerLength;
const fill = (s) => new Array(len).fill(s);
H.send({ type: 'guess', symbols: fill('1') });
await waitTurn(H, 1);
G.send({ type: 'guess', symbols: fill('2') });
await waitTurn(G, 2);
F.send({ type: 'guess', symbols: fill('3') });
await waitTurn(F, 0);
ok('3 人轮流猜，回合正确轮转回到房主');

G.send({ type: 'guess', symbols: fill('1') });
assert.equal((await G.waitFor('error')).message, '还没轮到你的回合');
ok('非当前回合被拒绝');

console.log('== 5. 房主（合作）中途离开 → 作废 ==');
const overF = F.waitFor('game_over');
H.ws.close();
const ab = await overF;
assert.equal(ab.outcome, 'aborted');
ok('合作房主离开 → 对局作废（F 收到）');
G.ws.close(); F.ws.close();

console.log('== 6. 大厅房主转移 ==');
const H2 = await connect('user-host2', '房东2');
const K = await connect('user-k', '好友K');
const L = await connect('user-l', '好友L');
await H2.waitFor('connected'); await K.waitFor('connected'); await L.waitFor('connected');
H2.send({ type: 'create_room', mode: 'coop', difficulty: 'easy' });
const rc2 = await H2.waitFor('room_created');
K.send({ type: 'join_room', code: rc2.code }); await K.waitFor('room_joined');
L.send({ type: 'join_room', code: rc2.code }); await L.waitFor('room_joined');
await waitLobby(H2, 3); await waitLobby(K, 3); await waitLobby(L, 3);
ok('新房间 3 人');

// 房主离开大厅 → 房主转移给第一个剩余玩家
const hostTransfer = K.waitForCond((m) => m.type === 'room_state' && m.status === 'lobby' && m.hostId === 'user-k', 8000, '房主转移');
H2.ws.close();
const kHost = await hostTransfer;
assert.equal(kHost.players.length, 2);
ok('房主离开大厅 → 房主转移给 K');

K.send({ type: 'start_room' });
const [ks, ls] = await Promise.all([K.waitFor('room_started'), L.waitFor('room_started')]);
assert.equal(ks.yourIndex, 0); assert.equal(ls.yourIndex, 1);
ok('新房主可以开始对局');

console.log('== 7. 合作获胜（bot 解算）==');
const len2 = ks.equation.answerLength;
const rng = makeRNGHelpers(createRNG('room-solve'));
const historyArr = [];
let lastGuess = null;
K.on('room_state', (m) => {
  historyArr.length = 0;
  historyArr.push(...(m.history || []));
  if (m.turnIndex === 0) {
    lastGuess = botGuess(new Array(len2).fill(null), 'easy', historyArr, rng);
    K.send({ type: 'guess', symbols: lastGuess });
  }
});
L.on('room_state', (m) => {
  historyArr.length = 0;
  historyArr.push(...(m.history || []));
  if (m.turnIndex === 1) {
    L.send({ type: 'guess', symbols: new Array(len2).fill('7') });
  }
});
lastGuess = botGuess(new Array(len2).fill(null), 'easy', historyArr, rng);
K.send({ type: 'guess', symbols: lastGuess });
const [winK, winL] = await Promise.all([K.waitFor('game_over'), L.waitFor('game_over')]);
assert.equal(winK.outcome, 'win');
assert.equal(winL.outcome, 'win');
assert.equal(winL.reason, '合作成功');
assert.ok(winL.answer && winL.answer.length === len2, '结算下发答案');
ok(`合作破解成功（团队 ${winK.steps} 步）`);

console.log('\n全部通过 ✅');
H2.ws.close(); K.ws.close(); L.ws.close();
process.exit(0);
