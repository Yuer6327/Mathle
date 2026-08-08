// 联机服务冒烟测试（本地）：模拟真实玩家跑通 匹配 → 对局 → 胜负 / 回合轮转 / 离场
// 用法: cd server && node smoke.mjs
import assert from 'node:assert';
import { WebSocket } from 'ws';
import { signJWT } from '../functions/api/_lib/jwt.js';
import { botGuess } from '../src/lib/bot.js';
import { createRNG, makeRNGHelpers } from '../src/lib/seededRandom.js';

process.env.JWT_SECRET = 'smoke-test-secret';
process.env.PORT = '8099';
process.env.ALLOWED_ORIGINS = 'http://localhost:8090';
await import('./index.js');
await new Promise((r) => setTimeout(r, 400));

const SECRET = 'smoke-test-secret';
const WS_URL = (sub) => `ws://127.0.0.1:8099/ws?ticket=${encodeURIComponent(sub)}`;
const ticket = (sub, nickname) =>
  signJWT({ sub, nickname, scope: 'ws', iat: Date.now(), exp: Date.now() + 60000 }, SECRET);

let step = 0;
const ok = (name) => console.log(`  ✓ ${++step}. ${name}`);

// 通用连接助手
async function connect(sub, nickname) {
  const tk = await ticket(sub, nickname); // signJWT 是 async，必须先 await
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL(tk));
    const state = { msgs: [], waiters: [], closed: false };
    const api = {
      ws,
      send: (m) => ws.send(JSON.stringify(m)),
      // 消费式等待：匹配到的消息从队列移除，避免重复取到旧消息
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
      // 持续监听（不消费消息，消息仍会进队列）
      on: (type, fn) => {
        state.waiters.push((m) => {
          if (m.type === type) fn(m);
          return false;
        });
      },
      peek: () => state.msgs.map((m) => m.type),
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
    ws.on('close', () => { state.closed = true; api.closed = true; });
    ws.on('error', reject);
  });
}

function waitMs(ms) { return new Promise((r) => setTimeout(r, ms)); }

console.log('== 1. 鉴权 ==');
// 坏 ticket 拒绝（ws 在非 101 响应时，有 unexpected-response 监听则不再抛 error）
await new Promise((resolve) => {
  const bad = new WebSocket(WS_URL('garbage-ticket'));
  let settled = false;
  const done = () => { if (!settled) { settled = true; resolve(); } };
  bad.on('error', (err) => { assert.match(String(err.message), /401/); done(); });
  bad.on('unexpected-response', (_req, res) => { assert.equal(res.statusCode, 401); done(); });
  setTimeout(done, 3000);
});
ok('无 ticket / 非法 ticket 返回 401');

const A = await connect('user-a', '阿A');
const B = await connect('user-b', '阿B');
assert.equal((await A.waitFor('connected')).nickname, '阿A');
ok('合法 ticket 建立连接');

console.log('== 2. 对抗匹配 ==');
A.send({ type: 'find', mode: 'pvp', difficulty: 'beginner' });
assert.equal((await A.waitFor('queued')).difficulty, 'beginner');
B.send({ type: 'find', mode: 'pvp', difficulty: 'beginner' });
const ma = await A.waitFor('match_found');
const mb = await B.waitFor('match_found');
assert.equal(ma.roomId, mb.roomId);
assert.equal(ma.yourIndex, 0); assert.equal(mb.yourIndex, 1);
assert.equal(ma.opponent.nickname, '阿B');
assert.equal(ma.mode, 'pvp');
// 等式已下发且隐藏答案：隐藏槽 symbol 为 null，且不带 seed
assert.ok(ma.equation && ma.equation.tokens.length > 0);
const hidden = ma.equation.tokens.filter((t) => t.hidden);
assert.ok(hidden.length > 0, '应有隐藏槽位');
assert.ok(hidden.every((t) => t.symbol === null), '隐藏槽 symbol 应为 null');
assert.ok(hidden.every((t) => t.symbolType), '隐藏槽应带 symbolType');
assert.ok(!('seed' in ma.equation), '不应下发 seed');
ok('匹配成功，等式隐藏答案、不带 seed');

console.log('== 3. 对抗：无效猜词被拒 / 合法猜词有反馈 / bot 解算获胜 ==');
const badGuess = new Array(ma.equation.answerLength).fill('?'); // '?' 非法
A.send({ type: 'guess', symbols: badGuess });
assert.equal((await A.waitFor('error')).message, '包含非法符号');
ok('非法符号被拒绝');

// bot 只靠反馈历史解题（beginner 答案只含 1-9 + -，与 bot 池一致）
const answerLen = ma.equation.answerLength;
let lastGuess = null;
const myHistory = [];
const rng = makeRNGHelpers(createRNG('smoke-solve'));
const fakeAnswer = new Array(answerLen).fill(null);
A.on('guess_result', (m) => {
  if (lastGuess) myHistory.push({ guess: lastGuess, feedback: m.feedback });
  lastGuess = botGuess(fakeAnswer, 'beginner', myHistory, rng);
  A.send({ type: 'guess', symbols: lastGuess });
});
lastGuess = botGuess(fakeAnswer, 'beginner', myHistory, rng);
A.send({ type: 'guess', symbols: lastGuess });
const [winA, loseB] = await Promise.all([
  A.waitFor('game_over'),
  B.waitFor('game_over')
]);
assert.equal(winA.outcome, 'win');
assert.equal(loseB.outcome, 'lose');
assert.equal(loseB.reason, '对手先破解了等式');
assert.ok(winA.answer && winA.answer.length === answerLen, '结算应下发答案');
assert.ok(winA.seed, '结算应下发 seed 供统计');
assert.ok(loseB.opponentSteps >= 1);
ok(`bot ${winA.steps} 步解出，A 胜 B 负（答案 ${winA.answer.join('')}）`);

console.log('== 4. 合作：共享等式 + 回合轮转 + 离场作废 ==');
const C = await connect('user-c', '阿C');
const D = await connect('user-d', '阿D');
C.send({ type: 'find', mode: 'coop', difficulty: 'medium' });
D.send({ type: 'find', mode: 'coop', difficulty: 'medium' });
const mc = await C.waitFor('match_found');
const md = await D.waitFor('match_found');
assert.equal(mc.roomId, md.roomId);
assert.equal(mc.equation.answerLength, md.equation.answerLength);
assert.deepEqual(mc.equation.tokens, md.equation.tokens, 'coop 应共享同一等式');
assert.equal(mc.yourIndex, 0); assert.equal(md.yourIndex, 1);
ok('合作匹配成功，双方拿到相同等式');

const coopLen = mc.equation.answerLength;
const fill = (s) => new Array(coopLen).fill(s);
// C 先手猜（错）
C.send({ type: 'guess', symbols: fill('1') });
const rs1 = await C.waitFor('room_state');
assert.equal(rs1.turnIndex, 1);
ok('C 猜完轮到 D');
// C 回合外再猜 → 拒绝
C.send({ type: 'guess', symbols: fill('1') });
assert.equal((await C.waitFor('error')).message, '还没轮到你的回合');
ok('非当前回合被拒绝');
// D 猜（错）→ 回到 C
D.send({ type: 'guess', symbols: fill('2') });
const rs2 = await C.waitFor('room_state');
assert.equal(rs2.turnIndex, 0);
assert.equal(rs2.steps, 2);
ok('D 猜完回到 C，共享步数 2');
// D 中途离开 → C 收到作废
const overC = C.waitFor('game_over');
D.ws.close();
const ab = await overC;
assert.equal(ab.outcome, 'aborted');
ok('合作一方离开 → 对局作废');

console.log('== 5. 离队取消匹配 ==');
const E = await connect('user-e', '阿E');
E.send({ type: 'find', mode: 'pvp', difficulty: 'easy' });
await E.waitFor('queued');
E.send({ type: 'cancel_find' });
await waitMs(300);
// 取消后重新匹配，应能正常成对
E.send({ type: 'find', mode: 'pvp', difficulty: 'easy' });
const F = await connect('user-f', '阿F');
F.send({ type: 'find', mode: 'pvp', difficulty: 'easy' });
const meE = await E.waitFor('match_found');
const meF = await F.waitFor('match_found');
assert.equal(meE.roomId, meF.roomId, '重新匹配后应配对到同一房间');
ok('取消匹配后重新匹配正常');

console.log('\n全部通过 ✅');
A.ws.close(); B.ws.close(); C.ws.close(); E.ws.close(); F.ws.close();
process.exit(0);
