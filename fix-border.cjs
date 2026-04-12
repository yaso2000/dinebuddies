const fs = require('fs');
let file = 'c:/Users/yaser/v1/dinebuddies/src/pages/BusinessProfile.jsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/\$\{var\(--border-color\)\}/g, 'var(--border-color)');
fs.writeFileSync(file, content);
console.log('Fixed border colors!');
