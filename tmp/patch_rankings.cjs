const fs = require('fs');

const arPath = './src/locales/ar.json';
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

ar['rankings_title'] = "تصنيف الشركاء";
ar['rankings_elite_only'] = "متاحة فقط لمشتركي باقة النخبة (Elite)";
ar['rankings_global'] = "عالمياً";
ar['rankings_businesses'] = "منشأة";
ar['rankings_top'] = "أفضل";
ar['rankings_points'] = "نقطة";
ar['Australia'] = "أستراليا";
ar['Bundaberg'] = "بوندابيرج";

fs.writeFileSync(arPath, JSON.stringify(ar, null, 4));

const enPath = './src/locales/en.json';
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

en['rankings_title'] = "Business Rankings";
en['rankings_elite_only'] = "Only Elite subscribers are included in the ranking.";
en['rankings_global'] = "Global";
en['rankings_businesses'] = "businesses";
en['rankings_top'] = "top";
en['rankings_points'] = "pts";
en['Australia'] = "Australia";
en['Bundaberg'] = "Bundaberg";

fs.writeFileSync(enPath, JSON.stringify(en, null, 4));
console.log('Successfully injected ranking translations!');
