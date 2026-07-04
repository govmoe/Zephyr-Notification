/**
 * 通知路由 (NotifyRouter)
 * 通知 CRUD 的 HTTP 路由处理器
 */

const { Router } = require('express');
const authGuard = require('../middleware/authGuard');
const NotifyDto = require('../restDto/notifyDto');

function createNotifyRouter(notifyService, jwtSecret) {
  const router = Router();
  const guard = authGuard(jwtSecret);

  // 后台管理接口（需要登录）
  router.get('/notifications', guard, async (req, res) => {
    const data = await notifyService.getAll(req.user.id);
    res.json(NotifyDto.success(data));
  });

  // 公共接口（小铃铛用）
  router.get('/notifications/active', async (req, res) => {
    const userId = req.query.u;
    let data;
    if (userId) {
      data = await notifyService.getActive(userId);
    } else {
      data = await notifyService.getActivePublic();
    }
    res.json(NotifyDto.success(data));
  });

  router.get('/notifications/emergency', async (req, res) => {
    const data = await notifyService.getEmergencyPublic();
    res.json(NotifyDto.success(data));
  });

  // SSE 实时推送（必须放在 :id 路由之前）
  router.get('/notifications/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff'
    });
    res.write('data: connected\n\n');

    // 注册客户端（由上层管理 sseClients Set）
    if (req.app.locals.sseClients) {
      req.app.locals.sseClients.add(res);
      req.on('close', () => req.app.locals.sseClients.delete(res));
    }
  });

  // 管理接口（需要登录）
  router.get('/notifications/:id', guard, async (req, res) => {
    const item = await notifyService.getById(req.user.id, req.params.id);
    if (!item) return res.status(404).json(NotifyDto.error('通知不存在'));
    res.json(NotifyDto.success(item));
  });

  router.post('/notifications', guard, async (req, res) => {
    const result = NotifyDto.validateCreate(req.body);
    if (!result.valid) return res.status(400).json(NotifyDto.error(result.message));

    const item = await notifyService.create(req.user.id, result.data);
    res.status(201).json(NotifyDto.success(item));
  });

  router.put('/notifications/:id', guard, async (req, res) => {
    const result = NotifyDto.validateUpdate(req.body);
    if (!result.valid) return res.status(400).json(NotifyDto.error(result.message));

    const item = await notifyService.update(req.user.id, req.params.id, result.fields);
    if (!item) return res.status(404).json(NotifyDto.error('通知不存在'));
    res.json(NotifyDto.success(item));
  });

  router.delete('/notifications/:id', guard, async (req, res) => {
    const ok = await notifyService.delete(req.user.id, req.params.id);
    if (!ok) return res.status(404).json(NotifyDto.error('通知不存在'));
    res.json(NotifyDto.message('删除成功'));
  });

  router.post('/notifications/clear-all', guard, async (req, res) => {
    await notifyService.deleteAll(req.user.id);
    res.json(NotifyDto.message('已清空所有通知'));
  });

  // 获取嵌入代码
  router.get('/widget-code', (req, res) => {
    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = `${protocol}://${host}`;
    const userId = req.query.u || '';
    const code = `<script src="${baseUrl}/widget.js${userId ? '?u=' + userId : ''}"></script>`;
    res.json(NotifyDto.success(code));
  });

  return router;
}

module.exports = createNotifyRouter;
