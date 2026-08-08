const fs = require('fs');
const arPath = 'src/locales/ar.json';
const ar = JSON.parse(fs.readFileSync(arPath));

const timeTranslations = {
  "Just now": "الآن",
  "time_m": "د",
  "time_h": "س",
  "time_d": "ي"
};

Object.keys(timeTranslations).forEach(k => {
  ar[k] = timeTranslations[k];
});

fs.writeFileSync(arPath, JSON.stringify(ar, null, 2));
console.log('ar.json updated successfully with time strings!');
