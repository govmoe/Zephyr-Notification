/**
 * 安全头中间件
 * 为响应添加 HTTP 安全头，防止常见 Web 攻击
 */

function securityHead(req, res, next) {
  // 禁用 X-Powered-By
  res.setHeader('X-Powered-By', '');
  // 防止 MIME 类型嗅探
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // 防止点击劫持
  res.setHeader('X-Frame-Options', 'DENY');
  // 启用浏览器 XSS 过滤
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // 引用策略
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // CSP：仅对管理页面和 API 施加严格策略
  // widget.js 是动态嵌入到外部网站的，不做 CSP 限制
  const pathname = req.path;
  if (pathname === '/admin.html' || pathname.startsWith('/admin.') || pathname.startsWith('/api/')) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' data:; connect-src 'self' https:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"
    );
  }

  next();
}

module.exports = securityHead;
