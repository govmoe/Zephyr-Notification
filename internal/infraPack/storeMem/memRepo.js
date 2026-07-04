/**
 * 内存存储实现 (MemRepo)
 * 用于 EdgeOne 等无持久化存储的环境
 * 实现 NotifyRepo 接口契约
 * 注意：重启后数据丢失
 */
const NotifyRepo = require('../../domainCond/notifyModel/notifyRepo');

function now() {
  const d = new Date();
  d.setHours(d.getHours() + 8);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

class MemRepo extends NotifyRepo {
  constructor() {
    super();
    this._store = new Map();
  }

  async findAll(userId) {
    const list = this._store.get(userId) || [];
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async findById(userId, id) {
    const list = this._store.get(userId) || [];
    return list.find(n => n.id === id) || null;
  }

  async save(userId, entity) {
    if (!this._store.has(userId)) this._store.set(userId, []);
    const list = this._store.get(userId);
    const idx = list.findIndex(n => n.id === entity.id);
    if (idx === -1) {
      list.push(entity);
    } else {
      list[idx] = entity;
    }
    return entity;
  }

  async delete(userId, id) {
    const list = this._store.get(userId) || [];
    const idx = list.findIndex(n => n.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    return true;
  }

  async deleteAll(userId) {
    this._store.set(userId, []);
  }

  async findAllPublic() {
    const all = [];
    for (const [, list] of this._store) {
      if (Array.isArray(list)) {
        list.forEach(n => { if (n.is_active) all.push(n); });
      }
    }
    return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
}

module.exports = MemRepo;
