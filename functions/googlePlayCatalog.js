/**
 * Google Play product IDs — must match Play Console → Monetize → Products.
 * Internal package ids align with Stripe `CREDIT_PACKAGES` keys in creditsCore.js.
 */

const GOOGLE_PLAY_CREDIT_PRODUCTS = {
    dine_credits_200: { packageId: 'credits_200', credits: 200 },
    dine_credits_500: { packageId: 'credits_500', credits: 500 },
    dine_credits_1000: { packageId: 'credits_1000', credits: 1000 },
    dine_credits_3000: { packageId: 'credits_3000', credits: 3000 },
};

/** @type {Record<string, string>} packageId → Play product id */
const PACKAGE_ID_TO_GOOGLE_PRODUCT = Object.fromEntries(
    Object.entries(GOOGLE_PLAY_CREDIT_PRODUCTS).map(([productId, def]) => [def.packageId, productId])
);

function resolveGooglePlayPackageName() {
    return String(process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.dinebuddies.app').trim();
}

function resolveGoogleProductFromPackageId(packageId) {
    const id = String(packageId || '').trim();
    return PACKAGE_ID_TO_GOOGLE_PRODUCT[id] || null;
}

function resolvePackageFromGoogleProductId(productId) {
    const sku = String(productId || '').trim();
    return GOOGLE_PLAY_CREDIT_PRODUCTS[sku] || null;
}

function listGooglePlayCreditProducts() {
    return Object.entries(GOOGLE_PLAY_CREDIT_PRODUCTS).map(([productId, def]) => ({
        productId,
        packageId: def.packageId,
        credits: def.credits,
    }));
}

module.exports = {
    GOOGLE_PLAY_CREDIT_PRODUCTS,
    PACKAGE_ID_TO_GOOGLE_PRODUCT,
    resolveGooglePlayPackageName,
    resolveGoogleProductFromPackageId,
    resolvePackageFromGoogleProductId,
    listGooglePlayCreditProducts,
};
