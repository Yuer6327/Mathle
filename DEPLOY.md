# MathWordle v2.0 部署指南

## 架构

```
前端 (Vite + React + Tailwind) → Cloudflare Worker（静态资源 assets + SPA 回退）
API  (Worker 路由)               → 同域名 /api/* 路由，复用 functions/ 处理函数
DB   (D1 SQLite, APAC)          → 用户、游戏记录、排行榜
认证  (JWT HMAC-SHA256)           → HttpOnly Cookie，无第三方依赖
```

## 前置条件

- Cloudflare 账号（免费计划即可）
- npm Node ≥ 18

---

## 部署步骤

### 1. 安装依赖

```bash
cd mathwordle
npm install
```

### 2. 创建 D1 数据库

```bash
npx wrangler d1 create mathwordle
```

命令输出会显示 `database_id`，类似：
```
✅ Successfully created DB 'mathwordle'
database_id = "xxxx-xxxx-xxxx-xxxx-xxxx"
```

### 3. 填入 database_id

编辑 `wrangler.toml`，把 `YOUR_DATABASE_ID_HERE` 替换为上一步得到的 ID：

```toml
[[d1_databases]]
binding = "DB"
database_name = "mathwordle"
database_id = "xxxx-xxxx-xxxx-xxxx-xxxx"  ← 改这里
```

### 4. 执行数据库迁移

```bash
# 远端（生产环境）
npx wrangler d1 execute mathwordle --remote --file=migrations/0001_init.sql

# 本地（开发测试）
npx wrangler d1 execute mathwordle --local --file=migrations/0001_init.sql
```

### 5. 设置 JWT 密钥

```bash
# 生成随机密钥
echo $(openssl rand -base64 32)

# 设为 Worker secret（首次部署后执行）
npx wrangler secret put JWT_SECRET
# 粘贴上一步生成的密钥，回车
```

> ⚠️ 本地开发时，创建 `.dev.vars` 文件写入：`JWT_SECRET=your-secret-here`

### 6. 构建并部署

```bash
# 一键构建+部署
npm run deploy
# 等价于: npm run build && wrangler deploy

# 或分步执行
npm run build           # 构建前端到 dist/
npx wrangler deploy     # 部署 Worker（含静态资源 assets + 路由）
```

`wrangler deploy` 会同时上传 Worker 脚本、`dist/` 静态资源，并挂载 `wrangler.toml` 里的路由。

### 7. 绑定自定义域名

自定义路由已写在 `wrangler.toml`：

```toml
[[routes]]
pattern = "wordle.yuer6327.top/*"
zone_id = "a7aa2aef32198c741273fe14173ebb59"
```

要求该域名的 DNS 记录在 Cloudflare 上是**代理状态（橙色云朵）**，路由会自动接管流量，CNAME 目标指向谁不重要。

### 8. 验证

- 访问 `https://wordle.yuer6327.top` → 看到主菜单
- 注册账号 → 登录 → 玩一局 → 查看排行榜

---

## 本地开发

```bash
# 仅前端（无 API）
npm run dev

# 前端 + API（完整本地环境，静态 dist + Worker 路由 + 本地 D1）
npm run dev:full
# 等价于: wrangler dev
# 先跑 npm run build 再启动，前端改动后需重新 build

# 前端 + API + HMR（双终端，推荐日常开发）
# 终端 1:
npm run dev
# 终端 2:
npx wrangler dev --proxy 5173
# wrangler 在 127.0.0.1:8787 提供 Worker API + D1，并把页面请求代理到 vite 的 5173 端口
```

---

## 文件结构

```
mathwordle/
├── functions/                    ← Pages Functions (API)
│   └── api/
│       ├── _middleware.js        ← CORS 中间件
│       ├── _lib/
│       │   ├── jwt.js            ← JWT 签发/验证
│       │   ├── crypto.js         ← PBKDF2 密码哈希
│       │   └── response.js       ← JSON 响应工具
│       ├── auth/
│       │   ├── register.js       ← POST /api/auth/register
│       │   ├── login.js          ← POST /api/auth/login
│       │   └── me.js             ← GET  /api/auth/me
│       ├── stats.js              ← GET/POST /api/stats
│       └── leaderboard/
│           └── [difficulty].js   ← GET /api/leaderboard/:difficulty
├── migrations/
│   └── 0001_init.sql             ← D1 初始化 SQL
├── src/
│   ├── worker.js                  ← Worker 入口（路由 /api/* + 静态资源转发）
│   ├── lib/
│   │   ├── evaluator.js          ← 表达式解析器
│   │   ├── equationGenerator.js  ← 等式生成
│   │   ├── feedback.js           ← Wordle 反馈算法
│   │   ├── bot.js                ← Bot AI
│   │   ├── storage.js            ← localStorage
│   │   ├── api.js                ← API 客户端
│   │   └── constants.js          ← 难度/符号配置
│   ├── hooks/
│   │   ├── useGame.js            ← 游戏状态
│   │   └── useAuth.jsx           ← 认证状态
│   └── components/               ← UI 组件
├── wrangler.toml                 ← Cloudflare 配置（Worker + assets + D1 + 路由）
└── package.json
```

---

## API 文档

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | /api/auth/register | ❌ | 注册：`{nickname, password}` → `{token, user}` |
| POST | /api/auth/login | ❌ | 登录：`{nickname, password}` → `{token, user}` |
| GET | /api/auth/me | Cookie | 获取当前用户 |
| GET | /api/stats | ✅ | 获取云端统计 |
| POST | /api/stats | ✅ | 提交游戏记录 |
| GET | /api/leaderboard/:difficulty | ❌ | 排行榜（前50名） |

---

## 安全说明

- **密码**：PBKDF2-SHA256，5000 次迭代，16 字节随机盐
- **JWT**：HMAC-SHA256，30 天有效期，HttpOnly+Secure+SameSite=Strict Cookie
- **CORS**：允许所有源（可收紧为 `wordle.yuer6327.top`）
- **无 eval**：表达式解析器为递归下降 parser，不执行用户输入

---

## 后续阶段

Phase 3（VPS WebSocket 联机）需要：
- VPS 上运行 WebSocket 服务（可复用已有 Redis）
- `api.yuer6327.top/ws` 反向代理
- 前端添加 WebSocket 客户端
- 房间/匹配/对抗/合作模式
