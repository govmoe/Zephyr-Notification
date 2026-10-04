/**
 * WorkerEO - 腾讯云 EdgeOne 边缘函数入口
 *
 * 特性：
 *   - 使用 Web API (fetch event) 适配 EdgeOne 运行时
 *   - 内联 JWT 实现（无外部依赖）
 *   - 内存存储 + 可选外部存储 API
 *   - 构建时内联静态文件
 *
 * 部署前需运行：node scripts/buildEdgeOne.js
 */

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

// ---- JWT ----
const b64u = s => btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const b64d = s => atob(s.replace(/-/g, '+').replace(/_/g, '/'));

async function signJWT(payload, secret, exp = 604800) {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + exp }));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return `${h}.${p}.${b64u(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${h}.${p}`)))))}`;
}

async function verifyJWT(token, secret) {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify('HMAC', key, Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)), new TextEncoder().encode(`${h}.${p}`))) return null;
    const data = JSON.parse(b64d(p));
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch { return null; }
}

// ---- 内存存储 ----
const memoryStore = new Map();

function createStore(env) {
  if (env.STORAGE_API_URL) {
    const api = env.STORAGE_API_URL;
    return {
      async getAll(k) { try { const r = await fetch(`${api}/${k}`); return r.ok ? await r.json() : []; } catch { return []; } },
      async saveAll(k, d) { await fetch(`${api}/${k}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }); }
    };
  }
  return {
    async getAll(k) { return memoryStore.get(k) || []; },
    async saveAll(k, d) { memoryStore.set(k, d); }
  };
}

// ---- 密码凭证（PBKDF2-HMAC-SHA256，310000 次迭代，与 CF/Node 端一致）----
const PBKDF2_ITERATIONS = 310000;
const USERS_KEY = 'auth:users';

const bytesToHex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
const hexToBytes = hex => Uint8Array.from(hex.match(/.{1,2}/g) || [], h => parseInt(h, 16));

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

// 用户凭证持久化：优先外部存储 API，无配置时使用实例内存（边缘实例内存不共享，配置 STORAGE_API_URL 可跨实例持久化）
async function readUsers(store) {
  const raw = await store.getAll(USERS_KEY);
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function sessionCookie(token) {
  return `ns_token=${token}; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax; Secure`;
}

function jsonError(sh, status, code, message, extraHeaders) {
  return new Response(JSON.stringify({ success: false, code, message }), { status, headers: { ...sh, ...(extraHeaders || {}), 'Content-Type': 'application/json; charset=utf-8' } });
}

function now() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

// ---- OAuth2 Providers ----
function createProviders(env, baseUrl) {
  const github = {
    name: 'github', displayName: 'GitHub',
    icon: '<svg viewBox="0 0 16 16" style="width:20px;height:20px"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>',
    isConfigured() { return !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET); },
    getAuthUrl(state) {
      return `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=read:user&redirect_uri=${encodeURIComponent(baseUrl + '/auth/github/callback')}${state ? '&state=' + state : ''}`;
    },
    async exchangeCode(code) {
      const r = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'notice-hub/1.0' },
        body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: baseUrl + '/auth/github/callback' })
      });
      return r.json();
    },
    async getUserInfo(token) {
      const r = await fetch('https://api.github.com/user', { headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'notice-hub/1.0' } });
      const u = await r.json();
      return { id: String(u.id), login: u.login, name: u.name || u.login, avatar: u.avatar_url, email: u.email || '', provider: 'github' };
    }
  };
  const m = new Map(); m.set('github', github);
  return m;
}

// ---- 请求处理 ----
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const baseUrl = `${url.protocol}//${url.host}`;
  const JWT_SECRET = env.JWT_SECRET || (env.JWT_SECRET_DEFAULT || 'eo-default-secret');
  const sh = {
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin', 'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (request.method === 'OPTIONS') return new Response(null, { headers: sh });

  // CSP
  if (path === '/' || path === '/index.html' || path === '/admin.html' || path === '/preview.html' || path.startsWith('/api/')) {
    sh['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' data:; connect-src 'self' https:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";
  }

  // 静态文件（CSS/JS 已全部内联到 HTML，仅保留 4 个入口）
  if (path === '/widget.js') return new Response(WIDGET_JS, { headers: { ...sh, 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' } });
  if (path === '/index.html') return new Response(INDEX_HTML, { headers: { ...sh, 'Content-Type': 'text/html; charset=utf-8' } });
  if (path === '/admin.html') return new Response(ADMIN_HTML, { headers: { ...sh, 'Content-Type': 'text/html; charset=utf-8' } });
  if (path === '/preview.html') return new Response(PREVIEW_HTML, { headers: { ...sh, 'Content-Type': 'text/html; charset=utf-8' } });
  if (path === '/' || path === '') return new Response(INDEX_HTML, { headers: { ...sh, 'Content-Type': 'text/html; charset=utf-8' } });

  // i18n 国际化：语言注册表 + 任意已注册语言包（未知语言回退到默认语言）
  if (path === '/api/i18n/config') return new Response(JSON.stringify(I18N_CONFIG), { headers: { ...sh, 'Content-Type': 'application/json; charset=utf-8' } });
  const i18nM = path.match(/^\/api\/i18n\/([A-Za-z0-9-]+)(\.json)?$/);
  if (i18nM) {
    if (i18nM[1] === 'config') return new Response(JSON.stringify(I18N_CONFIG), { headers: { ...sh, 'Content-Type': 'application/json; charset=utf-8' } });
    const data = I18N_LOCALES[i18nM[1]] || I18N_LOCALES[I18N_CONFIG.default] || '{}';
    return new Response(data, { headers: { ...sh, 'Content-Type': 'application/json; charset=utf-8' } });
  }

  // 认证
  const providers = createProviders(env, baseUrl);
  if (path === '/api/auth/providers') {
    const list = [];
    for (const [n, p] of providers) if (p.isConfigured()) list.push({ name: n, displayName: p.displayName, icon: p.icon, authUrl: `${baseUrl}/auth/${n}` });
    // 契约与 Express/CF 端一致：{ oauth: [...], password: boolean }
    return new Response(JSON.stringify({ success: true, data: { oauth: list, password: true } }), { headers: { ...sh, 'Content-Type': 'application/json' } });
  }

  // 密码注册：校验 → 查重 → PBKDF2 哈希 → 持久化（STORAGE_API_URL 或实例内存）
  if (path === '/api/auth/register' && request.method === 'POST') {
    try {
      const body = await request.json().catch(() => ({})) || {};
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const password = body.password;
      const nameErr = validateUsername(username);
      if (nameErr) return jsonError(sh, 400, 'api.badRequest', nameErr);
      const pwdErr = validatePassword(password);
      if (pwdErr) return jsonError(sh, 400, 'api.badRequest', pwdErr);
      const store = createStore(env);
      const users = await readUsers(store);
      if (users[username]) return jsonError(sh, 400, 'login.usernameExists', 'Username already exists');
      const { hash, salt } = await hashPassword(password);
      users[username] = { username, hash, salt, createdAt: new Date().toISOString() };
      await store.saveAll(USERS_KEY, users);
      return new Response(JSON.stringify({ success: true, code: 'login.registerSuccess', message: 'Registration successful' }), { headers: { ...sh, 'Content-Type': 'application/json; charset=utf-8' } });
    } catch (e) {
      console.error('[auth:register]', e && e.stack ? e.stack : e);
      return jsonError(sh, 500, 'api.serverError', `Internal error (register): ${e?.name || 'Error'}: ${e?.message || e}`);
    }
  }

  // 密码登录：读取凭证 → 校验密码 → 签发 JWT 并写入 ns_token Cookie
  if (path === '/api/auth/login' && request.method === 'POST') {
    try {
      const body = await request.json().catch(() => ({})) || {};
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const password = body.password;
      if (!username || !password) return jsonError(sh, 401, 'login.invalidCredentials', 'Invalid username or password');
      const store = createStore(env);
      const stored = (await readUsers(store))[username];
      if (!stored || !(await verifyPassword(password, stored.salt, stored.hash))) {
        return jsonError(sh, 401, 'login.invalidCredentials', 'Invalid username or password');
      }
      const user = { id: `local:${username}`, login: username, name: username, avatar: '', provider: 'password' };
      const token = await signJWT(user, JWT_SECRET, 604800);
      return new Response(JSON.stringify({ success: true, code: 'login.loginSuccess', message: 'Login successful', data: user }), {
        status: 200,
        headers: { ...sh, 'Content-Type': 'application/json; charset=utf-8', 'Set-Cookie': sessionCookie(token) }
      });
    } catch (e) {
      console.error('[auth:login]', e && e.stack ? e.stack : e);
      return jsonError(sh, 500, 'api.serverError', `Internal error (login): ${e?.name || 'Error'}: ${e?.message || e}`);
    }
  }

  const authM = path.match(/^\/auth\/(\w+)$/);
  if (authM) {
    const p = providers.get(authM[1]);
    if (!p) return new Response('Unknown provider', { status: 400, headers: sh });
    return Response.redirect(p.getAuthUrl(crypto.randomUUID()), 302);
  }

  const cbM = path.match(/^\/auth\/(\w+)\/callback$/);
  if (cbM && request.method === 'GET') {
    const p = providers.get(cbM[1]);
    if (!p) return Response.redirect('/admin.html?error=unknown', 302);
    const code = url.searchParams.get('code');
    if (!code) return Response.redirect('/admin.html?error=no_code', 302);
    try {
      const td = await p.exchangeCode(code);
      if (!td.access_token) return Response.redirect('/admin.html?error=token', 302);
      const u = await p.getUserInfo(td.access_token);
      if (!u?.id) return Response.redirect('/admin.html?error=user', 302);
      const token = await signJWT({ id: u.id, login: u.login, name: u.name, avatar: u.avatar, provider: u.provider }, JWT_SECRET, 604800);
      return new Response(null, { status: 302, headers: { 'Location': '/admin.html', 'Set-Cookie': `ns_token=${token}; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax; Secure` } });
    } catch { return Response.redirect('/admin.html?error=auth_failed', 302); }
  }

  if (path === '/api/auth/me') {
    const m = (request.headers.get('Cookie') || '').match(/ns_token=([^;]+)/);
    if (!m) return new Response(JSON.stringify({ success: true, data: null }), { headers: { ...sh, 'Content-Type': 'application/json' } });
    const u = await verifyJWT(m[1], JWT_SECRET);
    return new Response(JSON.stringify({ success: true, data: u }), { headers: { ...sh, 'Content-Type': 'application/json' } });
  }
  if (path === '/auth/logout') return new Response(null, { status: 302, headers: { 'Location': '/admin.html', 'Set-Cookie': 'ns_token=; Path=/; Max-Age=0' } });

  // 通知 API
  const cookie = request.headers.get('Cookie') || '';
  const tm = cookie.match(/ns_token=([^;]+)/);
  let currentUser = null;
  if (tm) currentUser = await verifyJWT(tm[1], JWT_SECRET);

  function auth() {
    if (!currentUser?.id) return new Response(JSON.stringify({ success: false, code: 'api.unauthorized', message: 'Unauthorized' }), { status: 401, headers: { ...sh, 'Content-Type': 'application/json' } });
    return null;
  }

  const store = createStore(env);
  async function userStore(uid) {
    const s = store;
    return {
      async getAll() { const d = await s.getAll(uid); return d.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); },
      async getById(id) { const d = await s.getAll(uid); return d.find(n => n.id === id) || null; },
      async create(data) {
        const e = { id: crypto.randomUUID(), title: data.title, content: data.content || '', type: data.type || 'info', is_emergency: !!data.is_emergency, is_active: true, created_at: now(), updated_at: now() };
        const all = await s.getAll(uid); all.push(e); await s.saveAll(uid, all); return e;
      },
      async update(id, fields) {
        const all = await s.getAll(uid); const idx = all.findIndex(n => n.id === id);
        if (idx === -1) return null;
        all[idx] = { ...all[idx], ...fields, updated_at: now() }; await s.saveAll(uid, all); return all[idx];
      },
      async delete(id) { const all = await s.getAll(uid); const idx = all.findIndex(n => n.id === id); if (idx === -1) return false; all.splice(idx, 1); await s.saveAll(uid, all); return true; },
      async deleteAll() { await s.saveAll(uid, []); }
    };
  }

  try {
    if (path === '/api/notifications/active') {
      const uid = url.searchParams.get('u');
      const us = await userStore(uid || 'public');
      const d = await us.getAll();
      return new Response(JSON.stringify({ success: true, data: d.filter(n => n.is_active) }), { headers: { ...sh, 'Content-Type': 'application/json' } });
    }
    if (path === '/api/notifications/emergency') return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...sh, 'Content-Type': 'application/json' } });
    if (path === '/api/notifications/stream') return new Response(JSON.stringify({ success: false, code: 'api.serverError', message: 'SSE not supported on EdgeOne' }), { status: 501, headers: { ...sh, 'Content-Type': 'application/json' } });
    if (path === '/api/version') return new Response(JSON.stringify({ success: true, data: { version: APP_VERSION } }), { headers: { ...sh, 'Content-Type': 'application/json' } });

    // Widget 配置（EdgeOne 无持久 KV 时存于模块内存）
    if (path === '/api/widget-config' && request.method === 'GET') {
      return new Response(JSON.stringify({ success: true, data: memoryStore.get('widget-config') || {} }), { headers: { ...sh, 'Content-Type': 'application/json' } });
    }
    if (path === '/api/widget-config' && request.method === 'PUT') { const e = auth(); if (e) return e; const b = await request.json(); memoryStore.set('widget-config', b); return new Response(JSON.stringify({ success: true, code: 'api.configSaved', message: 'Settings saved', data: b }), { headers: { ...sh, 'Content-Type': 'application/json' } }); }
    if (path === '/api/widget-config/reset' && request.method === 'POST') { const e = auth(); if (e) return e; memoryStore.delete('widget-config'); return new Response(JSON.stringify({ success: true, code: 'api.configReset', message: 'Reset to defaults', data: {} }), { headers: { ...sh, 'Content-Type': 'application/json' } }); }

    if (path === '/api/widget-code') {
      const uid = url.searchParams.get('u') || '';
      return new Response(JSON.stringify({ success: true, data: `<script src="${baseUrl}/widget.js${uid ? '?u=' + uid : ''}"></script>` }), { headers: { ...sh, 'Content-Type': 'application/json' } });
    }

    if (path === '/api/notifications' && request.method === 'GET') { const e = auth(); if (e) return e; const us = await userStore(currentUser.id); return new Response(JSON.stringify({ success: true, data: await us.getAll() }), { headers: { ...sh, 'Content-Type': 'application/json' } }); }
    if (path === '/api/notifications' && request.method === 'POST') { const e = auth(); if (e) return e; const b = await request.json(); if (!b?.title) return new Response(JSON.stringify({ success: false, code: 'api.titleRequired', message: 'Title is required' }), { status: 400, headers: { ...sh, 'Content-Type': 'application/json' } }); const us = await userStore(currentUser.id); const item = await us.create(b); return new Response(JSON.stringify({ success: true, data: item }), { status: 201, headers: { ...sh, 'Content-Type': 'application/json' } }); }

    const idM = path.match(/^\/api\/notifications\/([a-f0-9-]+)$/);
    if (idM) {
      const e = auth(); if (e) return e;
      const us = await userStore(currentUser.id);
      if (request.method === 'GET') {
        const item = await us.getById(idM[1]);
        if (!item) return new Response(JSON.stringify({ success: false, code: 'api.notificationNotFound', message: 'Notification not found' }), { status: 404, headers: { ...sh, 'Content-Type': 'application/json' } });
        return new Response(JSON.stringify({ success: true, data: item }), { headers: { ...sh, 'Content-Type': 'application/json' } });
      }
      if (request.method === 'PUT') {
        const b = await request.json(); const fields = {};
        if (b.title !== undefined) fields.title = b.title;
        if (b.content !== undefined) fields.content = b.content;
        if (b.type !== undefined) fields.type = b.type;
        if (b.is_emergency !== undefined) fields.is_emergency = !!b.is_emergency;
        if (b.is_active !== undefined) fields.is_active = !!b.is_active;
        const item = await us.update(idM[1], fields);
        if (!item) return new Response(JSON.stringify({ success: false, code: 'api.notificationNotFound', message: 'Notification not found' }), { status: 404, headers: { ...sh, 'Content-Type': 'application/json' } });
        return new Response(JSON.stringify({ success: true, data: item }), { headers: { ...sh, 'Content-Type': 'application/json' } });
      }
      if (request.method === 'DELETE') {
        const ok = await us.delete(idM[1]);
        if (!ok) return new Response(JSON.stringify({ success: false, code: 'api.notificationNotFound', message: 'Notification not found' }), { status: 404, headers: { ...sh, 'Content-Type': 'application/json' } });
        return new Response(JSON.stringify({ success: true, code: 'api.deleteSuccess', message: 'Deleted' }), { headers: { ...sh, 'Content-Type': 'application/json' } });
      }
    }

    if (path === '/api/notifications/clear-all' && request.method === 'POST') { const e = auth(); if (e) return e; const us = await userStore(currentUser.id); await us.deleteAll(); return new Response(JSON.stringify({ success: true, code: 'api.clearedAll', message: 'Cleared' }), { headers: { ...sh, 'Content-Type': 'application/json' } }); }

    return new Response('Not Found', { status: 404, headers: sh });
  } catch (e) {
    console.error('[worker]', e && e.stack ? e.stack : e);
    return new Response(JSON.stringify({ success: false, code: 'api.serverError', message: `Internal error: ${e?.name || 'Error'}: ${e?.message || e}` }), { status: 500, headers: { ...sh, 'Content-Type': 'application/json' } });
  }
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event.env || {}));
});
