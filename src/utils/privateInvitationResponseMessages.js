/** @typedef {'male' | 'female' | 'neutral'} UserGender */

/** @param {object} [profile] @returns {UserGender} */
export function normalizeUserGender(profile) {
    const raw = String(profile?.gender || profile?.sex || '').toLowerCase();
    if (raw === 'female' || raw === 'f' || raw === 'woman') return 'female';
    if (raw === 'male' || raw === 'm' || raw === 'man') return 'male';
    return 'neutral';
}

function isArabicLocale(locale) {
    return String(locale || '').toLowerCase().startsWith('ar');
}

export { isArabicLocale };

function trimTitle(title, locale = 'en') {
    const trimmed = String(title || '').trim();
    if (trimmed) return trimmed;
    return isArabicLocale(locale) ? 'الدعوة' : 'Invitation';
}

function hostThanksPhrase(hostGender, locale) {
    if (!isArabicLocale(locale)) return 'Thank you for the invitation';
    if (hostGender === 'female') return 'شكراً لكِ على الدعوة';
    if (hostGender === 'male') return 'شكراً لك على الدعوة';
    return 'شكراً على الدعوة';
}

function hostMeetPhrase(hostGender, locale) {
    if (!isArabicLocale(locale)) return 'see you';
    if (hostGender === 'female') return 'للقائكِ';
    if (hostGender === 'male') return 'للقائك';
    return 'للقاء';
}

function hostWishPhrase(hostGender, locale) {
    if (!isArabicLocale(locale)) return 'Wishing you a wonderful time';
    if (hostGender === 'female') return 'أتمنى لكِ وقتاً جميلاً';
    if (hostGender === 'male') return 'أتمنى لك وقتاً جميلاً';
    return 'أتمنى لكم وقتاً جميلاً';
}

/** Chat + notification body (first person from invitee). */
export function buildPrivateInvitationResponseChatMessage(opts) {
    const {
        status,
        responderGender = 'neutral',
        hostGender = 'neutral',
        invitationTitle = '',
        isDating = false,
        locale = 'en',
    } = opts;
    const title = trimTitle(invitationTitle, locale);
    const thanks = hostThanksPhrase(hostGender, locale);
    const wish = hostWishPhrase(hostGender, locale);
    const meet = hostMeetPhrase(hostGender, locale);

    if (isArabicLocale(locale)) {
        if (status === 'accepted') {
            if (isDating) {
                if (responderGender === 'female') {
                    return `${thanks}! قبلت «${title}» وأنا متحمسة ${meet} 💕`;
                }
                if (responderGender === 'male') {
                    return `${thanks}! قبلت «${title}» وأنا متحمس ${meet} 💕`;
                }
                return `${thanks}! قبلت «${title}» وإن شاء الله أكون هناك 💕`;
            }
            if (responderGender === 'female') {
                return `${thanks}! قبلت «${title}» ومتحمسة للحضور 🎉`;
            }
            if (responderGender === 'male') {
                return `${thanks}! قبلت «${title}» ومتحمس للحضور 🎉`;
            }
            return `${thanks}! قبلت «${title}» وإن شاء الله أحضر 🎉`;
        }

        if (responderGender === 'female') {
            return `أعتذر بصدق، لن أتمكن من الحضور هذه المرة. ${wish} على «${title}» 🌸`;
        }
        if (responderGender === 'male') {
            return `أعتذر بصدق، لن أتمكن من الحضور هذه المرة. ${wish} على «${title}» 🌸`;
        }
        return `أعتذر، لن أتمكن من الحضور هذه المرة. ${wish} على «${title}» 🌸`;
    }

    if (status === 'accepted') {
        if (isDating) {
            return `Thank you for the invitation! I'd love to join you for "${title}" 💕`;
        }
        return `Thank you! I've accepted "${title}" and I'm looking forward to it 🎉`;
    }
    return `I'm sorry, I won't be able to make it this time. Wishing you a wonderful "${title}" 🌸`;
}

export function buildPrivateInvitationResponseNotificationTitle(opts) {
    const { status, locale = 'en', isDating = false } = opts;
    if (isArabicLocale(locale)) {
        if (status === 'accepted') {
            return isDating ? '💕 تم قبول موعد الدعوة' : '✅ تم قبول الدعوة';
        }
        return '🌸 اعتذار عن الدعوة';
    }
    return status === 'accepted' ? '✅ Invitation accepted' : '🌸 Invitation declined';
}
