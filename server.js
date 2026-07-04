require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const https = require('https');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3456;

// ========== GitHub OAuth 配置 ==========
// 在 https://github.com/settings/developers 创建 OAuth App 并填入
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('[安全警告] 未设置 JWT_SECRET 环境变量，已使用随机密钥。重启后所有会话将失效。');
  console.warn('[安全警告] 请在 .env 中设置 JWT_SECRET=你的密钥');
}
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || `http://localhost:${PORT}/auth/github/callback`;

app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.disable('x-powered-by');

// 简易限流
const rateLimit = new Map();
app.use((req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  if (!rateLimit.has(ip)) rateLimit.set(ip, []);
  const requests = rateLimit.get(ip).filter(t => now - t < 60000);
  if (requests.length > 60) return res.status(429).json({ success: false, message: '请求过于频繁' });
  requests.push(now);
  rateLimit.set(ip, requests);
  next();
});

// ========== GitHub OAuth 路由 ==========

function githubRequest(urlPath, options = {}) {
  const url = new URL(urlPath);
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: { 'User-Agent': 'Notification-System', ...options.headers },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

app.get('/auth/github', (req, res) => {
  if (!GITHUB_CLIENT_ID) return res.status(500).json({ error: 'GitHub OAuth 未配置' });
  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=read:user&redirect_uri=${encodeURIComponent(GITHUB_CALLBACK_URL)}`;
  res.redirect(redirectUrl);
});

app.get('/auth/github/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/admin.html?error=no_code');
  try {
    const tokenRes = await githubRequest('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code, redirect_uri: GITHUB_CALLBACK_URL })
    });
    console.log('Token response:', tokenRes);
    if (!tokenRes.access_token) return res.redirect('/admin.html?error=token_failed');
    const user = await githubRequest('https://api.github.com/user', {
      headers: { 'Authorization': `Bearer ${tokenRes.access_token}`, 'Accept': 'application/json' }
    });
    console.log('User info:', user);
    const token = jwt.sign({ id: user.id, login: user.login, name: user.name, avatar: user.avatar_url }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('ns_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000,
      path: '/'
    });
    res.redirect('/admin.html');
  } catch (e) {
    console.error('Auth error:', e);
    res.redirect('/admin.html?error=auth_failed');
  }
});

app.get('/api/auth/me', (req, res) => {
  const token = req.cookies?.ns_token;
  if (!token) return res.json({ success: true, data: null });
  try {
    const user = jwt.verify(token, JWT_SECRET);
    res.json({ success: true, data: user });
  } catch {
    res.json({ success: true, data: null });
  }
});

app.get('/auth/logout', (req, res) => {
  res.clearCookie('ns_token');
  res.redirect('/admin.html');
});

// ========== 认证中间件 ==========

function authMiddleware(req, res, next) {
  const token = req.cookies?.ns_token;
  if (!token) return res.status(401).json({ success: false, message: '请先登录' });
  try {
    req.user = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (!req.user.id) throw new Error('invalid token');
    next();
  } catch {
    res.clearCookie('ns_token');
    res.status(401).json({ success: false, message: '登录已过期，请重新登录' });
  }
}

// ========== API 路由 ==========

// 后台管理接口（需要登录）
app.get('/api/notifications', authMiddleware, (req, res) => {
  res.json({ success: true, data: db.getAll(req.user.id) });
});

// 公共接口（小铃铛用）
app.get('/api/notifications/active', (req, res) => {
  const userId = req.query.u;
  if (userId) {
    res.json({ success: true, data: db.getActive(userId) });
  } else {
    res.json({ success: true, data: db.getActivePublic() });
  }
});

app.get('/api/notifications/emergency', (req, res) => {
  res.json({ success: true, data: db.getEmergencyPublic() });
});

// SSE 实时推送 - must be before :id route
const sseClients = new Set();

app.get('/api/notifications/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.write('data: connected\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

function notifySSE() {
  sseClients.forEach(client => {
    client.write('event: update\ndata: {}\n\n');
  });
}

const _create = db.create; const _update = db.update;
const _delete = db.delete; const _deleteAll = db.deleteAll;
db.create = (...args) => { const r = _create(...args); notifySSE(); return r; };
db.update = (...args) => { const r = _update(...args); notifySSE(); return r; };
db.delete = (...args) => { const r = _delete(...args); notifySSE(); return r; };
db.deleteAll = (...args) => { const r = _deleteAll(...args); notifySSE(); return r; };

// 管理接口（需要登录）
app.get('/api/notifications/:id', authMiddleware, (req, res) => {
  const item = db.getById(req.user.id, req.params.id);
  if (!item) return res.status(404).json({ success: false, message: '通知不存在' });
  res.json({ success: true, data: item });
});

app.post('/api/notifications', authMiddleware, (req, res) => {
  const { title, content, type, is_emergency } = req.body;
  if (!title || typeof title !== 'string') return res.status(400).json({ success: false, message: '标题不能为空' });
  if (title.length > 200) return res.status(400).json({ success: false, message: '标题过长' });
  if (content && typeof content !== 'string') return res.status(400).json({ success: false, message: '内容格式错误' });
  if (content && content.length > 10000) return res.status(400).json({ success: false, message: '内容过长' });
  if (type && !['info', 'success', 'warning', 'error'].includes(type)) return res.status(400).json({ success: false, message: '无效的通知类型' });
  const item = db.create(req.user.id, { title, content, type, is_emergency: !!is_emergency });
  res.status(201).json({ success: true, data: item });
});

app.put('/api/notifications/:id', authMiddleware, (req, res) => {
  const item = db.update(req.user.id, req.params.id, req.body);
  if (!item) return res.status(404).json({ success: false, message: '通知不存在' });
  res.json({ success: true, data: item });
});

app.delete('/api/notifications/:id', authMiddleware, (req, res) => {
  const result = db.delete(req.user.id, req.params.id);
  if (result.changes === 0) return res.status(404).json({ success: false, message: '通知不存在' });
  res.json({ success: true, message: '删除成功' });
});

app.post('/api/notifications/clear-all', authMiddleware, (req, res) => {
  db.deleteAll(req.user.id);
  res.json({ success: true, message: '已清空所有通知' });
});

// 获取嵌入代码（支持用户隔离）
app.get('/api/widget-code', (req, res) => {
  const host = req.get('host');
  const protocol = req.protocol;
  const baseUrl = `${protocol}://${host}`;
  const userId = req.query.u || '';
  const code = `<script src="${baseUrl}/widget.js${userId ? '?u=' + userId : ''}"></script>`;
  res.json({ success: true, data: code });
});

app.listen(PORT, () => {
  console.log(`通知系统已启动: http://localhost:${PORT}`);
  console.log(`后台管理: http://localhost:${PORT}/admin.html`);
  console.log(`预览页面: http://localhost:${PORT}/preview.html`);
});
