/**
 * 通知 DTO
 * 定义 API 请求/响应的数据结构和校验规则
 */

const ALLOWED_TYPES = ['info', 'success', 'warning', 'error'];

class NotifyDto {
  /**
   * 校验创建通知请求
   * @param {object} body
   * @returns {{ valid: boolean, message: string|null, data: object|null }}
   */
  static validateCreate(body) {
    if (!body || !body.title || typeof body.title !== 'string') {
      return { valid: false, message: '标题不能为空', data: null };
    }
    if (body.title.length > 200) {
      return { valid: false, message: '标题过长（最多200字）', data: null };
    }
    if (body.content && typeof body.content !== 'string') {
      return { valid: false, message: '内容格式错误', data: null };
    }
    if (body.content && body.content.length > 10000) {
      return { valid: false, message: '内容过长（最多10000字）', data: null };
    }
    if (body.type && !ALLOWED_TYPES.includes(body.type)) {
      return { valid: false, message: '无效的通知类型', data: null };
    }
    return {
      valid: true,
      message: null,
      data: {
        title: body.title.trim(),
        content: body.content?.trim() || '',
        type: body.type || 'info',
        isEmergency: !!body.is_emergency
      }
    };
  }

  /**
   * 校验更新通知请求
   * @param {object} body
   * @returns {{ valid: boolean, message: string|null, fields: object }}
   */
  static validateUpdate(body) {
    const fields = {};
    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title.length > 200) {
        return { valid: false, message: '标题无效', fields: null };
      }
      fields.title = body.title.trim();
    }
    if (body.content !== undefined) {
      if (typeof body.content !== 'string' || body.content.length > 10000) {
        return { valid: false, message: '内容无效', fields: null };
      }
      fields.content = body.content.trim();
    }
    if (body.type !== undefined) {
      if (!ALLOWED_TYPES.includes(body.type)) {
        return { valid: false, message: '类型无效', fields: null };
      }
      fields.type = body.type;
    }
    if (body.is_emergency !== undefined) fields.is_emergency = !!body.is_emergency;
    if (body.is_active !== undefined) fields.is_active = !!body.is_active;
    return { valid: true, message: null, fields };
  }

  /**
   * 统一成功响应
   * @param {*} data
   * @returns {object}
   */
  static success(data) {
    return { success: true, data };
  }

  /**
   * 统一消息响应
   * @param {string} message
   * @returns {object}
   */
  static message(message) {
    return { success: true, message };
  }

  /**
   * 统一错误响应
   * @param {string} message
   * @returns {object}
   */
  static error(message) {
    return { success: false, message };
  }
}

module.exports = NotifyDto;
