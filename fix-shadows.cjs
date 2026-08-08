const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let original = content;

            // Target unquoted box shadow injected by the script
            const unquotedShadows = [
                '0 10px 30px rgba(0,0,0,0.15)',
                '0 8px 24px rgba(0,0,0,0.15)',
                '0 8px 24px rgba(0,0,0,0.1)',
                '0 4px 20px rgba(0,0,0,0.08)'
            ];

            for (const shadow of unquotedShadows) {
                const regexStr = `boxShadow:\\s*${shadow.replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/\./g, '\\.')}\\s*([,}])`;
                const regex = new RegExp(regexStr, 'g');
                content = content.replace(regex, `boxShadow: '${shadow}'$1`);
            }

            if (content !== original) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Fixed unquoted box shadows in ${fullPath}`);
            }
        }
    }
}

processDir('c:/Users/yaser/v1/dinebuddies/src/components');
processDir('c:/Users/yaser/v1/dinebuddies/src/pages');
