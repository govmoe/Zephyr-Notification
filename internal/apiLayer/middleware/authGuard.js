/**
 * JWT 认证守卫中间件
 * 验证请求中的 ns_token cookie，将用户信息注入 req.user
 * @param {string} jwtSecret - JWT 签名密钥
 * @returns {function} Express 中间件
 */

const jwt = require('jsonwebtoken');

function authGuard(jwtSecret) {
  return (req, res, next) => {
    const token = req.cookies?.ns_token;
    if (!token) {
      return res.status(401).json({ success: false, message: '请先登录' });
    }

    try {
      const user = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
      if (!user || !user.id) throw new Error('invalid token');
      req.user = user;
      next();
    } catch (e) {
      res.clearCookie('ns_token', { path: '/' });
      return res.status(401).json({ success: false, message: '登录已过期，请重新登录' });
    }
  };
}

module.exports = authGuard;
