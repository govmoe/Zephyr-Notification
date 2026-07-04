/**
 * 小铃铛配置路由 (WidgetRouter)
 * 提供 widget 配置的读写接口
 */

const { Router } = require('express');
const authGuard = require('../middleware/authGuard');

function createWidgetRouter(widgetRepo, jwtSecret) {
  const router = Router();
  const guard = authGuard(jwtSecret);

  // ── 获取 widget 配置（公开，widget.js 调用） ──
  router.get('/widget-config', (req, res) => {
    const config = widgetRepo.getConfig();
    res.json({ success: true, data: config });
  });

  // ── 更新 widget 配置（需登录） ──
  router.put('/widget-config', guard, (req, res) => {
    const result = widgetRepo.saveConfig(req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, message: '配置校验失败', errors: result.errors });
    }
    res.json({ success: true, message: '配置已保存' });
  });

  // ── 重置 widget 配置（需登录） ──
  router.post('/widget-config/reset', guard, (req, res) => {
    widgetRepo.resetConfig();
    res.json({ success: true, message: '已重置为默认配置' });
  });

  return router;
}

module.exports = createWidgetRouter;
