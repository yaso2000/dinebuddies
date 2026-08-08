const fs = require('fs');
const path = require('path');

function forceLtr(filePath, matchStr, replaceStr) {
    const fullPath = path.join(__dirname, '..', filePath);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes(matchStr) && !content.includes(replaceStr)) {
            content = content.replace(matchStr, replaceStr);
            fs.writeFileSync(fullPath, content);
            console.log(`Forced LTR in ${filePath}`);
        } else {
            console.log(`Skipped or already applied in ${filePath}`);
        }
    } else {
        console.log(`File not found: ${filePath}`);
    }
}

// 1. CommunityChatRoom.jsx
forceLtr('src/pages/CommunityChatRoom.jsx', 
    '<div ref={containerRef} className="chat-room-container chat-screen"', 
    '<div dir="ltr" ref={containerRef} className="chat-room-container chat-screen"'
);

// 2. InvitationChatRoom.jsx
forceLtr('src/pages/InvitationChatRoom.jsx', 
    '<div className="chat-screen"', 
    '<div dir="ltr" className="chat-screen"'
);

// 3. Chat.jsx
forceLtr('src/pages/Chat.jsx', 
    '<div className="chat-layout">', 
    '<div dir="ltr" className="chat-layout">'
);

// 4. GroupChat.jsx
forceLtr('src/components/GroupChat.jsx', 
    '<div style={{ display: \'flex\', flexDirection: \'column\'', 
    '<div dir="ltr" style={{ display: \'flex\', flexDirection: \'column\''
);

// Add dir="auto" to message bubbles if we can, to ensure Arabic text renders Right-to-Left inside the Left-to-Right layout
function addDirAuto(filePath) {
    const fullPath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(fullPath)) return;
    
    let content = fs.readFileSync(fullPath, 'utf8');
    
    let updated = content.replace(/<span>\{msg\.text\}<\/span>/g, '<span dir="auto">{msg.text}</span>');
    updated = updated.replace(/<span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word'/g, `<span dir="auto" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word'`);
    updated = updated.replace(/<p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word'/g, `<p dir="auto" style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word'`);
    
    if (content !== updated) {
        fs.writeFileSync(fullPath, updated);
        console.log(`Added dir="auto" to text in ${filePath}`);
    } else {
        console.log(`No match for dir="auto" replacement in ${filePath}`);
    }
}

addDirAuto('src/pages/CommunityChatRoom.jsx');
addDirAuto('src/pages/InvitationChatRoom.jsx');
addDirAuto('src/pages/Chat.jsx');
addDirAuto('src/components/GroupChat.jsx');
