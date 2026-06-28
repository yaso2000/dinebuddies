const { listGooglePlayCreditProducts, resolveGooglePlayPackageName } = require('./googlePlayCatalog');

function hasGooglePlayServiceAccount() {
    const raw = String(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || '').trim();
    return raw.length > 10;
}

function googlePlayCommerceStatus() {
    return {
        packageName: resolveGooglePlayPackageName(),
        serviceAccountConfigured: hasGooglePlayServiceAccount(),
        creditProducts: listGooglePlayCreditProducts(),
    };
}

module.exports = {
    hasGooglePlayServiceAccount,
    googlePlayCommerceStatus,
};
