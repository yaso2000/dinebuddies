const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, searchRegex, replaceWith) {
    const fullPath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(fullPath)) return;
    
    let content = fs.readFileSync(fullPath, 'utf8');
    const newContent = content.replace(searchRegex, replaceWith);
    
    if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent);
        console.log(`Updated ${filePath}`);
    } else {
        console.log(`No match or already updated in ${filePath}`);
    }
}

// 1. In CommunityChatRoom.jsx
replaceInFile(
    'src/pages/CommunityChatRoom.jsx',
    /<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>/g,
    '<div style={{ display: \'flex\', flexDirection: \'column\', alignItems: \'flex-start\', flex: 1, minWidth: 0 }}>'
);
replaceInFile(
    'src/pages/CommunityChatRoom.jsx',
    /<h1 className="header-title" style={{ fontSize: '16px' }}>/g,
    '<h1 className="header-title" style={{ fontSize: \'16px\', whiteSpace: \'nowrap\', overflow: \'hidden\', textOverflow: \'ellipsis\', width: \'100%\' }}>'
);
replaceInFile(
    'src/pages/CommunityChatRoom.jsx',
    /<span className="header-subtitle" style={{ fontSize: '12px' }}>/g,
    '<span className="header-subtitle" style={{ fontSize: \'12px\', whiteSpace: \'nowrap\', overflow: \'hidden\', textOverflow: \'ellipsis\', width: \'100%\' }}>'
);
// Make sure header-info also has flex:1 and minWidth: 0
replaceInFile(
    'src/pages/CommunityChatRoom.jsx',
    /className="header-info" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginInlineStart: '8px' }}/g,
    'className="header-info" style={{ flexDirection: \'row\', alignItems: \'center\', justifyContent: \'flex-start\', marginInlineStart: \'8px\', flex: 1, minWidth: 0 }}'
);

// 2. In Chat.jsx (Direct messages)
// Similar structure?
replaceInFile(
    'src/pages/Chat.jsx',
    /<h3 className="header-title">/g,
    '<h3 className="header-title" style={{ whiteSpace: \'nowrap\', overflow: \'hidden\', textOverflow: \'ellipsis\', width: \'100%\' }}>'
);
replaceInFile(
    'src/pages/Chat.jsx',
    /<div className="header-info"(.*?)>/g,
    '<div className="header-info"$1 style={{ minWidth: 0, flex: 1 }}>'
);

// 3. In InvitationChatRoom.jsx
replaceInFile(
    'src/pages/InvitationChatRoom.jsx',
    /<div style={{ flex: 1, minWidth: 0 }}>/g,
    '<div style={{ flex: 1, minWidth: 0, overflow: \'hidden\' }}>'
);
// The header title in InvitationChatRoom already has: whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'

console.log("Done patching chat headers.");
