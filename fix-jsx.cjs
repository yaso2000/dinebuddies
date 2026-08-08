const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let original = content;

            // 1. Fix unquoted var(--...)
            // Match: `: var(--something)` or `: var(--something, fallback)`
            // Negative lookbehind for quotes is not fully supported in old node, so we match the colon and space.
            content = content.replace(/(:\s*)(var\(--[a-zA-Z0-9-]+(?:,\s*[^)]+)?\))([,} \n])/g, "$1'$2'$3");

            // 2. Fix unquoted color-mix(...)
            content = content.replace(/(:\s*)(color-mix\(in srgb, var\(--[a-zA-Z0-9-]+\)\s+[0-9]+%,\s*transparent\))([,} \n])/g, "$1'$2'$3");

            // 3. Fix unquoted boxShadow with color-mix
            content = content.replace(/(:\s*)(0 8px 24px color-mix\(in srgb, var\(--[a-zA-Z0-9-]+\)\s+[0-9]+%,\s*transparent\))([,} \n])/g, "$1'$2'$3");

            // 4. Fix other boxShadow unquoted (if any) like `0 4px 20px rgba(...)` when it wasn't quoted
            // Actually I didn't see any other unquoted ones, but let's be careful.

            // 5. Fix `var(--bg-card) !important` or similar if it's unquoted.
            content = content.replace(/(:\s*)(var\(--[a-zA-Z0-9-]+(?:,\s*[^)]+)?\)\s+!important)([,} \n])/g, "$1'$2'$3");

            if (content !== original) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Fixed unquoted strings in ${fullPath}`);
            }
        }
    }
}

processDir('c:/Users/yaser/v1/dinebuddies/src/components');
processDir('c:/Users/yaser/v1/dinebuddies/src/pages');
