# MathWordle 联机 WebSocket 服务（VPS 侧）

VPS 只负责通过 `https://api.yuer6327.top/ws` 做联机同步通讯，**不托管前端**。
本目录代码部署在 VPS，前端代码仍在 Cloudflare Worker（wordle.yuer6327.top）。

## 架构

```
浏览器 (wordle.yuer6327.top)                    VPS (NAT, 104.168.76.139)
  GET /api/ws-ticket ──→ Worker 签发 60s ticket
  wss://api.yuer6327.top/ws?ticket= ──(CF橙云→40443)──→ nginx:443
                                                        │ location /ws → 127.0.0.1:8082
                                                        └─ node index.js (systemd: mathwordle-ws.service)
                                                             匹配队列 → 房间状态机 → 服务端生成等式/校验/反馈
                                                             复用 src/lib 纯JS + 同一 JWT_SECRET
```

## 文件

| 文件 | 说明 |
|------|------|
| `index.js` | WS 入口（HTTP 升级 + ticket 鉴权 + Origin 校验 + 心跳） |
| `auth.js` | 校验 WS ticket（JWT HMAC-SHA256，`scope=ws`，60s 有效） |
| `matchmaking.js` | 按 `模式:难度` 排队，满 2 人开房 |
| `rooms.js` | 房间状态机：对抗(各自答案)/合作(共享等式轮流猜, 破解即胜) |
| `validate.js` | 服务端猜词校验（复用前端 evaluator/feedback/constants） |
| `setup.sh` | VPS 引导：免 npm，直接 curl 拉 `ws` tarball |

依赖 `../src/lib/{constants,evaluator,feedback,equationGenerator,seededRandom}.js`（纯 JS，Node 可直接 import）。

## 配置（环境变量）

| 变量 | 默认 | 说明 |
|------|------|------|
| `PORT` | `8082` | 监听端口（仅 127.0.0.1） |
| `JWT_SECRET` | 必填 | 与 Worker `/api/ws-ticket` 完全相同的密钥 |
| `ALLOWED_ORIGINS` | `https://wordle.yuer6327.top` | 允许的页面 Origin（逗号分隔） |

## 消息协议

### 客户端 → 服务端
| type | 载荷 | 说明 |
|------|------|------|
| `find` | `{mode, difficulty}` | 进入匹配队列（mode: `pvp`/`coop`） |
| `cancel_find` | - | 退出队列 |
| `guess` | `{symbols:[...]}` | 提交一次完整猜测 |
| `leave` | - | 离开对局 |

### 服务端 → 客户端
| type | 说明 |
|------|------|
| `connected` | 连接建立 `{nickname}` |
| `queued` | 已入队 `{mode, difficulty}` |
| `match_found` | 匹配成功 `{roomId, mode, difficulty, yourIndex, opponent, equation, startAt}`（隐藏槽位 symbol 已抹除） |
| `guess_result` | 对抗：本次猜测反馈 `{feedback, steps, correct}` |
| `room_state` | 合作：共享历史 + 回合 `{history, steps, turnIndex, timeoutNotice?}` |
| `opponent_update` | 对抗：对手进度 `{steps, status}` |
| `game_over` | 对局结束 `{outcome, reason, steps, opponentSteps, answer, seed, winner}` |
| `error` | 错误 `{message}` |

## 部署

见仓库根目录 `scripts/deploy-vps.sh`（tar-over-ssh 上传 + systemd + nginx）。
