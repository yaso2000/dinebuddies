/**
 * Apple App Store Server API env/config status — mirrors functions/googlePlayEnv.js.
 */
const { listAppleCreditProducts, resolveAppleBundleId, APPLE_BUSINESS_SUBSCRIPTION_PRODUCT_ID } = require('./appStoreCatalog');

function hasAppleIapKey() {
    const keyId = String(process.env.APPLE_IAP_KEY_ID || '').trim();
    const issuerId = String(process.env.APPLE_IAP_ISSUER_ID || '').trim();
    const privateKeyB64 = String(process.env.APPLE_IAP_PRIVATE_KEY_BASE64 || '').trim();
    return Boolean(keyId && issuerId && privateKeyB64.length > 10);
}

/** Decoded .p8 private key (PEM), or null if not configured / invalid base64. */
function resolveAppleIapPrivateKey() {
    const b64 = String(process.env.APPLE_IAP_PRIVATE_KEY_BASE64 || '').trim();
    if (!b64) return null;
    try {
        return Buffer.from(b64, 'base64').toString('utf8');
    } catch {
        return null;
    }
}

/** Local file paths (comma-separated in env) to Apple's Root CA .cer files, required by SignedDataVerifier. */
function resolveAppleRootCertPaths() {
    const raw = String(process.env.APPLE_IAP_ROOT_CERT_PATHS || '').trim();
    if (!raw) return [];
    return raw.split(',').map((p) => p.trim()).filter(Boolean);
}

function appleCommerceStatus() {
    return {
        bundleId: resolveAppleBundleId(),
        keyConfigured: hasAppleIapKey(),
        rootCertsConfigured: resolveAppleRootCertPaths().length > 0,
        creditProducts: listAppleCreditProducts(),
        businessSubscriptionProductId: APPLE_BUSINESS_SUBSCRIPTION_PRODUCT_ID,
    };
}

module.exports = {
    hasAppleIapKey,
    resolveAppleIapPrivateKey,
    resolveAppleRootCertPaths,
    appleCommerceStatus,
};
