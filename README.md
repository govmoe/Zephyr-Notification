# Notification System — 部署文档

## 项目结构

```
notification-system/
├── server.js          # Node.js 本地后端
├── database.js        # JSON 文件数据库
├── worker-base.js     # Cloudflare Worker 模板
├── worker.js          # Worker 入口（构建生成）
├── build-worker.js    # 内联打包脚本
├── wrangler.toml      # Worker 配置
├── package.json
├── .env.example       # 环境变量模板
└── public/
    ├── admin.html     # 后台管理
    ├── admin.css
    ├── admin.js
    ├── widget.js      # 前端悬浮小铃铛
    ├── widget.css
    └── preview.html   # 预览页面
```

## 功能特性

- GitHub OAuth 登录
- 多用户隔离（不同 GitHub 账号独立管理通知）
- 悬浮小铃铛组件（Material Design）
- 已读/未读标签页 + 分页
- 通知提示音（Web Audio）
- SSE 实时推送
- HTML 内容支持
- 搜索通知
- 移动端适配

---

## 一、本地开发

```bash
# 安装依赖
npm install

# 复制环境变量配置
cp .env.example .env

# 编辑 .env，填入 GitHub OAuth 凭据
# GITHUB_CLIENT_ID=你的ClientID
# GITHUB_CLIENT_SECRET=你的ClientSecret
# JWT_SECRET=随机字符串

# 启动
npm start
```

访问 http://localhost:3456/admin.html

> GitHub OAuth App 回调 URL：`http://localhost:3456/auth/github/callback`

---

## 二、部署到 Cloudflare Workers

### 1. 登录

```bash
npx wrangler login
```

### 2. 创建 KV 命名空间

```bash
npx wrangler kv namespace create NOTIFICATIONS
npx wrangler kv namespace create NOTIFICATIONS --preview
```

将输出的 `id` 和 `preview_id` 填入 `wrangler.toml`。

### 3. 配置 wrangler.toml

```toml
name = "notification-system"
main = "worker.js"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[[kv_namespaces]]
binding = "NOTIFICATIONS"
id = "你的KV_ID"
preview_id = "你的Preview_ID"

[vars]
GITHUB_CLIENT_ID = "你的GitHub OAuth Client ID"

[observability]
enabled = true
```

### 4. 设置密钥

```bash
echo "你的GitHub OAuth Client Secret" | npx wrangler secret put GITHUB_CLIENT_SECRET
```

### 5. 构建并部署

```bash
node build-worker.js && npx wrangler deploy
```

### 6. GitHub OAuth App 配置

回调 URL 设为：
```
https://你的域名.workers.dev/auth/github/callback
```

---

## 三、嵌入网站

在网页任意位置添加：

```html
<script src="https://你的域名.workers.dev/widget.js"></script>
```

---

## 四、更新部署

```bash
node build-worker.js && npx wrangler deploy
```

---

## 五、常用命令

| 命令 | 说明 |
|------|------|
| `npm start` | 本地启动 |
| `npx wrangler dev` | Worker 本地调试 |
| `npx wrangler deploy` | 部署 |
| `npx wrangler tail` | 实时日志 |
| `npx wrangler rollback` | 回滚 |
| `npx wrangler kv namespace list` | 列出 KV |

---

© 002.HK
