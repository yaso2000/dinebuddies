/** Fixed-opacity panels behind card copy on photo backgrounds (tone only — no slider). */
export const DEFAULT_PRIVATE_TEXT_BACKDROP_TONE = 'dark';

/** @typedef {'dark' | 'light' | 'glass' | 'none'} PrivateTextBackdropTone */

export const PRIVATE_TEXT_BACKDROP_TONE_IDS = ['dark', 'light', 'glass', 'none'];

/** Icon rail on create/edit preview (light → dark → glass → none). */
export const SOCIAL_TEXT_BACKDROP_ICON_ORDER = ['light', 'dark', 'glass', 'none'];
export const PRIVATE_TEXT_BACKDROP_ICON_ORDER = SOCIAL_TEXT_BACKDROP_ICON_ORDER;

/** Message panel width on photo backgrounds (matches showcase preview proportions). Height follows copy. */
export const PRIVATE_TEXT_BACKDROP_PANEL_WIDTH = '78%';

export const PRIVATE_TEXT_BACKDROP_TONES = {
    dark: { color: '#000000', opacity: 0.38 },
    light: { color: '#ffffff', opacity: 0.38 },
    glass: { color: '#f8fafc', opacity: 0.22 }
};

/** @param {unknown} tone */
export function resolvePrivateTextBackdropTone(tone) {
    if (tone === 'light' || tone === 'none' || tone === 'glass') return tone;
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
    if (tone !== 'light' && tone !== 'dark' && tone !== 'glass' && tone !== 'none') {
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

/** Social invitation card — text panel tone (stored on socialCardTextBackdropTone). */
export function getPrivateCardTextBackdropFromInvitation(invitation) {
    if (!invitation || invitation.type !== 'Social') {
        return { tone: DEFAULT_PRIVATE_TEXT_BACKDROP_TONE, showWithContent: false };
    }
    return resolveCardTextBackdropFromInvitationFields(invitation, {
        toneField: 'socialCardTextBackdropTone',
        colorField: 'socialCardTextBackdropColor',
        showField: 'socialCardShowHostAndMessage'
    });
}

/** Private invitation card — text panel tone (stored on privateCardTextBackdropTone). */
export function getDatingCardTextBackdropFromInvitation(invitation) {
    if (!invitation || invitation.type !== 'Private') {
        return { tone: DEFAULT_PRIVATE_TEXT_BACKDROP_TONE, showWithContent: false };
    }
    return resolveCardTextBackdropFromInvitationFields(invitation, {
        toneField: 'privateCardTextBackdropTone',
        colorField: 'datingCardTextBackdropColor',
        showField: 'privateCardShowHostAndMessage'
    });
}

/** Private or private invite card — text panel tone behind copy on photo backgrounds. */
export function getInvitationCardTextBackdropFromInvitation(invitation) {
    if (!invitation) {
        return { tone: DEFAULT_PRIVATE_TEXT_BACKDROP_TONE, showWithContent: false };
    }
    if (invitation.type === 'Private') return getDatingCardTextBackdropFromInvitation(invitation);
    if (invitation.type === 'Social') return getPrivateCardTextBackdropFromInvitation(invitation);
    return { tone: DEFAULT_PRIVATE_TEXT_BACKDROP_TONE, showWithContent: false };
}
