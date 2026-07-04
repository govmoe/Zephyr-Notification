/**
 * EdgeOne Worker 构建脚本
 * 内联 cmd/worker-eo/main.js + public/ 中的静态文件到单文件 edgeone.js
 *
 * 使用方法：node scripts/buildEdgeOne.js
 * 输出：edgeone.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const base = fs.readFileSync(path.join(root, 'cmd', 'worker-eo', 'main.js'), 'utf8');
const widgetJs = fs.readFileSync(path.join(root, 'public', 'widget.js'), 'utf8');
const adminHtml = fs.readFileSync(path.join(root, 'public', 'admin.html'), 'utf8');
const adminCss = fs.readFileSync(path.join(root, 'public', 'admin.css'), 'utf8');
const adminJs = fs.readFileSync(path.join(root, 'public', 'admin.js'), 'utf8');
const previewHtml = fs.readFileSync(path.join(root, 'public', 'preview.html'), 'utf8');

function escapeTemplate(s) {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

let result = base;
result = result.replace('__WIDGET_JS__', escapeTemplate(widgetJs));
result = result.replace('__ADMIN_HTML__', escapeTemplate(adminHtml));
result = result.replace('__ADMIN_CSS__', escapeTemplate(adminCss));
result = result.replace('__ADMIN_JS__', escapeTemplate(adminJs));
result = result.replace('__PREVIEW_HTML__', escapeTemplate(previewHtml));

fs.writeFileSync(path.join(root, 'edgeone.js'), result, 'utf8');
console.log('edgeone.js generated:', result.length, 'bytes');
