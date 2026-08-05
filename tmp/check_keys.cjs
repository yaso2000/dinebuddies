const fs = require('fs');
const path = require('path');

const arPath = path.join(__dirname, '../src/locales/ar.json');
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

console.log({
    business_directory: ar['business_directory'],
    nav_invitations: ar['nav_invitations'],
    search_venues: ar['search_venues'],
    type_restaurant: ar['type_restaurant'],
    type_cafe: ar['type_cafe'],
    venue: ar['venue']
});
