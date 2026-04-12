const fs = require('fs');
const path = require('path');

function patch(filename, newKeys) {
    const p = path.join(__dirname, '../src/locales', filename);
    const raw = fs.readFileSync(p, 'utf8');
    const json = JSON.parse(raw);
    for (const [k, v] of Object.entries(newKeys)) {
        if (!json[k]) json[k] = v;
    }
    fs.writeFileSync(p, JSON.stringify(json, null, 4));
}

patch('en.json', {
    "business_services": "Business Services",
    "contact_information": "Contact Information"
});

patch('ar.json', {
    "business_services": "الخدمات",
    "contact_information": "التواصل"
});

console.log('Locales patched successfully!');
