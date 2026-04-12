const fs = require('fs');
const path = require('path');

function forceLtr(filePath, matchStr, replaceStr) {
    const fullPath = path.join(__dirname, '..', filePath);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes(matchStr) && !content.includes(replaceStr)) {
            // Use global replace instead of just replace to catch all instances
            content = content.replace(new RegExp(matchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replaceStr);
            fs.writeFileSync(fullPath, content);
            console.log(`Forced LTR in ${filePath}`);
        } else {
            console.log(`Skipped or already applied in ${filePath}`);
        }
    }
}

// 3. Chat.jsx
forceLtr('src/pages/Chat.jsx', '<div className="chat-container">', '<div dir="ltr" className="chat-container">');

// Also Add dir="auto" to text in Chat.jsx
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
    }
}

addDirAuto('src/pages/Chat.jsx');
