/** Fixed-opacity panels behind card copy on photo backgrounds (tone only — no slider). */
export const DEFAULT_PRIVATE_TEXT_BACKDROP_TONE = 'dark';

/** @typedef {'dark' | 'light' | 'none'} PrivateTextBackdropTone */

export const PRIVATE_TEXT_BACKDROP_TONE_IDS = ['dark', 'light', 'none'];

export const PRIVATE_TEXT_BACKDROP_TONES = {
    dark: { color: '#000000', opacity: 0.52 },
    light: { color: '#ffffff', opacity: 0.52 }
};

/** @param {unknown} tone */
export function resolvePrivateTextBackdropTone(tone) {
    if (tone === 'light' || tone === 'none') return tone;
    return 'dark';
}

/** @param {PrivateTextBackdropTone} tone */
export function privateTextBackdropToneToRgba(tone) {
    const resolved = resolvePrivateTextBackdropTone(tone);
    if (resolved === 'none') return null;
    const spec = PRIVATE_TEXT_BACKDROP_TONES[resolved];
    const h = spec.color.slice(1);
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${spec.opacity})`;
}

/**
 * @param {object} [invitation]
 * @param {{ toneField: string, colorField: string, showField: string }} fields
 */
function resolveCardTextBackdropFromInvitationFields(invitation, { toneField, colorField, showField }) {
    const showWithContent = invitation[showField] !== false;
    let tone = invitation[toneField];
    if (tone !== 'light' && tone !== 'dark' && tone !== 'none') {
        const rawColor =
            typeof invitation[colorField] === 'string'
                ? invitation[colorField].trim().toLowerCase()
                : '';
        if (rawColor === '#ffffff' || rawColor === '#f8fafc') {
            tone = 'light';
        } else {
            tone = DEFAULT_PRIVATE_TEXT_BACKDROP_TONE;
        }
    }
    return {
        tone: resolvePrivateTextBackdropTone(tone),
        showWithContent
    };
}

/** @param {object} [invitation] */
export function getPrivateCardTextBackdropFromInvitation(invitation) {
    if (!invitation || invitation.type !== 'Private') {
        return { tone: DEFAULT_PRIVATE_TEXT_BACKDROP_TONE, showWithContent: false };
    }
    return resolveCardTextBackdropFromInvitationFields(invitation, {
        toneField: 'privateCardTextBackdropTone',
        colorField: 'privateCardTextBackdropColor',
        showField: 'privateCardShowHostAndMessage'
    });
}

/** @param {object} [invitation] */
export function getDatingCardTextBackdropFromInvitation(invitation) {
    if (!invitation || invitation.type !== 'Dating') {
        return { tone: DEFAULT_PRIVATE_TEXT_BACKDROP_TONE, showWithContent: false };
    }
    return resolveCardTextBackdropFromInvitationFields(invitation, {
        toneField: 'datingCardTextBackdropTone',
        colorField: 'datingCardTextBackdropColor',
        showField: 'datingCardShowHostAndMessage'
    });
}

/** Private or dating invitation card — text panel tone behind copy on photo backgrounds. */
export function getInvitationCardTextBackdropFromInvitation(invitation) {
    if (!invitation) {
        return { tone: DEFAULT_PRIVATE_TEXT_BACKDROP_TONE, showWithContent: false };
    }
    if (invitation.type === 'Dating') return getDatingCardTextBackdropFromInvitation(invitation);
    if (invitation.type === 'Private') return getPrivateCardTextBackdropFromInvitation(invitation);
    return { tone: DEFAULT_PRIVATE_TEXT_BACKDROP_TONE, showWithContent: false };
}
