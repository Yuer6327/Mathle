#!/bin/bash
# MathWordle 联机服务 VPS 引导脚本（免 npm：直接拉 ws tarball，零系统包改动）
# 用法: cd server && bash setup.sh
set -euo pipefail

WS_VERSION="${WS_VERSION:-8.21.3}"
DIR="$(cd "$(dirname "$0")" && pwd)"

# 确保 ws 就位（ws 无运行时依赖，单包即可）
if [ ! -d "$DIR/node_modules/ws" ]; then
  echo "[setup] 下载 ws@${WS_VERSION} ..."
  mkdir -p "$DIR/node_modules"
  TMP="$(mktemp -d)"
  curl -fsSL "https://registry.npmjs.org/ws/-/ws-${WS_VERSION}.tgz" | tar -xz -C "$TMP"
  mv "$TMP/package" "$DIR/node_modules/ws"
  rm -rf "$TMP"
  # 写入版本标记，方便核对
  node -e "const p=require('$DIR/node_modules/ws/package.json'); console.log('[setup] ws', p.version, 'ok')" || true
else
  echo "[setup] ws 已存在"
fi

echo "[setup] 完成。启动: PORT=8082 JWT_SECRET=xxx node index.js"
