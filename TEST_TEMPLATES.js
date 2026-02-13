// ✅ TEST: Quick verification script
// Run this in browser console on /create page

console.log('🧪 Testing Template System...');

// 1. Check if files exist
import('./utils/invitationTemplates.js').then(module => {
    console.log('✅ Templates file loaded:', {
        colors: Object.keys(module.COLOR_SCHEMES).length,
        templates: Object.keys(module.TEMPLATE_STYLES).length
    });
}).catch(e => console.error('❌ Templates file error:', e));

// 2. Check if component renders
const selector = document.querySelector('[style*="Choose Your Style"]') ||
    document.querySelector('h3');

if (selector && selector.textContent.includes('Choose Your Style')) {
    console.log('✅ TemplateColorSelector is rendering');
} else {
    console.warn('⚠️ Selector not found - are you on /create page?');
}

// 3. Check states
setTimeout(() => {
    console.log('Current page:', window.location.pathname);
    console.log('If you see "Choose Your Style" heading, everything works! 🎉');
}, 1000);
