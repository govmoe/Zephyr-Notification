/**
 * OAuth2 认证管理器 (OAuth2Mgr)
 * 支持多 provider 扩展，是认证领域的外层管理组件
 */
const crypto = require('crypto');

class OAuth2Mgr {
  constructor() {
    this.providers = new Map();
  }

  /**
   * 注册一个 OAuth2 provider
   * @param {string} name - provider 唯一标识
   * @param {object} provider - provider 实例，需实现接口:
   *   - name: string (getter)
   *   - displayName: string (getter)
   *   - icon: string (getter) - SVG 图标
   *   - isConfigured(): boolean
   *   - getAuthUrl(state): string
   *   - exchangeCode(code): Promise<{access_token, ...}>
   *   - getUserInfo(accessToken): Promise<{id, login, name, avatar, email, provider}>
   */
  register(name, provider) {
    this.providers.set(name, provider);
  }

  /** 获取指定 provider */
  get(name) {
    return this.providers.get(name);
  }

  /** 获取所有已注册的 provider 名称列表 */
  getProviderNames() {
    return Array.from(this.providers.keys());
  }

  /**
   * 获取所有已配置的 provider 信息（用于前端展示登录按钮）
   * @param {string} baseUrl
   * @returns {Array<{name, displayName, icon, authUrl}>}
   */
  getConfiguredProviders(baseUrl = '') {
    const list = [];
    for (const [name, provider] of this.providers) {
      if (provider.isConfigured()) {
        list.push({
          name: provider.name,
          displayName: provider.displayName,
          icon: provider.icon,
          authUrl: `${baseUrl}/auth/${name}`
        });
      }
    }
    return list;
  }

  /**
   * 生成 OAuth2 授权跳转 URL
   * @param {string} providerName
   * @param {string} [state]
   * @returns {string}
   */
  getAuthUrl(providerName, state) {
    const provider = this.providers.get(providerName);
    if (!provider) throw new Error(`Unknown provider: ${providerName}`);
    if (!provider.isConfigured()) throw new Error(`Provider ${providerName} is not configured`);
    return provider.getAuthUrl(state || crypto.randomBytes(16).toString('hex'));
  }

  /**
   * 处理 OAuth2 回调，交换 code 获取用户信息
   * @param {string} providerName
   * @param {string} code
   * @returns {Promise<{id, login, name, avatar, email, provider}>}
   */
  async handleCallback(providerName, code) {
    const provider = this.providers.get(providerName);
    if (!provider) throw new Error(`Unknown provider: ${providerName}`);

    const tokenData = await provider.exchangeCode(code);
    if (!tokenData.access_token) {
      throw new Error(`Failed to exchange code for ${providerName}: ${JSON.stringify(tokenData)}`);
    }

    const userInfo = await provider.getUserInfo(tokenData.access_token);
    if (!userInfo || !userInfo.id) {
      throw new Error(`Failed to get user info from ${providerName}`);
    }

    return userInfo;
  }
}

module.exports = new OAuth2Mgr();
module.exports.OAuth2Mgr = OAuth2Mgr;
