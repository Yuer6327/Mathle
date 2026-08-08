// 响应与中间件工具

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Cookie',
  'Access-Control-Allow-Credentials': 'true'
};

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...extraHeaders
    }
  });
}

export function error(msg, status = 400) {
  return json({ error: msg }, status);
}

// CORS 中间件 + OPTIONS 预检
export function withCors(handler) {
  return async (context) => {
    if (context.request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    const response = await handler(context);
    // 确保响应有 CORS 头
    if (response instanceof Response) {
      for (const [k, v] of Object.entries(CORS_HEADERS)) {
        response.headers.set(k, v);
      }
    }
    return response;
  };
}

// JWT 鉴权中间件
import { verifyJWT, getTokenFromRequest } from './jwt.js';

export async function requireAuth(context) {
  const token = getTokenFromRequest(context.request);
  if (!token) return null;
  const payload = await verifyJWT(token, context.env.JWT_SECRET);
  if (!payload) return null;
  return payload;
}
