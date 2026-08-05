const fs = require('fs');

const file = 'c:/Users/yaser/v1/dinebuddies/src/pages/BusinessProfile.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add useTheme import
if (!content.includes("from '../context/ThemeContext'")) {
    content = content.replace("import { useAuth } from '../context/AuthContext';", "import { useAuth } from '../context/AuthContext';\nimport { useTheme } from '../context/ThemeContext';");
}

// 2. Add setBrandColor inside component
if (!content.includes("const { setBrandColor }")) {
    content = content.replace("const { currentUser, userProfile, updateUserProfile, isGuest } = useAuth();", "const { currentUser, userProfile, updateUserProfile, isGuest } = useAuth();\n    const { setBrandColor } = useTheme();");
}

// 3. Find brandKit extraction and inject useEffect for setBrandColor
const brandKitRegex = /const brandKit = \(isPreviewMode && previewBrandKit\) \? previewBrandKit : \(businessInfo\?\.brandKit \|\| \{\}\);\s*const _p = brandKit\.primaryColor;\s*const _s = brandKit\.secondaryColor \|\| _p;\s*const _br = brandKit\.buttonStyle \|\| '14px';\s*const _ff = 'system-ui, sans-serif';/s;

if (content.match(brandKitRegex)) {
    content = content.replace(brandKitRegex, (match) => {
        return `${match}\n\n    useEffect(() => {\n        setBrandColor(_p || null);\n        return () => setBrandColor(null);\n    }, [_p, setBrandColor]);\n`;
    });
}

// 4. Remove `tc` and `th` functions completely. 
// Note: It's better to just redefine `tc=null` and `th = (t, f) => f` in case we miss replacing something,
// but we will explicitly replace the known ones first.

content = content.replace(/th\(tc\?\.cardBg,\s*'(.*?)'\)/g, 'var(--bg-card)');
content = content.replace(/th\(tc\?\.cardBg \? tc\.cardBg \+ 'cc' : null,\s*'(.*?)'\)/g, 'color-mix(in srgb, var(--bg-card) 90%, transparent)');
content = content.replace(/th\(tc\?\.border,\s*'(.*?)'\)/g, 'var(--border-color)');
content = content.replace(/th\(tc\?\.accent,\s*'(.*?)'\)/g, 'var(--brand-primary)');
content = content.replace(/th\(tc\?\.badgeText,\s*'(.*?)'\)/g, 'var(--text-secondary)');
content = content.replace(/th\(tc\?\.badgeBg,\s*'(.*?)'\)/g, 'color-mix(in srgb, var(--brand-primary) 15%, transparent)');
content = content.replace(/th\(tc\?\.footerBg,\s*'(.*?)'\)/g, 'var(--brand-primary)');
content = content.replace(/th\(tc\?\.joinBtnBg,\s*'(.*?)'\)/g, 'var(--brand-primary)');
content = content.replace(/th\(tc\?\.joinBtnTextColor,\s*'(.*?)'\)/g, 'var(--text-on-brand)');
content = content.replace(/th\(tc\?\.inviteBtnBg,\s*'(.*?)'\)/g, 'var(--bg-primary)');
content = content.replace(/th\(tc\?\.inviteBtnTextColor,\s*'(.*?)'\)/g, 'var(--text-primary)');
content = content.replace(/th\(tc\?\.btnBorderRadius,\s*'(.*?)'\)/g, '16px');
content = content.replace(/th\(tc\?\.cardShadow,\s*'(.*?)'\)/g, '$1');
content = content.replace(/th\(tc\?\.btnShadow,\s*'(.*?)'\)/g, '0 8px 24px color-mix(in srgb, var(--brand-primary) 30%, transparent)');
content = content.replace(/th\(tc\?\.swatchGradient,\s*'(.*?)'\)/g, 'var(--brand-primary)');
content = content.replace(/th\(tc\?\.accentText \|\| '\#fff',\s*'(.*?)'\)/g, 'var(--text-on-brand)');
content = content.replace(/th\(tc\?\.gradientFrom \? `linear-gradient\(.*?\)` : null,\s*'(.*?)'\)/g, '$1');

// Clear out `const tc` object construction entirely as it's dead code now.
content = content.replace(/const tc = _p \? \(\(\) => \{.+?\}\)\(\) : null;/s, 'const tc = null; /* Removed legacy theme engine */');
content = content.replace(/const th = \(themed, fallback\) => \(tc && themed !== undefined\) \? themed : fallback;/g, 'const th = (t, f) => f; /* Legacy */');

// Additional inline replacements
content = content.replace(/tc\?\.accent \? `\$\{tc\.accent\}22` : '(.*?)'/g, 'color-mix(in srgb, var(--brand-primary) 15%, transparent)');
content = content.replace(/tc\?\.accent \? `\$\{tc\.accent\}44` : '(.*?)'/g, 'color-mix(in srgb, var(--brand-primary) 25%, transparent)');
content = content.replace(/`1\.5px solid \$\{tc\?\.accent \|\| '(.*?)'\}`/g, '`1.5px solid var(--brand-primary)`');
content = content.replace(/tc\?\.accent \|\| '(.*?)'/g, 'var(--brand-primary)');
content = content.replace(/tc\?\.headerGlow \|\| '(.*?)'/g, '0 10px 40px color-mix(in srgb, var(--brand-primary) 30%, transparent)');
content = content.replace(/tc \? `0 8px 24px \$\{tc\.accent\}66` : '(.*?)'/g, '0 8px 24px color-mix(in srgb, var(--brand-primary) 40%, transparent)');
content = content.replace(/tc\?\.swatchGradient \|\| '(.*?)'/g, 'var(--brand-primary)');

// Fix double background properties left over from complex string literal matching
content = content.replace(/tc\?\.inviteBtnBg \? \(tc\?\.tabBorderColor \|\| 'var\(--border-color\)'\) : 'var\(--border-color\)'/g, "'var(--border-color)'");

fs.writeFileSync(file, content, 'utf8');
console.log('Business Profile refactored successfully.');
