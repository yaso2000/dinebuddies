import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const additions = {
    en: {
        ai_context_current_message: 'Current message: {{value}}',
        ai_context_current_title: 'Current title: {{value}}',
        ai_context_location: 'Location: {{value}}',
        ai_context_occasion: 'Occasion: {{value}}',
        ai_context_post_linked_invitation: 'Post linked to invitation: {{title}}',
        ai_context_schedule: 'Schedule: {{date}} {{time}}',
        ai_prompt_dating_default:
            'Write a dating invitation title and a short romantic message suited to the occasion.',
        ai_prompt_dating_invitee: 'Invitee: {{name}}',
        ai_prompt_private_invitation_default:
            'Write a private invitation title and welcoming message suited to the occasion and venue.',
        ai_prompt_regular_post_default: 'Short friendly community post',
    },
    ar: {
        ai_context_current_message: 'رسالة حالية: {{value}}',
        ai_context_current_title: 'عنوان حالي: {{value}}',
        ai_context_location: 'المكان: {{value}}',
        ai_context_occasion: 'المناسبة: {{value}}',
        ai_context_post_linked_invitation: 'منشور مرتبط بدعوة: {{title}}',
        ai_context_schedule: 'الموعد: {{date}} {{time}}',
        ai_prompt_dating_default: 'اكتب عنوان دعوة موعد ورسالة رومانسية قصيرة ومناسبة',
        ai_prompt_dating_invitee: 'المدعو/ة: {{name}}',
        ai_prompt_private_invitation_default:
            'اكتب عنوان دعوة خاصة ورسالة ترحيبية مناسبة للمناسبة والمكان',
        ai_prompt_regular_post_default: 'منشور مجتمعي قصير وودّي',
    },
};

for (const file of ['en.json', 'ar.json']) {
    const lang = file.startsWith('en') ? 'en' : 'ar';
    const p = path.join(root, 'src/locales', file);
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    Object.assign(data, additions[lang]);
    const sorted = Object.fromEntries(Object.keys(data).sort().map((k) => [k, data[k]]));
    fs.writeFileSync(p, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
}

console.log('Added', Object.keys(additions.en).length, 'AI prompt keys');
