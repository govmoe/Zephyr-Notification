const API = '/api/notifications';
const $ = s => document.querySelector(s);
const $q = s => document.querySelectorAll(s);

// ═══════════════════════════════════
// i18n 国际化模块
// ═══════════════════════════════════

const i18n = {
  locale: 'zh-CN',
  strings: {},
  available: ['zh-CN', 'en'],
  displayNames: { 'zh-CN': '简体中文', 'en': 'English' },

  async init() {
    const saved = localStorage.getItem('ns_locale');
    this.locale = saved || (navigator.language?.startsWith('en') ? 'en' : 'zh-CN');
    await this.load(this.locale);
  },

  async load(locale) {
    try {
      const res = await fetch(`/api/i18n/${locale}.json`);
      this.strings = await res.json();
      this.locale = locale;
      localStorage.setItem('ns_locale', locale);
      document.documentElement.lang = locale;
      document.documentElement.dataset.locale = locale;
      this.applyDOM();
      this.updateSwitchers();
    } catch (e) {
      console.warn('i18n load failed:', e);
    }
  },

  t(key, fallback) {
    if (this.strings[key]) return this.strings[key];
    const pipeIdx = key.indexOf('|');
    if (pipeIdx > -1) {
      const template = this.strings[key.slice(0, pipeIdx)];
      if (template) return template.replace('{provider}', key.slice(pipeIdx + 1));
    }
    return fallback || key;
  },

  applyDOM() {
    $q('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (key) el.innerHTML = this.t(key, el.innerHTML);
    });
    $q('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      if (key) el.placeholder = this.t(key, el.placeholder);
    });
  },

  updateSwitchers() {
    $q('.lang-switcher').forEach(sel => {
      if (!sel) return;
      sel.innerHTML = this.available.map(l =>
        `<option value="${l}"${l === this.locale ? ' selected' : ''}>${this.displayNames[l] || l}</option>`
      ).join('');
      sel.value = this.locale;
    });
  }
};

function __(key, fallback) { return i18n.t(key, fallback); }

async function switchLang(locale) {
  await i18n.load(locale);
  if ($('#mainContainer')?.style.display === 'block') loadNotifications();
}

// ═══════════════════════════════════
// 工具函数
// ═══════════════════════════════════

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = i18n.t(msg, msg);
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2000);
}

async function fetchJSON(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const res = await fetch(url, { credentials: 'same-origin', headers, ...options });
  return res.json();
}

function mdToHtml(str) {
  if (!str) return '';
  str = escapeHtml(str);
  str = str.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  str = str.replace(/`([^`]+)`/g, '<code>$1</code>');
  str = str.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  str = str.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  str = str.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  str = str.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  str = str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  str = str.replace(/\*(.+?)\*/g, '<em>$1</em>');
  str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  str = str.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
  str = str.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  return str;
}

// ═══════════════════════════════════
// 事件委托（统一处理所有点击）
// ═══════════════════════════════════

document.body.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  switch (action) {
    // ── 模态弹窗 ──
    case 'open-preview':
      window.open('/preview.html', '_blank');
      break;
    case 'open-modal':
      openModal();
      break;
    case 'close-modal':
      closeModal();
      break;

    // ── 语言切换 ──
    case 'switch-lang':
      switchLang(btn.value);
      break;

    // ── 认证 ──
    case 'show-register':
      $('#passwordLoginForm').style.display = 'none';
      $('#registerForm').style.display = '';
      $('#loginError').style.display = 'none';
      break;
    case 'show-login':
      $('#registerForm').style.display = 'none';
      $('#passwordLoginForm').style.display = '';
      $('#loginError').style.display = 'none';
      break;

    // ── 通知操作 ──
    case 'reset-widget-config':
        resetWidgetConfig();
        break;
      case 'toggle-active':
        toggleActive(btn.dataset.id, btn.dataset.current === 'true');
        break;
    case 'toggle-emergency':
      toggleEmergency(btn.dataset.id, btn.dataset.set === 'true');
      break;
    case 'delete-notify':
      deleteNotification(btn.dataset.id);
      break;

    // ── 复制 ──
    case 'copy-code':
      copyCode();
      break;
  }
});

// ═══════════════════════════════════
// 模态弹窗
// ═══════════════════════════════════

function openModal() {
  $('#modalCode').classList.add('active');
  $('#modalOverlay').classList.add('active');
}

function closeModal() {
  $('#modalCode').classList.remove('active');
  $('#modalOverlay').classList.remove('active');
}

async function copyCode() {
  const ta = $('#embedCode');
  if (!ta) return;
  try {
    await navigator.clipboard.writeText(ta.value);
    toast(__('action.copied'));
  } catch {
    // fallback
    ta.select();
    document.execCommand('copy');
    toast(__('action.copied'));
  }
}

// ═══════════════════════════════════
// 认证
// ═══════════════════════════════════

async function loadProviders() {
  const providerList = $('#providerList');
  const loginError = $('#loginError');
  try {
    const res = await fetchJSON('/api/auth/providers');
    if (res.success && res.data) {
      const { oauth, password } = res.data;
      let html = '';

      if (oauth && oauth.length > 0) {
        html += oauth.map(p => `
          <a href="${escapeHtml(p.authUrl)}" class="btn-oauth">
            ${p.icon}
            <span>${__('login.oauthLogin', p.displayName + ' 登录').replace('{provider}', escapeHtml(p.displayName))}</span>
          </a>
        `).join('');
      }

      if (!oauth?.length && !password) {
        providerList.innerHTML = `<div class="provider-loading">${__('login.noProvider')}</div>`;
        loginError.style.display = 'block';
        loginError.textContent = __('login.noProviderHint');
        return;
      }

      providerList.innerHTML = html;

      document.querySelectorAll('.password-login-form').forEach(f => {
        if (password) {
          if (f.id === 'passwordLoginForm') f.style.display = '';
          else if (f.id === 'registerForm') f.style.display = 'none';
        } else {
          f.style.display = 'none';
        }
      });
    } else {
      providerList.innerHTML = `<div class="provider-loading">${__('login.noProvider')}</div>`;
    }
  } catch (e) {
    providerList.innerHTML = `<div class="provider-loading">${__('login.loadFailed')}</div>`;
    loginError.style.display = 'block';
    loginError.textContent = __('login.loadFailedHint');
  }
}

async function checkAuth() {
  const res = await fetchJSON('/api/auth/me');
  const userArea = $('#userInfo');
  const mainContainer = $('#mainContainer');
  const loginPage = $('#loginPage');

  if (res.success && res.data) {
    const user = res.data;
    mainContainer.style.display = 'block';
    loginPage.classList.remove('active');
    const displayName = escapeHtml(user.name || user.login);
    const providerLabel = user.provider ? ` (${user.provider})` : '';
    userArea.innerHTML = `
      ${user.avatar
        ? `<img src="${escapeHtml(user.avatar)}" alt="" class="user-avatar">`
        : `<div class="user-avatar-placeholder">${displayName[0].toUpperCase()}</div>`}
      <span class="user-name">${displayName}${providerLabel}</span>
      <a href="/auth/logout" class="user-logout">${__('login.logout')}</a>
    `;
    loadNotifications();
  } else {
    mainContainer.style.display = 'none';
    loginPage.classList.add('active');
    loadProviders();
  }
}

// ═══════════════════════════════════
// 密码登录表单提交
// ═══════════════════════════════════

$('#passwordLoginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const username = $('#loginUsername').value.trim();
  const password = $('#loginPassword').value;
  if (!username || !password) return toast(__('login.invalidCredentials'), 'error');

  try {
    const res = await fetchJSON('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (res.success) {
      toast(__('login.loginSuccess'));
      checkAuth();
    } else {
      toast(res.message || __('login.invalidCredentials'), 'error');
    }
  } catch { toast(__('login.loginFailed'), 'error'); }
});

$('#registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const username = $('#regUsername').value.trim();
  const password = $('#regPassword').value;
  if (!username || !password) return toast(__('login.invalidCredentials'), 'error');

  try {
    const res = await fetchJSON('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (res.success) {
      toast(__('login.registerSuccess'));
      $('#registerForm').style.display = 'none';
      $('#passwordLoginForm').style.display = '';
      $('#loginUsername').value = username;
      $('#loginPassword').value = '';
    } else {
      toast(res.message || __('login.registerFailed'), 'error');
    }
  } catch { toast(__('login.registerFailed'), 'error'); }
});

// ═══════════════════════════════════
// 通知列表
// ═══════════════════════════════════

async function loadNotifications() {
  const res = await fetchJSON(API);
  const list = $('#notificationList');
  const emergencyList = $('#emergencyList');
  const emergencyPanel = $('#emergencyPanel');
  const query = ($('#searchInput')?.value || '').toLowerCase();

  if (!res.success || !res.data.length) {
    list.innerHTML = `<div class="empty">${__('notify.empty')}</div>`;
    emergencyPanel.style.display = 'none';
    return;
  }

  const emergencies = res.data.filter(n => n.is_emergency && n.is_active);
  let all = res.data;

  if (query) {
    all = all.filter(n =>
      n.title.toLowerCase().includes(query) ||
      (n.content && n.content.toLowerCase().includes(query))
    );
  }

  if (emergencies.length > 0) {
    emergencyPanel.style.display = '';
    const fe = query
      ? emergencies.filter(n => n.title.toLowerCase().includes(query) || (n.content && n.content.toLowerCase().includes(query)))
      : emergencies;
    emergencyList.innerHTML = fe.length
      ? fe.map(n => renderItem(n)).join('')
      : `<div class="empty" style="padding:20px">${__('notify.noMatch')}</div>`;
  } else {
    emergencyPanel.style.display = 'none';
  }

  list.innerHTML = all.length
    ? all.map(n => renderItem(n)).join('')
    : `<div class="empty">${__('notify.noMatch')}</div>`;
}

function renderItem(n) {
  const typeLabels = {
    info: __('notify.typeInfo'),
    success: __('notify.typeSuccess'),
    warning: __('notify.typeWarning'),
    error: __('notify.typeError')
  };
  const cls = [];
  if (n.is_emergency) cls.push('emergency');
  if (!n.is_active) cls.push('inactive');

  return `
    <div class="notification-item ${cls.join(' ')}" data-id="${escapeHtml(n.id)}">
      <div class="dot ${escapeHtml(n.type)}"></div>
      <div class="info-main">
        <div class="info-title">
          ${escapeHtml(n.title)}
          ${n.is_emergency ? `<span class="badge emergency-badge">${__('notify.badgeEmergency')}</span>` : ''}
          <span class="badge type-badge">${typeLabels[n.type] || n.type}</span>
          ${!n.is_active ? `<span class="badge disabled-badge">${__('notify.badgeDisabled')}</span>` : ''}
        </div>
        ${n.content ? `<div class="info-content">${mdToHtml(n.content)}</div>` : ''}
        <div class="info-meta">ID: ${escapeHtml(n.id.slice(0, 8))}... | ${escapeHtml(n.created_at)}</div>
      </div>
      <div class="item-actions">
        <button data-action="toggle-active" data-id="${escapeHtml(n.id)}" data-current="${n.is_active}">${n.is_active ? __('notify.btnDisable') : __('notify.btnEnable')}</button>
        ${n.is_emergency
          ? `<button data-action="toggle-emergency" data-id="${escapeHtml(n.id)}" data-set="false">${__('notify.btnCancelEmergency')}</button>`
          : `<button data-action="toggle-emergency" data-id="${escapeHtml(n.id)}" data-set="true">${__('notify.btnSetEmergency')}</button>`}
        <button class="btn-del" data-action="delete-notify" data-id="${escapeHtml(n.id)}">${__('notify.btnDelete')}</button>
      </div>
    </div>`;
}

// 这些函数需要在渲染的按钮中被调用，通过事件委托处理
async function deleteNotification(id) {
  if (!confirm(__('action.deleteConfirm'))) return;
  const res = await fetchJSON(`${API}/${id}`, { method: 'DELETE' });
  if (res.success) { toast(__('action.deleteSuccess')); loadNotifications(); }
  else toast(res.message, 'error');
}

async function toggleActive(id, current) {
  const res = await fetchJSON(`${API}/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ is_active: current ? 0 : 1 })
  });
  if (res.success) loadNotifications();
  else toast(res.message, 'error');
}

async function toggleEmergency(id, set) {
  const res = await fetchJSON(`${API}/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ is_emergency: set ? 1 : 0 })
  });
  if (res.success) { toast(set ? __('action.setEmergencySuccess') : __('action.cancelEmergencySuccess')); loadNotifications(); }
  else toast(res.message, 'error');
}

// ═══════════════════════════════════
// 添加通知
// ═══════════════════════════════════

$('#formAdd').addEventListener('submit', async e => {
  e.preventDefault();
  const title = $('#title').value.trim();
  if (!title) return toast(__('notify.titleRequired'), 'error');

  const res = await fetchJSON(API, {
    method: 'POST',
    body: JSON.stringify({
      title,
      content: $('#content').value.trim(),
      type: $('#type').value,
      is_emergency: $('#is_emergency').checked
    })
  });

  if (res.success) {
    toast(__('notify.addSuccess'));
    $('#formAdd').reset();
    $('#is_emergency').checked = false;
    loadNotifications();
  } else {
    toast(res.message || __('notify.addFailed'), 'error');
  }
});

$('#btnRefresh').addEventListener('click', loadNotifications);
$('#searchInput').addEventListener('input', loadNotifications);

$('#btnClearAll').addEventListener('click', async () => {
  if (!confirm(__('action.clearConfirm'))) return;
  const res = await fetchJSON(`${API}/clear-all`, { method: 'POST' });
  if (res.success) { toast(__('action.clearSuccess')); loadNotifications(); }
});

// ═══════════════════════════════════
// 小铃铛配置
// ═══════════════════════════════════

const WIDGET_FIELDS = {
  position: 'widgetPosition',
  offsetX: 'widgetOffsetX',
  offsetY: 'widgetOffsetY',
  buttonSize: 'widgetButtonSize',
  buttonColor: 'widgetButtonColor',
  buttonBg: 'widgetButtonBg',
  showBadge: 'widgetShowBadge',
  badgeBg: 'widgetBadgeBg',
  badgeColor: 'widgetBadgeColor',
  panelWidth: 'widgetPanelWidth',
  borderRadius: 'widgetBorderRadius',
  primaryColor: 'widgetPrimaryColor',
  successColor: 'widgetSuccessColor',
  warningColor: 'widgetWarningColor',
  errorColor: 'widgetErrorColor',
  animationEnabled: 'widgetAnimationEnabled',
  soundEnabled: 'widgetSoundEnabled',
  language: 'widgetLanguage'
};

async function loadWidgetConfig() {
  try {
    const res = await fetchJSON('/api/widget-config');
    if (res.success && res.data) {
      const cfg = res.data;
      Object.keys(WIDGET_FIELDS).forEach(key => {
        const el = $('#' + WIDGET_FIELDS[key]);
        if (!el) return;
        const val = cfg[key];
        if (el.type === 'checkbox') {
          el.checked = val === true || val === 1;
        } else if (el.type === 'color') {
          // 确保颜色值格式正确
          el.value = val || '#000000';
        } else {
          el.value = val !== undefined && val !== null ? val : '';
        }
      });
    }
  } catch (e) {
    console.warn('加载 widget 配置失败:', e);
  }
}

$('#widgetConfigForm').addEventListener('submit', async e => {
  e.preventDefault();
  const statusEl = $('#widgetConfigStatus');
  statusEl.textContent = '';

  const config = {};
  Object.keys(WIDGET_FIELDS).forEach(key => {
    const el = $('#' + WIDGET_FIELDS[key]);
    if (!el) return;
    if (el.type === 'checkbox') {
      config[key] = el.checked;
    } else if (el.type === 'color') {
      config[key] = el.value || '#000000';
    } else if (el.type === 'number') {
      config[key] = parseInt(el.value, 10) || 0;
    } else {
      config[key] = el.value;
    }
  });

  try {
    const res = await fetchJSON('/api/widget-config', {
      method: 'PUT',
      body: JSON.stringify(config)
    });
    if (res.success) {
      statusEl.className = 'settings-status success';
      statusEl.textContent = __('widget.saved', '配置已保存');
      toast(__('widget.saved', '配置已保存'));
      // 通知 widget 刷新（通过 SSE 已在其他页面生效）
    } else {
      statusEl.className = 'settings-status error';
      statusEl.textContent = (res.errors || []).join('; ') || __('widget.saveFailed', '保存失败');
    }
  } catch {
    statusEl.className = 'settings-status error';
    statusEl.textContent = __('widget.saveFailed', '保存失败');
  }
});

async function resetWidgetConfig() {
  if (!confirm(__('widget.resetConfirm', '确定恢复小铃铛设置为默认值？'))) return;
  try {
    const res = await fetchJSON('/api/widget-config/reset', { method: 'POST' });
    if (res.success) {
      toast(__('widget.resetDone', '已恢复默认设置'));
      loadWidgetConfig();
    }
  } catch {
    toast(__('widget.saveFailed', '操作失败'), 'error');
  }
}

// ═══════════════════════════════════
// 嵌入代码
// ═══════════════════════════════════

$('#btnGetCode').addEventListener('click', async () => {
  const me = await fetchJSON('/api/auth/me');
  const uid = (me.success && me.data) ? '?u=' + me.data.id : '';
  const res = await fetchJSON('/api/widget-code' + uid);
  if (res.success) {
    $('#embedCode').value = res.data;
    openModal();
  }
});

// ═══════════════════════════════════
// 初始化
// ═══════════════════════════════════

(async function init() {
  await i18n.init();
  checkAuth();
  // 登录后自动加载 widget 配置
  loadWidgetConfig();
})();
