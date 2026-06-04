// Shared utilities for admin API: JWT, users, GitHub API.

import { createHmac, pbkdf2Sync, scryptSync, timingSafeEqual, randomBytes } from 'node:crypto';

// -------- ENV / users --------
// Cache for users.json from repo (per cold-start)
let _usersCache = null;

export function getEnvUsers() {
  const raw = process.env.ADMIN_USERS_JSON || '[]';
  try { return JSON.parse(raw); } catch (e) { return []; }
}

// Async — читает пользователей из ENV + content/users.json (репо)
export async function getUsers() {
  const envUsers = getEnvUsers();
  let repoUsers = [];
  try {
    if (_usersCache) {
      repoUsers = _usersCache;
    } else {
      const f = await ghGet('content/users.json');
      if (f) {
        const json = JSON.parse(Buffer.from(f.content, 'base64').toString('utf8'));
        repoUsers = Array.isArray(json) ? json : [];
        _usersCache = repoUsers;
      }
    }
  } catch (e) { /* ignore */ }
  // Merge: ENV users first (root admin), then repo. Email is unique.
  const map = new Map();
  for (const u of [...envUsers, ...repoUsers]) {
    if (u?.email) map.set(u.email.toLowerCase(), u);
  }
  return Array.from(map.values());
}

export function invalidateUsersCache() { _usersCache = null; }

export async function findUser(email) {
  const all = await getUsers();
  return all.find((u) => u.email?.toLowerCase() === String(email || '').toLowerCase());
}

// -------- Password hashing --------
// Supports both formats:
//   "pbkdf2:<iterations>:<saltHex>:<hashHex>"  (used by tools-password.html via Web Crypto)
//   "scrypt:<saltHex>:<hashHex>"               (legacy)

export function hashPassword(plain) {
  const salt = randomBytes(16);
  const iterations = 200000;
  const hash = pbkdf2Sync(String(plain).normalize('NFKC'), salt, iterations, 64, 'sha256');
  return `pbkdf2:${iterations}:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(plain, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split(':');
  try {
    if (parts[0] === 'pbkdf2' && parts.length === 4) {
      const iterations = parseInt(parts[1], 10);
      const salt = Buffer.from(parts[2], 'hex');
      const expected = Buffer.from(parts[3], 'hex');
      const got = pbkdf2Sync(String(plain).normalize('NFKC'), salt, iterations, expected.length, 'sha256');
      return timingSafeEqual(expected, got);
    }
    if (parts[0] === 'scrypt' && parts.length === 3) {
      const salt = Buffer.from(parts[1], 'hex');
      const expected = Buffer.from(parts[2], 'hex');
      const got = scryptSync(plain, salt, expected.length);
      return timingSafeEqual(expected, got);
    }
  } catch (e) {}
  return false;
}

// -------- JWT (HS256, minimal) --------
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const b64urlDecode = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4), 'base64');

export function signJWT(payload, secret, expiresInSec = 60 * 60 * 24 * 7) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(body));
  const sig = b64url(createHmac('sha256', secret).update(`${h}.${p}`).digest());
  return `${h}.${p}.${sig}`;
}

export function verifyJWT(token, secret) {
  if (!token) return null;
  const [h, p, s] = String(token).split('.');
  if (!h || !p || !s) return null;
  const expected = b64url(createHmac('sha256', secret).update(`${h}.${p}`).digest());
  if (expected !== s) return null;
  try {
    const payload = JSON.parse(b64urlDecode(p).toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) { return null; }
}

// -------- Cookies --------
export function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || '';
  raw.split(';').forEach((p) => {
    const [k, ...v] = p.trim().split('=');
    if (k) out[k] = decodeURIComponent(v.join('='));
  });
  return out;
}

export function setSessionCookie(res, token, maxAgeSec = 60 * 60 * 24 * 7) {
  res.setHeader('Set-Cookie', `meta_session=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${maxAgeSec}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'meta_session=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0');
}

// -------- Auth guard --------
export function getSession(req) {
  const secret = process.env.JWT_SECRET || '';
  if (!secret) return null;
  const cookies = parseCookies(req);
  return verifyJWT(cookies.meta_session, secret);
}

export function requireRole(req, res, roles = ['admin', 'editor']) {
  const session = getSession(req);
  if (!session) { res.status(401).json({ error: 'Не авторизован' }); return null; }
  if (!roles.includes(session.role)) {
    res.status(403).json({ error: 'Недостаточно прав' });
    return null;
  }
  return session;
}

// -------- GitHub API --------
const GH = 'https://api.github.com';
function ghHeaders() {
  return {
    'Authorization': `Bearer ${process.env.GH_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export async function ghGet(path) {
  const repo = process.env.GH_REPO; // e.g. exeslam/metacollege
  const branch = process.env.GH_BRANCH || 'main';
  const url = `${GH}/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${branch}`;
  const r = await fetch(url, { headers: ghHeaders() });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub GET ${path} failed: ${r.status}`);
  return r.json();
}

export async function ghList(dir) {
  const repo = process.env.GH_REPO;
  const branch = process.env.GH_BRANCH || 'main';
  const url = `${GH}/repos/${repo}/contents/${encodeURIComponent(dir).replace(/%2F/g, '/')}?ref=${branch}`;
  const r = await fetch(url, { headers: ghHeaders() });
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`GitHub LIST ${dir} failed: ${r.status}`);
  return r.json();
}

export async function ghPut(path, content, message, sha = null) {
  const repo = process.env.GH_REPO;
  const branch = process.env.GH_BRANCH || 'main';
  const url = `${GH}/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`;
  const body = {
    message: message || `chore(cms): update ${path}`,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch,
  };
  if (sha) body.sha = sha;
  const r = await fetch(url, { method: 'PUT', headers: { ...ghHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`GitHub PUT ${path} failed: ${r.status} — ${txt}`);
  }
  return r.json();
}

export async function ghDelete(path, sha, message) {
  const repo = process.env.GH_REPO;
  const branch = process.env.GH_BRANCH || 'main';
  const url = `${GH}/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`;
  const body = { message: message || `chore(cms): delete ${path}`, sha, branch };
  const r = await fetch(url, { method: 'DELETE', headers: { ...ghHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`GitHub DELETE ${path} failed: ${r.status} — ${txt}`);
  }
  return r.json();
}

// -------- Body parser --------
export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || '{}'); } catch (e) { return {}; }
}
