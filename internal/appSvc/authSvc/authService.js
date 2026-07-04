/**
 * 认证应用服务 (AuthService)
 * 编排认证流程：OAuth2 provider 回调、密码登录/注册 → 签发 JWT
 * 屏蔽认证协议细节对上层的影响
 */

const jwt = require('jsonwebtoken');
const UserEntity = require('../../domainCond/userAuth/userEntity');

class AuthService {
  /**
   * @param {import('../../../pkg/oauth2Mgr/index')} oauth2Mgr - OAuth2 管理器
   * @param {object} userRepo - 用户凭证存储
   * @param {string} jwtSecret - JWT 签名密钥
   * @param {object} [cookieOpts] - Cookie 配置
   */
  constructor(oauth2Mgr, userRepo, jwtSecret, cookieOpts = {}) {
    this.oauth2Mgr = oauth2Mgr;
    this.userRepo = userRepo;
    this.jwtSecret = jwtSecret;
    this.cookieOpts = {
      httpOnly: true,
      secure: cookieOpts.secure !== undefined ? cookieOpts.secure : process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000,
      path: '/',
      ...cookieOpts
    };
  }

  /** 获取已配置的 providers 列表（含密码登录选项） */
  getProviders(baseUrl) {
    const oauthList = this.oauth2Mgr.getConfiguredProviders(baseUrl);
    const hasPasswordAuth = true; // 密码登录始终可用
    return {
      oauth: oauthList,
      password: hasPasswordAuth
    };
  }

  /** 获取 OAuth2 授权 URL */
  getAuthUrl(providerName) {
    return this.oauth2Mgr.getAuthUrl(providerName);
  }

  /**
   * 处理 OAuth2 回调，返回 JWT 令牌和 cookie 配置
   * @param {string} providerName
   * @param {string} code
   * @returns {Promise<{token: string, user: object, cookie: object}>}
   */
  async handleCallback(providerName, code) {
    const user = await this.oauth2Mgr.handleCallback(providerName, code);

    const token = jwt.sign(
      {
        id: user.id,
        login: user.login,
        name: user.name,
        avatar: user.avatar,
        provider: user.provider
      },
      this.jwtSecret,
      { expiresIn: '7d', algorithm: 'HS256' }
    );

    return {
      token,
      user: { ...user },
      cookie: { ...this.cookieOpts }
    };
  }

  /**
   * 密码注册
   * @param {string} username
   * @param {string} password
   * @returns {{ success: boolean, message: string, user?: object }}
   */
  register(username, password) {
    // 校验用户名
    const nameErr = UserEntity.validateUsername(username);
    if (nameErr) return { success: false, message: nameErr };

    // 校验密码
    const pwdErr = UserEntity.validatePassword(password);
    if (pwdErr) return { success: false, message: pwdErr };

    // 检查重复
    if (this.userRepo.exists(username)) {
      return { success: false, message: '用户名已存在' };
    }

    // 密码加密
    const { hash, salt } = UserEntity.hashPassword(password);
    const user = this.userRepo.create(username, hash, salt);

    return {
      success: true,
      message: '注册成功',
      user
    };
  }

  /**
   * 密码登录
   * @param {string} username
   * @param {string} password
   * @returns {{ success: boolean, message: string, token?: string, cookie?: object, user?: object }}
   */
  login(username, password) {
    if (!username || !password) {
      return { success: false, message: '用户名和密码不能为空' };
    }

    const stored = this.userRepo.findByUsername(username);
    if (!stored) {
      return { success: false, message: '用户名或密码错误' };
    }

    const valid = UserEntity.verifyPassword(password, stored.salt, stored.hash);
    if (!valid) {
      return { success: false, message: '用户名或密码错误' };
    }

    const userPayload = {
      id: `local:${stored.username}`,
      login: stored.username,
      name: stored.username,
      avatar: '',
      provider: 'password'
    };

    const token = jwt.sign(userPayload, this.jwtSecret, {
      expiresIn: '7d',
      algorithm: 'HS256'
    });

    return {
      success: true,
      message: '登录成功',
      token,
      user: userPayload,
      cookie: { ...this.cookieOpts }
    };
  }

  /** 验证 JWT，返回用户信息 */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret, { algorithms: ['HS256'] });
    } catch {
      return null;
    }
  }
}

module.exports = AuthService;
