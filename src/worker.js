// Cloudflare Worker 入口
// 静态资源（dist/）由 assets 绑定提供，/api/* 由下方路由分发到现有 Pages Functions 处理函数
import { onRequestPost as registerPost } from '../functions/api/auth/register.js';
import { onRequestPost as loginPost } from '../functions/api/auth/login.js';
import { onRequestPost as logoutPost } from '../functions/api/auth/logout.js';
import { onRequestGet as meGet } from '../functions/api/auth/me.js';
import { onRequestGet as statsGet, onRequestPost as statsPost } from '../functions/api/stats.js';
import { onRequestGet as leaderboardGet } from '../functions/api/leaderboard/[difficulty].js';
import { onRequestGet as wsTicketGet } from '../functions/api/ws-ticket.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Cookie',
  'Access-Control-Allow-Credentials': 'true'
};

function withCors(response) {
  if (response instanceof Response) {
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      response.headers.set(k, v);
    }
  }
  return response;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    // OPTIONS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const ctx = { request, env, params: {} };
    let response;

    if (pathname === '/api/auth/register' && request.method === 'POST') {
      response = await registerPost(ctx);
    } else if (pathname === '/api/auth/login' && request.method === 'POST') {
      response = await loginPost(ctx);
    } else if (pathname === '/api/auth/logout' && request.method === 'POST') {
      response = await logoutPost(ctx);
    } else if (pathname === '/api/auth/me' && request.method === 'GET') {
      response = await meGet(ctx);
    } else if (pathname === '/api/ws-ticket' && request.method === 'GET') {
      response = await wsTicketGet(ctx);
    } else if (pathname === '/api/stats' && request.method === 'GET') {
      response = await statsGet(ctx);
    } else if (pathname === '/api/stats' && request.method === 'POST') {
      response = await statsPost(ctx);
    } else if (pathname.startsWith('/api/leaderboard/') && request.method === 'GET') {
      const diff = decodeURIComponent(pathname.slice('/api/leaderboard/'.length).split('/')[0]);
      if (diff) {
        ctx.params.difficulty = diff;
        response = await leaderboardGet(ctx);
      }
    } else if (pathname.startsWith('/api/')) {
      // 未匹配的 /api/* 路径
      return withCors(new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      }));
    } else {
      // 其余路径交给静态资源（assets）处理，SPA 回退到 index.html
      return env.ASSETS.fetch(request);
    }

    return withCors(response);
  }
};
