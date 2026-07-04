/**
 * 认证路由 (AuthRouter)
 * OAuth2 登录/回调、密码登录/注册、用户信息、语言文件的 HTTP 路由处理器
 */

const { Router } = require('express');
const path = require('path');
const fs = require('fs');

function createAuthRouter(authService) {
  const router = Router();

  // ── 获取可用登录方式 ──
  router.get('/auth/providers', (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    const providers = authService.getProviders(baseUrl);
    res.json({ success: true, data: providers });
  });

  // ── 密码注册 ──
  router.post('/auth/register', (req, res) => {
    const { username, password } = req.body || {};
    const result = authService.register(username, password);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }
    res.json({ success: true, message: result.message });
  });

  // ── 密码登录 ──
  router.post('/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    const result = authService.login(username, password);
    if (!result.success) {
      return res.status(401).json({ success: false, message: result.message });
    }
    res.cookie('ns_token', result.token, result.cookie);
    res.json({ success: true, message: result.message, data: result.user });
  });

  // ── 获取当前用户信息 ──
  router.get('/auth/me', (req, res) => {
    const token = req.cookies?.ns_token;
    if (!token) return res.json({ success: true, data: null });

    const user = authService.verifyToken(token);
    if (!user) return res.json({ success: true, data: null });
    res.json({ success: true, data: user });
  });

  // ── i18n 语言文件 ──
  router.get('/i18n/:locale.json', (req, res) => {
    const { locale } = req.params;
    const localesDir = path.join(__dirname, '..', '..', '..', 'locales');
    const filePath = path.join(localesDir, `${locale}.json`);

    try {
      if (!fs.existsSync(filePath)) {
        // 回退到中文
        const fallbackPath = path.join(localesDir, 'zh-CN.json');
        const data = fs.readFileSync(fallbackPath, 'utf8');
        res.json(JSON.parse(data));
        return;
      }
      const data = fs.readFileSync(filePath, 'utf8');
      res.json(JSON.parse(data));
    } catch {
      res.json({});
    }
  });

  return router;
}

module.exports = createAuthRouter;
