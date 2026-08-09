#!/bin/bash
# 一键部署 MathWordle 联机服务到 NAT VPS（增量化：不影响现有 5 个服务）
#
# 用法（在本机 Git Bash）:
#   VPS_SSH_PASS='密码' bash scripts/deploy-vps.sh
#   # 或用已配置好的 SSH key: bash scripts/deploy-vps.sh
#
# 环境变量:
#   VPS_HOST      默认 104.168.76.139
#   VPS_SSH_PORT  默认 47641
#   VPS_USER      默认 root
#   VPS_SSH_PASS  SSH 密码（可选；不设则走密钥）
#   JWT_SECRET    联机用密钥（不设则自动从仓库根 .dev.vars 读取）
#
# 步骤: 上传代码 → 装 ws → 写 .env → systemd 单元 → nginx /ws 路由 → 启动
set -euo pipefail

HOST="${VPS_HOST:-104.168.76.139}"
SPORT="${VPS_SSH_PORT:-47641}"
USER="${VPS_USER:-root}"
PASS="${VPS_SSH_PASS:-}"
JWT_SECRET="${JWT_SECRET:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 1. 密钥
[ -z "$JWT_SECRET" ] && JWT_SECRET="$(grep '^JWT_SECRET=' .dev.vars | cut -d= -f2- | tr -d '\r' || true)"
if [ -z "$JWT_SECRET" ]; then
  echo "✗ 未找到 JWT_SECRET（.dev.vars 缺失或变量为空）"; exit 1
fi
echo "✓ JWT_SECRET 已就绪（长度 ${#JWT_SECRET}）"

# 2. ssh 封装
ASKPASS=""
if [ -n "$PASS" ]; then
  ASKPASS="/tmp/mw_askpass_$$"
  printf '#!/bin/bash\necho %s\n' "$PASS" > "$ASKPASS"
  chmod +x "$ASKPASS"
  SSHH() { DISPLAY=:0 SSH_ASKPASS="$ASKPASS" SSH_ASKPASS_REQUIRE=force ssh -p "$SPORT" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 "$USER@$HOST" "$@"; }
else
  SSHH() { ssh -p "$SPORT" -o BatchMode=yes -o ConnectTimeout=20 "$USER@$HOST" "$@"; }
fi
trap '[ -n "$ASKPASS" ] && rm -f "$ASKPASS"' EXIT

echo "→ 连接 $USER@$HOST:$SPORT ..."
SSHH 'echo ok' > /dev/null
echo "✓ SSH 连接正常"

# 3. 上传代码（排除 node_modules / 测试 / 密钥）
echo "→ 上传 server/ + src/lib/ 到 /opt/mathwordle ..."
mkdir -p /tmp/mw_tar 2>/dev/null || true
tar -czf - --exclude='server/node_modules' --exclude='server/smoke.mjs' --exclude='server/room-smoke.mjs' --exclude='server/.env' server src/lib | \
  SSHH 'rm -rf /opt/mathwordle && mkdir -p /opt/mathwordle && tar -xzf - -C /opt/mathwordle && echo "✓ 代码已上传"'

# 3.1 补 /opt/mathwordle/package.json，让 src/lib/*.js 按 ESM 加载（Node 18 需要）
echo "→ 写入 /opt/mathwordle/package.json (type:module) ..."
SSHH 'echo "{\"name\":\"mathwordle-server\",\"private\":true,\"type\":\"module\"}" > /opt/mathwordle/package.json && echo "✓ 已写入"'

# 4. 写 .env（密钥不落盘到本机脚本，经 stdin 传输）
echo "→ 写入 /opt/mathwordle/server/.env ..."
printf 'PORT=8082\nJWT_SECRET=%s\n' "$JWT_SECRET" | \
  SSHH 'umask 077 && cat > /opt/mathwordle/server/.env && chmod 600 /opt/mathwordle/server/.env && echo "✓ .env 已写入(600)"'

# 5. 安装 ws（免 npm）
echo "→ 安装 ws ..."
SSHH 'cd /opt/mathwordle/server && bash setup.sh'

# 6. systemd 单元
echo "→ 写入 systemd 单元 mathwordle-ws.service ..."
SSHH 'cat > /etc/systemd/system/mathwordle-ws.service <<UNIT
[Unit]
Description=MathWordle WS server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/mathwordle/server
EnvironmentFile=/opt/mathwordle/server/.env
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=3
MemoryMax=120M
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable mathwordle-ws
# enable --now 不会重启已运行的服务，必须 restart 才能真正加载新上传的代码
systemctl restart mathwordle-ws
for i in $(seq 1 10); do
  st=$(systemctl is-active mathwordle-ws || true)
  [ "$st" = "active" ] && break
  sleep 1
done
echo "mathwordle-ws: $st"'

# 7. nginx: 加 /ws → 8082（幂等）
echo "→ 配置 nginx /ws 路由 ..."
SSHH 'mkdir -p /etc/nginx/snippets
cat > /etc/nginx/snippets/mathwordle-ws.conf <<CONF
location /ws {
    proxy_pass http://127.0.0.1:8082;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    # 注意: 值不能加引号, heredoc 会保留 \" 反斜杠, nginx 发出的 Connection 头带引号
    # 导致 node 识别不了 upgrade, /ws 握手返回 404（2026-08-08 踩坑）
    proxy_set_header Connection upgrade;
    proxy_set_header Host \$host;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
CONF
for f in online-counter-tls online-counter; do
  p=/etc/nginx/sites-available/$f
  if [ -f "$p" ] && ! grep -q "snippets/mathwordle-ws.conf" "$p"; then
    cp "$p" "$p.bak-mathwordle"
    sed -i "s|server_name api.yuer6327.top;|server_name api.yuer6327.top;\n    include /etc/nginx/snippets/mathwordle-ws.conf;|" "$p"
    echo "→ 已注入 $f（备份 $p.bak-mathwordle）"
  else
    echo "→ $f 已包含或不存在，跳过"
  fi
done
nginx -t && systemctl reload nginx && echo "✓ nginx reloaded"'

echo ""
echo "✅ 部署完成"
SSHH 'echo "── 状态 ──"; systemctl is-active mathwordle-ws; curl -s http://127.0.0.1:8082/health; echo'
