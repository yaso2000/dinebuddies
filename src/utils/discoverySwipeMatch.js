import { normalizeInvitePreference } from '../constants/privateProfileOptions';

/** @returns {'male' | 'female' | null} */
export function normalizeSwipeGender(gender) {
    const g = String(gender || '').trim().toLowerCase();
    if (g === 'male' || g === 'female') return g;
    return null;
}

/**
 * Whether someone with `invitePreference` is open to private invites from `gender`.
 * Social comfort boundary (friendship / meetups) — not sexual orientation.
 */
export function invitePreferenceAcceptsGender(invitePreference, gender) {
    const pref = normalizeInvitePreference(invitePreference);
    const g = normalizeSwipeGender(gender);
    if (!g) return false;
    if (pref === 'any') return true;
    if (pref === 'male_only') return g === 'male';
    if (pref === 'female_only') return g === 'female';
    return false;
}

/**
 * Which profile genders the viewer sees in swipe, from their own invite preference
 * («من يمكنه إرسال دعوات خاصة لك؟»).
 * @returns {Array<'male' | 'female'>}
 */
export function swipeVisibleGendersForViewer(invitePreference) {
    const pref = normalizeInvitePreference(invitePreference);
    if (pref === 'male_only') return ['male'];
    if (pref === 'female_only') return ['female'];
    return ['male', 'female'];
}

/**
 * Swipe deck — mutual gender comfort: viewer preference ∩ target preference.
 * Connect card list uses manual chips instead (no auto gender filter).
 */
export function isDiscoverySwipeMatch(viewer, target) {
    if (!viewer?.id || !target?.id || viewer.id === target.id) return false;

    const targetGender = normalizeSwipeGender(target?.gender);
    const viewerGender = normalizeSwipeGender(viewer?.gender);
    if (!targetGender || !viewerGender) return false;

    if (!invitePreferenceAcceptsGender(viewer?.invitePreference, targetGender)) return false;
    if (!invitePreferenceAcceptsGender(target?.invitePreference, viewerGender)) return false;

    return true;
}
