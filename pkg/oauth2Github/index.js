/**
 * GitHub OAuth2 Provider
 */
class OAuth2Github {
  constructor(options = {}) {
    this.clientId = options.clientId || process.env.GITHUB_CLIENT_ID || '';
    this.clientSecret = options.clientSecret || process.env.GITHUB_CLIENT_SECRET || '';
    this.callbackUrl = options.callbackUrl || process.env.GITHUB_CALLBACK_URL || '';
  }

  get name() { return 'github'; }
  get displayName() { return 'GitHub'; }
  get icon() {
    return '<svg viewBox="0 0 16 16" style="width:20px;height:20px"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';
  }

  isConfigured() {
    return !!(this.clientId && this.clientSecret);
  }

  getAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: 'read:user',
      redirect_uri: this.callbackUrl
    });
    if (state) params.set('state', state);
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCode(code) {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Notification-System/1.0'
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.callbackUrl
      })
    });
    return res.json();
  }

  async getUserInfo(accessToken) {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'User-Agent': 'Notification-System/1.0'
      }
    });
    const user = await res.json();
    return {
      id: String(user.id),
      login: user.login,
      name: user.name || user.login,
      avatar: user.avatar_url,
      email: user.email || '',
      provider: this.name
    };
  }
}

module.exports = OAuth2Github;
