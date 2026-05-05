/**
 * Framer Motion props for invitation hero title / message on image layouts.
 * Canonical modes match `INVITATION_COVER_ANIMATION_TYPES` in `aiInvitationThemeBinding.js` and `api/generate-image.js`.
 */

import { resolveCoverAnimationForMotion } from './aiInvitationThemeBinding';

/**
 * @param {string | undefined} mode
 * @returns {{ animate: object; transition: object } | null} null = no motion (static text)
 */
export function getCoverTextMotionProps(mode) {
    const effective = resolveCoverAnimationForMotion(mode);
    if (!effective) return null;

    const baseTransition = { repeat: Infinity, ease: 'easeInOut' };

    switch (effective) {
        case 'elegant-fade':
            return {
                animate: { opacity: [1, 0.78, 1] },
                transition: { ...baseTransition, duration: 3.2 },
            };
        case 'glide-up':
            return {
                animate: {
                    opacity: [1, 0.94, 1],
                    y: [2, -6, 2],
                },
                transition: { ...baseTransition, duration: 3.4 },
            };
        case 'gentle-pulse':
            return {
                animate: {
                    opacity: [1, 0.92, 1],
                    scale: [1, 1.02, 1],
                },
                transition: { ...baseTransition, duration: 2.5 },
            };
        default:
            return {
                animate: {
                    opacity: [1, 0.92, 1],
                    scale: [1, 1.02, 1],
                },
                transition: { ...baseTransition, duration: 2.5 },
            };
    }
}
