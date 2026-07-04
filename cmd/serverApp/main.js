/**
 * ServerApp - Express 服务器入口
 * 职责：
 *   1. 加载环境变量，创建 JWT 密钥
 *   2. 注册 OAuth2 providers
 *   3. 组装中间件和路由（含密码认证）
 *   4. 启动 HTTP 服务器
 *
 * 依赖注入流程：
 *   FileRepo + UserRepo → NotifyService + AuthService → Router
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

// ---- 基础设施 ----
const FileRepo = require('../../internal/infraPack/storeFile/fileRepo');
const UserRepo = require('../../internal/infraPack/storeFile/userRepo');
const WidgetRepo = require('../../internal/infraPack/storeFile/widgetRepo');

// ---- 应用服务 ----
const NotifyService = require('../../internal/appSvc/notifySvc/notifyService');
const AuthService = require('../../internal/appSvc/authSvc/authService');

// ---- API 路由 ----
const securityHead = require('../../internal/apiLayer/middleware/securityHead');
const rateLimit = require('../../internal/apiLayer/middleware/rateLimit');
const createAuthRouter = require('../../internal/apiLayer/routeAuth/authHandler');
const createNotifyRouter = require('../../internal/apiLayer/routeNotify/notifyHandler');
const createWidgetRouter = require('../../internal/apiLayer/routeWidget/widgetHandler');

// ---- OAuth2 组件 ----
const oauth2 = require('../../pkg/oauth2Mgr');
const OAuth2Github = require('../../pkg/oauth2Github');

// ========== 配置 ==========
const PORT = process.env.PORT || 3456;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const DB_PATH = path.join(__dirname, '..', '..', 'data.json');

if (!process.env.JWT_SECRET) {
  console.warn('[安全警告] 未设置 JWT_SECRET 环境变量，已使用运行时随机密钥。');
}

// ========== 注册 OAuth2 Providers ==========
const callbackUrl = process.env.GITHUB_CALLBACK_URL || `http://localhost:${PORT}/auth/github/callback`;
oauth2.register('github', new OAuth2Github({
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackUrl
}));

// ========== 依赖注入 ==========
const repo = new FileRepo(DB_PATH);
const userRepo = new UserRepo(DB_PATH);
const widgetRepo = new WidgetRepo(DB_PATH);
const sseClients = new Set();

function notifySSE() {
  sseClients.forEach(client => {
    try { client.write('event: update\ndata: {}\n\n'); } catch (e) { /* ignore */ }
  });
}

const notifyService = new NotifyService(repo, notifySSE);
const authService = new AuthService(oauth2, userRepo, JWT_SECRET, {
  secure: process.env.NODE_ENV === 'production'
});

// ========== 创建 Express 应用 ==========
const app = express();
app.disable('x-powered-by');

app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(securityHead);
app.use(rateLimit);

app.locals.sseClients = sseClients;

// 路由
app.use('/', createAuthRouter(authService));
app.use('/', createNotifyRouter(notifyService, JWT_SECRET));
app.use('/', createWidgetRouter(widgetRepo, JWT_SECRET));

// 静态文件
app.use(express.static(path.join(__dirname, '..', '..', 'public')));

// widget.js 跨域
app.get('/widget.js', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'widget.js'), {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    }
  });
});

app.get('/', (req, res) => res.redirect('/admin.html'));

// ========== 启动 ==========
app.listen(PORT, () => {
  console.log(`≡ notice-hub (Express) ≡`);
  console.log(`  地址: http://localhost:${PORT}`);
  console.log(`  管理: http://localhost:${PORT}/admin.html`);
  console.log(`  预览: http://localhost:${PORT}/preview.html`);

  const configuredProviders = oauth2.getProviderNames()
    .filter(name => oauth2.get(name)?.isConfigured());
  if (configuredProviders.length > 0) {
    console.log(`  OAuth2: ${configuredProviders.join(', ')}`);
  }
  console.log(`  密码登录: 已启用`);
});
