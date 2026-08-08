const fs = require('fs');
let file = 'c:/Users/yaser/v1/dinebuddies/src/pages/BusinessProfile.jsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/borderRadius:\s*16px/g, "borderRadius: '16px'");
content = content.replace(/borderRadius:\s*24px/g, "borderRadius: '24px'");
fs.writeFileSync(file, content);
console.log('Fixed border radius syntax!');
