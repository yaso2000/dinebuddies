/** Mock discovery profiles for the immersive 9:16 feed prototype. */
export const DISCOVERY_MOCK_PROFILES = [
    {
        id: 'disc-1',
        name: 'ليلى',
        age: 28,
        coverPhoto:
            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80',
        tasteTags: ['مطبخ إيطالي', 'قهوة مختصة', 'حلويات'],
        bio: 'أبحث عن رفقة لاكتشاف مطاعم جديدة بدون ضغط.',
    },
    {
        id: 'disc-2',
        name: 'Omar',
        age: 31,
        coverPhoto:
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
        tasteTags: ['شاورما', 'مشاوي', 'شاي'],
        bio: 'عشاق الطعام الشارعي والجلسات الهادئة.',
    },
    {
        id: 'disc-3',
        name: 'Sara',
        age: 26,
        coverPhoto:
            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=800&q=80',
        tasteTags: ['سوشي', 'نباتي', 'برانش'],
        bio: 'مواعيد غداء عفوية ومحادثات خفيفة.',
    },
    {
        id: 'disc-4',
        name: 'Youssef',
        age: 29,
        coverPhoto:
            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80',
        tasteTags: ['مأكولات بحرية', 'كافيهات', 'تجارب جديدة'],
        bio: 'دائماً مستعد لتجربة مطعم جديد في المدينة.',
    },
];

export const ICEBREAKER_ITEMS = [
    { id: 'coffee', emoji: '☕', label: 'قهوة؟' },
    { id: 'bubble-tea', emoji: '🧋', label: 'شاي مثلج' },
    { id: 'cookie', emoji: '🍪', label: 'حلوى' },
    { id: 'wave', emoji: '👋', label: 'تحية' },
];

export const INBOX_MOCK_CHATS = [
    {
        id: 'chat-1',
        name: 'ليلى',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop&crop=face',
        preview: 'أحب فكرة المطعم اللي اقترحته!',
        time: '2m',
        unread: 2,
    },
    {
        id: 'chat-2',
        name: 'Omar',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop&crop=face',
        preview: 'نتفق على الغداء يوم الخميس؟',
        time: '1h',
        unread: 0,
    },
];

export const INBOX_MOCK_INVITES = [
    {
        id: 'inv-1',
        type: 'gift',
        from: 'Sara',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=128&h=128&fit=crop&crop=face',
        title: 'هدية بريميوم — قهوة مجانية',
        time: 'اليوم',
        premium: true,
    },
    {
        id: 'inv-2',
        type: 'dining',
        from: 'Youssef',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=128&h=128&fit=crop&crop=face',
        title: 'دعوة للطعام — مطعم بحري',
        time: 'أمس',
        premium: false,
    },
];

export const INBOX_MOCK_ACTIVITY = [
    { id: 'act-1', text: 'Omar تابعك', time: '3h' },
    { id: 'act-2', text: 'Sara أعجبت بملفك', time: '5h' },
    { id: 'act-3', text: 'ليلى أرسلت تحية 👋', time: '1d' },
];

export const INBOX_MOCK_LIKED_YOU = [
    { id: 'like-1', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop&crop=face' },
    { id: 'like-2', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=128&h=128&fit=crop&crop=face' },
    { id: 'like-3', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80' },
    { id: 'like-4', avatar: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&q=80' },
];
