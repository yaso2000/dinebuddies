function normalizeEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function isConfiguredSuperOwner({ uid, email }, { superOwnerUids, superOwnerEmails }) {
    const configuredUids = Array.isArray(superOwnerUids) ? superOwnerUids : [];
    const configuredEmails = Array.isArray(superOwnerEmails)
        ? superOwnerEmails.map(normalizeEmail)
        : [];
    return configuredUids.includes(uid) || configuredEmails.includes(normalizeEmail(email));
}

function buildAdminGrantClaims({ targetUid, targetEmail, currentClaims, superOwnerUids, superOwnerEmails }) {
    const existingClaims = currentClaims && typeof currentClaims === 'object' ? currentClaims : {};
    return {
        ...existingClaims,
        admin: true,
        superOwner: isConfiguredSuperOwner(
            { uid: targetUid, email: targetEmail },
            { superOwnerUids, superOwnerEmails }
        )
    };
}

module.exports = {
    buildAdminGrantClaims,
    isConfiguredSuperOwner
};
