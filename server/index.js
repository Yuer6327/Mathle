// MathWordle 联机 WebSocket 服务入口
// 仅监听本机端口（默认 8082），由 nginx 反代 api.yuer6327.top/ws → 本服务
// 鉴权：wss://.../ws?ticket=xxx，ticket 由 Worker /api/ws-ticket 用同一 JWT_SECRET 签发
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { verifyTicket } from './auth.js';
import { Matchmaking } from './matchmaking.js';
import { Rooms } from './rooms.js';

const PORT = Number(process.env.PORT || 8082);
const JWT_SECRET = process.env.JWT_SECRET || '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://wordle.yuer6327.top')
  .split(',').map((s) => s.trim()).filter(Boolean);
const DEV_ORIGIN_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

if (!JWT_SECRET) {
  console.error('[mathwordle-ws] 缺少 JWT_SECRET，拒绝启动');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

const wss = new WebSocketServer({ noServer: true });
const matchmaking = new Matchmaking();
const rooms = new Rooms();
matchmaking.onMatch = (a, b, info) => rooms.create([a, b], info);

// HTTP → WebSocket 升级 + 鉴权
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/ws') return socket.destroy();

  const user = verifyTicket(url.searchParams.get('ticket'), JWT_SECRET);
  if (!user) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    return socket.destroy();
  }

  // 防跨站 WebSocket 劫持（CSWSH）
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin) && !DEV_ORIGIN_RE.test(origin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    return socket.destroy();
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req, { user });
  });
});

wss.on('connection', (ws, req, { user }) => {
  const client = {
    id: user.sub,
    nickname: user.nickname || '玩家',
    ws,
  };
  client.send = (msg) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };
  ws._client = client;
  ws._alive = true;
  ws.on('pong', () => { ws._alive = true; });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return client.send({ type: 'error', message: '消息格式错误' });
    }
    handleMessage(client, msg);
  });

  ws.on('close', () => {
    matchmaking.remove(client);
    rooms.leave(client);
  });
  ws.on('error', () => {});

  client.send({ type: 'connected', nickname: client.nickname, id: client.id });
});

function handleMessage(client, msg) {
  switch (msg.type) {
    case 'find': return matchmaking.add(client, msg);
    case 'cancel_find': return matchmaking.remove(client);
    case 'create_room': return rooms.createPrivate(client, msg);
    case 'join_room': return rooms.joinPrivate(client, msg.code);
    case 'start_room': return rooms.startPrivate(client);
    case 'guess': return rooms.guess(client, msg);
    case 'leave': return rooms.leave(client);
    default: return client.send({ type: 'error', message: '未知消息类型' });
  }
}

// 心跳保活：Cloudflare 代理空闲 100s 会断连，30s ping 一轮
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.readyState !== 1) continue;
    if (ws._alive === false) {
      ws.terminate();
      continue;
    }
    ws._alive = false;
    ws.ping();
  }
}, 30000);
heartbeat.unref?.();

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mathwordle-ws] 监听 127.0.0.1:${PORT}`);
});
