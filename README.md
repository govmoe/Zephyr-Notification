# notice-hub · 风铃通知

在线通知管理系统，支持**密码登录**与 **OAuth2 认证**，可嵌入任意前端网站。

---

## 功能特性

- **双重认证体系**：密码登录（PBKDF2 加密） + OAuth2（GitHub/可扩展）
- **通知管理后台**：创建/编辑/搜索/删除通知，支持紧急标记
- **悬浮小铃铛组件**：Material Design，零依赖，可嵌入任意网站
- **实时推送**：SSE 服务端推送，通知即时到达
- **多用户隔离**：不同用户独立管理自己的通知
- **国际化**：简体中文 / English 双语支持
- **多平台部署**：Node.js / Cloudflare Workers / EdgeOne / Netlify

---

## 快速开始（本地开发）

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入必要的配置
```

### 3. 启动

```bash
npm start
```

访问 `http://localhost:3456/admin.html`

> 首次使用：在登录页面点击「注册账号」创建管理员账户，或配置 GitHub OAuth。

---

## 四层架构

```
notice-hub/
├── cmd/                       # 程序入口（各平台）
│   ├── serverApp/             # Express 服务器
│   ├── worker-cf/             # Cloudflare Workers
│   ├── worker-eo/             # 腾讯云 EdgeOne
│   └── serverNet/             # Netlify Functions
├── internal/
│   ├── apiLayer/              # HTTP 接口层
│   │   ├── middleware/        #   安全头/限流/JWT守卫
│   │   ├── routeAuth/         #   认证路由
│   │   ├── routeNotify/       #   通知 CRUD 路由
│   │   └── restDto/           #   请求/响应 DTO
│   ├── appSvc/                # 应用服务层
│   │   ├── authSvc/           #   认证编排
│   │   └── notifySvc/         #   通知编排
│   ├── domainCond/            # 领域层
│   │   ├── notifyModel/       #   通知实体 + 存储接口
│   │   └── userAuth/          #   用户实体 + 密码加密
│   └── infraPack/             # 基础设施层
│       ├── storeFile/         #   文件存储
│       ├── storeKv/           #   Cloudflare KV
│       └── storeMem/          #   内存存储
├── pkg/
│   ├── oauth2Mgr/             # OAuth2 管理器
│   └── oauth2Github/          # GitHub OAuth2 实现
├── locales/                   # i18n 语言文件
├── public/                    # 前端静态资源
│   ├── admin.html/admin.js/admin.css  # 管理后台
│   └── widget.js/widget.css           # 嵌入组件
├── scripts/                   # 构建脚本
├── configs/                   # 配置模板
└── docs/                      # 设计文档
```

---

## 密码登录

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/auth/register` | POST | 注册（需 body: { username, password }） |
| `/api/auth/login` | POST | 登录（需 body: { username, password }） |

**密码加密方案**：
- PBKDF2-HMAC-SHA256，迭代 310,000 次
- 随机 16 字节盐值，防止彩虹表攻击
- 恒定时间比较，防止时序攻击

---

## OAuth2 认证

### 支持的 Provider

| Provider | 配置变量 | 注册地址 |
|---|---|---|
| GitHub | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | [GitHub OAuth Apps](https://github.com/settings/developers) |
| Google (预留) | - | 按需扩展 |
| QQ (预留) | - | 按需扩展 |

### 添加自定义 Provider

1. 在 `pkg/` 下新建模块（参考 `oauth2Github`）
2. 实现 `getAuthUrl()` / `exchangeCode()` / `getUserInfo()` 接口
3. 在入口文件注册即可

---

## 部署

### Node.js (推荐)

```bash
npm start
# 或使用 PM2: pm2 start cmd/serverApp/main.js --name notice-hub
```

### Cloudflare Workers

```bash
# 1. 构建
node scripts/buildWorker.js
# 2. 配置 wrangler.toml（参考 wrangler.example.toml）
# 3. 部署
npx wrangler deploy
```

### 腾讯云 EdgeOne

```bash
node scripts/buildEdgeOne.js
# 在 EdgeOne 控制台创建边缘函数，粘贴 edgeone.js 内容
```

### Netlify

```bash
# 直接推送 git 仓库到 Netlify 自动部署
# 或在 Netlify 后台设置构建命令和 publish 目录
```

---

## 国际化

支持语言：简体中文（zh-CN）、English（en）

默认语言跟随浏览器设置，可在登录页或管理后台右上角切换。
语言设置保存在 `localStorage` 中。

---

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `JWT_SECRET` | 推荐 | JWT 签名密钥（`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`） |
| `GITHUB_CLIENT_ID` | 可选 | GitHub OAuth Client ID |
| `GITHUB_CLIENT_SECRET` | 可选 | GitHub OAuth Client Secret |
| `GITHUB_CALLBACK_URL` | 可选 | 自定义回调 URL |
| `PORT` | 否 | 服务端口（默认 3456） |
| `NODE_ENV` | 否 | 运行环境（production/development） |

---

## API 一览

| 端点 | 认证 | 说明 |
|---|---|---|
| `GET /api/auth/providers` | 否 | 获取可用登录方式 |
| `POST /api/auth/register` | 否 | 密码注册 |
| `POST /api/auth/login` | 否 | 密码登录 |
| `GET /api/auth/me` | 否 | 获取当前用户 |
| `GET /api/notifications` | 是 | 获取通知列表 |
| `POST /api/notifications` | 是 | 创建通知 |
| `PUT /api/notifications/:id` | 是 | 更新通知 |
| `DELETE /api/notifications/:id` | 是 | 删除通知 |
| `GET /api/notifications/active` | 否 | 获取公共活跃通知 |
| `GET /api/notifications/emergency` | 否 | 获取公共紧急通知 |
| `GET /api/notifications/stream` | 否 | SSE 实时推送 |
| `GET /api/i18n/:locale.json` | 否 | 获取语言文件 |

---

## 嵌入网站

在网页任意位置添加：

```html
<script src="https://你的域名/widget.js"></script>
```

---

## 许可证

MIT License

---

*Powered By [002.HK](https://github.com/govmoe/Zephyr-Notification) and [exyone-js](https://github.com/exyone-js)*
