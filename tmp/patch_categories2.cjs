const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '../src/locales/en.json');
const arPath = path.join(__dirname, '../src/locales/ar.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

// Add keys
en['type_bar'] = "Bar";
en['type_nightclub'] = "Night Club";
en['type_foodtruck'] = "Food Truck";
en['type_fastfood'] = "Fast Food";

ar['type_bar'] = "بار";
ar['type_nightclub'] = "نادي ليلي";
ar['type_foodtruck'] = "عربة طعام";
ar['type_fastfood'] = "وجبات سريعة";

fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2));

console.log('Successfully patched category translation keys!');
