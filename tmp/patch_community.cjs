const fs = require('fs');
const path = require('path');

const cmFile = path.join(__dirname, '../src/components/CommunityManagement.jsx');
let content = fs.readFileSync(cmFile, 'utf8');

// Add useTranslation
if (!content.includes('useTranslation')) {
    content = content.replace("import {\n    const getFunctions", "import { useTranslation } from 'react-i18next';\nimport {");
    content = content.replace("import { getSafeAvatar } from '../utils/avatarUtils';", "import { getSafeAvatar } from '../utils/avatarUtils';\nimport { useTranslation } from 'react-i18next';");
}

if (!content.includes('const { t } = useTranslation()')) {
    content = content.replace("const { showToast } = useToast();", "const { showToast } = useToast();\n    const { t } = useTranslation();");
}

const replacements = [
    { target: /Community Management/g, replace: "{t('community_management', 'Community Management')}" },
    { target: /Message Selected/g, replace: "{t('message_selected', 'Message Selected')}" },
    { target: /Deselect All/g, replace: "{t('deselect_all', 'Deselect All')}" },
    { target: /Select All \(Broadcasting\)/g, replace: "{t('select_all_broadcast', 'Select All (Broadcasting)')}" },
    { target: /\{members\.length\} member\(s\)/, replace: "{members.length} {t('members_count', 'member')} " },
    // wait "{selectedMembers.length} selected" 
    { target: /\{selectedMembers\.length\} selected/, replace: "{selectedMembers.length} {t('selected_count', 'selected')}" },
    { target: /<p>No community members yet<\/p>/, replace: "<p>{t('no_community_members_yet', 'No community members yet')}</p>" },
    { target: /title="Remove member"/g, replace: "title={t('remove_member', 'Remove member')}" },
    { target: /Send Message to \{selectedMembers\.length\} Member\(s\)/, replace: "{t('send_message_to_members', 'Send Message to')} {selectedMembers.length} {t('members_count', 'Members')}" },
    { target: /"Type your message here\.\.\."/, replace: "t('type_message_placeholder', 'Type your message here...')" },
    { target: /Cancel/g, replace: "{t('btn_cancel', 'Cancel')}" },
    { target: /\{sending \? 'Sending\.\.\.' : 'Send Message'\}/, replace: "{sending ? t('sending_message', 'Sending...') : t('send_message', 'Send Message')}" },
    { target: /<p>Loading members\.\.\.<\/p>/, replace: "<p>{t('loading_members', 'Loading members...')}</p>" },
    
    // Notifications and Alerts
    { target: /'Are you sure you want to remove this member from your community\?'/g, replace: "t('remove_member_confirm', 'Are you sure you want to remove this member from your community?')" },
    { target: /'Member removed successfully'/g, replace: "t('member_removed_success', 'Member removed successfully')" },
    { target: /'Failed to remove member'/g, replace: "t('member_removed_error', 'Failed to remove member')" },
    { target: /'Please enter a message'/g, replace: "t('please_enter_message', 'Please enter a message')" },
    { target: /'Please select at least one member'/g, replace: "t('please_select_member', 'Please select at least one member')" },
    { target: /`Message sent to \$\{selectedMembers\.length\} member\(s\)`/g, replace: "`\${t('message_sent', 'Message sent to')} ${selectedMembers.length} ${t('members_count', 'members')}`" },
    { target: /'Failed to send messages'/g, replace: "t('message_sent_error', 'Failed to send messages')" }
];

replacements.forEach(r => content = content.replace(r.target, r.replace));

fs.writeFileSync(cmFile, content);
console.log('Patched CommunityManagement.jsx');

// Update Dictionary
const arJsonPath = path.join(__dirname, '../src/locales/ar.json');
const enJsonPath = path.join(__dirname, '../src/locales/en.json');
let arDict = JSON.parse(fs.readFileSync(arJsonPath, 'utf8'));
let enDict = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));

const updates = {
    "community_management": { en: "Community Management", ar: "إدارة المجتمع" },
    "message_selected": { en: "Message Selected", ar: "مراسلة المحددين" },
    "deselect_all": { en: "Deselect All", ar: "إلغاء التحديد" },
    "select_all_broadcast": { en: "Select All (Broadcast)", ar: "تحديد الكل (بث)" },
    "members_count": { en: "Members", ar: "أعضاء" },
    "selected_count": { en: "Selected", ar: "محدد" },
    "no_community_members_yet": { en: "No community members yet", ar: "لا يوجد أعضاء في المجتمع بعد" },
    "remove_member": { en: "Remove member", ar: "إزالة عضو" },
    "send_message_to_members": { en: "Send Message to", ar: "إرسال رسالة إلى" },
    "type_message_placeholder": { en: "Type your message here...", ar: "اكتب رسالتك هنا..." },
    "btn_cancel": { en: "Cancel", ar: "إلغاء" },
    "sending_message": { en: "Sending...", ar: "جاري الإرسال..." },
    "send_message": { en: "Send Message", ar: "إرسال رسالة" },
    "loading_members": { en: "Loading members...", ar: "جاري تحميل الأعضاء..." },
    "remove_member_confirm": { en: "Are you sure you want to remove this member from your community?", ar: "هل أنت متأكد أنك تريد إزالة هذا العضو من مجتمعك؟" },
    "member_removed_success": { en: "Member removed successfully", ar: "تم إزالة العضو بنجاح" },
    "member_removed_error": { en: "Failed to remove member", ar: "فشل في إزالة العضو" },
    "please_enter_message": { en: "Please enter a message", ar: "الرجاء إدخال رسالة" },
    "please_select_member": { en: "Please select at least one member", ar: "الرجاء تحديد عضو واحد على الأقل" },
    "message_sent": { en: "Message sent to", ar: "تم إرسال الرسالة إلى" },
    "message_sent_error": { en: "Failed to send messages", ar: "فشل إرسال الرسائل" }
};

Object.entries(updates).forEach(([k, v]) => {
    arDict[k] = v.ar;
    enDict[k] = v.en;
});

fs.writeFileSync(arJsonPath, JSON.stringify(arDict, null, 2));
fs.writeFileSync(enJsonPath, JSON.stringify(enDict, null, 2));
console.log('Updated Dictionary for CommunityManagement!');
