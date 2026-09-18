// Phone-number login (and its server-side resolver) was removed. Business
// accounts sign in with their EMAIL directly. Only shared UI copy remains here.

export const BUSINESS_LOGIN_INVALID_MSG_AR =
    'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
export const BUSINESS_LOGIN_INVALID_MSG_EN =
    'Invalid email or password.';

export const BUSINESS_AI_UNCLAIMED_MSG_AR =
    'هذا الحساب منشأ تلقائياً بالذكاء الاصطناعي. يرجى توثيق الحساب أولاً لتعيين كلمة مرور والدخول.';
export const BUSINESS_AI_UNCLAIMED_MSG_EN =
    'This account was created automatically by AI. Claim it first to set a password and sign in.';

export const RESET_GENERIC_SUCCESS_AR =
    'إذا كان الحساب موجوداً، فقد أرسلنا رابط الاستعادة.';
export const RESET_GENERIC_SUCCESS_EN =
    'If an account exists, we sent a reset link.';

export const AI_UNCLAIMED_CODES = new Set(['unclaimed-ai-profile', 'ai-unclaimed']);
