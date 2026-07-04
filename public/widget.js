(function () {
  'use strict';

  var SCRIPT = document.currentScript;
  var API_HOST = SCRIPT ? (new URL(SCRIPT.src)).origin : window.location.origin;
  var USER_ID = '';
  if (SCRIPT) {
    var params = new URL(SCRIPT.src).searchParams;
    USER_ID = params.get('u') || '';
  }

  // ─── i18n ─────────────────────────────────────────────
  var W_STR = {
    zh_CN: {
      read: '已读', unread: '未读', emptyRead: '暂无已读通知',
      emptyUnread: '没有未读通知', prev: '上一页', next: '下一页',
      emergency: '紧急', noData: '暂无通知', langLabel: '语言'
    },
    en: {
      read: 'Read', unread: 'Unread', emptyRead: 'No read notifications',
      emptyUnread: 'No unread notifications', prev: 'Prev', next: 'Next',
      emergency: 'Emergency', noData: 'No notifications', langLabel: 'Language'
    }
  };

  function detectLang(configLang) {
    if (configLang && configLang !== 'auto') return configLang;
    var saved = localStorage.getItem('ns_widget_lang');
    if (saved === 'zh-CN' || saved === 'en') return saved;
    return navigator.language && navigator.language.startsWith('en') ? 'en' : 'zh-CN';
  }

  function T(key, langMap) {
    return (langMap && langMap[key]) || key;
  }

  // ─── Config defaults ────────────────────────────────────
  var DEF = {
    position: 'top-right', offsetX: 20, offsetY: 20,
    buttonSize: 48, buttonColor: '#ffffff', buttonBg: '#1976d2',
    showBadge: true, badgeBg: '#ff5252', badgeColor: '#ffffff',
    panelWidth: 400, panelMaxHeight: 520,
    animationEnabled: true, soundEnabled: true,
    borderRadius: 12, language: 'auto',
    primaryColor: '#1976d2', successColor: '#388e3c',
    warningColor: '#f57c00', errorColor: '#d32f2f'
  };
  var cfg = {};

  // ─── Icons ──────────────────────────────────────────────
  var ICONS = {
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"/></svg>',
    success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
    warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
    error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>',
    emergency: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14h2v2h-2v-2zm0-10h2v8h-2V6z"/></svg>',
    bell: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>',
    close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>',
    globe: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>'
  };

  // ─── CSS (using CSS custom properties) ────────────────
  var CSS = '' +
    '#ns-widget-root{position:fixed;z-index:2147483647;font-family:Roboto,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;font-size:14px;line-height:1.5;direction:ltr}' +
    '#ns-widget-root *{box-sizing:border-box}' +
    '.ns-toggle{width:var(--ns-tgl-w);height:var(--ns-tgl-w);border-radius:50%;background:var(--ns-tgl-bg);border:1px solid rgba(0,0,0,.05);box-shadow:0 4px 12px rgba(0,0,0,.1),0 2px 4px rgba(0,0,0,.06);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--ns-tgl-clr);transition:all .25s cubic-bezier(.4,0,.2,1);margin-left:auto;position:relative}' +
    '.ns-toggle:hover{box-shadow:0 6px 16px rgba(0,0,0,.15),0 3px 6px rgba(0,0,0,.08);transform:translateY(-2px)}' +
    '.ns-toggle:active{transform:translateY(0) scale(.95);box-shadow:0 2px 8px rgba(0,0,0,.12)}' +
    '.ns-badge-count{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;border-radius:10px;background:var(--ns-bdg-bg);color:var(--ns-bdg-clr);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 6px;line-height:1;box-shadow:0 2px 6px rgba(0,0,0,.4);pointer-events:none;border:2px solid #fff}' +
    '.ns-panel{position:absolute;top:var(--ns-pnl-top);bottom:var(--ns-pnl-bottom);left:var(--ns-pnl-left);right:var(--ns-pnl-right);width:var(--ns-pnl-w);max-height:var(--ns-pnl-mh);overflow-y:auto;overflow-x:hidden;display:none;border-radius:var(--ns-rad)px;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,.12),0 4px 12px rgba(0,0,0,.06);border:1px solid rgba(0,0,0,.05)}' +
    '.ns-panel.ns-open{display:block}' +
    '.ns-panel::-webkit-scrollbar{width:6px}' +
    '.ns-panel::-webkit-scrollbar-track{background:transparent}' +
    '.ns-panel::-webkit-scrollbar-thumb{background:rgba(0,0,0,.12);border-radius:3px}' +
    '.ns-panel::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.2)}' +
    '.ns-tabs{display:flex;background:#fafafa;border-radius:var(--ns-rad)px var(--ns-rad)px 0 0;border-bottom:1px solid rgba(0,0,0,.06);position:sticky;top:0;z-index:1}' +
    '.ns-tab{flex:1;padding:14px 16px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:500;color:rgba(0,0,0,.5);font-family:inherit;transition:all .2s;white-space:nowrap;display:flex;align-items:center;justify-content:center;gap:6px;position:relative}' +
    '.ns-tab:hover{color:rgba(0,0,0,.7);background:rgba(0,0,0,.02)}' +
    '.ns-tab.ns-active{color:var(--ns-primary);background:#fff}' +
    '.ns-tab.ns-active::after{content:"";position:absolute;bottom:-1px;left:0;right:0;height:2px;background:var(--ns-primary)}' +
    '.ns-tab .ns-tab-num{font-size:11px;opacity:.6;font-weight:600}' +
    '.ns-tab.ns-active .ns-tab-num{color:var(--ns-primary);opacity:.8}' +
    '.ns-list{display:none;flex-direction:column;gap:10px;padding:12px}' +
    '.ns-list.ns-show{display:flex}' +
    '.ns-notification{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-radius:10px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04);position:relative;overflow:hidden;opacity:0;transform:translateX(30px);transition:all .25s cubic-bezier(.4,0,.2,1);border:1px solid rgba(0,0,0,.04)}' +
    '.ns-notification:hover{box-shadow:0 4px 16px rgba(0,0,0,.1),0 2px 6px rgba(0,0,0,.06);transform:translateY(-1px);border-color:rgba(0,0,0,.08)}' +
    '.ns-notification.ns-dismissing{transform:translateX(100%);opacity:0}' +
    '.ns-notification::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:4px 0 0 4px}' +
    '.ns-notification.ns-type-info::before{background:var(--ns-primary)}.ns-notification.ns-type-info .ns-icon{color:var(--ns-primary)}' +
    '.ns-notification.ns-type-success::before{background:var(--ns-success)}.ns-notification.ns-type-success .ns-icon{color:var(--ns-success)}' +
    '.ns-notification.ns-type-warning::before{background:var(--ns-warn)}.ns-notification.ns-type-warning .ns-icon{color:var(--ns-warn)}' +
    '.ns-notification.ns-type-error::before{background:var(--ns-error)}.ns-notification.ns-type-error .ns-icon{color:var(--ns-error)}' +
    '.ns-notification.ns-emergency{box-shadow:0 2px 12px rgba(211,47,47,.2),0 1px 4px rgba(0,0,0,.06)}' +
    '.ns-notification.ns-emergency::before{background:var(--ns-error)}' +
    '.ns-notification.ns-emergency .ns-icon,.ns-notification.ns-emergency .ns-title{color:var(--ns-error)}' +
    '.ns-icon{flex-shrink:0;width:22px;height:22px;display:flex;align-items:center;justify-content:center;margin-top:1px}' +
    '.ns-body{flex:1;min-width:0}' +
    '.ns-title{font-size:14px;font-weight:600;color:rgba(0,0,0,.88);margin:0;line-height:1.4;display:flex;align-items:center;flex-wrap:wrap;gap:6px}' +
    '.ns-time{font-size:11px;color:rgba(0,0,0,.4);margin-top:6px}' +
    '.ns-content{font-size:13px;color:rgba(0,0,0,.6);margin:6px 0 0 0;line-height:1.55;word-break:break-word}' +
    '.ns-content code{background:rgba(0,0,0,.05);padding:2px 6px;border-radius:4px;font-family:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace;font-size:12px;color:var(--ns-error)}' +
    '.ns-content strong{color:rgba(0,0,0,.88)}' +
    '.ns-content a{color:var(--ns-primary);text-decoration:none}' +
    '.ns-content a:hover{text-decoration:underline}' +
    '.ns-content pre{background:rgba(0,0,0,.04);padding:8px 12px;border-radius:6px;overflow-x:auto;font-size:12px;margin:6px 0}' +
    '.ns-badge{display:inline-flex;align-items:center;font-size:10px;height:18px;padding:0 8px;border-radius:9px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}' +
    '.ns-badge-emergency{background:linear-gradient(135deg,#ff5252,var(--ns-error));color:#fff}' +
    '.ns-close{flex-shrink:0;width:26px;height:26px;border-radius:50%;border:none;background:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(0,0,0,.3);padding:0;margin-top:-2px;transition:all .2s}' +
    '.ns-close:hover{background:rgba(0,0,0,.06);color:rgba(0,0,0,.7)}' +
    '.ns-close:active{background:rgba(0,0,0,.1);transform:scale(.9)}' +
    '.ns-empty{padding:40px 20px;text-align:center;color:rgba(0,0,0,.4);font-size:13px;line-height:1.6}' +
    '.ns-pagination{display:flex;justify-content:center;align-items:center;gap:6px;padding:10px 0 6px;flex-wrap:wrap}' +
    '.ns-page-btn{padding:7px 14px;border:1px solid rgba(0,0,0,.08);border-radius:20px;background:#fff;cursor:pointer;font-size:12px;font-weight:500;color:rgba(0,0,0,.6);font-family:inherit;transition:all .2s;min-width:36px;text-align:center}' +
    '.ns-page-btn:hover{background:#f5f5f5;color:rgba(0,0,0,.8);border-color:rgba(0,0,0,.15);transform:translateY(-1px)}' +
    '.ns-page-btn.ns-active{background:linear-gradient(135deg,#42a5f5,var(--ns-primary));color:#fff;border-color:transparent;box-shadow:0 2px 8px rgba(25,118,210,.3)}' +
    '.ns-page-btn.ns-disabled{opacity:.35;cursor:default;pointer-events:none}' +
    '.ns-lang-toggle{display:flex;align-items:center;gap:4px;border:none;background:none;cursor:pointer;color:rgba(0,0,0,.35);padding:4px 8px;font-size:11px;margin:0 auto 4px;transition:color .2s}' +
    '.ns-lang-toggle:hover{color:rgba(0,0,0,.6)}' +
    '@keyframes nsSlideIn{to{opacity:1;transform:translateX(0)}}' +
    '@keyframes nsPulse{0%,100%{box-shadow:0 2px 8px rgba(211,47,47,.25),0 1px 3px rgba(0,0,0,.08)}50%{box-shadow:0 4px 16px rgba(211,47,47,.4),0 2px 6px rgba(0,0,0,.12)}}' +
    '@media (max-width:480px){' +
    '#ns-widget-root{--ns-tgl-w:40px}' +
    '.ns-panel{position:fixed;top:60px;right:8px;left:8px;width:auto;max-height:calc(100vh - 80px)}' +
    '.ns-tab{padding:10px 12px;font-size:12px}' +
    '.ns-notification{padding:12px 14px;gap:10px}' +
    '.ns-page-btn{padding:5px 10px;font-size:11px;min-width:28px}' +
    '}';

  // ─── Init ──────────────────────────────────────────────
  var PAGE = 5;
  var dismissed = {};
  try { dismissed = JSON.parse(localStorage.getItem('ns-dismissed') || '{}'); } catch (e) {}
  var readCache = [];
  try { readCache = JSON.parse(localStorage.getItem('ns-read') || '[]'); } catch (e) {}

  var root, toggle, panel, badge, isOpen = false;
  var tab = 'unread', readPage = 0, unreadPage = 0;
  var currentData = [], lastDataIds = '';
  var readEl, unreadEl, tabsEl;
  var wLang = 'zh-CN', wStr;

  function mergeConfig(config) {
    cfg = {};
    Object.keys(DEF).forEach(function(k) { cfg[k] = (config[k] !== undefined) ? config[k] : DEF[k]; });
    wLang = detectLang(cfg.language);
    wStr = wLang === 'en' ? W_STR.en : W_STR.zh_CN;
    if (!cfg.soundEnabled) playDing = function(){};
  }

  function applyConfigToRoot() {
    if (!root) return;
    var x = cfg.offsetX, y = cfg.offsetY;
    var pos = {};
    if (cfg.position.indexOf('top') === 0) pos.top = y + 'px';
    else pos.bottom = y + 'px';
    if (cfg.position.indexOf('right') > -1) pos.right = x + 'px';
    else pos.left = x + 'px';

    root.style.cssText = Object.keys(pos).map(function(k) { return k + ':' + pos[k]; }).join(';');
    root.style.setProperty('--ns-tgl-w', cfg.buttonSize + 'px');
    root.style.setProperty('--ns-tgl-clr', cfg.buttonColor);
    root.style.setProperty('--ns-tgl-bg', cfg.buttonBg);
    root.style.setProperty('--ns-bdg-bg', cfg.badgeBg);
    root.style.setProperty('--ns-bdg-clr', cfg.badgeColor);
    root.style.setProperty('--ns-pnl-w', cfg.panelWidth + 'px');
    root.style.setProperty('--ns-pnl-mh', cfg.panelMaxHeight + 'px');
    root.style.setProperty('--ns-rad', cfg.borderRadius);
    root.style.setProperty('--ns-primary', cfg.primaryColor);
    root.style.setProperty('--ns-success', cfg.successColor);
    root.style.setProperty('--ns-warn', cfg.warningColor);
    root.style.setProperty('--ns-error', cfg.errorColor);

    // 根据按钮位置调整面板弹出方向
    var gap = 'calc(var(--ns-tgl-w) + 8px)';
    if (cfg.position.startsWith('top')) {
      root.style.setProperty('--ns-pnl-top', gap);
      root.style.setProperty('--ns-pnl-bottom', 'auto');
    } else {
      root.style.setProperty('--ns-pnl-top', 'auto');
      root.style.setProperty('--ns-pnl-bottom', gap);
    }
    if (cfg.position.endsWith('right')) {
      root.style.setProperty('--ns-pnl-right', '0');
      root.style.setProperty('--ns-pnl-left', 'auto');
    } else {
      root.style.setProperty('--ns-pnl-right', 'auto');
      root.style.setProperty('--ns-pnl-left', '0');
    }

    if (!cfg.showBadge && badge) badge.style.display = 'none';

    var styleBlock = document.getElementById('ns-anim-style');
    if (!cfg.animationEnabled) {
      if (!styleBlock) {
        styleBlock = document.createElement('style');
        styleBlock.id = 'ns-anim-style';
        document.head.appendChild(styleBlock);
      }
      styleBlock.textContent = '#ns-widget-root .ns-notification{animation:none!important;opacity:1!important;transform:none!important}';
    } else if (styleBlock) {
      styleBlock.remove();
    }
  }

  function fetchConfig(cb) {
    fetch(API_HOST + '/api/widget-config')
      .then(function(r) { return r.json(); })
      .then(function(res) {
        if (res.success && res.data) cb(res.data);
        else cb(null);
      })
      .catch(function() { cb(null); });
  }

  function initUI(config) {
    mergeConfig(config || {});

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    root = document.createElement('div');
    root.id = 'ns-widget-root';
    root.innerHTML = '<button class="ns-toggle" title="Notifications">' + ICONS.bell + '<span class="ns-badge-count" style="display:none">0</span></button><div class="ns-panel"></div>';
    if (SCRIPT && SCRIPT.parentNode) {
      SCRIPT.parentNode.insertBefore(root, SCRIPT.nextSibling);
    } else {
      document.body.appendChild(root);
    }

    toggle = root.querySelector('.ns-toggle');
    panel = root.querySelector('.ns-panel');
    badge = root.querySelector('.ns-badge-count');

    // 在 root 创建后应用样式变量
    applyConfigToRoot();

    toggle.onclick = function () {
      isOpen = !isOpen;
      if (isOpen) { panel.classList.add('ns-open'); readPage = 0; unreadPage = 0; fullRender(false); }
      else { panel.classList.remove('ns-open'); }
      ensureAudioCtx();
    };

    document.addEventListener('click', function (e) {
      if (isOpen && !root.contains(e.target)) { isOpen = false; panel.classList.remove('ns-open'); }
    });

    load();
    connectSSE();
    setInterval(load, 5000);
  }

  // ─── Render ────────────────────────────────────────────
  function collectRead(notifications) {
    var list = notifications.filter(function (n) { return dismissed[n.id]; });
    readCache.forEach(function (r) {
      if (!list.some(function (d) { return d.id === r.id; })) list.push(r);
    });
    list.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    return list;
  }

  function fullRender(refresh) {
    var unread = sortUrgentFirst(currentData.filter(function (n) { return !dismissed[n.id]; }));
    var readAll = collectRead(currentData);

    if (unread.length && cfg.showBadge) {
      badge.textContent = unread.length > 99 ? '99+' : unread.length;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
    if (tab === 'read' && !readAll.length) tab = 'unread';

    var h = '';
    h += '<div class="ns-tabs" id="ns-tabs">' +
      '<button class="ns-tab' + (tab === 'read'  ? ' ns-active' : '') + '" data-tab="read">' + esc(wStr.read) + '<span class="ns-tab-num">' + readAll.length + '</span></button>' +
      '<button class="ns-tab' + (tab === 'unread' ? ' ns-active' : '') + '" data-tab="unread">' + esc(wStr.unread) + '<span class="ns-tab-num">' + (unread.length > 99 ? '99+' : unread.length) + '</span></button>' +
    '</div>';

    h += '<div class="ns-list' + (tab === 'read'  ? ' ns-show' : '') + '" id="ns-list-read">';
    if (!readAll.length) {
      h += '<div class="ns-empty">' + esc(wStr.emptyRead) + '</div>';
    } else {
      var rStart = readPage * PAGE;
      var rEnd = Math.min((readPage + 1) * PAGE, readAll.length);
      for (var i = rStart; i < rEnd; i++) h += card(readAll[i], i - rStart, true, refresh);
      if (readAll.length > PAGE) h += buildPagination(readAll.length, readPage, 'read');
    }
    h += '</div>';

    h += '<div class="ns-list' + (tab === 'unread'  ? ' ns-show' : '') + '" id="ns-list-unread">';
    if (!unread.length) {
      h += '<div class="ns-empty">' + esc(wStr.emptyUnread) + '</div>';
    } else {
      var uStart = unreadPage * PAGE;
      var uEnd = Math.min((unreadPage + 1) * PAGE, unread.length);
      for (var ui = uStart; ui < uEnd; ui++) h += card(unread[ui], ui - uStart, false, refresh);
      if (unread.length > PAGE) h += buildPagination(unread.length, unreadPage, 'unread');
    }
    h += '</div>';

    // Language toggle
    h += '<button class="ns-lang-toggle" id="ns-lang-btn">' + ICONS.globe + '<span>' + (wLang === 'en' ? '中文' : 'English') + '</span></button>';

    panel.innerHTML = h;

    readEl = document.getElementById('ns-list-read');
    unreadEl = document.getElementById('ns-list-unread');
    tabsEl = document.getElementById('ns-tabs');

    var tabs = tabsEl.querySelectorAll('.ns-tab');
    for (var t = 0; t < tabs.length; t++) {
      tabs[t].onclick = function (e) { e.stopPropagation(); switchTab(this.getAttribute('data-tab')); };
    }
    var btns = panel.querySelectorAll('.ns-close');
    for (var j = 0; j < btns.length; j++) {
      btns[j].onclick = function (e) { e.stopPropagation(); dismiss(this.getAttribute('data-id')); };
    }
    bindPagination(readEl, 'read');
    bindPagination(unreadEl, 'unread');
    document.getElementById('ns-lang-btn').onclick = function(e) {
      e.stopPropagation();
      wLang = wLang === 'en' ? 'zh-CN' : 'en';
      localStorage.setItem('ns_widget_lang', wLang);
      wStr = wLang === 'en' ? W_STR.en : W_STR.zh_CN;
      fullRender(false);
    };
  }

  // ─── Card / Pagination / Tab / Dismiss (unchanged logic) ──
  function card(n, i, read, refresh) {
    var anim = '';
    if (cfg.animationEnabled && !refresh) {
      anim = 'animation-duration:.35s;animation-fill-mode:forwards;animation-name:nsSlideIn;animation-delay:' + (i * 0.04) + 's';
    } else {
      // 无动画时直接可见，避免卡在 opacity:0
      anim = 'opacity:1;transform:none';
    }
    return '<div class="ns-notification ns-type-' + n.type + (n.is_emergency ? ' ns-emergency' : '') + '" ' +
      'style="' + anim + '" data-id="' + n.id + '">' +
      '<span class="ns-icon">' + (n.is_emergency ? ICONS.emergency : (ICONS[n.type] || ICONS.info)) + '</span>' +
      '<div class="ns-body">' +
        '<div class="ns-title">' + esc(n.title) + (n.is_emergency ? '<span class="ns-badge ns-badge-emergency">' + esc(wStr.emergency) + '</span>' : '') + '</div>' +
        (n.content ? '<div class="ns-content">' + md(n.content) + '</div>' : '') +
        '<div class="ns-time">' + n.created_at + '</div>' +
      '</div>' +
      (read ? '<span style="flex-shrink:0;color:#388e3c;margin-top:-2px">' + ICONS.check + '</span>' : '<button class="ns-close" data-id="' + n.id + '">' + ICONS.close + '</button>') +
    '</div>';
  }

  function buildPagination(total, page, listType) {
    var totalPages = Math.ceil(total / PAGE);
    if (totalPages <= 1) return '';
    var h = '<div class="ns-pagination">';
    h += '<button class="ns-page-btn' + (page === 0 ? ' ns-disabled' : '') + '" data-page="' + (page - 1) + '" data-list="' + listType + '">' + esc(wStr.prev) + '</button>';
    var maxShow = 5, half = Math.floor(maxShow / 2);
    var pStart = Math.max(0, page - half), pEnd = Math.min(totalPages, pStart + maxShow);
    if (pEnd - pStart < maxShow) pStart = Math.max(0, pEnd - maxShow);
    for (var p = pStart; p < pEnd; p++) {
      h += '<button class="ns-page-btn ns-page-num' + (p === page ? ' ns-active' : '') + '" data-page="' + p + '" data-list="' + listType + '">' + (p + 1) + '</button>';
    }
    h += '<button class="ns-page-btn' + (page >= totalPages - 1 ? ' ns-disabled' : '') + '" data-page="' + (page + 1) + '" data-list="' + listType + '">' + esc(wStr.next) + '</button>';
    h += '</div>';
    return h;
  }

  function bindPagination(container, listType) {
    var btns = container.querySelectorAll('.ns-page-btn:not(.ns-disabled)');
    for (var b = 0; b < btns.length; b++) {
      btns[b].onclick = function (e) {
        e.stopPropagation();
        var p = parseInt(this.getAttribute('data-page'));
        if (listType === 'read') readPage = p; else unreadPage = p;
        refreshListView(listType);
      };
    }
  }

  function refreshListView(listType) {
    var container, items, page, isRead;
    if (listType === 'read') {
      container = readEl; items = collectRead(currentData); page = readPage; isRead = true;
    } else {
      container = unreadEl; items = sortUrgentFirst(currentData.filter(function(n){return !dismissed[n.id]})); page = unreadPage; isRead = false;
    }
    container.innerHTML = '';
    if (!items.length) {
      container.innerHTML = '<div class="ns-empty">' + esc(isRead ? wStr.emptyRead : wStr.emptyUnread) + '</div>';
    } else {
      var start = page * PAGE, end = Math.min((page + 1) * PAGE, items.length);
      if (page * PAGE >= items.length) { page = 0; start = 0; end = Math.min(PAGE, items.length); if (isRead) readPage = 0; else unreadPage = 0; }
      for (var i = start; i < end; i++) {
        var tmp = document.createElement('div');
        tmp.innerHTML = card(items[i], i - start, isRead, true);
        var el = tmp.firstChild;
        container.appendChild(el);
        if (!isRead) {
          var btn = el.querySelector('.ns-close');
          if (btn) btn.onclick = function(e){e.stopPropagation();dismiss(this.getAttribute('data-id'));};
        }
      }
      if (items.length > PAGE) {
        var tmp2 = document.createElement('div');
        tmp2.innerHTML = buildPagination(items.length, page, listType);
        container.appendChild(tmp2.firstChild);
        bindPagination(container, listType);
      }
    }
    updateTabNums();
  }

  function updateTabNums() {
    var unread = sortUrgentFirst(currentData.filter(function(n){return !dismissed[n.id]}));
    var readAll = collectRead(currentData);
    var numEls = tabsEl.querySelectorAll('.ns-tab .ns-tab-num');
    if (numEls.length >= 2) {
      numEls[0].textContent = readAll.length;
      numEls[1].textContent = unread.length > 99 ? '99+' : unread.length;
    }
  }

  function switchTab(newTab) {
    if (tab !== newTab) {
      var tabs = tabsEl.querySelectorAll('.ns-tab');
      for (var t = 0; t < tabs.length; t++) {
        tabs[t].classList.toggle('ns-active', tabs[t].getAttribute('data-tab') === newTab);
      }
      readEl.classList.toggle('ns-show', newTab === 'read');
      unreadEl.classList.toggle('ns-show', newTab === 'unread');
      tab = newTab;
      refreshListView(newTab);
    }
  }

  function dismiss(id) {
    dismissed[id] = true;
    try { localStorage.setItem('ns-dismissed', JSON.stringify(dismissed)); } catch (e) {}
    var item = currentData.find(function(n){return n.id===id});
    if (item && !readCache.some(function(r){return r.id===id})) {
      readCache.push(item);
      try { localStorage.setItem('ns-read', JSON.stringify(readCache)); } catch (e) {}
    }
    var el = panel.querySelector('.ns-notification[data-id="' + id + '"]');
    if (el) { el.classList.add('ns-dismissing'); el.addEventListener('transitionend', function(){refreshListView(tab);}, {once:true}); }
    else { refreshListView(tab); }
  }

  function sortUrgentFirst(list) {
    return list.sort(function(a,b) {
      if (a.is_emergency && !b.is_emergency) return -1;
      if (!a.is_emergency && b.is_emergency) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }

  function esc(str) { var d=document.createElement('div'); d.textContent=str; return d.innerHTML; }

  function sanitize(str) {
    if (!str) return '';
    var div = document.createElement('div'); div.innerHTML = str;
    function clean(node) {
      if (node.nodeType === 1) {
        if (node.tagName === 'SCRIPT'||node.tagName==='IFRAME'||node.tagName==='OBJECT'||node.tagName==='EMBED') { node.remove(); return; }
        var attrs = node.attributes;
        for (var i = attrs.length-1; i>=0; i--) {
          if (/^on/i.test(attrs[i].name) || (attrs[i].name==='href' && /^javascript:/i.test(attrs[i].value))) node.removeAttribute(attrs[i].name);
        }
      }
      var children = node.childNodes;
      for (var c = children.length-1; c>=0; c--) clean(children[c]);
    }
    var frag = document.createDocumentFragment();
    while (div.firstChild) frag.appendChild(div.firstChild);
    clean(frag);
    var tmp = document.createElement('div'); tmp.appendChild(frag);
    return tmp.innerHTML;
  }

  function md(str) {
    if (!str) return '';
    str = sanitize(str);
    str = str.replace(/```(\w*)\n([\s\S]*?)```/g,'<pre><code>$2</code></pre>');
    str = str.replace(/`([^`]+)`/g,'<code>$1</code>');
    str = str.replace(/^### (.+)$/gm,'<h4>$1</h4>');
    str = str.replace(/^## (.+)$/gm,'<h3>$1</h3>');
    str = str.replace(/^# (.+)$/gm,'<h2>$1</h2>');
    str = str.replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>');
    str = str.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
    str = str.replace(/\*(.+?)\*/g,'<em>$1</em>');
    str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
    str = str.replace(/^[\-\*] (.+)$/gm,'<li>$1</li>');
    str = str.replace(/(<li>.*<\/li>)/s,'<ul>$1</ul>');
    str = str.replace(/\n\n/g,'<br><br>');
    return str;
  }

  var audioCtx = null;
  function ensureAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }
  document.addEventListener('click', ensureAudioCtx, {once:true});
  document.addEventListener('touchstart', ensureAudioCtx, {once:true});

  function playDing() {
    try {
      ensureAudioCtx();
      var now = audioCtx.currentTime;
      var osc1 = audioCtx.createOscillator(); var osc2 = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc1.type='sine'; osc1.frequency.value=880;
      osc2.type='sine'; osc2.frequency.value=1100;
      gain.gain.setValueAtTime(1.0, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now+0.5);
      osc1.connect(gain); osc2.connect(gain); gain.connect(audioCtx.destination);
      osc1.start(now); osc2.start(now); osc1.stop(now+0.15); osc2.stop(now+0.3);
    } catch(e) {}
  }

  function load() {
    fetch(API_HOST + '/api/notifications/active' + (USER_ID ? '?u='+USER_ID : ''))
      .then(function(r){return r.json()})
      .then(function(res) {
        if (res.success) {
          var apiIds = {};
          res.data.forEach(function(n){apiIds[n.id]=true});
          var cleaned = readCache.filter(function(r){return apiIds[r.id]});
          if (cleaned.length !== readCache.length) { readCache = cleaned; try{localStorage.setItem('ns-read',JSON.stringify(readCache))}catch(e){} }
          var dirty = false;
          for (var key in dismissed) { if (dismissed.hasOwnProperty(key) && !apiIds[key]) { delete dismissed[key]; dirty = true; } }
          if (dirty) { try{localStorage.setItem('ns-dismissed',JSON.stringify(dismissed))}catch(e){} }
          var ids = res.data.map(function(n){return n.id}).sort().join(',');
          if (lastDataIds && ids !== lastDataIds) {
            var oldSet = {};
            lastDataIds.split(',').forEach(function(id){if(id) oldSet[id]=true});
            var hasNew = res.data.some(function(n){return !oldSet[n.id]});
            if (hasNew && cfg.soundEnabled !== false) playDing();
          }
          lastDataIds = ids;
          currentData = res.data;
          var unread = res.data.filter(function(n){return !dismissed[n.id]});
          if (cfg.showBadge !== false) {
            badge.textContent = unread.length > 99 ? '99+' : unread.length;
            badge.style.display = unread.length ? 'flex' : 'none';
          }
          if (isOpen) refreshListView(tab);
        }
      })
      .catch(function(){});
  }

  function connectSSE() {
    try {
      var evtSource = new EventSource(API_HOST + '/api/notifications/stream');
      evtSource.addEventListener('update', function(){load()});
      evtSource.onerror = function(){evtSource.close(); setTimeout(connectSSE, 5000)};
    } catch(e) { setTimeout(connectSSE, 5000); }
  }

  // ─── Start ──
  fetchConfig(function(config) {
    initUI(config);
  });

})();
