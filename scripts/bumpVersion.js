/**
 * 版本升级脚本
 * 自增版本号，同步更新前端页面
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const verFile = path.join(root, 'VERSION');
const current = parseFloat(fs.readFileSync(verFile, 'utf8').trim());
const next = (current + 0.1).toFixed(1);

// 更新 VERSION 文件
fs.writeFileSync(verFile, next + '\n', 'utf8');

// 更新 admin.html
let admin = fs.readFileSync(path.join(root, 'public', 'admin.html'), 'utf8');
admin = admin.replace(/v\d+\.\d+/, 'v' + next);
fs.writeFileSync(path.join(root, 'public', 'admin.html'), admin, 'utf8');

// 更新 preview.html
let preview = fs.readFileSync(path.join(root, 'public', 'preview.html'), 'utf8');
preview = preview.replace(/v\d+\.\d+/, 'v' + next);
fs.writeFileSync(path.join(root, 'public', 'preview.html'), preview, 'utf8');

console.log('Version bumped: ' + current + ' → ' + next);
