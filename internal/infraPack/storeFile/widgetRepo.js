/**
 * 小铃铛配置存储 (WidgetRepo)
 * 基于 FileRepo 的 data.json 存储 widget 配置
 * 存储在 data.json 的 _widgetConfig 键下
 */
const path = require('path');
const fs = require('fs');
const WidgetEntity = require('../../domainCond/widgetConf/widgetEntity');

const CONFIG_KEY = '_widgetConfig';

class WidgetRepo {
  /**
   * @param {string} dbPath - data.json 的绝对路径
   */
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '..', '..', '..', '..', 'data.json');
  }

  _read() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
      return raw[CONFIG_KEY] || null;
    } catch {
      return null;
    }
  }

  _write(config) {
    try {
      const raw = JSON.parse(fs.readFileSync(this.dbPath, 'utf8')) || {};
      raw[CONFIG_KEY] = config;
      fs.writeFileSync(this.dbPath, JSON.stringify(raw, null, 2), 'utf8');
    } catch {
      const data = {};
      data[CONFIG_KEY] = config;
      fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2), 'utf8');
    }
  }

  /**
   * 获取 widget 配置（合并默认值）
   * @returns {object}
   */
  getConfig() {
    const saved = this._read();
    return WidgetEntity.merge(saved);
  }

  /**
   * 保存 widget 配置
   * @param {object} config
   * @returns {{ success: boolean, errors?: string[] }}
   */
  saveConfig(config) {
    const validation = WidgetEntity.validate(config);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }
    const merged = WidgetEntity.merge(config);
    this._write(merged);
    return { success: true };
  }

  /**
   * 重置为默认配置
   */
  resetConfig() {
    this._write(WidgetEntity.defaults());
  }
}

module.exports = WidgetRepo;
