/**
 * 小铃铛配置实体 (WidgetEntity)
 * 定义可配置项及其默认值，提供校验逻辑
 */

const DEFAULTS = {
  // 位置
  position: 'top-right',  // top-right | top-left | bottom-right | bottom-left
  // 偏移量 (px)
  offsetX: 20,
  offsetY: 20,
  // 按钮
  buttonSize: 48,
  buttonColor: '#ffffff',
  buttonBg: '#1976d2',
  // 角标
  showBadge: true,
  badgeBg: '#ff5252',
  badgeColor: '#ffffff',
  // 面板
  panelWidth: 400,
  panelMaxHeight: 520,
  // 动画
  animationEnabled: true,
  // 通知声音
  soundEnabled: true,
  // 语言
  language: 'auto',  // auto | zh-CN | en
  // 圆角
  borderRadius: 12,
  // 主题色（通知条左侧色条等）
  primaryColor: '#1976d2',
  successColor: '#388e3c',
  warningColor: '#f57c00',
  errorColor: '#d32f2f'
};

const POSITIONS = ['top-right', 'top-left', 'bottom-right', 'bottom-left'];

class WidgetEntity {
  /**
   * 获取默认配置
   */
  static defaults() {
    return { ...DEFAULTS };
  }

  /**
   * 合并用户配置与默认值
   * @param {object} userConfig
   */
  static merge(userConfig) {
    const config = { ...DEFAULTS };
    if (!userConfig || typeof userConfig !== 'object') return config;

    Object.keys(DEFAULTS).forEach(key => {
      if (userConfig[key] !== undefined && userConfig[key] !== null) {
        config[key] = userConfig[key];
      }
    });

    // 校验位置
    if (!POSITIONS.includes(config.position)) {
      config.position = 'top-right';
    }

    // 数值范围校验
    if (config.buttonSize < 32) config.buttonSize = 32;
    if (config.buttonSize > 72) config.buttonSize = 72;
    if (config.panelWidth < 280) config.panelWidth = 280;
    if (config.panelWidth > 600) config.panelWidth = 600;
    if (config.offsetX < 0) config.offsetX = 0;
    if (config.offsetY < 0) config.offsetY = 0;
    if (config.borderRadius < 0) config.borderRadius = 0;
    if (config.borderRadius > 24) config.borderRadius = 24;

    return config;
  }

  /**
   * 校验颜色值
   */
  static isValidColor(color) {
    return /^#[0-9a-fA-F]{3,8}$/.test(color) ||
           /^rgba?\(/.test(color) ||
           /^transparent$/.test(color);
  }

  /**
   * 校验来源的配置
   * @returns {{ valid: boolean, errors: string[] }}
   */
  static validate(config) {
    const errors = [];
    if (config.position && !POSITIONS.includes(config.position)) {
      errors.push(`无效位置: ${config.position}`);
    }
    ['buttonColor', 'buttonBg', 'badgeBg', 'badgeColor', 'primaryColor',
     'successColor', 'warningColor', 'errorColor'].forEach(key => {
      if (config[key] !== undefined && !WidgetEntity.isValidColor(config[key])) {
        errors.push(`无效颜色值: ${key}=${config[key]}`);
      }
    });
    return { valid: errors.length === 0, errors };
  }
}

module.exports = WidgetEntity;
