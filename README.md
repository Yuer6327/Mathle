# MathWordle 数学版 Wordle

猜等式的数学 Wordle。支持单人、人机、**联机对战**（1v1 对抗 / 合作）。

🔗 在线试玩：<https://wordle.yuer6327.top>

## 玩法

- 根据难度生成一条带隐藏槽位的等式（如 `3 × ? = ?`）
- 每步用给定符号池填入猜测，得到 Wordle 式反馈（🟩🟨⬜）
- **对抗(pvp)**：各自答案，同时玩，先破解者胜
- **合作(coop)**：共享等式，轮流猜，破解即胜（无步数上限）

## 架构

```
前端 (Vite + React + Tailwind)  →  Cloudflare Worker
                                   ├─ 静态资源（SPA）
                                   ├─ /api/*（认证 JWT + D1 排行榜 + /api/ws-ticket）
                                   └─ D1 SQLite
联机同步  →  VPS WebSocket（wss://api.yuer6327.top/ws，经 Cloudflare 橙云）
             ├─ 匹配队列 / 房间状态机 / 服务端权威猜词校验（复用 src/lib 纯 JS）
             └─ 同一 JWT_SECRET 验证 60s 短时效 ticket
```

## 目录

| 路径 | 说明 |
|------|------|
| `src/` | 前端 + Worker 入口（`src/worker.js` 手动路由 /api/*） |
| `functions/api/` | 各 API handler（含 `ws-ticket.js`） |
| `server/` | VPS 联机 WebSocket 服务（部署到 VPS，不在 CF） |
| `migrations/` | D1 SQL |
| `scripts/deploy-vps.sh` | 一键部署 VPS 联机服务 |
| `.github/workflows/deploy.yml` | push 到 main 自动部署到 Cloudflare |

## 开发

```bash
npm install
npm run dev        # 仅前端
npm run dev:full   # 前端 + API（wrangler dev）
cd server && npm install && node smoke.mjs   # 联机服务冒烟测试
```

## 部署

- **Cloudflare**：push 到 `main` 自动触发 GitHub Actions 部署
- **VPS 联机服务**：`VPS_SSH_PASS=... bash scripts/deploy-vps.sh`（详见 `server/README.md`）
