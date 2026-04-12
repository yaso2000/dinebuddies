const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '../src/locales/en.json');
const arPath = path.join(__dirname, '../src/locales/ar.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

// Apply Missing Keys
en['choose_invitation_type_to_continue'] = "Choose invitation type to continue";
en['dating_invitation_selector_desc'] = "Send an exclusive private date to someone special";

ar['choose_invitation_type_to_continue'] = "الرجاء اختيار نوع الدعوة للمتابعة";
ar['dating_invitation_selector_desc'] = "أرسل دعوة خاصة وحصرية لشخص مميز";

fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2));

console.log('Successfully patched Create Invitation Selector UI translations!');
