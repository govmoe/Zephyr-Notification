const API = '/api/notifications';
const $ = s => document.querySelector(s);

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2000);
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...options });
  return res.json();
}

// ========== GitHub 认证 ==========

async function checkAuth() {
  const res = await fetchJSON('/api/auth/me');
  const userArea = $('#userInfo');
  const mainContainer = $('#mainContainer');
  const loginPage = $('#loginPage');

  if (res.success && res.data) {
    const user = res.data;
    mainContainer.style.display = 'block';
    loginPage.classList.remove('active');
    userArea.innerHTML = `
      <img src="${escapeHtml(user.avatar)}" alt="" class="user-avatar">
      <span class="user-name">${escapeHtml(user.name || user.login)}</span>
      <a href="/auth/logout" class="user-logout">退出</a>
    `;
    loadNotifications();
  } else {
    mainContainer.style.display = 'none';
    loginPage.classList.add('active');
  }
}

checkAuth();

// ========== 加载通知列表 ==========

async function loadNotifications() {
  const res = await fetchJSON(API);
  const list = $('#notificationList');
  const emergencyList = $('#emergencyList');
  const emergencyPanel = $('#emergencyPanel');
  const query = ($('#searchInput')?.value || '').toLowerCase();

  if (!res.success || !res.data.length) {
    list.innerHTML = '<div class="empty">暂无通知</div>';
    emergencyPanel.style.display = 'none';
    return;
  }

  const emergencies = res.data.filter(n => n.is_emergency && n.is_active);
  let all = res.data;

  // Apply search filter
  if (query) {
    all = all.filter(n =>
      n.title.toLowerCase().includes(query) ||
      (n.content && n.content.toLowerCase().includes(query))
    );
  }

  // 紧急通知面板
  if (emergencies.length > 0) {
    emergencyPanel.style.display = '';
    const filteredEmergencies = query
      ? emergencies.filter(n => n.title.toLowerCase().includes(query) || (n.content && n.content.toLowerCase().includes(query)))
      : emergencies;
    emergencyList.innerHTML = filteredEmergencies.length
      ? filteredEmergencies.map(n => renderItem(n)).join('')
      : '<div class="empty" style="padding:20px">无匹配结果</div>';
  } else {
    emergencyPanel.style.display = 'none';
  }

  // 所有通知
  list.innerHTML = all.length
    ? all.map(n => renderItem(n)).join('')
    : '<div class="empty">无匹配结果</div>';
}

function renderItem(n) {
  const typeLabels = { info: '信息', success: '成功', warning: '警告', error: '错误' };
  const cls = [];
  if (n.is_emergency) cls.push('emergency');
  if (!n.is_active) cls.push('inactive');

  return `
    <div class="notification-item ${cls.join(' ')}" data-id="${n.id}">
      <div class="dot ${n.type}"></div>
      <div class="info-main">
        <div class="info-title">
          ${n.title}
          ${n.is_emergency ? '<span class="badge emergency-badge">紧急</span>' : ''}
          <span class="badge type-badge">${typeLabels[n.type] || n.type}</span>
          ${!n.is_active ? '<span class="badge" style="background:#eee;color:#999;">已停用</span>' : ''}
        </div>
        ${n.content ? `<div class="info-content">${mdToHtml(n.content)}</div>` : ''}
        <div class="info-meta">ID: ${n.id.slice(0, 8)}... | ${n.created_at}</div>
      </div>
      <div class="item-actions">
        <button onclick="toggleActive('${n.id}', ${n.is_active})">${n.is_active ? '停用' : '启用'}</button>
        ${n.is_emergency ? `<button onclick="toggleEmergency('${n.id}', false)">取消紧急</button>` : `<button onclick="toggleEmergency('${n.id}', true)">设紧急</button>`}
        <button class="btn-del" onclick="deleteNotification('${n.id}')">删除</button>
      </div>
    </div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
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
  str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  str = str.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
  str = str.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  return str;
}

// ========== 添加通知 ==========

$('#formAdd').addEventListener('submit', async e => {
  e.preventDefault();
  const title = $('#title').value.trim();
  if (!title) return toast('请输入标题', 'error');

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
    toast('添加成功');
    $('#formAdd').reset();
    $('#is_emergency').checked = false;
    loadNotifications();
  } else {
    toast(res.message || '添加失败', 'error');
  }
});

// ========== 操作 ==========

async function deleteNotification(id) {
  if (!confirm('确定要删除这条通知吗？')) return;
  const res = await fetchJSON(`${API}/${id}`, { method: 'DELETE' });
  if (res.success) { toast('删除成功'); loadNotifications(); }
  else toast(res.message, 'error');
}

async function toggleActive(id, current) {
  const res = await fetchJSON(`${API}/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ is_active: current ? 0 : 1 })
  });
  if (res.success) { loadNotifications(); }
  else toast(res.message, 'error');
}

async function toggleEmergency(id, set) {
  const res = await fetchJSON(`${API}/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ is_emergency: set ? 1 : 0 })
  });
  if (res.success) { toast(set ? '已设为紧急通知' : '已取消紧急'); loadNotifications(); }
  else toast(res.message, 'error');
}

$('#btnRefresh').addEventListener('click', loadNotifications);

$('#searchInput').addEventListener('input', loadNotifications);

$('#btnClearAll').addEventListener('click', async () => {
  if (!confirm('确定要清空所有通知吗？此操作不可恢复！')) return;
  const res = await fetchJSON(`${API}/clear-all`, { method: 'POST' });
  if (res.success) { toast('已清空所有通知'); loadNotifications(); }
});

// ========== 嵌入代码弹窗 ==========

$('#btnGetCode').addEventListener('click', async () => {
  const me = await fetchJSON('/api/auth/me');
  const uid = (me.success && me.data) ? '?u=' + me.data.id : '';
  const res = await fetchJSON('/api/widget-code' + uid);
  if (res.success) {
    $('#embedCode').value = res.data;
    openModal();
  }
});

function openModal() {
  $('#modalCode').classList.add('active');
  $('#modalOverlay').classList.add('active');
}

function closeModal() {
  $('#modalCode').classList.remove('active');
  $('#modalOverlay').classList.remove('active');
}

$('#btnCopy').addEventListener('click', () => {
  $('#embedCode').select();
  document.execCommand('copy');
  toast('代码已复制到剪贴板');
});

// ========== 初始加载 ==========
// 认证检查已在 checkAuth() 中处理，成功后会调用 loadNotifications()
