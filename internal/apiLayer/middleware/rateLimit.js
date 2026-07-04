/**
 * 请求限流中间件
 * 基于内存的简易 IP 限流（单进程适用）
 */

const rateLimitMap = new Map();
// 每分钟重置
setInterval(() => rateLimitMap.clear(), 60000);

function rateLimit(req, res, next) {
  if (req.path.startsWith('/api/')) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const count = (rateLimitMap.get(ip) || 0) + 1;
    if (count > 100) {
      return res.status(429).json({ success: false, message: '请求过于频繁' });
    }
    rateLimitMap.set(ip, count);
  }
  next();
}

module.exports = rateLimit;
