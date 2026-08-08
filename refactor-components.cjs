const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/yaser/v1/dinebuddies/src/components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx') || f.endsWith('.js'));

for (const file of files) {
    const fullPath = path.join(dir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    let original = content;

    // 1. Replace specific known attributes
    content = content.replace(/th\(tc\?\.cardBg,\s*(undefined|'.*?'|".*?")\)/g, 'var(--bg-card)');
    content = content.replace(/th\(tc\?\.border,\s*(undefined|'.*?'|".*?")\)/g, 'var(--border-color)');
    content = content.replace(/th\(tc\?\.accentText.*?,\s*(undefined|'.*?'|".*?")\)/g, 'var(--text-on-brand)');
    content = content.replace(/th\(tc\?\.accent,\s*(undefined|'.*?'|".*?")\)/g, 'var(--brand-primary)');
    content = content.replace(/th\(tc\?\.badgeText,\s*(undefined|'.*?'|".*?")\)/g, 'var(--text-secondary)');
    content = content.replace(/th\(tc\?\.badgeBg,\s*(undefined|'.*?'|".*?")\)/g, 'color-mix(in srgb, var(--brand-primary) 15%, transparent)');
    
    // 2. Replace generic th(tc?.something, fallback)
    content = content.replace(/th\(tc\?\.([a-zA-Z]+)[^)]*,\s*(undefined|'(.*?)'|"(.*?)")\)/g, (match, prop, fallback) => {
        if(prop === 'starColor') return 'var(--stat-reviews)';
        if(prop.includes('Color')) return 'var(--brand-primary)';
        if(prop.includes('Bg')) return 'var(--bg-secondary)';
        if(prop.includes('Shadow')) return 'var(--shadow-premium)';
        return 'var(--brand-primary)';
    });

    // 3. Replace direct tc?.something references without th()
    content = content.replace(/tc\?\.starColor \|\| ('(.*?)'|"(.*?)")/g, "var(--stat-reviews)");
    content = content.replace(/tc\?\.accent \|\| ('(.*?)'|"(.*?)")/g, "var(--brand-primary)");
    content = content.replace(/tc\?\.([a-zA-Z]+) \? `\$\{tc.[a-zA-Z]+\}(.*?)` : ('(.*?)'|"(.*?)")/g, (match, prop, hexAlpha) => {
         return `color-mix(in srgb, var(--brand-primary) 20%, transparent)`;
    });
    content = content.replace(/tc\?\.([a-zA-Z]+)/g, 'var(--brand-primary)');

    // 4. Remove tc and th from destructured props
    content = content.replace(/,\s*tc(?:=null)?/g, '');
    content = content.replace(/,\s*th(?:=.*?)?/g, '');
    content = content.replace(/\s*tc(?:=null)?\s*,/g, '');
    content = content.replace(/\s*th(?:=.*?)?\s*,/g, '');

    if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${file}`);
    }
}
