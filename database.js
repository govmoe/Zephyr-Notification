const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');

function read() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return []; }
}

function write(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function now() {
  const d = new Date();
  d.setHours(d.getHours() + 8);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

module.exports = {
  getAll() {
    return read().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  getActive() {
    return read().filter(n => n.is_active).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  getEmergency() {
    return read().filter(n => n.is_emergency && n.is_active).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  getById(id) {
    return read().find(n => n.id === id) || null;
  },

  create({ title, content, type, is_emergency }) {
    const data = read();
    const item = {
      id: uuid(),
      title,
      content: content || '',
      type: type || 'info',
      is_emergency: !!is_emergency,
      is_active: true,
      created_at: now(),
      updated_at: now()
    };
    data.push(item);
    write(data);
    return item;
  },

  update(id, fields) {
    const data = read();
    const idx = data.findIndex(n => n.id === id);
    if (idx === -1) return null;
    const existing = data[idx];
    data[idx] = {
      ...existing,
      title: fields.title !== undefined ? fields.title : existing.title,
      content: fields.content !== undefined ? fields.content : existing.content,
      type: fields.type !== undefined ? fields.type : existing.type,
      is_emergency: fields.is_emergency !== undefined ? !!fields.is_emergency : existing.is_emergency,
      is_active: fields.is_active !== undefined ? !!fields.is_active : existing.is_active,
      updated_at: now()
    };
    write(data);
    return data[idx];
  },

  delete(id) {
    const data = read();
    const idx = data.findIndex(n => n.id === id);
    if (idx === -1) return { changes: 0 };
    data.splice(idx, 1);
    write(data);
    return { changes: 1 };
  },

  deleteAll() {
    write([]);
    return { changes: 1 };
  }
};
