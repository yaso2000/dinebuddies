const fs = require('fs');
let file = 'c:/Users/yaser/v1/dinebuddies/src/pages/BusinessProfile.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/boxShadow:\s*activeTab === id && !locked \? 0 8px 24px color-mix\(in srgb, var\(--brand-primary\) 30%,\s*transparent\) : 'none'/g,
"boxShadow: activeTab === id && !locked ? '0 8px 24px color-mix(in srgb, var(--brand-primary) 30%, transparent)' : 'none'");

content = content.replace(/e\.currentTarget\.style\.boxShadow = 0 8px 24px color-mix\(in srgb, var\(--brand-primary\) 30%, transparent\)/g,
"e.currentTarget.style.boxShadow = '0 8px 24px color-mix(in srgb, var(--brand-primary) 30%, transparent)'");

content = content.replace(/e\.currentTarget\.style\.boxShadow = 0 8px 24px rgba\([^)]+\)/g,
"e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'");

fs.writeFileSync(file, content);
console.log('Fixed final shadows!');
