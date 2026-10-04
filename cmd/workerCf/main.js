/**
 * WorkerCF - Cloudflare Workers 入口
 * 职责：
 *   1. 使用 Hono 框架适配 Cloudflare Workers 运行时
 *   2. 内联静态文件作为 Worker 变量（构建时注入）
 *   3. 使用 KvRepo 作为存储
 *   4. 使用 Web Crypto API 进行 JWT 签名
 *
 * 构建说明：
 *   运行 node scripts/buildWorker.js 生成 worker.js
 *   或直接使用 wrangler deploy 部署
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

// ---- 内联静态文件（构建时替换）----
const WIDGET_JS = `__WIDGET_JS__`;
const INDEX_HTML = `__INDEX_HTML__`;
const ADMIN_HTML = `__ADMIN_HTML__`;
const PREVIEW_HTML = `__PREVIEW_HTML__`;
// i18n：语言注册表与全部语言包（构建脚本按 locales/config.json 注入）
const I18N_CONFIG = JSON.parse(`__I18N_CONFIG__`);
const I18N_LOCALES = JSON.parse(`__I18N_LOCALES__`);
// 应用版本（构建脚本读取 VERSION 文件注入）
const APP_VERSION = `__APP_VERSION__`;

// ---- 存储实现 ----
function createKvRepo(kvNamespace) {
  return {
    async findAll(userId) {
      const key = userId ? `ns:${userId}` : 'ns:public';
      const raw = await kvNamespace.get(key, 'json') || [];
      return raw.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    async findById(userId, id) {
      const all = await this.findAll(userId);
      return all.find(n => n.id === id) || null;
    },
    async save(userId, entity) {
      const key = userId ? `ns:${userId}` : 'ns:public';
      const all = await kvNamespace.get(key, 'json') || [];
      const idx = all.findIndex(n => n.id === entity.id);
      idx === -1 ? all.push(entity) : (all[idx] = entity);
      await kvNamespace.put(key, JSON.stringify(all));
    },
    async delete(userId, id) {
      const key = userId ? `ns:${userId}` : 'ns:public';
      const all = await kvNamespace.get(key, 'json') || [];
      const idx = all.findIndex(n => n.id === id);
      if (idx === -1) return false;
      all.splice(idx, 1);
      await kvNamespace.put(key, JSON.stringify(all));
      return true;
    },
    async deleteAll(userId) {
      const key = userId ? `ns:${userId}` : 'ns:public';
      await kvNamespace.put(key, '[]');
    },
    async findAllPublic() {
      const all = [];
      try {
        const list = await kvNamespace.list({ prefix: 'ns:' });
        for (const key of list.keys) {
          const raw = await kvNamespace.get(key.name, 'json');
          if (Array.isArray(raw)) raw.forEach(n => n.is_active && all.push(n));
        }
      } catch (e) {}
      return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  };
}

// ---- JWT 辅助函数（Workers 无 jsonwebtoken，使用 Web Crypto）----
const base64UrlEncode = str => btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const base64UrlDecode = str => atob(str.replace(/-/g, '+').replace(/_/g, '/'));

async function signJWT(payload, secret, expiresInSec = 604800) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const data = { ...payload, iat: now, exp: now + expiresInSec };
  const h = base64UrlEncode(JSON.stringify(header));
  const p = base64UrlEncode(JSON.stringify(data));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = base64UrlEncode(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${h}.${p}`)))));
  return `${h}.${p}.${sig}`;
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sig = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    if (!await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(`${parts[0]}.${parts[1]}`))) return null;
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

// ---- 密码凭证（与 Node 端 UserEntity 保持一致：PBKDF2-HMAC-SHA256，310000 次迭代）----
const PBKDF2_ITERATIONS = 310000;
const USERS_KEY = 'auth:users'; // KV 键：{ username: { username, hash, salt, createdAt } }

const bytesToHex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
const hexToBytes = hex => Uint8Array.from(hex.match(/.{1,2}/g) || [], h => parseInt(h, 16));

// 恒定时间比较，防止时序攻击
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, baseKey, 256);
  return { hash: bytesToHex(bits), salt: bytesToHex(salt) };
}

async function verifyPassword(password, saltHex, storedHash) {
  try {
    if (!password || !saltHex || !storedHash) return false;
    const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, baseKey, 256);
    return timingSafeEqual(new Uint8Array(bits), hexToBytes(storedHash));
  } catch { return false; }
}

// 校验规则与 internal/domainCond/userAuth/userEntity.js 保持一致
function validateUsername(username) {
  if (!username || typeof username !== 'string') return 'Username is required';
  if (username.length < 2) return 'Username must be at least 2 characters';
  if (username.length > 32) return 'Username must be at most 32 characters';
  if (!/^[a-zA-Z0-9_一-龥]+$/.test(username)) return 'Username may only contain letters, numbers, underscores and Chinese characters';
  return null;
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters';
  if (password.length > 128) return 'Password must be at most 128 characters';
  return null;
}

// 读取全部用户；KV 无此键时返回空对象，读取异常直接抛出（禁止用空数据回写覆盖）
async function readUsers(kv) {
  const raw = await kv.get(USERS_KEY, 'json');
  return raw && typeof raw === 'object' ? raw : {};
}

function sessionCookie(token, reqUrl) {
  return `ns_token=${token}; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax${reqUrl.startsWith('https') ? '; Secure' : ''}`;
}

// 500 时把真实错误名/消息带回客户端（自部署工具，便于定位绑定/配额问题），完整堆栈进 tail 日志
function serverError(c, stage, e) {
  console.error(`[auth:${stage}]`, e && e.stack ? e.stack : e);
  const detail = e && (e.message || String(e)) ? `${e.name || 'Error'}: ${e.message || e}` : 'Unknown error';
  return c.json({ success: false, code: 'api.serverError', message: `Internal error (${stage}): ${detail}` }, 500);
}

// ---- OAuth2 Providers ----
function createProviders(env, baseUrl) {
  const github = {
    name: 'github', displayName: 'GitHub',
    icon: '<svg viewBox="0 0 16 16" style="width:20px;height:20px"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>',
    isConfigured() { return !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET); },
    getAuthUrl(state) {
      const cb = `${baseUrl}/auth/github/callback`;
      return `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=read:user&redirect_uri=${encodeURIComponent(cb)}${state ? '&state=' + state : ''}`;
    },
    async exchangeCode(code) {
      const cb = `${baseUrl}/auth/github/callback`;
      const r = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'notice-hub' },
        body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: cb })
      });
      return r.json();
    },
    async getUserInfo(token) {
      const r = await fetch('https://api.github.com/user', { headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'notice-hub', 'Accept': 'application/json' } });
      const u = await r.json();
      return { id: String(u.id), login: u.login, name: u.name || u.login, avatar: u.avatar_url, email: u.email || '', provider: 'github' };
    }
  };
  const map = new Map();
  map.set('github', github);
  return map;
}

// ---- 应用 ----
const app = new Hono();

// 安全头
app.use('*', async (c, next) => {
  await next();
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('X-Frame-Options', 'DENY');
  c.res.headers.set('X-XSS-Protection', '1; mode=block');
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  const p = new URL(c.req.url).pathname;
  if (p === '/' || p === '/index.html' || p === '/admin.html' || p === '/preview.html' || p.startsWith('/api/')) {
    c.res.headers.set('Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' data:; connect-src 'self' https:; object-src 'none'; base-uri 'self'");
  }
});
app.use('/*', cors());
app.use('/*', async (c, next) => { c.res.headers.set('Access-Control-Allow-Origin', '*'); return next(); });

// 静态文件（CSS/JS 已全部内联到 HTML，仅保留 4 个入口）
app.get('/widget.js', c => new Response(WIDGET_JS, { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' } }));
app.get('/index.html', c => c.html(INDEX_HTML));
app.get('/admin.html', c => c.html(ADMIN_HTML));
app.get('/preview.html', c => c.html(PREVIEW_HTML));
app.get('/', c => c.html(INDEX_HTML));

// i18n 国际化：语言注册表 + 任意已注册语言包（未知语言回退到默认语言）
app.get('/api/i18n/config', c => c.json(I18N_CONFIG));
app.get('/api/i18n/:file', c => {
  const file = c.req.param('file');
  if (file === 'config.json') return c.json(I18N_CONFIG);
  const locale = file.replace(/\.json$/, '');
  if (!/^[A-Za-z0-9-]+$/.test(locale)) return c.json({ success: false }, 400);
  const data = I18N_LOCALES[locale] || I18N_LOCALES[I18N_CONFIG.default];
  return new Response(data || '{}', { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
});

// Widget 配置
app.get('/api/widget-config', async c => {
  const raw = await c.env.NOTIFICATIONS.get('widget-config', 'json') || {};
  return c.json({ success: true, data: raw });
});
app.put('/api/widget-config', async c => {
  const body = await c.req.json();
  await c.env.NOTIFICATIONS.put('widget-config', JSON.stringify(body));
  return c.json({ success: true, data: body });
});
app.post('/api/widget-config/reset', async c => {
  await c.env.NOTIFICATIONS.delete('widget-config');
  return c.json({ success: true, code: 'api.configReset', message: 'Reset to defaults' });
});

// 版本信息（APP_VERSION 由构建脚本读取 VERSION 文件注入）
app.get('/api/version', c => c.json({ success: true, data: { version: APP_VERSION } }));

// 密码注册：校验 → 查重 → PBKDF2 哈希 → 写入 KV（auth:users）
app.post('/api/auth/register', async c => {
  try {
    const body = await c.req.json().catch(() => ({})) || {};
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = body.password;
    const nameErr = validateUsername(username);
    if (nameErr) return c.json({ success: false, message: nameErr }, 400);
    const pwdErr = validatePassword(password);
    if (pwdErr) return c.json({ success: false, message: pwdErr }, 400);
    const kv = c.env.NOTIFICATIONS;
    if (!kv || typeof kv.put !== 'function') {
      return c.json({ success: false, code: 'api.kvNotBound', message: 'KV namespace "NOTIFICATIONS" is not bound. Add the binding in wrangler.toml / dashboard and redeploy.' }, 503);
    }
    const users = await readUsers(kv); // 读-改-写；读取失败会抛出，不会覆盖已有数据
    if (users[username]) return c.json({ success: false, code: 'login.usernameExists', message: 'Username already exists' }, 400);
    const { hash, salt } = await hashPassword(password);
    users[username] = { username, hash, salt, createdAt: new Date().toISOString() };
    await kv.put(USERS_KEY, JSON.stringify(users));
    return c.json({ success: true, code: 'login.registerSuccess', message: 'Registration successful' });
  } catch (e) {
    return serverError(c, 'register', e);
  }
});

// 密码登录：读取 KV 凭证 → 校验密码 → 签发 JWT 并写入 ns_token Cookie
app.post('/api/auth/login', async c => {
  try {
    const body = await c.req.json().catch(() => ({})) || {};
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = body.password;
    if (!username || !password) {
      return c.json({ success: false, code: 'login.invalidCredentials', message: 'Invalid username or password' }, 401);
    }
    const kv = c.env.NOTIFICATIONS;
    if (!kv || typeof kv.get !== 'function') {
      return c.json({ success: false, code: 'api.kvNotBound', message: 'KV namespace "NOTIFICATIONS" is not bound. Add the binding in wrangler.toml / dashboard and redeploy.' }, 503);
    }
    const stored = (await readUsers(kv))[username];
    if (!stored || !(await verifyPassword(password, stored.salt, stored.hash))) {
      return c.json({ success: false, code: 'login.invalidCredentials', message: 'Invalid username or password' }, 401);
    }
    const user = { id: `local:${username}`, login: username, name: username, avatar: '', provider: 'password' };
    const jwtSecret = c.env.JWT_SECRET || (c.env.JWT_SECRET_DEFAULT || 'cf-worker-secret');
    const token = await signJWT(user, jwtSecret, 604800);
    return new Response(JSON.stringify({ success: true, code: 'login.loginSuccess', message: 'Login successful', data: user }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Set-Cookie': sessionCookie(token, c.req.url) }
    });
  } catch (e) {
    return serverError(c, 'login', e);
  }
});

// Providers 列表
app.get('/api/auth/providers', c => {
  const u = new URL(c.req.url);
  const base = `${u.protocol}//${u.host}`;
  const providers = createProviders(c.env, base);
  const oauth = [];
  for (const [name, p] of providers) if (p.isConfigured()) oauth.push({ name, displayName: p.displayName, icon: p.icon, authUrl: `${base}/auth/${name}` });
  return c.json({ success: true, data: { oauth, password: true } });
});

// OAuth2 登录 / 回调
app.get('/auth/logout', c => new Response(null, { status: 302, headers: { 'Location': '/admin.html', 'Set-Cookie': 'ns_token=; Path=/; Max-Age=0' } }));

app.get('/auth/:provider', c => {
  const u = new URL(c.req.url);
  const providers = createProviders(c.env, `${u.protocol}//${u.host}`);
  const p = providers.get(c.req.param('provider'));
  if (!p) return c.text('未知 provider', 400);
  if (!p.isConfigured()) return c.text('未配置', 500);
  return c.redirect(p.getAuthUrl(crypto.randomUUID()));
});

app.get('/auth/:provider/callback', async c => {
  const u = new URL(c.req.url);
  const base = `${u.protocol}//${u.host}`;
  const providers = createProviders(c.env, base);
  const p = providers.get(c.req.param('provider'));
  if (!p) return c.redirect('/admin.html?error=unknown');
  const code = c.req.query('code');
  if (!code) return c.redirect('/admin.html?error=no_code');
  try {
    const t = await p.exchangeCode(code);
    if (!t.access_token) return c.redirect('/admin.html?error=token');
    const user = await p.getUserInfo(t.access_token);
    if (!user?.id) return c.redirect('/admin.html?error=user');
    const jwtSecret = c.env.JWT_SECRET || (c.env.JWT_SECRET_DEFAULT || 'cf-worker-secret');
    const session = { id: user.id, login: user.login, name: user.name, avatar: user.avatar, provider: user.provider };
    const token = await signJWT(session, jwtSecret, 604800);
    return new Response(null, { status: 302, headers: { 'Location': '/admin.html', 'Set-Cookie': `ns_token=${token}; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax${c.req.url.startsWith('https') ? '; Secure' : ''}` } });
  } catch (e) { return c.redirect('/admin.html?error=auth_failed'); }
});

app.get('/api/auth/me', async c => {
  const m = (c.req.header('Cookie') || '').match(/ns_token=([^;]+)/);
  if (!m) return c.json({ success: true, data: null });
  const jwtSecret = c.env.JWT_SECRET || (c.env.JWT_SECRET_DEFAULT || 'cf-worker-secret');
  const user = await verifyJWT(m[1], jwtSecret);
  return c.json({ success: true, data: user });
});

// 通知 API
const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

async function authMiddleware(c, next) {
  const m = (c.req.header('Cookie') || '').match(/ns_token=([^;]+)/);
  if (!m) return c.json({ success: false, code: 'api.unauthorized', message: 'Unauthorized' }, 401);
  const jwtSecret = c.env.JWT_SECRET || (c.env.JWT_SECRET_DEFAULT || 'cf-worker-secret');
  const user = await verifyJWT(m[1], jwtSecret);
  if (!user) return c.json({ success: false, code: 'api.sessionExpired', message: 'Session expired' }, 401);
  c.set('user', user);
  return next();
}

async function getStore(env, userId) {
  const repo = createKvRepo(env.NOTIFICATIONS);
  return {
    async getAll() { return repo.findAll(userId); },
    async getActive() { return (await repo.findAll(userId)).filter(n => n.is_active); },
    async getById(id) { return repo.findById(userId, id); },
    async create(data) {
      const entity = { id: crypto.randomUUID(), ...data, is_active: true, created_at: now(), updated_at: now() };
      await repo.save(userId, entity);
      return entity;
    },
    async update(id, fields) {
      const raw = await repo.findById(userId, id);
      if (!raw) return null;
      const updated = { ...raw, ...fields, updated_at: now() };
      await repo.save(userId, updated);
      return updated;
    },
    async delete(id) { return repo.delete(userId, id); },
    async deleteAll() { return repo.deleteAll(userId); }
  };
}

app.get('/api/notifications', authMiddleware, async c => {
  const s = await getStore(c.env, c.get('user').id);
  return c.json({ success: true, data: await s.getAll() });
});

app.get('/api/notifications/active', async c => {
  const userId = c.req.query('u');
  if (userId) {
    const s = await getStore(c.env, userId);
    const data = await s.getActive();
    if (data.length) return c.json({ success: true, data });
  }
  const r = createKvRepo(c.env.NOTIFICATIONS);
  return c.json({ success: true, data: await r.findAllPublic() });
});

app.get('/api/notifications/emergency', async c => {
  const r = createKvRepo(c.env.NOTIFICATIONS);
  const all = await r.findAllPublic();
  return c.json({ success: true, data: all.filter(n => n.is_emergency) });
});

app.get('/api/notifications/stream', c => {
  const body = new ReadableStream({
    async start(c) {
      c.enqueue('data: connected\n\n');
      for (let i = 0; i < 300; i++) {
        await new Promise(r => setTimeout(r, 3000));
        c.enqueue('event: update\ndata: {}\n\n');
      }
      c.close();
    }
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' } });
});

app.get('/api/notifications/:id', authMiddleware, async c => {
  const s = await getStore(c.env, c.get('user').id);
  const item = await s.getById(c.req.param('id'));
  if (!item) return c.json({ success: false, code: 'api.notificationNotFound', message: 'Notification not found' }, 404);
  return c.json({ success: true, data: item });
});

app.post('/api/notifications', authMiddleware, async c => {
  const body = await c.req.json();
  if (!body?.title) return c.json({ success: false, code: 'api.titleRequired', message: 'Title is required' }, 400);
  const s = await getStore(c.env, c.get('user').id);
  const item = await s.create({ title: body.title, content: body.content || '', type: body.type || 'info', is_emergency: !!body.is_emergency });
  return c.json({ success: true, data: item }, 201);
});

app.put('/api/notifications/:id', authMiddleware, async c => {
  const body = await c.req.json();
  const fields = {};
  if (body.title !== undefined) fields.title = body.title;
  if (body.content !== undefined) fields.content = body.content;
  if (body.type !== undefined) fields.type = body.type;
  if (body.is_emergency !== undefined) fields.is_emergency = !!body.is_emergency;
  if (body.is_active !== undefined) fields.is_active = !!body.is_active;
  const s = await getStore(c.env, c.get('user').id);
  const item = await s.update(c.req.param('id'), fields);
  if (!item) return c.json({ success: false, code: 'api.notificationNotFound', message: 'Notification not found' }, 404);
  return c.json({ success: true, data: item });
});

app.delete('/api/notifications/:id', authMiddleware, async c => {
  const s = await getStore(c.env, c.get('user').id);
  const ok = await s.delete(c.req.param('id'));
  if (!ok) return c.json({ success: false, code: 'api.notificationNotFound', message: 'Notification not found' }, 404);
  return c.json({ success: true, code: 'api.deleteSuccess', message: 'Deleted' });
});

app.post('/api/notifications/clear-all', authMiddleware, async c => {
  const s = await getStore(c.env, c.get('user').id);
  await s.deleteAll();
  return c.json({ success: true, code: 'api.clearedAll', message: 'Cleared' });
});

app.get('/api/widget-code', c => {
  const u = new URL(c.req.url);
  const uid = u.searchParams.get('u') || '';
  return c.json({ success: true, data: `<script src="${u.protocol}//${u.host}/widget.js${uid ? '?u=' + uid : ''}"></script>` });
});

export default app;
