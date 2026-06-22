import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();
app.use('/*', cors());

// ---- file contents ----
const WIDGET_JS = `__WIDGET_JS__`;
const ADMIN_HTML = `__ADMIN_HTML__`;
const ADMIN_CSS = `__ADMIN_CSS__`;
const ADMIN_JS = `__ADMIN_JS__`;
const PREVIEW_HTML = `__PREVIEW_HTML__`;

// ---- static file routes ----
app.get('/widget.js', c => c.newResponse(WIDGET_JS, 200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' }));
app.get('/admin.html', c => c.html(ADMIN_HTML));
app.get('/admin.css', c => c.newResponse(ADMIN_CSS, 200, { 'Content-Type': 'text/css; charset=utf-8' }));
app.get('/admin.js', c => c.newResponse(ADMIN_JS, 200, { 'Content-Type': 'application/javascript; charset=utf-8' }));
app.get('/preview.html', c => c.html(PREVIEW_HTML));
app.get('/', c => c.redirect('/admin.html'));

// ---- KV 存储 ----
function store(env) {
  const KV = env.NOTIFICATIONS;
  return {
    async getAll() {
      const raw = await KV.get('notifications', 'json');
      return (raw || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    async saveAll(list) { await KV.put('notifications', JSON.stringify(list)); },
    async getActive() { return (await this.getAll()).filter(n => n.is_active); },
    async getEmergency() { return (await this.getAll()).filter(n => n.is_emergency && n.is_active); },
    async getById(id) { return (await this.getAll()).find(n => n.id === id) || null; },
    async create({ title, content, type, is_emergency }) {
      const all = await this.getAll();
      const item = {
        id: crypto.randomUUID(), title, content: content || '', type: type || 'info',
        is_emergency: !!is_emergency, is_active: true,
        created_at: now(), updated_at: now()
      };
      all.push(item);
      await this.saveAll(all);
      return item;
    },
    async update(id, fields) {
      const all = await this.getAll();
      const idx = all.findIndex(n => n.id === id);
      if (idx === -1) return null;
      all[idx] = { ...all[idx], ...fields, updated_at: now() };
      await this.saveAll(all);
      return all[idx];
    },
    async delete(id) {
      const all = await this.getAll();
      const idx = all.findIndex(n => n.id === id);
      if (idx === -1) return { changes: 0 };
      all.splice(idx, 1);
      await this.saveAll(all);
      return { changes: 1 };
    },
    async deleteAll() { await KV.put('notifications', '[]'); }
  };
}

function now() { const d = new Date(); d.setHours(d.getHours() + 8); return d.toISOString().replace('T', ' ').slice(0, 19); }

// ---- API routes ----
app.get('/api/notifications', async c => c.json({ success: true, data: await store(c.env).getAll() }));
app.get('/api/notifications/active', async c => c.json({ success: true, data: await store(c.env).getActive() }));
app.get('/api/notifications/emergency', async c => c.json({ success: true, data: await store(c.env).getEmergency() }));

// SSE 实时推送 - 必须在 :id 之前
app.get('/api/notifications/stream', async c => {
  const db = store(c.env);
  let lastHash = '';
  const body = new ReadableStream({
    async start(controller) {
      controller.enqueue('data: connected\n\n');
      for (let i = 0; i < 300; i++) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          const raw = await c.env.NOTIFICATIONS.get('notifications');
          const hash = raw ? raw.length.toString() : '0';
          if (hash !== lastHash) {
            lastHash = hash;
            controller.enqueue('event: update\ndata: {}\n\n');
          }
        } catch (e) { break; }
      }
      controller.close();
    }
  });
  return new Response(body, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*' }
  });
});

app.get('/api/notifications/:id', async c => {
  const item = await store(c.env).getById(c.req.param('id'));
  if (!item) return c.json({ success: false, message: '通知不存在' }, 404);
  return c.json({ success: true, data: item });
});
app.post('/api/notifications', async c => {
  const body = await c.req.json();
  if (!body.title) return c.json({ success: false, message: '标题不能为空' }, 400);
  const item = await store(c.env).create(body);
  return c.json({ success: true, data: item }, 201);
});
app.put('/api/notifications/:id', async c => {
  const item = await store(c.env).update(c.req.param('id'), await c.req.json());
  if (!item) return c.json({ success: false, message: '通知不存在' }, 404);
  return c.json({ success: true, data: item });
});
app.delete('/api/notifications/:id', async c => {
  const r = await store(c.env).delete(c.req.param('id'));
  if (!r.changes) return c.json({ success: false, message: '通知不存在' }, 404);
  return c.json({ success: true, message: '删除成功' });
});
app.post('/api/notifications/clear-all', async c => { await store(c.env).deleteAll(); return c.json({ success: true, message: '已清空所有通知' }); });
app.get('/api/widget-code', c => {
  const u = new URL(c.req.url);
  return c.json({ success: true, data: `<script src="${u.protocol}//${u.host}/widget.js"></script>` });
});

export default app;
