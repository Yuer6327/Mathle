// /api/* 全局 CORS 中间件
import { withCors } from './_lib/response.js';

export const onRequest = withCors(async (context) => {
  return context.next();
});
