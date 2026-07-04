/**
 * 用户实体 (UserEntity)
 * 封装密码加密与验证逻辑
 *
 * 密码存储方案：PBKDF2-HMAC-SHA256 + 随机盐
 * - 迭代次数：310000（OWASP 推荐 2023+）
 * - 密钥长度：32 字节
 * - 盐长度：16 字节（随机）
 * - 存储格式：JSON { hash, salt }
 */

const crypto = require('crypto');

const PBKDF2_ITERATIONS = 310000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const DIGEST = 'sha256';

class UserEntity {
  /**
   * 对密码进行哈希加密
   * @param {string} password - 明文密码
   * @returns {{ hash: string, salt: string }} hex 编码的哈希和盐
   */
  static hashPassword(password) {
    if (!password || typeof password !== 'string') {
      throw new Error('密码不能为空');
    }
    if (password.length < 6) {
      throw new Error('密码长度至少为 6 位');
    }
    if (password.length > 128) {
      throw new Error('密码长度不能超过 128 位');
    }

    const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
    const hash = crypto.pbkdf2Sync(
      password,
      salt,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      DIGEST
    ).toString('hex');

    return { hash, salt };
  }

  /**
   * 验证密码
   * @param {string} password - 明文密码
   * @param {string} salt - 存储的盐值（hex）
   * @param {string} storedHash - 存储的哈希值（hex）
   * @returns {boolean}
   */
  static verifyPassword(password, salt, storedHash) {
    if (!password || !salt || !storedHash) return false;

    const hash = crypto.pbkdf2Sync(
      password,
      salt,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      DIGEST
    ).toString('hex');

    // 恒定时间比较（防止时序攻击）
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
  }

  /**
   * 校验用户名合法性
   * @param {string} username
   * @returns {string|null} 错误消息，无错误返回 null
   */
  static validateUsername(username) {
    if (!username || typeof username !== 'string') return '用户名不能为空';
    if (username.length < 2) return '用户名至少 2 个字符';
    if (username.length > 32) return '用户名最多 32 个字符';
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
      return '用户名只能包含字母、数字、下划线和中文';
    }
    return null;
  }

  /**
   * 校验密码强度
   * @param {string} password
   * @returns {string|null} 错误消息，无错误返回 null
   */
  static validatePassword(password) {
    if (!password || typeof password !== 'string') return '密码不能为空';
    if (password.length < 6) return '密码长度至少为 6 位';
    if (password.length > 128) return '密码长度不能超过 128 位';
    return null;
  }
}

module.exports = UserEntity;
