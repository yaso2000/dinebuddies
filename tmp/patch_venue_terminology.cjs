const fs = require('fs');
const enPath = './src/locales/en.json';
const arPath = './src/locales/ar.json';

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

// Update EN
if(en.form_title_placeholder) en.form_title_placeholder = "Ex: Dinner at a venue...";
if(en.restaurant_closed) en.restaurant_closed = "Venue Closed";
if(en.for_restaurants) en.for_restaurants = "For Partners";
if(en.restaurant_not_found) en.restaurant_not_found = "Venue not found";
if(en.restaurant_community) en.restaurant_community = "Venue Community";
if(en.faq_create_answer) en.faq_create_answer = "You can create a new invitation by clicking the (+) button in the bottom menu, then choosing the venue and setting the time and number of guests.";
if(en.info_we_collect_text) en.info_we_collect_text = "We collect information you provide when registering (name, email, photo). We also collect location data to help find nearby venues and partners.";
if(en.liability_limitation_text) en.liability_limitation_text = "The app provides a platform for individuals to communicate and coordinate meetings. We are not responsible for service or food quality at venues or individuals' actions outside the app.";

// Update AR
if(ar.form_title_placeholder) ar.form_title_placeholder = "مثال: لقاء في مكان...";
if(ar.business_response) ar.business_response = "رد المنشأة";
if(ar.cancellation_reason_venue_closed) ar.cancellation_reason_venue_closed = "المنشأة مغلقة / غير متاحة";
if(ar.location_permission_denied) ar.location_permission_denied = "نحتاج صلاحية الموقع للتحقق من وصولك للمكان";
if(ar.restaurant_closed) ar.restaurant_closed = "المنشأة مغلقة";
if(ar.restaurant_not_found) ar.restaurant_not_found = "المنشأة غير موجودة";
if(ar.restaurant_community) ar.restaurant_community = "مجتمع المنشأة";
if(ar.venue_location) ar.venue_location = "موقع المنشأة";
if(ar.faq_create_answer) ar.faq_create_answer = "يمكنك إنشاء دعوة جديدة بالنقر على زر (+) في القائمة السفلية، ثم اختيار المكان المنشأة الوقت وعدد الضيوف.";

fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2));

console.log("Venue terminology patched in translations!");
