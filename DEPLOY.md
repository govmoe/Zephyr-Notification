# Notification System — 部署文档

## 项目地址

https://github.com/govmoe/Notification-System

## 功能

- GitHub OAuth 登录 · 多用户隔离
- 悬浮小铃铛（Material Design）· 已读/未读 · 分页
- SSE 实时推送 · 提示音 · HTML 内容 · 搜索
- Node.js 本地 + Cloudflare Workers 双模式

## 本地开发

```bash
npm install
cp .env.example .env   # 填入 GitHub OAuth 凭据
npm start              # http://localhost:3456
```

## 部署 Workers

```bash
npx wrangler login
npx wrangler kv namespace create NOTIFICATIONS
npx wrangler kv namespace create NOTIFICATIONS --preview
# 将 id / preview_id 填入 wrangler.toml
echo "secret" | npx wrangler secret put GITHUB_CLIENT_SECRET
node build-worker.js && npx wrangler deploy
```

## 嵌入

```html
<script src="https://你的域名.workers.dev/widget.js"></script>
```

---

Powered By [002.HK](https://github.com/govmoe/Notification-System)
