const fs = require('fs');
const path = require('path');

const files = [
    'src/pages/InvitationChatRoom.jsx',
    'src/pages/CommunityChatRoom.jsx',
    'src/pages/Chat.jsx',
    'src/components/GroupChat.jsx'
];

files.forEach(file => {
    const fullPath = path.join(__dirname, '..', file);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        
        // This specifically targets the exact string my previous script injected
        if (content.includes('const { t } = useTranslation();')) {
            content = content.replace('const { t } = useTranslation();', 'const { t, i18n } = useTranslation();');
            fs.writeFileSync(fullPath, content);
            console.log(`Patched ${file} successfully.`);
        } else {
            console.log(`Skipped ${file} - already patched or signature varies.`);
        }
    } else {
        console.warn(`File not found: ${file}`);
    }
});
