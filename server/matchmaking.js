// 匹配队列：按 (模式:难度) 排队，满 2 人开房
const DIFFICULTIES = ['beginner', 'easy', 'medium', 'hard', 'expert'];
const MODES = ['pvp', 'coop'];

export class Matchmaking {
  constructor() {
    this.queues = new Map();     // `${mode}:${difficulty}` -> client[]
    this.clientQueue = new Map(); // client.id -> queueKey
    this.onMatch = null;          // (clientA, clientB, {mode, difficulty}) => room
  }

  add(client, msg) {
    const { mode, difficulty } = msg || {};
    if (!MODES.includes(mode) || !DIFFICULTIES.includes(difficulty)) {
      return client.send({ type: 'error', message: '匹配参数不合法' });
    }
    // 已在其它队列则先移除
    this.remove(client);

    const key = `${mode}:${difficulty}`;
    let q = this.queues.get(key);
    if (!q) { q = []; this.queues.set(key, q); }
    this.clientQueue.set(client.id, key);
    q.push(client);

    client.send({ type: 'queued', mode, difficulty });
    this.tryMatch(key);
  }

  remove(client) {
    const key = this.clientQueue.get(client.id);
    if (!key) return;
    const q = this.queues.get(key);
    if (q) {
      const i = q.indexOf(client);
      if (i >= 0) q.splice(i, 1);
      if (q.length === 0) this.queues.delete(key);
    }
    this.clientQueue.delete(client.id);
  }

  tryMatch(key) {
    const q = this.queues.get(key);
    if (!q || q.length < 2) return;

    const a = q.shift();
    const b = q.shift();
    this.clientQueue.delete(a.id);
    this.clientQueue.delete(b.id);
    if (q.length === 0) this.queues.delete(key);

    const [mode, difficulty] = key.split(':');
    if (this.onMatch) this.onMatch(a, b, { mode, difficulty });
  }
}
