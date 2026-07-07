/**
 * Curated relationship & dating advice excerpts for AI Text Studio.
 * Grounded in publicly available guidance from research-backed organizations.
 * Edit or extend this file to add more Q&A — retrieval runs keyword/topic matching.
 *
 * @typedef {{ name: string, url: string }} AdviceSource
 * @typedef {{
 *   id: string,
 *   topic: string,
 *   keywords: { en: string[], ar: string[] },
 *   questionExamples: { en: string[], ar: string[] },
 *   guidance: string,
 *   sources: AdviceSource[],
 * }} RelationshipAdviceEntry
 */

/** @type {RelationshipAdviceEntry[]} */
export const RELATIONSHIP_ADVICE_KNOWLEDGE = [
    {
        id: 'healthy-communication-ratio',
        topic: 'Healthy communication',
        keywords: {
            en: ['communication', 'argument', 'fight', 'conflict', 'criticism', 'compliment', 'praise', 'tone'],
            ar: ['تواصل', 'جدال', 'شجار', 'خلاف', 'نقد', 'مدح', 'إطراء', 'نبرة', 'محادثة'],
        },
        questionExamples: {
            en: [
                'How do we argue without hurting each other?',
                'What makes communication healthy in a relationship?',
            ],
            ar: [
                'كيف نتجادل دون أن نؤذي بعضنا؟',
                'ما الذي يجعل التواصل صحياً في العلاقة؟',
            ],
        },
        guidance:
            'Research on long-term couples (Gottman Institute) suggests stable relationships maintain far more positive than negative interactions during everyday talk — often summarized as about five positive moments for each negative one. Focus on specific appreciation, curiosity, and repair attempts after tension (a sincere apology, humor, or a gentle check-in). Avoid contempt, stonewalling, and personal attacks. Disagreements are normal; how you repair matters more than never fighting.',
        sources: [
            { name: 'Gottman Institute', url: 'https://www.gottman.com/blog/the-magic-relationship-ratio/' },
            { name: 'APA — Marriage & relationships', url: 'https://www.apa.org/topics/marriage-relationships' },
        ],
    },
    {
        id: 'boundaries-consent',
        topic: 'Boundaries and consent',
        keywords: {
            en: ['boundary', 'boundaries', 'consent', 'no', 'pressure', 'uncomfortable', 'limits', 'respect'],
            ar: ['حدود', 'حد', 'موافقة', 'لا', 'ضغط', 'مزعج', 'غير مرتاح', 'احترام', 'يرفض'],
        },
        questionExamples: {
            en: [
                'How do I set boundaries on a date?',
                'What if they pressure me to do something I do not want?',
            ],
            ar: [
                'كيف أضع حدوداً في الموعد؟',
                'ماذا أفعل إذا ضغط عليّ لفعل شيء لا أريده؟',
            ],
        },
        guidance:
            'Healthy relationships require clear, mutual respect for boundaries and ongoing consent — consent must be freely given, informed, and can be withdrawn at any time. State limits calmly and directly ("I am not comfortable with that"). A partner who respects you will accept a no without guilt-tripping, threats, or persistence. Pressure, manipulation, or ignoring boundaries are warning signs, not normal dating friction.',
        sources: [
            { name: 'CDC — Healthy relationships (Dating Matters)', url: 'https://vetoviolence.cdc.gov/apps/heart/' },
            { name: 'Love is Respect', url: 'https://www.loveisrespect.org/healthy-relationships/' },
        ],
    },
    {
        id: 'first-date-safety',
        topic: 'First-date safety',
        keywords: {
            en: ['first date', 'meet', 'meeting', 'safety', 'public', 'stranger', 'online', 'location', 'alone'],
            ar: ['موعد أول', 'لقاء', 'أول مرة', 'سلامة', 'عام', 'غريب', 'أونلاين', 'مكان', 'وحدي', 'وحدها'],
        },
        questionExamples: {
            en: [
                'How do I stay safe on a first date?',
                'Should I meet someone from the app in private?',
            ],
            ar: [
                'كيف أبقى آمناً في الموعد الأول؟',
                'هل ألتقي بشخص من التطبيق في مكان خاص؟',
            ],
        },
        guidance:
            'For early meetings, choose a busy public place, arrange your own transport, and tell a trusted friend where you are and when you expect to finish. Keep personal details (home address, workplace routines) private until trust builds over time. Stay sober enough to make clear decisions. If you feel uneasy at any point, you may leave — no explanation owed. Video chat once before an in-person meet can reduce surprises.',
        sources: [
            { name: 'RAINN — Online dating safety', url: 'https://www.rainn.org/articles/online-dating-and-dating-app-safety-tips' },
            { name: 'Love is Respect', url: 'https://www.loveisrespect.org/resources/safe-dating-tips/' },
        ],
    },
    {
        id: 'handling-rejection',
        topic: 'Handling rejection',
        keywords: {
            en: ['rejection', 'rejected', 'unmatched', 'ghosted', 'no interest', 'dignity', 'move on'],
            ar: ['رفض', 'رفضني', 'غير مهتم', 'تجاهل', 'ghost', 'كرامة', 'تخطي', 'لا يهتم'],
        },
        questionExamples: {
            en: [
                'How do I handle rejection with dignity?',
                'They stopped replying — what should I do?',
            ],
            ar: [
                'كيف أتعامل مع الرفض بكرامة؟',
                'توقف عن الرد — ماذا أفعل؟',
            ],
        },
        guidance:
            'Rejection is common in dating and rarely a measure of your worth. Accept the answer without repeated messages, guilt, or arguments. One polite follow-up after a few days is reasonable; persistent contact after a clear no is disrespectful and can feel threatening. Redirect energy toward people who show mutual interest. Self-care, friends, and hobbies help you recover faster than analyzing every detail.',
        sources: [
            { name: 'APA — Relationships', url: 'https://www.apa.org/topics/relationships' },
            { name: 'Love is Respect', url: 'https://www.loveisrespect.org/resources/10-tips-for-healthy-relationships/' },
        ],
    },
    {
        id: 'expressing-interest',
        topic: 'Expressing interest respectfully',
        keywords: {
            en: ['interest', 'flirt', 'message', 'text', 'ask out', 'compliment', 'start conversation', 'nervous'],
            ar: ['اهتمام', 'إعجاب', 'رسالة', 'مدح', 'دعوة', 'محادثة', 'أبدأ', 'متوتر', 'خجول'],
        },
        questionExamples: {
            en: [
                'How do I show interest without being pushy?',
                'How do I start a conversation on a dating app?',
            ],
            ar: [
                'كيف أظهر اهتمامي دون إزعاج؟',
                'كيف أبدأ محادثة في تطبيق مواعدة؟',
            ],
        },
        guidance:
            'Show interest with specificity and respect: mention something from their profile, ask open questions, and invite rather than demand ("Would you like to grab coffee this week?"). Match their pace — if replies are brief, do not flood with messages. Compliments should focus on choices or personality, not pressure about appearance. Enthusiasm is attractive; entitlement to their time is not.',
        sources: [
            { name: 'CDC — Healthy relationships toolkit', url: 'https://vetoviolence.cdc.gov/apps/heart/' },
            { name: 'Gottman Institute — Friendship in love', url: 'https://www.gottman.com/blog/the-sound-relationship-house/' },
        ],
    },
    {
        id: 'red-flags-warning-signs',
        topic: 'Warning signs',
        keywords: {
            en: ['red flag', 'warning', 'toxic', 'control', 'jealous', 'abuse', 'manipulation', 'stalking'],
            ar: ['علامة خطر', 'تحذير', 'سام', 'سيطرة', 'غيرة', 'إساءة', 'تلاعب', 'مطاردة', 'تحكم'],
        },
        questionExamples: {
            en: [
                'What are red flags in dating?',
                'Is extreme jealousy a sign of love?',
            ],
            ar: [
                'ما علامات الخطر في المواعدة؟',
                'هل الغيرة الشديدة دليل حب؟',
            ],
        },
        guidance:
            'Warning signs include controlling who you see, monitoring your phone, isolating you from friends, intense jealousy framed as love, humiliation, threats, or pressure around sex and money. Love should not require fear. Mild jealousy can be human, but possessiveness and surveillance are not healthy romance. If you feel unsafe, prioritize support from trusted people or local helplines over trying to "fix" the other person alone.',
        sources: [
            { name: 'Love is Respect — Abuse defined', url: 'https://www.loveisrespect.org/resources/is-this-abuse/' },
            { name: 'CDC — Dating Matters science', url: 'https://www.cdc.gov/intimate-partner-violence/php/datingmatters/the-science-behind-dating-matters.html' },
        ],
    },
    {
        id: 'emotional-safety-attachment',
        topic: 'Emotional safety',
        keywords: {
            en: ['attachment', 'anxiety', 'insecure', 'trust', 'closeness', 'distance', 'need reassurance'],
            ar: ['تعلق', 'قلق', 'عدم أمان', 'ثقة', 'قرب', 'مسافة', 'طمأنة', 'خوف', 'هجر'],
        },
        questionExamples: {
            en: [
                'Why do I get anxious when they do not reply?',
                'How do I build emotional safety with someone new?',
            ],
            ar: [
                'لماذا أقلق عندما لا يرد؟',
                'كيف أبني أماناً عاطفياً مع شخص جديد؟',
            ],
        },
        guidance:
            'Emotional safety grows when partners respond consistently, validate feelings, and repair after misunderstandings. Anxiety when someone is slow to reply often reflects attachment stress, not proof they dislike you — name the feeling, avoid accusatory messages, and ask for a realistic check-in rhythm. Early dating benefits from steady honesty about expectations rather than testing the other person with games.',
        sources: [
            { name: 'Gottman Institute — Attachment', url: 'https://www.gottman.com/blog/attachment-style-influences-success-relationship/' },
            { name: 'Hold Me Tight (Sue Johnson / EFT)', url: 'https://www.drsuejohnson.com/books/hold-me-tight/' },
        ],
    },
    {
        id: 'repair-after-conflict',
        topic: 'Repair after conflict',
        keywords: {
            en: ['apologize', 'sorry', 'forgive', 'make up', 'after fight', 'repair', 'misunderstanding'],
            ar: ['اعتذار', 'آسف', 'سامح', 'بعد شجار', 'تصالح', 'سوء فهم', 'إصلاح'],
        },
        questionExamples: {
            en: [
                'How do we recover after a big argument?',
                'What is a good apology in a relationship?',
            ],
            ar: [
                'كيف نتعافى بعد شجار كبير؟',
                'ما شكل الاعتذار الجيد في العلاقة؟',
            ],
        },
        guidance:
            'Effective repairs acknowledge impact without excuses, name what you will do differently, and invite dialogue. Gottman research highlights "repair attempts" — small bridges during or after conflict (humor, affection, taking responsibility) that prevent negativity from spiraling. Forgive incrementally; some issues need repeated conversation. Perpetual differences are normal; cruelty during conflict is not.',
        sources: [
            { name: 'Gottman Institute — Repair attempts', url: 'https://www.gottman.com/blog/make-repair-attempts/' },
            { name: 'Gottman — After a fight', url: 'https://www.gottman.com/blog/what-to-do-after-a-fight/' },
        ],
    },
    {
        id: 'respectful-differences',
        topic: 'Respecting differences',
        keywords: {
            en: ['gender', 'men', 'women', 'difference', 'stereotype', 'expectations', 'culture'],
            ar: ['جنس', 'رجل', 'امرأة', 'اختلاف', 'توقعات', 'ثقافة', 'الجنس الآخر'],
        },
        questionExamples: {
            en: [
                'How should I communicate with the opposite gender?',
                'Do men and women need completely different approaches?',
            ],
            ar: [
                'كيف أتواصل مع الجنس الآخر باحترام؟',
                'هل الرجل والمرأة يحتاجان أسلوباً مختلفاً تماماً؟',
            ],
        },
        guidance:
            'Treat people as individuals, not stereotypes. Communication styles vary more by person, culture, and attachment than by gender alone. Listen actively, ask before assuming, and avoid "all men" or "all women" framing. Respectful dating means curiosity, equality, and adjusting to the person in front of you — not scripts from pop psychology that generalize entire groups.',
        sources: [
            { name: 'APA — Healthy relationships', url: 'https://www.apa.org/topics/relationships' },
            { name: 'CDC — Healthy relationships', url: 'https://vetoviolence.cdc.gov/apps/heart/' },
        ],
    },
    {
        id: 'pace-and-expectations',
        topic: 'Relationship pace',
        keywords: {
            en: ['pace', 'too fast', 'too slow', 'exclusive', 'commitment', 'define relationship', 'expectations'],
            ar: ['سرعة', 'سريع', 'بطيء', 'حصري', 'التزام', 'تعريف العلاقة', 'توقعات'],
        },
        questionExamples: {
            en: [
                'When should we become exclusive?',
                'They want to move faster than me — what do I say?',
            ],
            ar: [
                'متى نصبح حصريين؟',
                'يريد التقدم أسرع مني — ماذا أقول؟',
            ],
        },
        guidance:
            'There is no universal timeline — clarity matters more than speed. Share what you are comfortable with ("I enjoy our dates and want to keep getting to know you before exclusivity"). Pressure to label the relationship or escalate intimacy before you are ready is a boundary issue. Mutual enthusiasm, not urgency, should drive next steps.',
        sources: [
            { name: 'Love is Respect — Healthy relationships', url: 'https://www.loveisrespect.org/healthy-relationships/' },
            { name: 'APA — Intimacy & relationships', url: 'https://www.apa.org/topics/relationships' },
        ],
    },
];
