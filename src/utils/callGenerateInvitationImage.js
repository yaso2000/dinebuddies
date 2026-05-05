import { getAuth } from 'firebase/auth';

/**
 * POST /api/generate-image — atomic invitation pack (Gemini JSON + cover image) + credit handling.
 *
 * @param {{
 *   prompt?: string,
 *   style?: string,
 *   userBrief?: string,
 *   language?: string,
 *   hints?: Record<string, unknown>,
 *   referenceImage?: { mimeType: string, dataBase64: string },
 *   coverAspectRatio?: '1:1' | '9:16',
 *   userPreferences?: { tonePreference?: string, colorPreference?: string, fontPreference?: string, inviteMood?: string, venueType?: string },
 * }} payload
 * @returns {Promise<{
 *   basic_info?: { title: string, message: string, style_suggestion: string },
 *   media?: { image_prompt: string },
 *   theme?: { frame_text_color: string, font_name: string },
 *   animation_meta?: { type: 'elegant-fade' | 'gentle-pulse' | 'glide-up' | 'none' },
 *   mimeType: string,
 *   dataBase64: string,
 *   creditsCharged?: number,
 * }>}
 */
export async function callGenerateInvitationImage(payload) {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
        const e = new Error('Authentication required.');
        e.code = 'unauthenticated';
        throw e;
    }
    const token = await user.getIdToken();

    const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            prompt: payload.prompt,
            style: payload.style,
            userBrief: payload.userBrief,
            language: payload.language,
            hints: payload.hints,
            referenceImage: payload.referenceImage,
            coverAspectRatio: payload.coverAspectRatio,
            userPreferences: payload.userPreferences,
        }),
    });

    let json = {};
    try {
        json = await res.json();
    } catch {
        json = {};
    }

    if (!res.ok) {
        const e = new Error(json.message || json.error || `Request failed (${res.status})`);
        e.code = json.code || `http_${res.status}`;
        e.status = res.status;
        e.details = json;
        throw e;
    }

    return json;
}
