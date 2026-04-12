const fs = require('fs');
const path = require('path');

const bDashFile = path.join(__dirname, '../src/pages/BusinessDashboard.jsx');
let content = fs.readFileSync(bDashFile, 'utf8');

const replacements = [
    { target: /📊 Business Dashboard/, replace: "📊 {t('business_dashboard', 'Business Dashboard')}" },
    { target: /userProfile\?\.display_name \|\| 'Your Business'/g, replace: "{userProfile?.display_name || t('your_business', 'Your Business')}" },
    { target: /'Elite Partner'/g, replace: "t('elite_partner', 'Elite Partner')" },
    { target: /'Professional'/g, replace: "t('professional_tier', 'Professional')" },
    { target: /'Free Plan'/g, replace: "t('free_plan', 'Free Plan')" },
    { target: /\{businessInfo\.businessType \|\| 'Business'\} • \{businessInfo\.city \|\| 'Location'\}/, replace: "{t((businessInfo.businessType || 'business').toLowerCase(), businessInfo.businessType || 'Business')} • {businessInfo.city || t('location', 'Location')}" },
    { target: /Try Elite Partner FREE!/g, replace: "{t('try_elite_free', 'Try Elite Partner FREE!')}" },
    { target: /Get a full month of Elite features/g, replace: "{t('get_elite_features_promo', 'Get a full month of Elite features')}" },
    { target: /Explore<\/div>/g, replace: "{t('explore', 'Explore')}</div>" },
    { target: /<FaEye \/> View Profile/g, replace: "<FaEye /> {t('btn_view_profile', 'View Profile')}" },
    { target: /<FaEdit \/> Edit Profile/g, replace: "<FaEdit /> {t('btn_edit_profile', 'Edit Profile')}" },
    { target: /<FaCog \/> Settings/g, replace: "<FaCog /> {t('btn_settings', 'Settings')}" },
    { target: /Community Members\n\s+<\/div>/, replace: "{t('stat_cmty_members', 'Community Members')}\n                    </div>" },
    { target: /Active Invitations\n\s+<\/div>/, replace: "{t('stat_active_invites', 'Active Invitations')}\n                    </div>" },
    { target: /Profile Views\n\s+<\/div>/, replace: "{t('stat_profile_views', 'Profile Views')}\n                    </div>" },
    { target: /Rating \(\{stats\.reviewCount\} reviews\)/, replace: "{t('stat_rating_reviews', 'Rating')} ({stats.reviewCount} {t('stat_reviews', 'reviews')})" },
    { target: /<FaCalendar style=\{\{ color: 'var\(--primary\)' \}\} \/>\s+Recent Activity/, replace: "<FaCalendar style={{ color: 'var(--primary)' }} />\n                    {t('recent_activity', 'Recent Activity')}" },
    { target: /<p>No recent activity<\/p>/, replace: "<p>{t('no_recent_activity', 'No recent activity')}</p>" },
    { target: /New Invitation/g, replace: "{t('new_invitation', 'New Invitation')}" },
    { target: /\|\| 'Recent'/g, replace: "|| t('recent', 'Recent')" },
    
    // Alerts and Prompts
    { target: /'✅ Offer updated successfully!'/g, replace: "t('offer_updated', '✅ Offer updated successfully!')" },
    { target: /'✅ Offer published successfully!'/g, replace: "t('offer_published', '✅ Offer published successfully!')" },
    { target: /`❌ Failed to publish offer: \$\{error\.message\}`/g, replace: "`❌ ${t('offer_published_err', 'Failed to publish offer:')} ${error.message}`" },
    { target: /'Are you sure you want to freeze this offer\? It will be removed from the active carousel\.'/g, replace: "t('offer_freeze_confirm', 'Are you sure you want to freeze this offer? It will be removed from the active carousel.')" },
    { target: /'Error freezing offer: ' \+ error\.message/g, replace: "t('offer_freeze_err', 'Error freezing offer: ') + error.message" },
    { target: /'Are you sure you want to republish this offer\?'/g, replace: "t('offer_republish_confirm', 'Are you sure you want to republish this offer?')" },
    { target: /'Could not republish: ' \+ error\.message/g, replace: "t('offer_republish_err', 'Could not republish: ') + error.message" },
    { target: /'Are you sure you want to delete this offer permanently\?'/g, replace: "t('offer_delete_confirm', 'Are you sure you want to delete this offer permanently?')" },
    { target: /'Error deleting offer: ' \+ error\.message/g, replace: "t('offer_delete_err', 'Error deleting offer: ') + error.message" }
];

replacements.forEach(r => content = content.replace(r.target, r.replace));

fs.writeFileSync(bDashFile, content);
console.log('Patched BusinessDashboard.jsx');

// Update Dictionary
const arJsonPath = path.join(__dirname, '../src/locales/ar.json');
const enJsonPath = path.join(__dirname, '../src/locales/en.json');
let arDict = JSON.parse(fs.readFileSync(arJsonPath, 'utf8'));
let enDict = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));

const updates = {
    // Dashboard strings
    "business_dashboard": { en: "Business Dashboard", ar: "لوحة تحكم النشاط التجاري" },
    "your_business": { en: "Your Business", ar: "نشاطك التجاري" },
    "elite_partner": { en: "Elite Partner", ar: "شريك النخبة" },
    "professional_tier": { en: "Professional", ar: "احترافي" },
    "free_plan": { en: "Free Plan", ar: "الخطة المجانية" },
    "try_elite_free": { en: "Try Elite Partner FREE!", ar: "جرب شريك النخبة مجاناً!" },
    "get_elite_features_promo": { en: "Get a full month of Elite features", ar: "احصل على شهر كامل من ميزات النخبة" },
    "explore": { en: "Explore", ar: "استكشف" },
    "btn_view_profile": { en: "View Profile", ar: "عرض الملف" },
    "btn_edit_profile": { en: "Edit Profile", ar: "تعديل الملف" },
    "btn_settings": { en: "Settings", ar: "الإعدادات" },
    "stat_cmty_members": { en: "Community Members", ar: "أعضاء المجتمع" },
    "stat_active_invites": { en: "Active Invitations", ar: "الدعوات النشطة" },
    "stat_profile_views": { en: "Profile Views", ar: "زيارات الملف" },
    "stat_rating_reviews": { en: "Rating", ar: "التقييم" },
    "stat_reviews": { en: "reviews", ar: "تقييمات" },
    "recent_activity": { en: "Recent Activity", ar: "الأنشطة الأخيرة" },
    "no_recent_activity": { en: "No recent activity", ar: "لا توجد أنشطة حديثة" },
    "new_invitation": { en: "New Invitation", ar: "دعوة جديدة" },
    "recent": { en: "Recent", ar: "حديث" },
    "offer_updated": { en: "✅ Offer updated successfully!", ar: "✅ تم تحديث العرض بنجاح!" },
    "offer_published": { en: "✅ Offer published successfully!", ar: "✅ تم نشر العرض بنجاح!" },
    "offer_published_err": { en: "Failed to publish offer:", ar: "فشل في نشر العرض:" },
    "offer_freeze_confirm": { en: "Are you sure you want to freeze this offer? It will be removed from the active carousel.", ar: "هل أنت متأكد أنك تريد تجميد هذا العرض؟ ستتم إزالته من العروض النشطة." },
    "offer_freeze_err": { en: "Error freezing offer: ", ar: "خطأ في تجميد العرض: " },
    "offer_republish_confirm": { en: "Are you sure you want to republish this offer?", ar: "هل أنت متأكد أنك تريد إعادة نشر هذا العرض؟" },
    "offer_republish_err": { en: "Could not republish: ", ar: "تعذر إعادة النشر: " },
    "offer_delete_confirm": { en: "Are you sure you want to delete this offer permanently?", ar: "هل أنت متأكد أنك تريد حذف هذا العرض نهائياً؟" },
    "offer_delete_err": { en: "Error deleting offer: ", ar: "خطأ في حذف العرض: " },
    // Inbox Strings
    "feedback_empty_title": { en: "Inbox is Empty", ar: "صندوق الوارد فارغ" },
    "feedback_empty_desc": { en: "You haven't received any new open complaints or suggestions.", ar: "لم تتلق أي شكاوى أو اقتراحات جديدة." },
    "open_tickets": { en: "Open Tickets", ar: "التذاكر المفتوحة" },
    "view_more": { en: "View More", ar: "عرض المزيد" },
    "contact_phone": { en: "Contact Number", ar: "رقم التواصل" },
    "feedback_mark_resolved": { en: "Mark as Resolved", ar: "تحديد كـ محلول" },
    "feedback_resolve_confirm": { en: "Are you sure you want to mark this issue as resolved?", ar: "هل أنت متأكد أنك تريد تحديد هذه المشكلة كمحلولة؟" },
    "feedback_resolved_success": { en: "Message marked as resolved ✅", ar: "تحديد الرسالة كمحلولة ✅" },
    "feedback_resolved_error": { en: "An error occurred, please try again later.", ar: "حدث خطأ، يرجى المحاولة مرة أخرى لاحقاً." },
};

Object.entries(updates).forEach(([k, v]) => {
    arDict[k] = v.ar;
    enDict[k] = v.en;
});

fs.writeFileSync(arJsonPath, JSON.stringify(arDict, null, 2));
fs.writeFileSync(enJsonPath, JSON.stringify(enDict, null, 2));
console.log('Updated Dictionary for Dashboard and Inbox!');
