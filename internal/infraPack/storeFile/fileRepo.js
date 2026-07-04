/**
 * 文件存储实现 (FileRepo)
 * 基于 data.json 的持久化存储
 * 实现 NotifyRepo 接口契约
 */
const fs = require('fs');
const path = require('path');
const NotifyRepo = require('../../domainCond/notifyModel/notifyRepo');

class FileRepo extends NotifyRepo {
  /**
   * @param {string} dbPath - data.json 的绝对路径
   */
  constructor(dbPath) {
    super();
    this.dbPath = dbPath || path.join(__dirname, '..', '..', '..', '..', 'data.json');
  }

  /** 读取完整数据 */
  _read() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
      if (Array.isArray(raw)) {
        const migrated = { _migrated: raw };
        this._write(migrated);
        return migrated;
      }
      return raw || {};
    } catch {
      return {};
    }
  }

  /** 写入数据 */
  _write(data) {
    fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2), 'utf8');
  }

  async findAll(userId) {
    const all = this._read();
    const list = all[userId] || [];
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async findById(userId, id) {
    const all = this._read();
    const list = all[userId] || [];
    return list.find(n => n.id === id) || null;
  }

  async save(userId, entity) {
    const all = this._read();
    if (!all[userId]) all[userId] = [];
    const idx = all[userId].findIndex(n => n.id === entity.id);
    if (idx === -1) {
      all[userId].push(entity);
    } else {
      all[userId][idx] = entity;
    }
    this._write(all);
    return entity;
  }

  async delete(userId, id) {
    const all = this._read();
    const list = all[userId] || [];
    const idx = list.findIndex(n => n.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    this._write(all);
    return true;
  }

  async deleteAll(userId) {
    const all = this._read();
    all[userId] = [];
    this._write(all);
  }

  async findAllPublic() {
    const all = this._read();
    const list = [];
    Object.values(all).forEach(arr => {
      if (Array.isArray(arr)) arr.forEach(n => { if (n.is_active) list.push(n); });
    });
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
}

module.exports = FileRepo;
