/**
 * Netlify Function 入口
 * 将 Express 应用包装为 Netlify Function
 * 
 * 使用方式：
 * 1. 部署到 Netlify 时自动使用此文件
 * 2. 需要在 Netlify 后台设置环境变量：
 *    - GITHUB_CLIENT_ID
 *    - GITHUB_CLIENT_SECRET
 *    - JWT_SECRET
 *    - GITHUB_CALLBACK_URL (可选)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const serverless = require('serverless-http');
const db = require('../../database');
const oauth2 = require('../../oauth2');
const GitHubProvider = require('../../oauth2/providers/github');

const app = express();
const PORT = process.env.PORT || 3456;

// ========== JWT 密钥管理 ==========
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('[安全警告] 未设置 JWT_SECRET 环境变量，已使用运行时随机密钥。');
  console.warn('[安全警告] 请在 Netlify 后台设置 JWT_SECRET 环境变量。');
}
const RUNTIME_JWT_SECRET = JWT_SECRET;

// ========== OAuth2 Provider 注册 ==========
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || '';

oauth2.register('github', new GitHubProvider({
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackUrl: GITHUB_CALLBACK_URL
}));

// ========== 安全中间件 ==========
app.use((req, res, next) => {
  res.setHeader('X-Powered-By', '');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  const pathname = req.path;
  if (pathname === '/admin.html' || pathname === '/admin.js' || pathname.startsWith('/api/')) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' data:; connect-src 'self' https:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"
    );
  }
  next();
});

app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// ========== 通用 OAuth2 路由 ==========

app.get('/api/auth/providers', (req, res) => {
  const host = req.get('host');
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const baseUrl = `${protocol}://${host}`;
  const providers = oauth2.getConfiguredProviders(baseUrl);
  res.json({ success: true, data: providers });
});

app.get('/auth/:provider', (req, res) => {
  const { provider } = req.params;
  try {
    const authUrl = oauth2.getAuthUrl(provider);
    res.redirect(authUrl);
  } catch (e) {
    if (e.message.includes('not configured')) {
      return res.status(500).json({ error: `${provider} OAuth 未配置` });
    }
    res.status(400).json({ error: `未知的 OAuth provider: ${provider}` });
  }
});

app.get('/auth/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  const { code } = req.query;
  if (!code) return res.redirect('/admin.html?error=no_code');

  try {
    const user = await oauth2.handleCallback(provider, code);
    const token = jwt.sign(
      { id: user.id, login: user.login, name: user.name, avatar: user.avatar, provider: user.provider },
      RUNTIME_JWT_SECRET,
      { expiresIn: '7d', algorithm: 'HS256' }
    );
    res.cookie('ns_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000,
      path: '/'
    });
    res.redirect('/admin.html');
  } catch (e) {
    console.error(`[${provider}] Auth error:`, e.message);
    res.redirect(`/admin.html?error=auth_failed&provider=${provider}`);
  }
});

app.get('/api/auth/me', (req, res) => {
  const token = req.cookies?.ns_token;
  if (!token) return res.json({ success: true, data: null });
  try {
    const user = jwt.verify(token, RUNTIME_JWT_SECRET, { algorithms: ['HS256'] });
    res.json({ success: true, data: user });
  } catch {
    res.json({ success: true, data: null });
  }
});

app.get('/auth/logout', (req, res) => {
  res.clearCookie('ns_token', { path: '/' });
  res.redirect('/admin.html');
});

// ========== 认证中间件 ==========
function authMiddleware(req, res, next) {
  const token = req.cookies?.ns_token;
  if (!token) return res.status(401).json({ success: false, message: '请先登录' });
  try {
    req.user = jwt.verify(token, RUNTIME_JWT_SECRET, { algorithms: ['HS256'] });
    if (!req.user || !req.user.id) throw new Error('invalid token');
    next();
  } catch (e) {
    res.clearCookie('ns_token', { path: '/' });
    return res.status(401).json({ success: false, message: '登录已过期，请重新登录' });
  }
}

// ========== API 路由 ==========

app.get('/api/notifications', authMiddleware, (req, res) => {
  res.json({ success: true, data: db.getAll(req.user.id) });
});

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

// SSE (Netlify Functions 不支持持久连接，这里作为 fallback)
app.get('/api/notifications/stream', (req, res) => {
  res.json({ success: true, message: 'SSE 不适用于 Netlify Functions，请使用 Node.js 或 Cloudflare Workers 部署以支持实时推送' });
});

const sseClients = new Set();
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
  const fields = {};
  if (req.body.title !== undefined) {
    if (typeof req.body.title !== 'string' || req.body.title.length > 200) return res.status(400).json({ success: false, message: '标题无效' });
    fields.title = req.body.title;
  }
  if (req.body.content !== undefined) {
    if (typeof req.body.content !== 'string' || req.body.content.length > 10000) return res.status(400).json({ success: false, message: '内容无效' });
    fields.content = req.body.content;
  }
  if (req.body.type !== undefined) {
    if (!['info', 'success', 'warning', 'error'].includes(req.body.type)) return res.status(400).json({ success: false, message: '类型无效' });
    fields.type = req.body.type;
  }
  if (req.body.is_emergency !== undefined) fields.is_emergency = !!req.body.is_emergency;
  if (req.body.is_active !== undefined) fields.is_active = !!req.body.is_active;
  const item = db.update(req.user.id, req.params.id, fields);
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

app.get('/api/widget-code', (req, res) => {
  const host = req.get('host');
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const baseUrl = `${protocol}://${host}`;
  const userId = req.query.u || '';
  const code = `<script src="${baseUrl}/widget.js${userId ? '?u=' + userId : ''}"></script>`;
  res.json({ success: true, data: code });
});

// 导出 Netlify Function handler
exports.handler = serverless(app);
