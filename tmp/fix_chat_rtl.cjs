const fs = require('fs');
const path = require('path');

function replaceFileContents(filePath, replacements) {
    if (!fs.existsSync(filePath)) {
        console.warn('File not found:', filePath);
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    replacements.forEach(([search, replace]) => {
        content = content.split(search).join(replace);
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log('Patched', filePath);
    } else {
        console.log('No changes needed in', filePath);
    }
}

// 1. CommunityChatRoom.css
replaceFileContents(path.join(__dirname, '../src/pages/CommunityChatRoom.css'), [
    ['margin-right: 8px;', 'margin-inline-end: 8px;'],
    ['margin-left: auto;', 'margin-inline-start: auto;'],
    ['right: 8px;', 'inset-inline-end: 8px;'],
    ['left: 0;', 'inset-inline-start: 0;'],
    // ['right: 0;', 'inset-inline-end: 0;'], // be careful with these absolute stretches
    ['padding-left: 12px;', 'padding-inline-start: 12px;'],
    ['padding-right: 12px;', 'padding-inline-end: 12px;'],
    ['transform: translateX(-50%)', 'transform: translateX(calc(-50% * var(--dir-sign, 1)))'] // maybe too complex for css, let's leave it
]);

// 2. Chat.css
replaceFileContents(path.join(__dirname, '../src/pages/Chat.css'), [
    ['margin-right: 8px;', 'margin-inline-end: 8px;'],
    ['margin-right: 10px;', 'margin-inline-end: 10px;'],
    ['margin-left: auto;', 'margin-inline-start: auto;'],
    ['margin-left: 10px;', 'margin-inline-start: 10px;'],
    ['right: 8px;', 'inset-inline-end: 8px;'],
    ['left: 10px;', 'inset-inline-start: 10px;'],
    ['right: 10px;', 'inset-inline-end: 10px;']
]);

// 3. GroupChat.css (if exists)
replaceFileContents(path.join(__dirname, '../src/components/GroupChat.css'), [
    ['margin-right: 8px;', 'margin-inline-end: 8px;'],
    ['margin-left: auto;', 'margin-inline-start: auto;']
]);

// 4. InvitationChatRoom.jsx
replaceFileContents(path.join(__dirname, '../src/pages/InvitationChatRoom.jsx'), [
    ["marginRight: '10px'", "marginInlineEnd: '10px'"],
    ["marginLeft: '8px'", "marginInlineStart: '8px'"],
    ["marginLeft: '2px'", "marginInlineStart: '2px'"],
    ["marginLeft: '-2px'", "marginInlineStart: '-2px'"],
    // Fix Header Back Button direction manually using direction or just flip for RTL. Wait, CommunityChatRoom.jsx uses <FaArrowLeft />, we can replace with <FaArrowLeft style={{ transform: i18n.dir() === 'rtl' ? 'rotate(180deg)' : 'none' }} />
    ["<FaArrowLeft size={14} />", "<FaArrowLeft size={14} style={{ transform: i18n.language === 'ar' ? 'rotate(180deg)' : 'none' }} />"],
    // Fix message reaction inline style
    ["right: isMe ? 'auto' : '-5px', left: isMe ? '-5px' : 'auto'", "insetInlineEnd: isMe ? 'auto' : '-5px', insetInlineStart: isMe ? '-5px' : 'auto'"],
    ["left: isMe ? 'auto' : '50px', right: isMe ? '50px' : 'auto'", "insetInlineStart: isMe ? 'auto' : '50px', insetInlineEnd: isMe ? '50px' : 'auto'"],
    ["left: '0', zIndex: 1001", "insetInlineStart: '0', zIndex: 1001"]
]);

// 5. CommunityChatRoom.jsx
replaceFileContents(path.join(__dirname, '../src/pages/CommunityChatRoom.jsx'), [
    ["marginRight: '10px'", "marginInlineEnd: '10px'"],
    ["marginLeft: '8px'", "marginInlineStart: '8px'"],
    ["marginLeft: '2px'", "marginInlineStart: '2px'"],
    ["marginLeft: '-2px'", "marginInlineStart: '-2px'"],
    ["<FaArrowLeft size={20} />", "<FaArrowLeft size={20} style={{ transform: i18n.language === 'ar' ? 'rotate(180deg)' : 'none' }} />"],
    ["left: '0', zIndex: 1001", "insetInlineStart: '0', zIndex: 1001"]
]);

// 6. GroupChat.jsx
replaceFileContents(path.join(__dirname, '../src/components/GroupChat.jsx'), [
    ["marginRight: '10px'", "marginInlineEnd: '10px'"],
    ["marginLeft: '8px'", "marginInlineStart: '8px'"],
    ["marginLeft: '2px'", "marginInlineStart: '2px'"],
    ["marginLeft: '-2px'", "marginInlineStart: '-2px'"],
    ["right: '20px'", "insetInlineEnd: '20px'"]
]);

console.log('Finished updating chat logical properties.');
