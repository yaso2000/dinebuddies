import { isMinorUser } from '../constants/ageCategories';

/**
 * Members aged 16–17 and adults never interact privately: no private invitations,
 * no direct chat, and they are not shown to each other in people discovery, the
 * member directory or suggested friends. Public social invitations, venues and
 * quizzes stay open to everyone. Mirrored server-side in firestore.rules
 * (`sameAgeClass`).
 */
export function sameAgeClass(a, b) {
    return isMinorUser(a) === isMinorUser(b);
}

/** @param {object|null|undefined} viewer @param {object|null|undefined} target */
export function canInteractPrivately(viewer, target) {
    if (!viewer || !target) return true; // unknown → let the server rules decide
    return sameAgeClass(viewer, target);
}

/** Filter a list of directory/discovery members to the viewer's age class. */
export function filterSameAgeClass(viewer, members) {
    if (!viewer || !Array.isArray(members)) return members || [];
    const viewerMinor = isMinorUser(viewer);
    return members.filter((m) => isMinorUser(m) === viewerMinor);
}

export { isMinorUser };
