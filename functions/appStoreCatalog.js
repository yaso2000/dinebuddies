/**
 * Apple App Store product catalog — mirrors functions/googlePlayCatalog.js.
 * Product ids must exactly match what is created in App Store Connect.
 */

const APPLE_CREDIT_PRODUCTS = {
    'com.dinebuddies.app.credits_200': { packageId: 'credits_200', credits: 200 },
    'com.dinebuddies.app.credits_500': { packageId: 'credits_500', credits: 500 },
    'com.dinebuddies.app.credits_1000': { packageId: 'credits_1000', credits: 1000 },
    'com.dinebuddies.app.credits_3000': { packageId: 'credits_3000', credits: 3000 },
};

const PACKAGE_ID_TO_APPLE_PRODUCT = Object.fromEntries(
    Object.entries(APPLE_CREDIT_PRODUCTS).map(([productId, def]) => [def.packageId, productId])
);

const APPLE_BUSINESS_SUBSCRIPTION_PRODUCT_ID = 'com.dinebuddies.app.business_monthly';

function resolveAppleBundleId() {
    return String(process.env.APPLE_IAP_BUNDLE_ID || 'com.dinebuddies.app').trim();
}

function resolveAppleProductFromPackageId(packageId) {
    const id = String(packageId || '').trim();
    return PACKAGE_ID_TO_APPLE_PRODUCT[id] || null;
}

function resolvePackageFromAppleProductId(productId) {
    const sku = String(productId || '').trim();
    return APPLE_CREDIT_PRODUCTS[sku] || null;
}

function isAppleBusinessSubscriptionProduct(productId) {
    return String(productId || '').trim() === APPLE_BUSINESS_SUBSCRIPTION_PRODUCT_ID;
}

function listAppleCreditProducts() {
    return Object.entries(APPLE_CREDIT_PRODUCTS).map(([productId, def]) => ({
        productId,
        packageId: def.packageId,
        credits: def.credits,
    }));
}

module.exports = {
    APPLE_CREDIT_PRODUCTS,
    PACKAGE_ID_TO_APPLE_PRODUCT,
    APPLE_BUSINESS_SUBSCRIPTION_PRODUCT_ID,
    resolveAppleBundleId,
    resolveAppleProductFromPackageId,
    resolvePackageFromAppleProductId,
    isAppleBusinessSubscriptionProduct,
    listAppleCreditProducts,
};
