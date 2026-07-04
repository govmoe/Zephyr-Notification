/**
 * 通知实体 (NotifiyEntity)
 * 领域层核心模型，封装通知的业务属性和行为
 */
class NotifyEntity {
  /**
   * @param {object} data
   * @param {string} data.id
   * @param {string} data.title
   * @param {string} [data.content]
   * @param {'info'|'success'|'warning'|'error'} [data.type]
   * @param {boolean} [data.isEmergency]
   * @param {boolean} [data.isActive]
   * @param {string} [data.createdAt]
   * @param {string} [data.updatedAt]
   */
  constructor(data = {}) {
    this.id = data.id;
    this.title = data.title;
    this.content = data.content || '';
    this.type = data.type || 'info';
    this.isEmergency = !!data.isEmergency;
    this.isActive = data.isActive !== undefined ? !!data.isActive : true;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /** 标记为紧急 */
  markEmergency() { this.isEmergency = true; }

  /** 取消紧急 */
  unmarkEmergency() { this.isEmergency = false; }

  /** 停用 */
  deactivate() { this.isActive = false; }

  /** 启用 */
  activate() { this.isActive = true; }

  /**
   * 更新部分字段
   * @param {object} fields
   */
  updateFields(fields) {
    const allowed = ['title', 'content', 'type', 'isEmergency', 'isActive'];
    allowed.forEach(k => {
      if (fields[k] !== undefined) {
        this[k] = fields[k];
      }
    });
    this.updatedAt = new Date().toISOString();
  }

  /** 转为普通对象（用于序列化） */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      content: this.content,
      type: this.type,
      is_emergency: this.isEmergency,
      is_active: this.isActive,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  /**
   * 从存储数据创建实体（兼容旧格式 snake_case）
   * @param {object} raw
   * @returns {NotifyEntity}
   */
  static fromRaw(raw) {
    return new NotifyEntity({
      id: raw.id,
      title: raw.title,
      content: raw.content,
      type: raw.type,
      isEmergency: raw.is_emergency !== undefined ? raw.is_emergency : raw.isEmergency,
      isActive: raw.is_active !== undefined ? raw.is_active : raw.isActive,
      createdAt: raw.created_at || raw.createdAt,
      updatedAt: raw.updated_at || raw.updatedAt
    });
  }

  /**
   * 校验通知数据有效性
   * @returns {string|null} 错误消息，无错误返回 null
   */
  static validate(data) {
    if (!data.title || typeof data.title !== 'string') return '标题不能为空';
    if (data.title.length > 200) return '标题过长（最多200字）';
    if (data.content && typeof data.content !== 'string') return '内容格式错误';
    if (data.content && data.content.length > 10000) return '内容过长（最多10000字）';
    if (data.type && !['info', 'success', 'warning', 'error'].includes(data.type)) return '无效的通知类型';
    return null;
  }
}

module.exports = NotifyEntity;
