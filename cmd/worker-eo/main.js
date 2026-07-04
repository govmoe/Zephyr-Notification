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
const ADMIN_HTML = `__ADMIN_HTML__`;
const ADMIN_CSS = `__ADMIN_CSS__`;
const ADMIN_JS = `__ADMIN_JS__`;
const PREVIEW_HTML = `__PREVIEW_HTML__`;

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

function now() { const d = new Date(); d.setHours(d.getHours() + 8); return d.toISOString().replace('T', ' ').slice(0, 19); }

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
  if (path === '/admin.html' || path.startsWith('/admin.') || path.startsWith('/api/')) {
    sh['Content-Security-Policy'] = "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' data:; connect-src 'self' https:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";
  }

  // 静态文件
  if (path === '/widget.js') return new Response(WIDGET_JS, { headers: { ...sh, 'Content-Type': 'application/javascript; charset=utf-8' } });
  if (path === '/admin.html') return new Response(ADMIN_HTML, { headers: { ...sh, 'Content-Type': 'text/html; charset=utf-8' } });
  if (path === '/admin.css') return new Response(ADMIN_CSS, { headers: { ...sh, 'Content-Type': 'text/css; charset=utf-8' } });
  if (path === '/admin.js') return new Response(ADMIN_JS, { headers: { ...sh, 'Content-Type': 'application/javascript; charset=utf-8' } });
  if (path === '/preview.html') return new Response(PREVIEW_HTML, { headers: { ...sh, 'Content-Type': 'text/html; charset=utf-8' } });
  if (path === '/' || path === '') return Response.redirect(`${baseUrl}/admin.html`, 302);

  // 认证
  const providers = createProviders(env, baseUrl);
  if (path === '/api/auth/providers') {
    const list = [];
    for (const [n, p] of providers) if (p.isConfigured()) list.push({ name: n, displayName: p.displayName, icon: p.icon, authUrl: `${baseUrl}/auth/${n}` });
    return new Response(JSON.stringify({ success: true, data: list }), { headers: { ...sh, 'Content-Type': 'application/json' } });
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
    if (!currentUser?.id) return new Response(JSON.stringify({ success: false, message: '请先登录' }), { status: 401, headers: { ...sh, 'Content-Type': 'application/json' } });
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
    if (path === '/api/notifications/stream') return new Response(JSON.stringify({ success: true, message: 'EdgeOne 不支持 SSE' }), { headers: { ...sh, 'Content-Type': 'application/json' } });
    if (path === '/api/widget-code') {
      const uid = url.searchParams.get('u') || '';
      return new Response(JSON.stringify({ success: true, data: `<script src="${baseUrl}/widget.js${uid ? '?u=' + uid : ''}"></script>` }), { headers: { ...sh, 'Content-Type': 'application/json' } });
    }

    if (path === '/api/notifications' && request.method === 'GET') { const e = auth(); if (e) return e; const us = await userStore(currentUser.id); return new Response(JSON.stringify({ success: true, data: await us.getAll() }), { headers: { ...sh, 'Content-Type': 'application/json' } }); }
    if (path === '/api/notifications' && request.method === 'POST') { const e = auth(); if (e) return e; const b = await request.json(); if (!b?.title) return new Response(JSON.stringify({ success: false, message: '标题不能为空' }), { status: 400, headers: { ...sh, 'Content-Type': 'application/json' } }); const us = await userStore(currentUser.id); const item = await us.create(b); return new Response(JSON.stringify({ success: true, data: item }), { status: 201, headers: { ...sh, 'Content-Type': 'application/json' } }); }

    const idM = path.match(/^\/api\/notifications\/([a-f0-9-]+)$/);
    if (idM) {
      const e = auth(); if (e) return e;
      const us = await userStore(currentUser.id);
      if (request.method === 'GET') {
        const item = await us.getById(idM[1]);
        if (!item) return new Response(JSON.stringify({ success: false, message: '通知不存在' }), { status: 404, headers: { ...sh, 'Content-Type': 'application/json' } });
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
        if (!item) return new Response(JSON.stringify({ success: false, message: '通知不存在' }), { status: 404, headers: { ...sh, 'Content-Type': 'application/json' } });
        return new Response(JSON.stringify({ success: true, data: item }), { headers: { ...sh, 'Content-Type': 'application/json' } });
      }
      if (request.method === 'DELETE') {
        const ok = await us.delete(idM[1]);
        if (!ok) return new Response(JSON.stringify({ success: false, message: '通知不存在' }), { status: 404, headers: { ...sh, 'Content-Type': 'application/json' } });
        return new Response(JSON.stringify({ success: true, message: '删除成功' }), { headers: { ...sh, 'Content-Type': 'application/json' } });
      }
    }

    if (path === '/api/notifications/clear-all' && request.method === 'POST') { const e = auth(); if (e) return e; const us = await userStore(currentUser.id); await us.deleteAll(); return new Response(JSON.stringify({ success: true, message: '已清空' }), { headers: { ...sh, 'Content-Type': 'application/json' } }); }

    return new Response('Not Found', { status: 404, headers: sh });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: '服务器内部错误' }), { status: 500, headers: { ...sh, 'Content-Type': 'application/json' } });
  }
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event.env || {}));
});
