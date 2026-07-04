/**
 * 通知存储接口契约 (NotifyRepo)
 * 
 * 所有存储实现（文件、KV、内存）必须实现此接口。
 * 使用依赖倒置原则：上层定义接口，下层提供实现。
 */

class NotifyRepo {
  /**
   * 获取用户的所有通知
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async findAll(userId) {
    throw new Error('Not implemented: findAll');
  }

  /**
   * 根据 ID 获取通知
   * @param {string} userId
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(userId, id) {
    throw new Error('Not implemented: findById');
  }

  /**
   * 保存通知（创建或更新）
   * @param {string} userId
   * @param {object} entity
   * @returns {Promise<object>}
   */
  async save(userId, entity) {
    throw new Error('Not implemented: save');
  }

  /**
   * 删除通知
   * @param {string} userId
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(userId, id) {
    throw new Error('Not implemented: delete');
  }

  /**
   * 清空用户的所有通知
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async deleteAll(userId) {
    throw new Error('Not implemented: deleteAll');
  }

  /**
   * 获取所有用户的活跃通知（公共接口）
   * @returns {Promise<Array>}
   */
  async findAllPublic() {
    throw new Error('Not implemented: findAllPublic');
  }
}

module.exports = NotifyRepo;
