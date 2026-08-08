const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '../src/locales/en.json');
const arPath = path.join(__dirname, '../src/locales/ar.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

// Updates
en['business_directory'] = "Businesses";
ar['business_directory'] = "الشركاء";

en['nav_invitations'] = "Invitations";
ar['nav_invitations'] = "الدعوات";

en['search_venues'] = "Search venues and events...";
ar['search_venues'] = "ابحث عن المنشآت والفعاليات...";

en['type_venue'] = "Venue";
ar['type_venue'] = "منشأة";

fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2));

console.log('Successfully patched UI missing translation keys!');
