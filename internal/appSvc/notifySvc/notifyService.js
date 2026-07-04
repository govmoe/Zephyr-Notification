/**
 * 通知应用服务 (NotifyService)
 * 编排通知的 CRUD 业务用例，协调领域模型和基础设施
 */

const crypto = require('crypto');
const NotifyEntity = require('../../domainCond/notifyModel/notifyEntity');

function now() {
  const d = new Date();
  d.setHours(d.getHours() + 8);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

class NotifyService {
  /**
   * @param {import('../../domainCond/notifyModel/notifyRepo')} repo - 存储实现
   * @param {function} [onChange] - 数据变更回调（用于 SSE 通知）
   */
  constructor(repo, onChange) {
    this.repo = repo;
    this.onChange = onChange || (() => {});
  }

  /** 获取用户所有通知 */
  async getAll(userId) {
    return this.repo.findAll(userId);
  }

  /** 获取用户活跃通知 */
  async getActive(userId) {
    const all = await this.repo.findAll(userId);
    return all.filter(n => n.is_active);
  }

  /** 获取公共活跃通知 */
  async getActivePublic() {
    return this.repo.findAllPublic();
  }

  /** 获取公共紧急通知 */
  async getEmergencyPublic() {
    const all = await this.repo.findAllPublic();
    return all.filter(n => n.is_emergency);
  }

  /** 根据 ID 获取通知 */
  async getById(userId, id) {
    return this.repo.findById(userId, id);
  }

  /** 创建通知 */
  async create(userId, data) {
    const entity = new NotifyEntity({
      id: crypto.randomUUID(),
      title: data.title,
      content: data.content || '',
      type: data.type || 'info',
      isEmergency: !!data.isEmergency,
      isActive: true,
      createdAt: now(),
      updatedAt: now()
    });
    await this.repo.save(userId, entity.toJSON());
    this.onChange();
    return entity.toJSON();
  }

  /** 更新通知 */
  async update(userId, id, fields) {
    const raw = await this.repo.findById(userId, id);
    if (!raw) return null;

    const entity = NotifyEntity.fromRaw(raw);
    const mappedFields = {};
    if (fields.title !== undefined) mappedFields.title = fields.title;
    if (fields.content !== undefined) mappedFields.content = fields.content;
    if (fields.type !== undefined) mappedFields.type = fields.type;
    if (fields.is_emergency !== undefined) mappedFields.isEmergency = fields.is_emergency;
    if (fields.is_active !== undefined) mappedFields.isActive = fields.is_active;

    entity.updateFields(mappedFields);
    await this.repo.save(userId, entity.toJSON());
    this.onChange();
    return entity.toJSON();
  }

  /** 删除通知 */
  async delete(userId, id) {
    const result = await this.repo.delete(userId, id);
    if (result) this.onChange();
    return result;
  }

  /** 清空所有通知 */
  async deleteAll(userId) {
    await this.repo.deleteAll(userId);
    this.onChange();
  }
}

module.exports = NotifyService;
