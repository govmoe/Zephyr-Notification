/**
 * 用户凭证存储 (UserRepo)
 * 基于 FileRepo 的 data.json 存储用户加密凭证
 * 数据存储在 data.json 的 _users 键下
 */
const path = require('path');
const fs = require('fs');

const USERS_KEY = '_users';

class UserRepo {
  /**
   * @param {string} dbPath - data.json 的绝对路径
   */
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '..', '..', '..', '..', 'data.json');
  }

  _read() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
      return raw[USERS_KEY] || {};
    } catch {
      return {};
    }
  }

  _write(users) {
    try {
      const raw = JSON.parse(fs.readFileSync(this.dbPath, 'utf8')) || {};
      raw[USERS_KEY] = users;
      fs.writeFileSync(this.dbPath, JSON.stringify(raw, null, 2), 'utf8');
    } catch {
      const data = {};
      data[USERS_KEY] = users;
      fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2), 'utf8');
    }
  }

  /**
   * 查找用户
   * @param {string} username
   * @returns {{ username: string, hash: string, salt: string, createdAt: string }|null}
   */
  findByUsername(username) {
    const users = this._read();
    return users[username] || null;
  }

  /**
   * 创建用户（保存加密凭证）
   * @param {string} username
   * @param {string} hash - PBKDF2 哈希值（hex）
   * @param {string} salt - 盐值（hex）
   * @returns {object} 用户信息（不含密码）
   */
  create(username, hash, salt) {
    const users = this._read();
    if (users[username]) {
      throw new Error('用户名已存在');
    }
    const user = {
      username,
      hash,
      salt,
      createdAt: new Date().toISOString()
    };
    users[username] = user;
    this._write(users);
    return { username, createdAt: user.createdAt };
  }

  /**
   * 检查用户名是否已存在
   * @param {string} username
   * @returns {boolean}
   */
  exists(username) {
    const users = this._read();
    return !!users[username];
  }
}

module.exports = UserRepo;
