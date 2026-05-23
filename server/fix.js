const fs = require('fs');
const file = 'src/services/GoldScalperEngine.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('timeframe=1&count=60', 'timeframe=M1&count=60');
content = content.replace('timeframe=5&count=60', 'timeframe=M5&count=60');

content = content.replace('if (m1Resp?.data?.candles && m5Resp?.data?.candles) {', 'if (m1Resp?.data && m5Resp?.data && Array.isArray(m1Resp.data) && Array.isArray(m5Resp.data) && m1Resp.data.length > 0 && m5Resp.data.length > 0) {');

content = content.replace('const m1Candles = m1Resp.data.candles;', 'const m1Candles = m1Resp.data;');
content = content.replace('const m5Candles = m5Resp.data.candles;', 'const m5Candles = m5Resp.data;');

fs.writeFileSync(file, content);
console.log('Fixed');
