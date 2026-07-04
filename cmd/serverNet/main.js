/**
 * ServerNet - Netlify Functions 入口
 * 将 Express 应用包装为 serverless-http 函数
 *
 * 部署方式：
 *   netlify deploy --prod
 *
 * 注意：Netlify Functions 不支持 SSE 持久连接，
 *       SSE 端点将返回提示信息，建议使用 Node.js 或 CF Workers 部署。
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const serverless = require('serverless-http');

const FileRepo = require('../../internal/infraPack/storeFile/fileRepo');
const NotifyService = require('../../internal/appSvc/notifySvc/notifyService');
const AuthService = require('../../internal/appSvc/authSvc/authService');
const securityHead = require('../../internal/apiLayer/middleware/securityHead');
const rateLimit = require('../../internal/apiLayer/middleware/rateLimit');
const createAuthRouter = require('../../internal/apiLayer/routeAuth/authHandler');
const createNotifyRouter = require('../../internal/apiLayer/routeNotify/notifyHandler');
const oauth2 = require('../../pkg/oauth2Mgr');
const OAuth2Github = require('../../pkg/oauth2Github');

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const DB_PATH = path.join(__dirname, '..', '..', 'data.json');

// 注册 OAuth2
const hostUrl = process.env.URL || process.env.NETLIFY_URL || 'https://your-site.netlify.app';
const callbackUrl = `${hostUrl}/auth/github/callback`;
oauth2.register('github', new OAuth2Github({
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackUrl
}));

// 依赖注入
const repo = new FileRepo(DB_PATH);
const sseClients = new Set();
function notifySSE() { sseClients.forEach(c => { try { c.write('event: update\ndata: {}\n\n'); } catch {} }); }
const notifyService = new NotifyService(repo, notifySSE);
const authService = new AuthService(oauth2, JWT_SECRET, { secure: true });

// Express 应用
const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(securityHead);
app.use(rateLimit);
app.locals.sseClients = sseClients;

app.use('/', createAuthRouter(authService));
app.use('/', createNotifyRouter(notifyService, JWT_SECRET));

// 静态文件
app.use(express.static(path.join(__dirname, '..', '..', 'public')));
app.get('/widget.js', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'widget.js'), {
    headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' }
  });
});
app.get('/', (req, res) => res.redirect('/admin.html'));

exports.handler = serverless(app);
