(function () {
  'use strict';

  var SCRIPT = document.currentScript;
  var API_HOST = SCRIPT ? (new URL(SCRIPT.src)).origin : window.location.origin;

  var ICONS = {
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"/></svg>',
    success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
    warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
    error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>',
    emergency: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14h2v2h-2v-2zm0-10h2v8h-2V6z"/></svg>',
    bell: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>',
    close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>'
  };

  var CSS = '' +
    '#ns-widget-root{position:fixed;top:20px;right:20px;z-index:2147483647;font-family:Roboto,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;font-size:14px;line-height:1.5;direction:ltr}' +
    '#ns-widget-root *{box-sizing:border-box}' +
    '.ns-toggle{width:48px;height:48px;border-radius:50%;background:#fff;border:1px solid rgba(0,0,0,.05);box-shadow:0 4px 12px rgba(0,0,0,.1),0 2px 4px rgba(0,0,0,.06);cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(0,0,0,.6);transition:all .25s cubic-bezier(.4,0,.2,1);margin-left:auto;position:relative}' +
    '.ns-toggle:hover{box-shadow:0 6px 16px rgba(0,0,0,.15),0 3px 6px rgba(0,0,0,.08);color:rgba(0,0,0,.87);transform:translateY(-2px)}' +
    '.ns-toggle:active{transform:translateY(0) scale(.95);box-shadow:0 2px 8px rgba(0,0,0,.12)}' +
    '.ns-badge-count{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;border-radius:10px;background:linear-gradient(135deg,#ff5252,#d32f2f);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 6px;line-height:1;box-shadow:0 2px 6px rgba(211,47,47,.4);pointer-events:none;border:2px solid #fff}' +
    '.ns-panel{position:absolute;top:56px;right:0;width:400px;max-height:520px;overflow-y:auto;display:none;border-radius:12px;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,.12),0 4px 12px rgba(0,0,0,.06);border:1px solid rgba(0,0,0,.05)}' +
    '.ns-panel.ns-open{display:block}' +
    '.ns-panel::-webkit-scrollbar{width:6px}' +
    '.ns-panel::-webkit-scrollbar-track{background:transparent}' +
    '.ns-panel::-webkit-scrollbar-thumb{background:rgba(0,0,0,.12);border-radius:3px}' +
    '.ns-panel::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.2)}' +
    '.ns-tabs{display:flex;background:#fafafa;border-radius:12px 12px 0 0;border-bottom:1px solid rgba(0,0,0,.06);position:sticky;top:0;z-index:1}' +
    '.ns-tab{flex:1;padding:14px 16px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:500;color:rgba(0,0,0,.5);font-family:inherit;transition:all .2s;white-space:nowrap;display:flex;align-items:center;justify-content:center;gap:6px;position:relative}' +
    '.ns-tab:hover{color:rgba(0,0,0,.7);background:rgba(0,0,0,.02)}' +
    '.ns-tab.ns-active{color:#1976d2;background:#fff}' +
    '.ns-tab.ns-active::after{content:"";position:absolute;bottom:-1px;left:0;right:0;height:2px;background:#1976d2}' +
    '.ns-tab .ns-tab-num{font-size:11px;opacity:.6;font-weight:600}' +
    '.ns-tab.ns-active .ns-tab-num{color:#1976d2;opacity:.8}' +
    '.ns-list{display:none;flex-direction:column;gap:10px;padding:12px}' +
    '.ns-list.ns-show{display:flex}' +
    '.ns-notification{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-radius:10px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04);position:relative;overflow:hidden;opacity:0;transform:translateX(30px);animation:nsSlideIn .35s cubic-bezier(.4,0,.2,1) forwards;transition:all .25s cubic-bezier(.4,0,.2,1);border:1px solid rgba(0,0,0,.04)}' +
    '.ns-notification:hover{box-shadow:0 4px 16px rgba(0,0,0,.1),0 2px 6px rgba(0,0,0,.06);transform:translateY(-1px);border-color:rgba(0,0,0,.08)}' +
    '.ns-notification.ns-dismissing{transform:translateX(100%);opacity:0}' +
    '.ns-notification.ns-no-anim{animation:none;opacity:1;transform:none}' +
    '.ns-notification::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:4px 0 0 4px}' +
    '.ns-notification.ns-type-info::before{background:#1976d2}.ns-notification.ns-type-info .ns-icon{color:#1976d2}' +
    '.ns-notification.ns-type-success::before{background:#388e3c}.ns-notification.ns-type-success .ns-icon{color:#388e3c}' +
    '.ns-notification.ns-type-warning::before{background:#f57c00}.ns-notification.ns-type-warning .ns-icon{color:#f57c00}' +
    '.ns-notification.ns-type-error::before{background:#d32f2f}.ns-notification.ns-type-error .ns-icon{color:#d32f2f}' +
    '.ns-notification.ns-emergency{box-shadow:0 2px 12px rgba(211,47,47,.2),0 1px 4px rgba(0,0,0,.06);animation:nsSlideIn .35s cubic-bezier(.4,0,.2,1) forwards,nsPulse 2.5s ease-in-out infinite}' +
    '.ns-notification.ns-emergency::before{background:#d32f2f}' +
    '.ns-notification.ns-emergency .ns-icon,.ns-notification.ns-emergency .ns-title{color:#d32f2f}' +
    '.ns-icon{flex-shrink:0;width:22px;height:22px;display:flex;align-items:center;justify-content:center;margin-top:1px}' +
    '.ns-body{flex:1;min-width:0}' +
    '.ns-title{font-size:14px;font-weight:600;color:rgba(0,0,0,.88);margin:0;line-height:1.4;display:flex;align-items:center;flex-wrap:wrap;gap:6px}' +
    '.ns-time{font-size:11px;color:rgba(0,0,0,.4);margin-top:6px}' +
    '.ns-content{font-size:13px;color:rgba(0,0,0,.6);margin:6px 0 0 0;line-height:1.55;word-break:break-word}' +
    '.ns-content code{background:rgba(0,0,0,.05);padding:2px 6px;border-radius:4px;font-family:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace;font-size:12px;color:#d32f2f}' +
    '.ns-content strong{color:rgba(0,0,0,.88)}' +
    '.ns-content em{color:rgba(0,0,0,.6)}' +
    '.ns-content a{color:#1976d2;text-decoration:none}' +
    '.ns-content a:hover{text-decoration:underline}' +
    '.ns-badge{display:inline-flex;align-items:center;font-size:10px;height:18px;padding:0 8px;border-radius:9px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}' +
    '.ns-badge-emergency{background:linear-gradient(135deg,#ff5252,#d32f2f);color:#fff}' +
    '.ns-close{flex-shrink:0;width:26px;height:26px;border-radius:50%;border:none;background:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(0,0,0,.3);padding:0;margin-top:-2px;transition:all .2s}' +
    '.ns-close:hover{background:rgba(0,0,0,.06);color:rgba(0,0,0,.7)}' +
    '.ns-close:active{background:rgba(0,0,0,.1);transform:scale(.9)}' +
    '.ns-empty{padding:40px 20px;text-align:center;color:rgba(0,0,0,.4);font-size:13px;line-height:1.6}' +
    '.ns-pagination{display:flex;justify-content:center;align-items:center;gap:6px;padding:10px 0 6px;flex-wrap:wrap}' +
    '.ns-page-btn{padding:7px 14px;border:1px solid rgba(0,0,0,.08);border-radius:20px;background:#fff;cursor:pointer;font-size:12px;font-weight:500;color:rgba(0,0,0,.6);font-family:inherit;transition:all .2s;min-width:36px;text-align:center}' +
    '.ns-page-btn:hover{background:#f5f5f5;color:rgba(0,0,0,.8);border-color:rgba(0,0,0,.15);transform:translateY(-1px)}' +
    '.ns-page-btn.ns-active{background:linear-gradient(135deg,#42a5f5,#1976d2);color:#fff;border-color:transparent;box-shadow:0 2px 8px rgba(25,118,210,.3)}' +
    '.ns-page-btn.ns-disabled{opacity:.35;cursor:default;pointer-events:none}' +
    '@keyframes nsSlideIn{to{opacity:1;transform:translateX(0)}}' +
    '@keyframes nsPulse{0%,100%{box-shadow:0 2px 8px rgba(211,47,47,.25),0 1px 3px rgba(0,0,0,.08)}50%{box-shadow:0 4px 16px rgba(211,47,47,.4),0 2px 6px rgba(0,0,0,.12)}}' +
    '@media (max-width:480px){' +
    '#ns-widget-root{top:12px;right:12px}' +
    '.ns-toggle{width:40px;height:40px}' +
    '.ns-panel{position:fixed;top:60px;right:8px;left:8px;width:auto;max-height:calc(100vh - 80px);border-radius:12px}' +
    '.ns-tabs{border-radius:12px 12px 0 0}' +
    '.ns-tab{padding:10px 12px;font-size:12px}' +
    '.ns-notification{padding:12px 14px;gap:10px}' +
    '.ns-title{font-size:13px}' +
    '.ns-content{font-size:12px}' +
    '.ns-page-btn{padding:5px 10px;font-size:11px;min-width:28px}' +
    '}';

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  var PAGE = 5;
  var dismissed = {};
  try { dismissed = JSON.parse(localStorage.getItem('ns-dismissed') || '{}'); } catch (e) {}
  var readCache = [];
  try { readCache = JSON.parse(localStorage.getItem('ns-read') || '[]'); } catch (e) {}

  var root = document.createElement('div');
  root.id = 'ns-widget-root';
  root.innerHTML = '<button class="ns-toggle" title="通知">' + ICONS.bell + '<span class="ns-badge-count" style="display:none">0</span></button><div class="ns-panel"></div>';
  SCRIPT.parentNode.insertBefore(root, SCRIPT.nextSibling);

  var toggle = root.querySelector('.ns-toggle');
  var panel = root.querySelector('.ns-panel');
  var badge = root.querySelector('.ns-badge-count');
  var isOpen = false;
  var tab = 'unread';
  var readPage = 0;
  var unreadPage = 0;
  var currentData = [];
  var lastDataIds = '';
  var readEl, unreadEl, tabsEl;

  toggle.onclick = function () {
    isOpen = !isOpen;
    if (isOpen) { panel.classList.add('ns-open'); readPage = 0; unreadPage = 0; fullRender(false); }
    else { panel.classList.remove('ns-open'); }
    ensureAudioCtx();
  };

  document.addEventListener('click', function (e) {
    if (isOpen && !root.contains(e.target)) { isOpen = false; panel.classList.remove('ns-open'); }
  });

  function collectRead(notifications) {
    var list = notifications.filter(function (n) { return dismissed[n.id]; });
    readCache.forEach(function (r) {
      if (!list.some(function (d) { return d.id === r.id; })) list.push(r);
    });
    list.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    return list;
  }

  // Full rebuild (panel open or data changed)
  function fullRender(refresh) {
    var unread = currentData.filter(function (n) { return !dismissed[n.id]; });
    var readAll = collectRead(currentData);

    if (unread.length) {
      badge.textContent = unread.length > 99 ? '99+' : unread.length;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
    if (tab === 'read' && !readAll.length) tab = 'unread';

    var h = '';
    h += '<div class="ns-tabs" id="ns-tabs">' +
      '<button class="ns-tab' + (tab === 'read'  ? ' ns-active' : '') + '" data-tab="read">已读<span class="ns-tab-num">' + readAll.length + '</span></button>' +
      '<button class="ns-tab' + (tab === 'unread' ? ' ns-active' : '') + '" data-tab="unread">未读<span class="ns-tab-num">' + (unread.length > 99 ? '99+' : unread.length) + '</span></button>' +
    '</div>';

    h += '<div class="ns-list' + (tab === 'read'  ? ' ns-show' : '') + '" id="ns-list-read">';
    if (!readAll.length) {
      h += '<div class="ns-empty">暂无已读通知</div>';
    } else {
      var rStart = readPage * PAGE;
      var rEnd = Math.min((readPage + 1) * PAGE, readAll.length);
      for (var i = rStart; i < rEnd; i++) h += card(readAll[i], i - rStart, true, refresh);
      if (readAll.length > PAGE) h += buildPagination(readAll.length, readPage, 'read');
    }
    h += '</div>';

    h += '<div class="ns-list' + (tab === 'unread'  ? ' ns-show' : '') + '" id="ns-list-unread">';
    if (!unread.length) {
      h += '<div class="ns-empty">没有未读通知</div>';
    } else {
      var uStart = unreadPage * PAGE;
      var uEnd = Math.min((unreadPage + 1) * PAGE, unread.length);
      for (var ui = uStart; ui < uEnd; ui++) h += card(unread[ui], ui - uStart, false, refresh);
      if (unread.length > PAGE) h += buildPagination(unread.length, unreadPage, 'unread');
    }
    h += '</div>';

    panel.innerHTML = h;

    readEl = document.getElementById('ns-list-read');
    unreadEl = document.getElementById('ns-list-unread');
    tabsEl = document.getElementById('ns-tabs');

    // tab clicks: CSS-only toggle, no rebuild
    var tabs = tabsEl.querySelectorAll('.ns-tab');
    for (var t = 0; t < tabs.length; t++) {
      tabs[t].onclick = function (e) { e.stopPropagation(); switchTab(this.getAttribute('data-tab')); };
    }

    // close buttons
    var btns = panel.querySelectorAll('.ns-close');
    for (var j = 0; j < btns.length; j++) {
      btns[j].onclick = function (e) { e.stopPropagation(); dismiss(this.getAttribute('data-id')); };
    }

    // pagination bindings
    bindPagination(readEl, 'read');
    bindPagination(unreadEl, 'unread');
  }

  function buildPagination(total, page, listType) {
    var totalPages = Math.ceil(total / PAGE);
    if (totalPages <= 1) return '';
    var h = '<div class="ns-pagination">';
    h += '<button class="ns-page-btn' + (page === 0 ? ' ns-disabled' : '') + '" data-page="' + (page - 1) + '" data-list="' + listType + '">上一页</button>';
    var maxShow = 5;
    var half = Math.floor(maxShow / 2);
    var pStart = Math.max(0, page - half);
    var pEnd = Math.min(totalPages, pStart + maxShow);
    if (pEnd - pStart < maxShow) pStart = Math.max(0, pEnd - maxShow);
    for (var p = pStart; p < pEnd; p++) {
      h += '<button class="ns-page-btn ns-page-num' + (p === page ? ' ns-active' : '') + '" data-page="' + p + '" data-list="' + listType + '">' + (p + 1) + '</button>';
    }
    h += '<button class="ns-page-btn' + (page >= totalPages - 1 ? ' ns-disabled' : '') + '" data-page="' + (page + 1) + '" data-list="' + listType + '">下一页</button>';
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

  // Refresh only the list content (cards + pagination), no tab/panel rebuild
  function refreshListView(listType) {
    var container, items, page, isRead;
    if (listType === 'read') {
      container = readEl;
      items = collectRead(currentData);
      page = readPage;
      isRead = true;
    } else {
      container = unreadEl;
      items = currentData.filter(function (n) { return !dismissed[n.id]; });
      page = unreadPage;
      isRead = false;
    }
    // Clear existing
    container.innerHTML = '';
    if (!items.length) {
      container.innerHTML = '<div class="ns-empty">' + (isRead ? '暂无已读通知' : '没有未读通知') + '</div>';
    } else {
      var start = page * PAGE;
      var end = Math.min((page + 1) * PAGE, items.length);
      if (page * PAGE >= items.length) { page = 0; start = 0; end = Math.min(PAGE, items.length); if (isRead) readPage = 0; else unreadPage = 0; }
      for (var i = start; i < end; i++) {
        var tmp = document.createElement('div');
        tmp.innerHTML = card(items[i], i - start, isRead, true);
        var el = tmp.firstChild;
        container.appendChild(el);
        if (!isRead) {
          var btn = el.querySelector('.ns-close');
          if (btn) btn.onclick = function (e) { e.stopPropagation(); dismiss(this.getAttribute('data-id')); };
        }
      }
      if (items.length > PAGE) {
        var tmp2 = document.createElement('div');
        tmp2.innerHTML = buildPagination(items.length, page, listType);
        container.appendChild(tmp2.firstChild);
        bindPagination(container, listType);
      }
    }
    // update tab counts
    updateTabNums();
  }

  function updateTabNums() {
    var unread = currentData.filter(function (n) { return !dismissed[n.id]; });
    var readAll = collectRead(currentData);
    var numEls = tabsEl.querySelectorAll('.ns-tab .ns-tab-num');
    if (numEls.length >= 2) {
      numEls[0].textContent = readAll.length;
      numEls[1].textContent = unread.length > 99 ? '99+' : unread.length;
    }
  }

  // Seamless tab switch: CSS only, no DOM rebuild
  function switchTab(newTab) {
    if (tab !== newTab) {
      var tabs = tabsEl.querySelectorAll('.ns-tab');
      for (var t = 0; t < tabs.length; t++) {
        tabs[t].classList.toggle('ns-active', tabs[t].getAttribute('data-tab') === newTab);
      }
      readEl.classList.toggle('ns-show', newTab === 'read');
      unreadEl.classList.toggle('ns-show', newTab === 'unread');
      tab = newTab;
      // Refresh list content on tab switch
      refreshListView(newTab);
    }
  }

  function card(n, i, read, refresh) {
    var anim = refresh ? ' ns-no-anim' : '';
    return '<div class="ns-notification ns-type-' + n.type + (n.is_emergency ? ' ns-emergency' : '') + anim +
      '" data-id="' + n.id + '" style="animation-delay:' + (i * 0.04) + 's">' +
      '<span class="ns-icon">' + (n.is_emergency ? ICONS.emergency : (ICONS[n.type] || ICONS.info)) + '</span>' +
      '<div class="ns-body">' +
        '<div class="ns-title">' + esc(n.title) + (n.is_emergency ? '<span class="ns-badge ns-badge-emergency">紧急</span>' : '') + '</div>' +
        (n.content ? '<div class="ns-content">' + n.content + '</div>' : '') +
        '<div class="ns-time">' + n.created_at + '</div>' +
      '</div>' +
      (read ? '<span style="flex-shrink:0;color:#388e3c;margin-top:-2px">' + ICONS.check + '</span>' : '<button class="ns-close" data-id="' + n.id + '">' + ICONS.close + '</button>') +
    '</div>';
  }

  function dismiss(id) {
    dismissed[id] = true;
    try { localStorage.setItem('ns-dismissed', JSON.stringify(dismissed)); } catch (e) {}
    var item = currentData.find(function (n) { return n.id === id; });
    if (item && !readCache.some(function (r) { return r.id === id; })) {
      readCache.push(item);
      try { localStorage.setItem('ns-read', JSON.stringify(readCache)); } catch (e) {}
    }
    // Animate card out, then refresh current tab's list
    var el = panel.querySelector('.ns-notification[data-id="' + id + '"]');
    if (el) {
      el.classList.add('ns-dismissing');
      el.addEventListener('transitionend', function () { refreshListView(tab); }, { once: true });
    } else {
      refreshListView(tab);
    }
  }

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Play a "ding" notification sound
  var audioCtx = null;

  function ensureAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  // Resume AudioContext on first user interaction (browser autoplay policy)
  document.addEventListener('click', ensureAudioCtx, { once: true });
  document.addEventListener('touchstart', ensureAudioCtx, { once: true });

  function playDing() {
    try {
      ensureAudioCtx();
      var now = audioCtx.currentTime;
      var osc1 = audioCtx.createOscillator();
      var osc2 = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc1.type = 'sine'; osc1.frequency.value = 880;
      osc2.type = 'sine'; osc2.frequency.value = 1100;
      gain.gain.setValueAtTime(1.0, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc1.connect(gain); osc2.connect(gain);
      gain.connect(audioCtx.destination);
      osc1.start(now); osc2.start(now);
      osc1.stop(now + 0.15); osc2.stop(now + 0.3);
    } catch (e) {}
  }

  function load() {
    fetch(API_HOST + '/api/notifications/active')
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.success) {
          var apiIds = {};
          res.data.forEach(function (n) { apiIds[n.id] = true; });

          var cleaned = readCache.filter(function (r) { return apiIds[r.id]; });
          if (cleaned.length !== readCache.length) {
            readCache = cleaned;
            try { localStorage.setItem('ns-read', JSON.stringify(readCache)); } catch (e) {}
          }
          var dirty = false;
          for (var key in dismissed) {
            if (dismissed.hasOwnProperty(key) && !apiIds[key]) { delete dismissed[key]; dirty = true; }
          }
          if (dirty) {
            try { localStorage.setItem('ns-dismissed', JSON.stringify(dismissed)); } catch (e) {}
          }

          var ids = res.data.map(function (n) { return n.id; }).sort().join(',');
          // Check for new notifications and play ding
          if (lastDataIds && ids !== lastDataIds) {
            var oldSet = {};
            lastDataIds.split(',').forEach(function (id) { if (id) oldSet[id] = true; });
            var hasNew = res.data.some(function (n) { return !oldSet[n.id]; });
            if (hasNew) playDing();
          }
          lastDataIds = ids;
          currentData = res.data;
          var unread = res.data.filter(function (n) { return !dismissed[n.id]; });
          badge.textContent = unread.length > 99 ? '99+' : unread.length;
          badge.style.display = unread.length ? 'flex' : 'none';

          // 实时刷新当前列表
          if (isOpen) refreshListView(tab);
        }
      })
      .catch(function () {});
  }

  // SSE real-time sync
  function connectSSE() {
    try {
      var evtSource = new EventSource(API_HOST + '/api/notifications/stream');
      evtSource.addEventListener('update', function () { load(); });
      evtSource.onerror = function () {
        evtSource.close();
        setTimeout(connectSSE, 5000);
      };
    } catch (e) {
      setTimeout(connectSSE, 5000);
    }
  }

  load();
  connectSSE();
  setInterval(load, 30000);
})();
