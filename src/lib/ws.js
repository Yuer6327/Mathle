// WebSocket 联机客户端：先经 Worker 换 60s ticket，再连 VPS 的 /ws
import { api } from './api.js';

const WS_URL = import.meta.env.VITE_WS_URL || 'wss://api.yuer6327.top/ws';

/**
 * 建立联机连接
 * @param {{onMessage?:function, onClose?:function, onError?:function}} handlers
 * @returns {Promise<{send:function, close:function, readyState:()=>number}>}
 */
export async function connectMatch({ onMessage, onClose, onError } = {}) {
  // 1. 用 HttpOnly Cookie 换 60s ticket
  const { ticket } = await api.wsTicket();
  // 2. 建立 WebSocket（带 ticket）
  const ws = new WebSocket(`${WS_URL}?ticket=${encodeURIComponent(ticket)}`);

  await new Promise((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error('无法连接联机服务器'));
  });

  ws.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg && typeof msg.type === 'string') onMessage && onMessage(msg);
  };
  ws.onclose = () => onClose && onClose();
  ws.onerror = () => onError && onError(new Error('连接中断'));

  return {
    send: (msg) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    close: () => ws.close(),
    readyState: () => ws.readyState
  };
}
