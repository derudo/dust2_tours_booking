const fs = require('fs');
const lines = fs.readFileSync('public/css/style.css', 'utf8').split('\n');
fs.writeFileSync('public/css/style.css', lines.slice(0, 1718).join('\n') + '\n', 'utf8');
console.log('Truncated CSS to 1718 lines. Done.');
