const fs = require('fs');
const file = 'src/services/GoldScalperEngine.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "this.log('ERROR', `Falha ao abrir \ nível \: \`);", 
  "const bridgeMsg = error.response?.data?.error || error.message;\n            this.log('ERROR', `Falha ao abrir \ nível \: \`);"
);

fs.writeFileSync(file, content);
console.log('Fixed');
