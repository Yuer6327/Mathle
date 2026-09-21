// GET  /api/hint  → 查询今日剩余提示次数（不消耗）
// POST /api/hint  → 消耗一次提示：调用 TypeSafe Jev（System One）拿到概率分布后返回
//
// 配额（按 UTC+8 自然日）：
//   未登录游客 1 次/天（用 HttpOnly cookie mw_gid 标识）
//   登录用户   100 次/天（用 JWT 的 sub 标识）
// 另有全局每日预算护栏，防止密钥被刷爆（见下方常量）。
//
// 关键约定：只有 Jev 成功返回才扣配额；配额耗尽返回 429，前端据此弹出提醒。
import { requireAuth, json, error } from './_lib/response.js';
import { DIFFICULTIES, SYMBOL_POOLS } from '../../src/lib/constants.js';
import {
  buildJevRequest,
  boardToTokens,
  countSlots,
  buildDisplayToInternal,
  MAX_HISTORY,
  MAX_SLOTS
} from './_lib/hintPrompt.js';

// —— 可调参数 ——
const LIMIT_GUEST = 1;
const LIMIT_USER = 100;
/** 全局护栏：单日 Jev 调用次数上限（默认值可用 env 覆盖） */
const DEFAULT_GLOBAL_DAILY_CALLS = 1500;
/**
 * 全局护栏：单日 Jev 输入 token 上限（默认 250 万）。
 * 按官方 $0.042 / 1M input token 计算，最坏约 $0.105/天 ≈ $3.3/月，留在 $5 免费额度内。
 */
const DEFAULT_GLOBAL_DAILY_TOKENS = 2_500_000;

const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const JEV_TIMEOUT_MS = 6000;
const JEV_MAX_ATTEMPTS = 3;

const HINT_COOKIE = 'mw_gid';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const FEEDBACK_VALUES = new Set(['correct', 'present', 'absent']);

// —— 时间：按 UTC+8 划分自然日 ——
const DAY_MS = 86_400_000;
const UTC8_OFFSET_MS = 8 * 3600 * 1000;

export function utc8Day(now = Date.now()) {
  return new Date(now + UTC8_OFFSET_MS).toISOString().slice(0, 10);
}

/** 下一次 UTC+8 零点的时间戳（秒） */
export function utc8ResetAt(now = Date.now()) {
  const shifted = now + UTC8_OFFSET_MS;
  const nextShiftedMidnight = (Math.floor(shifted / DAY_MS) + 1) * DAY_MS;
  return Math.floor((nextShiftedMidnight - UTC8_OFFSET_MS) / 1000);
}

function readCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

function hintCookieHeader(guestId) {
  return `${HINT_COOKIE}=${guestId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE}`;
}

/** 解析出配额主体：登录用户优先，否则落到游客 cookie */
function resolveSubject(request, payload) {
  if (payload?.sub) return { subject: `u:${payload.sub}`, loggedIn: true, guestId: null, newGuestId: null };
  let guestId = readCookie(request, HINT_COOKIE);
  let newGuestId = null;
  if (!guestId || !/^[A-Za-z0-9-]{8,64}$/.test(guestId)) {
    guestId = crypto.randomUUID();
    newGuestId = guestId;
  }
  return { subject: `g:${guestId}`, loggedIn: false, guestId, newGuestId };
}

function quotaPayload({ loggedIn, limit, used, resetAt }) {
  const safeUsed = Math.min(used, limit);
  return {
    logged_in: loggedIn,
    limit,
    used: safeUsed,
    remaining: Math.max(0, limit - safeUsed),
    reset_at: resetAt
  };
}

async function readUsage(env, subject, day) {
  const row = await env.DB.prepare(
    'SELECT used FROM hint_usage WHERE subject = ? AND day = ?'
  ).bind(subject, day).first();
  return row?.used || 0;
}

async function readDayTotals(env, day) {
  const row = await env.DB.prepare(
    'SELECT COALESCE(SUM(used), 0) AS calls, COALESCE(SUM(tokens), 0) AS tokens FROM hint_usage WHERE day = ?'
  ).bind(day).first();
  return { calls: row?.calls || 0, tokens: row?.tokens || 0 };
}

/** 校验并规整请求体，返回 { tokens, history } 或 { error } */
function parseGamePayload(body, difficulty) {
  const tokens = boardToTokens(body?.board);
  if (!tokens) return { error: 'board 格式无效' };
  const slotCount = countSlots(tokens);
  if (slotCount === 0) return { error: 'board 没有空槽' };
  if (slotCount > MAX_SLOTS) return { error: '槽位过多' };

  const pool = new Set([
    ...SYMBOL_POOLS[difficulty].numbers,
    ...SYMBOL_POOLS[difficulty].operators,
    ...SYMBOL_POOLS[difficulty].functions
  ]);

  const raw = Array.isArray(body?.history) ? body.history.slice(-MAX_HISTORY) : [];
  const history = [];
  for (const entry of raw) {
    const guess = entry?.guess;
    const feedback = entry?.feedback;
    if (!Array.isArray(guess) || !Array.isArray(feedback)) continue;
    if (guess.length !== slotCount || feedback.length !== slotCount) continue;
    if (!guess.every((s) => typeof s === 'string' && pool.has(s))) continue;
    if (!feedback.every((f) => FEEDBACK_VALUES.has(f))) continue;
    history.push({ guess: [...guess], feedback: [...feedback] });
  }
  return { tokens, history, slotCount };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 调用 Jev。429 / 529 / 5xx 按指数退避重试（官方建议），401 / 422 不重试。
 */
async function callJev(apiKey, body) {
  let lastReason = 'upstream';
  let lastStatus = 0;
  for (let attempt = 1; attempt <= JEV_MAX_ATTEMPTS; attempt++) {
    let res;
    try {
      res = await fetch(JEV_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(JEV_TIMEOUT_MS)
      });
    } catch (e) {
      lastReason = 'network';
      lastStatus = 0;
      if (attempt < JEV_MAX_ATTEMPTS) {
        await sleep(400 * 2 ** (attempt - 1));
        continue;
      }
      return { ok: false, status: lastStatus, reason: lastReason };
    }

    if (res.ok) {
      try {
        return { ok: true, data: await res.json() };
      } catch {
        return { ok: false, status: res.status, reason: 'bad_response' };
      }
    }

    lastStatus = res.status;
    if (res.status === 401) return { ok: false, status: 401, reason: 'bad_key' };
    if (res.status === 422) return { ok: false, status: 422, reason: 'bad_request' };
    lastReason = res.status === 429 ? 'rate_limited' : res.status === 529 ? 'overloaded' : 'upstream';
    if (attempt < JEV_MAX_ATTEMPTS) {
      await sleep(400 * 2 ** (attempt - 1));
      continue;
    }
  }
  return { ok: false, status: lastStatus, reason: lastReason };
}

/** 把 Jev 的 Choice 答案映射回内部符号，并整理成按概率降序的数组 */
function normalizeAnswer(answer, difficulty) {
  const toInternal = buildDisplayToInternal(difficulty);
  const rawProbs = answer?.probabilities && typeof answer.probabilities === 'object' ? answer.probabilities : {};
  const mapped = [];
  let sum = 0;
  for (const [key, value] of Object.entries(rawProbs)) {
    const internal = toInternal.get(key) || toInternal.get(key.trim()) || null;
    const p = typeof value === 'number' && value > 0 ? value : 0;
    if (!internal || p <= 0) continue;
    mapped.push({ symbol: internal, probability: p });
    sum += p;
  }
  if (mapped.length === 0) return null;
  // 归一化（正常情况下 criteria 的键就是这些显示符号，sum 应该 ≈ 1）
  for (const item of mapped) item.probability = item.probability / sum;
  mapped.sort((a, b) => b.probability - a.probability);

  const declared = toInternal.get(answer?.choice) || null;
  const choice = declared && mapped.some((m) => m.symbol === declared) ? declared : mapped[0].symbol;
  const confidence = typeof answer?.confidence === 'number'
    ? Math.max(0, Math.min(1, answer.confidence))
    : mapped[0].probability;

  return { choice, probabilities: mapped, confidence };
}

// —— GET：只查配额 ——
export async function onRequestGet(context) {
  const { request, env } = context;
  const payload = await requireAuth(context);
  const { subject, loggedIn, newGuestId } = resolveSubject(request, payload);
  const day = utc8Day();
  const limit = loggedIn ? LIMIT_USER : LIMIT_GUEST;
  const resetAt = utc8ResetAt();

  let used = 0;
  try {
    used = await readUsage(env, subject, day);
  } catch {
    // 表未迁移等情况：返回配额上限但不阻塞页面
    return json({ quota: quotaPayload({ loggedIn, limit, used: 0, resetAt }), degraded: true });
  }

  const headers = newGuestId ? { 'Set-Cookie': hintCookieHeader(newGuestId) } : {};
  return json({ quota: quotaPayload({ loggedIn, limit, used, resetAt }) }, 200, headers);
}

// —— POST：消耗一次提示 ——
export async function onRequestPost(context) {
  const { request, env } = context;
  const payload = await requireAuth(context);
  const { subject, loggedIn, newGuestId } = resolveSubject(request, payload);
  const day = utc8Day();
  const limit = loggedIn ? LIMIT_USER : LIMIT_GUEST;
  const resetAt = utc8ResetAt();
  const setCookie = newGuestId ? { 'Set-Cookie': hintCookieHeader(newGuestId) } : {};

  let body;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body');
  }

  const difficulty = body?.difficulty;
  if (!DIFFICULTIES.includes(difficulty)) {
    return json({ error: '难度无效', reason: 'bad_request' }, 400, setCookie);
  }

  // 1) 配额检查（先查后调，避免白烧 token）
  let used = 0;
  let totals = { calls: 0, tokens: 0 };
  try {
    used = await readUsage(env, subject, day);
    totals = await readDayTotals(env, day);
  } catch {
    return json({ error: '提示服务暂不可用（数据库未迁移）', reason: 'db_error' }, 503, setCookie);
  }

  if (used >= limit) {
    return json({
      error: loggedIn ? '今日提示次数已用完' : '游客每天只能使用 1 次提示',
      reason: 'quota_exceeded',
      quota: quotaPayload({ loggedIn, limit, used, resetAt })
    }, 429, setCookie);
  }

  const globalCalls = Number(env.HINT_GLOBAL_DAILY_CALLS || DEFAULT_GLOBAL_DAILY_CALLS);
  const globalTokens = Number(env.HINT_GLOBAL_DAILY_TOKENS || DEFAULT_GLOBAL_DAILY_TOKENS);
  if (totals.calls >= globalCalls || totals.tokens >= globalTokens) {
    return json({
      error: '今日全局提示额度已用尽，请明天再试',
      reason: 'budget_exhausted',
      quota: quotaPayload({ loggedIn, limit, used, resetAt })
    }, 503, setCookie);
  }

  // 2) 参数校验 + 构建 Jev 请求
  const parsed = parseGamePayload(body, difficulty);
  if (parsed.error) return json({ error: parsed.error, reason: 'bad_request' }, 400, setCookie);

  const built = buildJevRequest({
    difficulty,
    tokens: parsed.tokens,
    history: parsed.history,
    currentGuess: parsed.currentGuess,
    excludeSlots: (Array.isArray(body?.exclude_slots) ? body.exclude_slots : [])
      .filter((i) => Number.isInteger(i) && i >= 0 && i < parsed.slotCount)
  });
  if (built.error) {
    return json({
      error: built.error === '没有可提示的槽位'
        ? '当前所有空槽都已被反馈逻辑锁定，无需提示（本次不消耗次数）'
        : built.error,
      reason: 'no_hint_available'
    }, 400, setCookie);
  }

  const apiKey = env.JEV_KEY;
  if (!apiKey) {
    return json({
      error: '提示服务尚未配置（缺少 JEV_KEY）',
      reason: 'not_configured'
    }, 503, setCookie);
  }

  // 3) 调用 Jev
  const result = await callJev(apiKey, built.body);
  if (!result.ok) {
    const message = result.reason === 'bad_key'
      ? '提示服务密钥无效'
      : result.reason === 'rate_limited' || result.reason === 'overloaded'
        ? 'Jev 服务繁忙，请稍后再试'
        : 'Jev 服务暂时不可用，请稍后再试';
    const status = result.reason === 'bad_key' ? 503 : 502;
    return json({ error: message, reason: result.reason }, status, setCookie);
  }

  // 4) 挑出置信度最高的槽位作为本次提示
  let best = null;
  for (const slotIndex of built.slotIds) {
    const answer = result.data?.answers?.[`slot_${slotIndex + 1}`];
    if (!answer || answer.type !== 'choice') continue;
    const normalized = normalizeAnswer(answer, difficulty);
    if (!normalized) continue;
    if (!best || normalized.confidence > best.confidence) {
      best = { slotIndex, ...normalized };
    }
  }
  if (!best) {
    return json({ error: 'Jev 未返回可用的判断，本次不扣次数', reason: 'empty_answer' }, 502, setCookie);
  }

  // 5) 成功才扣配额
  const usedTokens = Number(result.data?.usage?.input_tokens) || 0;
  try {
    await env.DB.prepare(
      `INSERT INTO hint_usage (subject, day, used, tokens) VALUES (?, ?, 1, ?)
       ON CONFLICT(subject, day) DO UPDATE SET
         used = used + 1,
         tokens = tokens + excluded.tokens,
         updated_at = unixepoch()`
    ).bind(subject, day, usedTokens).run();
  } catch {
    // 扣配额失败不阻塞本次结果（用户已付费式消耗了一次 Jev 调用）
  }

  const nextUsed = used + 1;
  return json({
    slot_index: best.slotIndex,
    slot_number: best.slotIndex + 1,
    type: 'choice',
    choice: best.choice,
    probabilities: best.probabilities,
    confidence: best.confidence,
    model: result.data?.model || 'jev-latest',
    quota: quotaPayload({ loggedIn, limit, used: nextUsed, resetAt })
  }, 200, setCookie);
}
