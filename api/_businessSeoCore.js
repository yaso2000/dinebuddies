/**
 * Server-side SEO HTML for published business profiles (/business/:id).
 * Used by crawlers (Googlebot, social preview bots) before the SPA loads.
 */
import { ensureFirebaseAdmin } from './_firebaseAdmin.js';

const DEFAULT_SITE_ORIGIN = 'https://www.dinebuddies.com';
const DEFAULT_OG_IMAGE_PATH = '/icon-light-512.png';

const SEARCH_AND_PREVIEW_BOT_RE =
    /Googlebot|Google-InspectionTool|GoogleOther|bingbot|Baiduspider|YandexBot|DuckDuckBot|Slurp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|PinterestBot/i;

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function resolveSiteOrigin(explicit) {
    const raw = String(explicit || process.env.SITE_ORIGIN || DEFAULT_SITE_ORIGIN).trim();
    return raw.replace(/\/+$/, '');
}

export function absoluteAssetUrl(url, siteOrigin) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!trimmed || trimmed.startsWith('data:')) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    const origin = resolveSiteOrigin(siteOrigin);
    return `${origin}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

function isInAppSocialBrowser(userAgent) {
    const ua = String(userAgent || '');
    const hasWebViewStack = /AppleWebKit/i.test(ua) || /Android/i.test(ua);
    if (!hasWebViewStack) return false;
    return /WhatsApp|Instagram|FBAN|FBAV|FB_IAB|Line\/|MicroMessenger|Messenger/i.test(ua);
}

export function isBusinessSeoCrawler(userAgent) {
    const ua = String(userAgent || '');
    if (isInAppSocialBrowser(ua)) return false;
    return SEARCH_AND_PREVIEW_BOT_RE.test(ua);
}

export function shouldForceAppShell(query) {
    if (!query || typeof query !== 'object') return false;
    const app = query.app ?? query.open;
    return app === '1' || app === 'true';
}

function schemaTypeForBusinessType(raw) {
    const t = String(raw || 'Restaurant').trim();
    switch (t) {
        case 'Cafe':
            return 'CafeOrCoffeeShop';
        case 'Bar':
            return 'BarOrPub';
        case 'Fast Food':
            return 'FastFoodRestaurant';
        case 'Restaurant':
            return 'Restaurant';
        default:
            return 'LocalBusiness';
    }
}

function mapPublicProfileDoc(id, data) {
    const info = data.businessPublic && typeof data.businessPublic === 'object' ? data.businessPublic : {};
    const displayName = String(data.displayName || info.businessName || id).trim() || id;
    return {
        id,
        name: displayName,
        businessType: info.businessType || 'Restaurant',
        description: info.description || '',
        address: info.address || '',
        city: info.city || '',
        country: info.country || '',
        countryCode: info.countryCode || '',
        phone: info.phone || '',
        website: info.website || '',
        coverImage: info.coverImage || data.avatarUrl || '',
        lat: info.lat ?? null,
        lng: info.lng ?? null,
        updatedAt: data.updatedAt || null,
    };
}

function mapRestaurantDoc(id, data) {
    const bi = data.businessInfo && typeof data.businessInfo === 'object' ? data.businessInfo : {};
    const displayName =
        String(data.display_name || data.name || bi.businessName || id).trim() || id;
    const coords = data.coordinates && typeof data.coordinates === 'object' ? data.coordinates : {};
    return {
        id,
        name: displayName,
        businessType: bi.businessType || 'Restaurant',
        description: bi.description || '',
        address: bi.address || data.address || '',
        city: bi.city || '',
        country: bi.country || '',
        countryCode: data.countryCode || bi.countryCode || '',
        phone: bi.phone || data.phone || '',
        website: bi.website || data.website || '',
        coverImage: bi.coverImage || data.photo_url || '',
        lat: bi.lat ?? coords.lat ?? null,
        lng: bi.lng ?? coords.lng ?? null,
        updatedAt: data.updated_at || data.updatedAt || null,
    };
}

function mapUserDoc(id, data) {
    const bi = data.businessInfo && typeof data.businessInfo === 'object' ? data.businessInfo : {};
    const displayName =
        String(data.display_name || data.displayName || bi.businessName || id).trim() || id;
    return {
        id,
        name: displayName,
        businessType: bi.businessType || 'Restaurant',
        description: bi.description || bi.tagline || '',
        address: bi.address || '',
        city: bi.city || '',
        country: bi.country || '',
        countryCode: data.countryCode || bi.countryCode || '',
        phone: bi.phone || data.phone || '',
        website: bi.website || '',
        coverImage: bi.coverImage || data.photo_url || data.cover_photo || '',
        lat: bi.lat ?? data.coordinates?.lat ?? null,
        lng: bi.lng ?? data.coordinates?.lng ?? null,
        updatedAt: data.updated_at || data.updatedAt || null,
    };
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} businessId
 */
export async function loadPublishedBusinessForSeo(db, businessId) {
    ensureFirebaseAdmin();
    const id = String(businessId || '').trim();
    if (!id || id.length > 128) return null;

    const profileSnap = await db.collection('public_profiles').doc(id).get();
    if (profileSnap.exists) {
        const p = profileSnap.data() || {};
        if (p.profileType === 'business') {
            const info = p.businessPublic || {};
            if (info.isPublished === true) {
                return mapPublicProfileDoc(id, p);
            }
            return null;
        }
    }

    const restSnap = await db.collection('restaurants').doc(id).get();
    if (restSnap.exists) {
        const r = restSnap.data() || {};
        const bi = r.businessInfo || {};
        if (r.emailVerified !== false && bi.isPublished !== false) {
            return mapRestaurantDoc(id, r);
        }
    }

    const userSnap = await db.collection('users').doc(id).get();
    if (userSnap.exists) {
        const u = userSnap.data() || {};
        const role = String(u.role || '').toLowerCase();
        if (role === 'business' || role === 'partner' || u.isBusiness === true) {
            const bi = u.businessInfo || {};
            if (bi.isPublished === true) {
                return mapUserDoc(id, u);
            }
        }
    }

    return null;
}

/**
 * @param {ReturnType<typeof mapPublicProfileDoc>} business
 * @param {string} siteOrigin
 */
export function buildBusinessSeoMeta(business, siteOrigin) {
    const origin = resolveSiteOrigin(siteOrigin);
    const pageUrl = `${origin}/business/${business.id}`;
    const cityPart = business.city ? ` in ${business.city}` : '';
    const title = `${business.name}${cityPart} - ${business.businessType || 'Venue'} | DineBuddies`;
    const description =
        String(business.description || '').trim() ||
        `Discover ${business.name}${business.city ? ` in ${business.city}` : ''}. View details, photos, and reviews on DineBuddies.`;
    const image =
        absoluteAssetUrl(business.coverImage, origin) ||
        `${origin}${DEFAULT_OG_IMAGE_PATH}`;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': schemaTypeForBusinessType(business.businessType),
        name: business.name,
        image: [image].filter(Boolean),
        url: pageUrl,
        telephone: business.phone || undefined,
        description,
        address: {
            '@type': 'PostalAddress',
            streetAddress: business.address || undefined,
            addressLocality: business.city || undefined,
            addressCountry: business.countryCode || business.country || undefined,
        },
    };

    if (business.lat != null && business.lng != null) {
        jsonLd.geo = {
            '@type': 'GeoCoordinates',
            latitude: business.lat,
            longitude: business.lng,
        };
    }

    if (business.website) {
        jsonLd.sameAs = [business.website];
    }

    Object.keys(jsonLd).forEach((key) => {
        if (jsonLd[key] === undefined) delete jsonLd[key];
    });
    if (jsonLd.address) {
        Object.keys(jsonLd.address).forEach((key) => {
            if (jsonLd.address[key] === undefined) delete jsonLd.address[key];
        });
    }

    return { title, description, image, url: pageUrl, jsonLd, business };
}

export function renderBusinessSeoHtml(meta) {
    const title = escapeHtml(meta.title);
    const description = escapeHtml(meta.description);
    const image = escapeHtml(meta.image);
    const url = escapeHtml(meta.url);
    const jsonLd = JSON.stringify(meta.jsonLd);
    const businessName = escapeHtml(meta.business?.name || meta.title);
    const addressLine = escapeHtml(
        [meta.business?.address, meta.business?.city, meta.business?.country].filter(Boolean).join(', '),
    );
    const bodyDescription = escapeHtml(meta.business?.description || meta.description);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="title" content="${title}" />
  <meta name="description" content="${description}" />
  <meta name="robots" content="index,follow" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="DineBuddies" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <script type="application/ld+json">${jsonLd}</script>
</head>
<body>
  <main>
    <h1>${businessName}</h1>
    ${addressLine ? `<p>${addressLine}</p>` : ''}
    <p>${bodyDescription}</p>
    <p><a href="${url}">View on DineBuddies</a></p>
  </main>
</body>
</html>`;
}
