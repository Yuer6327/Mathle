// JWT 签发与验证 (HMAC-SHA256, Web Crypto API)

const enc = new TextEncoder();

async function getKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function b64encode(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64decode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

export async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = b64encode(enc.encode(JSON.stringify(header)));
  const bodyB64 = b64encode(enc.encode(JSON.stringify(payload)));
  const data = `${headerB64}.${bodyB64}`;
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const sigB64 = b64encode(sig);
  return `${data}.${sigB64}`;
}

export async function verifyJWT(token, secret) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, bodyB64, sigB64] = parts;
  const data = `${headerB64}.${bodyB64}`;
  const key = await getKey(secret);
  const sigBytes = Uint8Array.from(b64decode(sigB64), c => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(data));
  if (!valid) return null;
  const bodyBytes = Uint8Array.from(b64decode(bodyB64), c => c.charCodeAt(0));
  const payload = JSON.parse(new TextDecoder().decode(bodyBytes));
  if (payload.exp && Date.now() > payload.exp) return null;
  return payload;
}

export function setAuthCookie(token) {
  return `auth=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`;
}

export function clearAuthCookie() {
  return `auth=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export function getTokenFromRequest(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/auth=([^;]+)/);
  return match ? match[1] : null;
}
