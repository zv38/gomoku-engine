// 把已修复的 engine.js 整体替换进 gomoku_play.html 的内联 <script> 块（首个含 GomokuEngine 的块）
const fs = require('fs');
const html = fs.readFileSync('gomoku_play.html', 'utf8');
const engine = fs.readFileSync('engine.js', 'utf8');
const re = /<script>([\s\S]*?GomokuEngine[\s\S]*?)<\/script>/;
if (!re.test(html)) { console.error('未找到内联 engine 块'); process.exit(1); }
const newHtml = html.replace(re, '<script>\n' + engine + '\n</script>');
fs.writeFileSync('gomoku_play.html', newHtml);
console.log('内联 engine 已同步；替换后文件大小=' + newHtml.length);
