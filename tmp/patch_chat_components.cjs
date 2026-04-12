const fs = require('fs');
const path = require('path');

const filesToPatch = [
    'src/pages/Chat.jsx',
    'src/pages/ChatList.jsx',
    'src/pages/CommunityChatRoom.jsx',
    'src/pages/InvitationChatRoom.jsx',
    'src/components/GroupChat.jsx'
];

const replacementsMap = {
    'src/pages/Chat.jsx': [
        ['<h3>Loading...</h3>', '<h3>{t("loading")}</h3>'],
        ['<h3>Chat</h3>', '<h3>{t("chat_title")}</h3>'],
        ["'Online'", "t('online')"],
        ["'Offline'", "t('offline')"],
        ["'typing...'", "t('typing')"],
        ["'Just now'", "t('just_now')"],
        ["' minutes ago'", " + ' ' + t('minutes_ago')"],
        ["' hours ago'", " + ' ' + t('hours_ago')"],
        ["showToast('Failed to upload image. Try again.',", "showToast(t('failed_upload_image'),"],
        ["showToast('Failed to send voice message. Try again.',", "showToast(t('failed_send_voice'),"],
        ["showToast('Could not access microphone.',", "showToast(t('no_mic_access'),"],
        ["Couldn't start conversation.", "{t('could_not_start_conv')}"],
        [">Retry<", ">{t('retry')}<"],
        ["> Stop<", "> {t('stop')}<"],
        ['placeholder="Message"', 'placeholder={t("message_placeholder")}'],
        ['<p className="reply-label">Replying to</p>', '<p className="reply-label">{t("replying_to")}</p>'],
        ['<span>Uploading... ', '<span>{t("uploading")} '],
        ["msg.fileName || 'File'", "msg.fileName || t('file_default')"]
    ],
    'src/pages/ChatList.jsx': [
        ['<h1>Messages</h1>', '<h1>{t("messages")}</h1>'],
        ['Loading conversations...', '{t("loading_conversations")}'],
        ['<h3>Your Messages</h3>', '<h3>{t("your_messages")}</h3>'],
        ['Select a conversation from the left sidebar to start chatting', '{t("select_conversation_prompt")}'],
        ['placeholder="Search conversations..."', 'placeholder={t("search_conversations")}'],
        ['<h3>No conversations yet</h3>', '<h3>{t("no_conversations")}</h3>'],
        ['<p>Start chatting with your friends!</p>', '<p>{t("start_chatting_friends")}</p>'],
        ["convo.lastMessage || 'No messages yet'", 'convo.lastMessage || t("no_messages_yet")']
    ],
    'src/pages/CommunityChatRoom.jsx': [
        ["partner?.display_name || 'Community Chat'", "partner?.display_name || t('community_chat')"],
        ['{partner?.communityMembers?.length || 0} members', '{partner?.communityMembers?.length || 0} {t("members")}'],
        ['<h2>Access Denied</h2>', '<h2>{t("access_denied")}</h2>'],
        ['>Go Back<', '>{t("go_back")}<'],
        ["showToast('Failed to send message. Try again.',", "showToast(t('failed_send_message'),"],
        ["showToast('Failed to send image. Try again.',", "showToast(t('failed_upload_image'),"],
        ['<p style={{ fontSize: \'1rem\', fontWeight: \'700\', color: \'var(--text-primary)\', margin: \'0 0 6px\' }}>Say Hello! 👋</p>', '<p style={{ fontSize: \'1rem\', fontWeight: \'700\', color: \'var(--text-primary)\', margin: \'0 0 6px\' }}>{t("say_hello")} 👋</p>'],
        ['<p style={{ fontSize: \'0.8rem\', color: \'var(--text-muted)\', margin: 0 }}>Be the first to start the conversation</p>', '<p style={{ fontSize: \'0.8rem\', color: \'var(--text-muted)\', margin: 0 }}>{t("start_conversation_first")}</p>'],
        ['placeholder="Message"', 'placeholder={t("message_placeholder")}']
    ],
    'src/pages/InvitationChatRoom.jsx': [
        ["invitation?.title || 'Group Chat'", "invitation?.title || t('group_chat')"],
        ["showToast(\"You are not a member of this invitation group chat.\",", "showToast(t('not_group_member'),"],
        ["navigate('/', { replace: true, state: { message: 'This invitation has ended.' } });", "navigate('/', { replace: true, state: { message: t('invitation_ended') } });"],
        ["showToast('Failed to send image. Try again.',", "showToast(t('failed_upload_image'),"],
        ["showToast('Could not access microphone.',", "showToast(t('no_mic_access'),"],
        ["showToast('Failed to send voice message. Try again.',", "showToast(t('failed_send_voice'),"],
        ["showToast('Failed to send message. Try again.',", "showToast(t('failed_send_message'),"],
        ['<div style={{ color: \'var(--text-muted)\', fontSize: \'0.9rem\' }}>Loading Chat...</div>', '<div style={{ color: \'var(--text-muted)\', fontSize: \'0.9rem\' }}>{t("loading_chat")}</div>'],
        ['<p style={{ fontSize: \'1rem\', fontWeight: \'700\', color: \'var(--text-primary)\', margin: \'0 0 6px\' }}>Say Hello! 👋</p>', '<p style={{ fontSize: \'1rem\', fontWeight: \'700\', color: \'var(--text-primary)\', margin: \'0 0 6px\' }}>{t("say_hello")} 👋</p>'],
        ['<p style={{ fontSize: \'0.8rem\', color: \'var(--text-muted)\', margin: 0 }}>Be the first to start the conversation</p>', '<p style={{ fontSize: \'0.8rem\', color: \'var(--text-muted)\', margin: 0 }}>{t("start_conversation_first")}</p>'],
        ['placeholder="Type a message..."', 'placeholder={t("type_message")}'],
        ['>Recording...<', '>{t("recording")}<'],
        ['>HOST<', '>{t("host_badge")}<']
    ],
    'src/components/GroupChat.jsx': [
        ["showToast('Could not access microphone.',", "showToast(t('no_mic_access'),"],
        ["showToast('Failed to send voice message. Try again.',", "showToast(t('failed_send_voice'),"],
        ["showToast('Failed to send message. Try again.',", "showToast(t('failed_send_message'),"],
        ['Please login to view chat', '{t("login_to_view_chat")}'],
        ['>Group Chat<', '>{t("group_chat")}<'],
        ['>Recent Messages<', '>{t("recent_messages")}<'],
        ['> Full Screen<', '> {t("full_screen")}<'],
        ['<p>Start the conversation!</p>', '<p>{t("start_conversation_first")}</p>'],
        ['placeholder="Type a message..."', 'placeholder={t("type_message")}'],
        ['>Recording...<', '>{t("recording")}<']
    ]
};

const newKeys = {
    "loading": { en: "Loading...", ar: "جاري التحميل..." },
    "chat_title": { en: "Chat", ar: "المحادثة" },
    "online": { en: "Online", ar: "متصل" },
    "offline": { en: "Offline", ar: "غير متصل" },
    "typing": { en: "typing...", ar: "يكتب..." },
    "just_now": { en: "Just now", ar: "الآن" },
    "minutes_ago": { en: "minutes ago", ar: "دقائق" },
    "hours_ago": { en: "hours ago", ar: "ساعات" },
    "failed_upload_image": { en: "Failed to upload image. Try again.", ar: "فشل رفع الصورة. حاول مرة أخرى." },
    "failed_send_voice": { en: "Failed to send voice message. Try again.", ar: "فشل إرسال المقطع الصوتي. حاول مرة أخرى." },
    "no_mic_access": { en: "Could not access microphone.", ar: "تعذر الوصول للميكروفون." },
    "could_not_start_conv": { en: "Couldn't start conversation.", ar: "تعذر بدء المحادثة." },
    "retry": { en: "Retry", ar: "إعادة المحاولة" },
    "stop": { en: "Stop", ar: "إيقاف" },
    "message_placeholder": { en: "Message", ar: "الرسالة" },
    "replying_to": { en: "Replying to", ar: "رد على" },
    "uploading": { en: "Uploading...", ar: "جاري الرفع..." },
    "file_default": { en: "File", ar: "ملف" },
    "messages": { en: "Messages", ar: "الرسائل" },
    "loading_conversations": { en: "Loading conversations...", ar: "جاري تحميل المحادثات..." },
    "your_messages": { en: "Your Messages", ar: "رسائلك" },
    "select_conversation_prompt": { en: "Select a conversation from the left sidebar to start chatting", ar: "اختر محادثة من القائمة للبدء" },
    "search_conversations": { en: "Search conversations...", ar: "البحث في المحادثات..." },
    "no_conversations": { en: "No conversations yet", ar: "لا توجد محادثات بعد" },
    "start_chatting_friends": { en: "Start chatting with your friends!", ar: "ابدأ الدردشة مع أصدقائك!" },
    "no_messages_yet": { en: "No messages yet", ar: "لا توجد رسائل بعد" },
    "community_chat": { en: "Community Chat", ar: "محادثة المجتمع" },
    "access_denied": { en: "Access Denied", ar: "غير مصرح بالدخول" },
    "go_back": { en: "Go Back", ar: "رجوع" },
    "failed_send_message": { en: "Failed to send message. Try again.", ar: "فشل إرسال الرسالة. حاول مرة أخرى." },
    "say_hello": { en: "Say Hello!", ar: "قل مرحباً!" },
    "start_conversation_first": { en: "Be the first to start the conversation", ar: "كن أول من يبدأ المحادثة" },
    "group_chat": { en: "Group Chat", ar: "محادثة جماعية" },
    "not_group_member": { en: "You are not a member of this invitation group chat.", ar: "أنت لست عضواً في هذه الدردشة." },
    "invitation_ended": { en: "This invitation has ended.", ar: "انتهت هذه الدعوة." },
    "loading_chat": { en: "Loading Chat...", ar: "جاري تحميل المحادثة..." },
    "type_message": { en: "Type a message...", ar: "اكتب رسالة..." },
    "recording": { en: "Recording...", ar: "جاري التسجيل..." },
    "host_badge": { en: "HOST", ar: "المضيف" },
    "login_to_view_chat": { en: "Please login to view chat", ar: "الرجاء تسجيل الدخول لرؤية المحادثة" },
    "recent_messages": { en: "Recent Messages", ar: "الرسائل الحديثة" },
    "full_screen": { en: "Full Screen", ar: "شاشة كاملة" }
};

// 1. Patch the files
filesToPatch.forEach(file => {
    const fullPath = path.join(__dirname, '..', file);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');

        // Prepend import
        if (!content.includes('useTranslation')) {
            content = "import { useTranslation } from 'react-i18next';\n" + content;
        }

        // Inject hook
        const compRegex = /(const (Chat|ChatList|CommunityChatRoom|InvitationChatRoom|GroupChat) = \([^)]*\) => {)/;
        if (content.match(compRegex) && !content.includes('const { t } = useTranslation();')) {
            content = content.replace(compRegex, "$1\n    const { t } = useTranslation();");
        }

        // Apply string replacements
        const replacements = replacementsMap[file] || [];
        replacements.forEach(([search, replace]) => {
            content = content.split(search).join(replace);
        });

        fs.writeFileSync(fullPath, content);
        console.log(`Patched ${file}`);
    } else {
        console.warn(`File not found: ${file}`);
    }
});

// 2. Patch locales
const enPath = path.join(__dirname, '../src/locales/en.json');
const arPath = path.join(__dirname, '../src/locales/ar.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

Object.entries(newKeys).forEach(([key, values]) => {
    en[key] = values.en;
    ar[key] = values.ar;
});

fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2));

console.log('Successfully patched all chat files and translations!');
