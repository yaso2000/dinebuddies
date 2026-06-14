/**
 * Detect Google / Firebase AI (Gemini, Imagen) billing & quota errors from SDK messages.
 * @param {unknown} text
 */
export function isGeminiProviderBillingExhausted(text) {
    const s = String(text || '');
    if (!s.trim()) return false;
    return (
        /prepayment credits are depleted|credits are depleted/i.test(s) ||
        (/429/i.test(s) && /prepayment credits|credits are depleted/i.test(s))
    );
}

export const GEMINI_PROVIDER_BILLING_CODE = 'GEMINI_PROVIDER_BILLING_EXHAUSTED';

/** @param {string | undefined} locale */
export function geminiProviderBillingUserMessage(locale = 'en') {
    if (String(locale || '').toLowerCase().startsWith('ar')) {
        return (
            'كريدت Dine في التطبيق (مثل 3000+) مختلفة عن رصيد Google AI Prepay. ' +
            'Google رفض الطلب لأن رصيد الدفع المسبق لمشروع Firebase dinebuddies نفد — شحن Prepay من AI Studio (ai.studio/projects → dinebuddies → Billing)، وليس من محفظة الكريدت داخل التطبيق.'
        );
    }
    return (
        'Dine Credits in the app are separate from Google AI Prepay. ' +
        'Google returned “prepayment credits depleted” for Firebase project dinebuddies — top up Prepay in AI Studio (ai.studio/projects → dinebuddies → Billing), not the in-app wallet.'
    );
}

/**
 * @param {unknown} rawError
 * @returns {{ code: string, error: string, message: string } | null}
 */
export function normalizeGeminiProviderBillingError(rawError) {
    const text = rawError instanceof Error ? rawError.message : String(rawError || '');
    if (!isGeminiProviderBillingExhausted(text)) return null;
    const message = geminiProviderBillingUserMessage('en');
    return { code: GEMINI_PROVIDER_BILLING_CODE, error: message, message };
}
