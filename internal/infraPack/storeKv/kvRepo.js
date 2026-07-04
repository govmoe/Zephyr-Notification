/**
 * Cloudflare KV 存储实现 (KvRepo)
 * 用于 Cloudflare Workers 环境
 * 实现 NotifyRepo 接口契约
 */
const NotifyRepo = require('../../domainCond/notifyModel/notifyRepo');

function now() {
  const d = new Date();
  d.setHours(d.getHours() + 8);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

class KvRepo extends NotifyRepo {
  /**
   * @param {object} kvNamespace - Cloudflare KV 命名空间 (c.env.NOTIFICATIONS)
   */
  constructor(kvNamespace) {
    super();
    this.kv = kvNamespace;
  }

  _userKey(userId) { return userId ? `ns:${userId}` : 'ns:public'; }

  async findAll(userId) {
    const raw = await this.kv.get(this._userKey(userId), 'json') || [];
    return raw.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async findById(userId, id) {
    const all = await this.findAll(userId);
    return all.find(n => n.id === id) || null;
  }

  async save(userId, entity) {
    const key = this._userKey(userId);
    const all = await this.kv.get(key, 'json') || [];
    const idx = all.findIndex(n => n.id === entity.id);
    if (idx === -1) {
      all.push(entity);
    } else {
      all[idx] = entity;
    }
    await this.kv.put(key, JSON.stringify(all));
    return entity;
  }

  async delete(userId, id) {
    const key = this._userKey(userId);
    const all = await this.kv.get(key, 'json') || [];
    const idx = all.findIndex(n => n.id === id);
    if (idx === -1) return false;
    all.splice(idx, 1);
    await this.kv.put(key, JSON.stringify(all));
    return true;
  }

  async deleteAll(userId) {
    await this.kv.put(this._userKey(userId), '[]');
  }

  async findAllPublic() {
    const all = [];
    try {
      const list = await this.kv.list({ prefix: 'ns:' });
      for (const key of list.keys) {
        const raw = await this.kv.get(key.name, 'json');
        if (Array.isArray(raw)) {
          raw.forEach(n => { if (n.is_active) all.push(n); });
        }
      }
    } catch (e) { /* ignore */ }
    return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
}

module.exports = KvRepo;
