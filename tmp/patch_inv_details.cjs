const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '../src/locales/en.json');
const arPath = path.join(__dirname, '../src/locales/ar.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

const newTranslations = {
    // Missing Keys used by existing components
    "on_way_too_early": { en: "You can only send \"I'm on my way\" up to 1 hour before the invitation time.", ar: "لا يمكنك إرسال 'أنا في طريقي' إلا قبل ساعة واحدة بحال أقصى من وقت الدعوة." },
    "arrived_too_far": { en: "You must be near the restaurant (within 100-200 meters) to send \"I've arrived\".", ar: "يجب أن تكون قريباً من المطعم (ضمن 100-200 متر) لإرسال 'لقد وصلت'." },
    "business_cannot_join": { en: "Business accounts cannot join invitations", ar: "حسابات الأعمال لا يمكنها الانضمام للدعوات" },
    "gender_mismatch": { en: "Sorry, this invitation does not match your gender preference.", ar: "عذراً، هذه الدعوة لا تتوافق مع تفضيلات الجنس المحددة." },
    "age_range_preference": { en: "Sorry, this invitation requests age range", ar: "عذراً، هذه الدعوة تطلب الفئة العمرية" },
    "share_failed": { en: "Share failed. Try again.", ar: "فشلت عملية المشاركة. حاول مرة أخرى." },
    "invitation_cancelled_success": { en: "Invitation cancelled successfully. {{count}} people were notified.", ar: "تم إلغاء الدعوة بنجاح. تم إشعار {{count}} أشخاص." },
    "cancellation_exempt": { en: "This cancellation is exempt from penalties.", ar: "هذا الإلغاء معفي من العقوبات." },
    "no_participants_affected": { en: "No participants were affected by this cancellation.", ar: "لم يتأثر أي مشاركين بهذا الإلغاء." },
    "cancellation_warning": { en: "Warning: frequent cancellations may restrict your account.", ar: "تحذير: الإلغاء المتكرر قد يؤدي إلى تقييد حسابك." },
    "cancellation_count": { en: "Cancelled {{count}} times in the last 30 days.", ar: "تم الإلغاء {{count}} مرات خلال الـ 30 يوماً الماضية." },
    "account_restricted": { en: "Your account is restricted from creating new invitations.", ar: "تم تقييد حسابك من إنشاء دعوات جديدة." },
    "restriction_duration": { en: "Restriction will last for {{days}} days.", ar: "سيستمر التقييد لمدة {{days}} يوماً." },
    "account_banned": { en: "Your account is temporarily banned from the system.", ar: "تم حظر حسابك مؤقتاً من النظام." },
    "ban_duration": { en: "The ban will last for {{days}} days.", ar: "سيستمر الحظر لمدة {{days}} يوماً." },
    "account_long_banned": { en: "Your account is banned for a long period due to frequent cancellations.", ar: "تم حظر حسابك لفترة طويلة بسبب الإلغاء المتكرر." },
    "verifying_location": { en: "Verifying location...", ar: "جاري التحقق من الموقع..." },
    "invitation_completed_success": { en: "Invitation completed successfully!", ar: "تم إكمال الدعوة بنجاح!" },
    "invitation_not_found": { en: "Invitation not found", ar: "الدعوة غير موجودة" },
    "invitation_ended_hint": { en: "This invitation may have ended or been removed.", ar: "ربما انتهت هذه الدعوة أو تم إزالتها." },
    "nav_home": { en: "Home", ar: "الرئيسية" },
    "edit": { en: "Edit", ar: "تعديل" },
    "date": { en: "Date", ar: "التاريخ" },
    "time": { en: "Time", ar: "الوقت" },
    "category": { en: "Category", ar: "الفئة" },
    "payment_label": { en: "Payment", ar: "الدفع" },
    "payment_split": { en: "Split", ar: "إنقسام" },
    "females_only": { en: "Females Only", ar: "إناث فقط" },
    "males_only": { en: "Males Only", ar: "ذكور فقط" },
    "everyone": { en: "Everyone", ar: "الجميع" },
    "age": { en: "Age", ar: "العمر" },
    "planning": { en: "Planning", ar: "تخطيط" },
    "on_way": { en: "On Way", ar: "في الطريق" },
    "arrived": { en: "Arrived", ar: "وصلت" },
    "completed": { en: "Completed", ar: "مكتمل" },
    "im_on_way": { en: "I'm on my way", ar: "أنا في طريقي" },
    "ive_arrived": { en: "I've arrived", ar: "لقد وصلت" },
    "complete_meeting": { en: "Complete Meeting", ar: "إكمال اللقاء" },
    "waiting_host_complete": { en: "Waiting for host to complete...", ar: "في انتظار المضيف لإكمال اللقاء..." },
    "members_list_title": { en: "Who's Coming", ar: "قائمة الحضور" },
    "open": { en: "Open", ar: "متاح" },
    "type_dinner": { en: "Dinner", ar: "عشاء" },
    "type_coffee": { en: "Coffee", ar: "قهوة" },
    "type_drinks": { en: "Drinks", ar: "مشروبات" },
    "type_activities": { en: "Activities", ar: "أنشطة" },
    "type_networking": { en: "Networking", ar: "تعارف مهني" },
    "type_dating": { en: "Dating", ar: "مواعدة" },
    "Dinner": { en: "Dinner", ar: "عشاء" },
    "Coffee": { en: "Coffee", ar: "قهوة" },
    "Drinks": { en: "Drinks", ar: "مشروبات" },
    "Activities": { en: "Activities", ar: "أنشطة" },
    "Networking": { en: "Networking", ar: "تعارف مهني" },
    "Dating": { en: "Dating", ar: "مواعدة" },
    "confirm_complete_invitation": { en: "Are you sure you want to complete this invitation?", ar: "هل أنت متأكد أنك تريد إكمال هذه الدعوة؟" },
    "not_at_venue_yet": { en: "😊 It looks like you're not at the venue yet\n\nYou can complete the invitation once you arrive at the restaurant", ar: "😊 يبدو أنك لم تصل إلى المكان بعد\n\nيمكنك إكمال الدعوة بمجرد وصولك إلى المطعم" },
    "verify_venue_location": { en: "📍 We need to verify you're at the venue\n\nPlease allow location access in your browser settings", ar: "📍 يجب علينا التحقق من وجودك في المكان\n\nيرجى السماح بالوصول إلى الموقع الجغرافي من إعدادات المتصفح" },
    "something_went_wrong": { en: "Sorry, something went wrong. Please try again", ar: "عذراً، حدث خطأ ما. يرجى المحاولة مرة أخرى" },
    "failed_update_profile": { en: "Failed to update profile. Please try again.", ar: "فشل تحديث الملف الشخصي. يرجى المحاولة مرة أخرى." },
    "age_groups_restricted": { en: "Sorry, this invitation is for age groups: {{allowed}}", ar: "عذراً، هذه الدعوة مخصصة للفئات العمرية: {{allowed}}" },
    "a_guest": { en: "A guest", ar: "ضيف" },
    "system": { en: "System", ar: "النظام" },
    "chat_on_way": { en: "🚗 {{name}} is on their way to the restaurant!", ar: "🚗 {{name}} في طريقه إلى المطعم!" },
    "chat_arrived": { en: "📍 {{name}} has arrived at the venue!", ar: "📍 {{name}} وصل إلى المكان!" },
    "share": { en: "Share", ar: "مشاركة" },
    "share_to_feed": { en: "Share to Feed", ar: "مشاركة في الحائط" },
    "confirm_delete": { en: "Delete this?", ar: "هل ترغب في مسح هذا؟" },
    "member": { en: "Member", ar: "عضو" },
    "host_badge": { en: "HOST", ar: "مضيف" },
    "edit_invitation": { en: "Edit Invitation", ar: "تعديل الدعوة" },
    "create_invitation": { en: "Create Invitation", ar: "إنشاء دعوة" },
    // Also include CreateInvitation generic ones to be safe
    "guests_needed": { en: "Guests Needed", ar: "عدد الضيوف المطلوب" },
    "occasion_type": { en: "Occasion Type", ar: "نوع المناسبة" },
    "theme_color": { en: "Theme Color", ar: "لون الطابع" },
    "visibility": { en: "Visibility", ar: "الرؤية" },
    "upload_media": { en: "Upload Media (Optional)", ar: "رفع صورة/فيديو (اختياري)" }
};

Object.entries(newTranslations).forEach(([key, vals]) => {
    if (!en[key]) en[key] = vals.en;
    if (!ar[key]) ar[key] = vals.ar;
});

fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2));


// Now patch InvitationDetails.jsx hardcoded strings
const invPath = path.join(__dirname, '../src/pages/InvitationDetails.jsx');
let invContent = fs.readFileSync(invPath, 'utf8');

const invReplacements = [
    ["'Are you sure you want to complete this invitation?'", "t('confirm_complete_invitation')"],
    ["'😊 It looks like you\\'re not at the venue yet\\n\\nYou can complete the invitation once you arrive at the restaurant'", "t('not_at_venue_yet')"],
    ["'📍 We need to verify you\\'re at the venue\\n\\nPlease allow location access in your browser settings'", "t('verify_venue_location')"],
    ["'Sorry, something went wrong. Please try again'", "t('something_went_wrong')"],
    ["\"Failed to update profile. Please try again.\"", "t('failed_update_profile')"],
    ["`Sorry, this invitation is for age groups: ${allowed}`", "t('age_groups_restricted', { allowed })"],
    ["'A guest'", "t('a_guest')"],
    ["'System'", "t('system')"],
    ["`🚗 ${userName} is on their way to the restaurant!`", "t('chat_on_way', { name: userName })"],
    ["`📍 ${userName} has arrived at the venue!`", "t('chat_arrived', { name: userName })"]
];

invReplacements.forEach(([search, replace]) => {
    invContent = invContent.split(search).join(replace);
});

fs.writeFileSync(invPath, invContent);


// Patch MembersList.jsx
const membersPath = path.join(__dirname, '../src/components/Invitation/MembersList.jsx');
let membersContent = fs.readFileSync(membersPath, 'utf8');
const memReplacements = [
    [">HOST<", ">{t('host_badge')}<"],
    ["author?.name || 'Host'", "author?.name || t('host')"],
    ["name: 'Member'", "name: t('member')"]
];
memReplacements.forEach(([search, replace]) => {
    membersContent = membersContent.split(search).join(replace);
});
fs.writeFileSync(membersPath, membersContent);


// Patch InvitationCard.jsx
const invCardPath = path.join(__dirname, '../src/components/InvitationCard.jsx');
let invCardContent = fs.readFileSync(invCardPath, 'utf8');
const invCardReplacements = [
    ["'Delete this?'", "t('confirm_delete')"]
];
invCardReplacements.forEach(([search, replace]) => {
    invCardContent = invCardContent.split(search).join(replace);
});
fs.writeFileSync(invCardPath, invCardContent);


// Patch CreateInvitation.jsx for header string
const createInvPath = path.join(__dirname, '../src/pages/CreateInvitation.jsx');
let createInvContent = fs.readFileSync(createInvPath, 'utf8');
createInvContent = createInvContent.replace("isEditing ? 'Edit Invitation' : 'Create Invitation'", "isEditing ? t('edit_invitation') : t('create_invitation')");
createInvContent = createInvContent.replace("<h2>{isEditing ? 'Edit Invitation' : 'Create Invitation'}</h2>", "<h2>{isEditing ? t('edit_invitation') : t('create_invitation')}</h2>");
// also "Update Invitation" button
createInvContent = createInvContent.replace("isEditing ? 'Update Invitation' : 'Create Invitation'", "isEditing ? t('edit_invitation') : t('create_invitation')");
fs.writeFileSync(createInvPath, createInvContent);

console.log('Successfully patched all missing invitation JSON keys and source values!');
