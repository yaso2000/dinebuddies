const DEFAULT_SITE_ORIGIN = 'https://www.dinebuddies.com';
const DEFAULT_OG_IMAGE_PATH = '/icon-light-512.png';

const OCCASION_TYPE_TO_CATEGORY_ID = {
    Dating: 'dating',
    Birthday: 'birthday',
    Social: 'social',
    Work: 'work',
    Nightlife: 'nightlife',
    Dining: 'dining',
    'Café': 'cafe',
    Gaming: 'gaming',
    Family: 'family',
    Celebration: 'celebration',
    Cinema: 'cinema',
    Sports: 'sports',
    'Singing Party': 'concert',
    Concert: 'concert',
    BBQ: 'concert',
};

/** Definite link-preview / social crawlers (not in-app WebViews opened by humans). */
const SOCIAL_CRAWLER_BOT_RE =
    /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|PinterestBot|Googlebot(?:-Image)?/i;

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function resolveSiteOrigin(explicit) {
    const raw = String(explicit || process.env.SITE_ORIGIN || DEFAULT_SITE_ORIGIN).trim();
    return raw.replace(/\/+$/, '');
}

function absoluteAssetUrl(url, siteOrigin) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!trimmed || trimmed.startsWith('data:')) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    const origin = resolveSiteOrigin(siteOrigin);
    return `${origin}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

function resolveOccasionCategoryId(occasionType) {
    if (!occasionType || typeof occasionType !== 'string') return 'social';
    return OCCASION_TYPE_TO_CATEGORY_ID[occasionType.trim()] || 'social';
}

function resolvePersonalTemplateFileStem(bgId) {
    if (!bgId || typeof bgId !== 'string') return null;
    if (bgId.startsWith('dating-')) return bgId;
    if (bgId.startsWith('private-')) return `dating-${bgId.slice('private-'.length)}`;
    return bgId;
}

function resolvePersonalInviteBackgroundDir(inv) {
    const raw = String(inv?.personalInviteCategory || '').trim().toLowerCase();
    if (raw === 'friendship' || raw === 'icebreaker' || raw === 'dating') return raw;
    return 'dating';
}

function resolveTemplateBackgroundUrl(inv, siteOrigin) {
    const bgId = inv?.cardBackgroundId;
    if (!bgId || typeof bgId !== 'string') return null;
    const origin = resolveSiteOrigin(siteOrigin);
    const isPersonal =
        inv.type === 'Private' ||
        inv.type === 'Dating' ||
        String(inv.occasionType || '').trim().toLowerCase() === 'dating' ||
        String(inv.personalInviteCategory || '').length > 0;
    if (isPersonal) {
        const stem = resolvePersonalTemplateFileStem(bgId);
        if (!stem) return null;
        const dir = resolvePersonalInviteBackgroundDir(inv);
        return `${origin}/private-invitation-templates/backgrounds/${dir}/${encodeURIComponent(stem)}.webp`;
    }
    const categoryId = resolveOccasionCategoryId(inv.occasionType);
    return `${origin}/invitation-card-backgrounds/${categoryId}/${encoded}.webp`;
}

function resolveShareOgImageUrl(inv, siteOrigin) {
    const origin = resolveSiteOrigin(siteOrigin);
    // P1: full 9:16 card JPEG uploaded by host at share time (highest priority for OG)
    const candidates = [
        inv?.shareOgImageUrl,
        inv?.customImage,
        inv?.image,
        inv?.cardImageUrl,
        inv?.videoThumbnail,
        resolveTemplateBackgroundUrl(inv, origin),
    ];
    for (const candidate of candidates) {
        const abs = absoluteAssetUrl(candidate, origin);
        if (abs) return abs;
    }
    return `${origin}${DEFAULT_OG_IMAGE_PATH}`;
}

function formatOgDate(dateRaw) {
    if (!dateRaw) return '';
    const parsed = new Date(dateRaw);
    if (Number.isNaN(parsed.getTime())) return String(dateRaw).trim();
    return parsed.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

function formatOgTime(timeRaw) {
    if (!timeRaw) return '';
    const raw = String(timeRaw).trim();
    if (raw.includes('T')) return raw.split('T')[1].substring(0, 5);
    return raw;
}

function buildOgDescription(inv, inviterName) {
    const title = String(inv?.title || '').trim();
    const location = String(inv?.location || inv?.venueName || '').trim();
    const formattedDate = formatOgDate(inv?.date);
    const formattedTime = formatOgTime(inv?.time);
    const description = String(inv?.description || '').trim();
    const host = String(inviterName || inv?.author?.displayName || '').trim();

    const parts = [];
    if (host) parts.push(`${host} invited you`);
    if (title) parts.push(title);
    if (formattedDate || formattedTime) {
        parts.push([formattedDate, formattedTime].filter(Boolean).join(' · '));
    }
    if (location) parts.push(location);
    if (description) parts.push(description.slice(0, 180));
    parts.push('Open the link to view the invitation and respond on DineBuddies.');
    return parts.filter(Boolean).join('\n');
}

/**
 * @param {Record<string, unknown>} inv Firestore invitation doc
 * @param {string} token share token
 * @param {string} [inviterName]
 * @param {{ siteOrigin?: string }} [opts]
 */
function buildPrivateInvitationOgMeta(inv, token, inviterName = '', opts = {}) {
    const siteOrigin = resolveSiteOrigin(opts.siteOrigin);
    const safeToken = encodeURIComponent(String(token || '').trim());
    const pageUrl = `${siteOrigin}/invite/p/${safeToken}`;
    const titleText = String(inv?.title || '').trim() || 'Private Invitation';
    const ogTitle = `${titleText} · DineBuddies`;
    const ogDescription = buildOgDescription(inv, inviterName);
    const ogImage = resolveShareOgImageUrl(inv, siteOrigin);
    const shareOgAbs = inv?.shareOgImageUrl ? absoluteAssetUrl(inv.shareOgImageUrl, siteOrigin) : null;
    const usesShareCardJpeg = Boolean(shareOgAbs);

    return {
        title: ogTitle,
        description: ogDescription,
        image: ogImage,
        url: pageUrl,
        type: 'website',
        siteName: 'DineBuddies',
        ogImageWidth: usesShareCardJpeg ? 1080 : undefined,
        ogImageHeight: usesShareCardJpeg ? 1920 : undefined,
    };
}

function appendAppShellQuery(pageUrl) {
    try {
        const parsed = new URL(String(pageUrl || ''));
        parsed.searchParams.set('app', '1');
        return parsed.toString();
    } catch {
        const raw = String(pageUrl || '');
        return `${raw}${raw.includes('?') ? '&' : '?'}app=1`;
    }
}

/** Human opened the link inside WhatsApp / Instagram / Facebook / etc. in-app browser. */
function isInAppSocialBrowser(userAgent) {
    const ua = String(userAgent || '');
    const hasWebViewStack = /AppleWebKit/i.test(ua) || /Android/i.test(ua);
    if (!hasWebViewStack) return false;
    return /WhatsApp|Instagram|FBAN|FBAV|FB_IAB|Line\/|MicroMessenger|Messenger/i.test(ua);
}

function isSocialShareCrawler(userAgent) {
    const ua = String(userAgent || '');
    // In-app browsers include "WhatsApp" etc. but must receive the SPA, not OG HTML.
    if (isInAppSocialBrowser(ua)) return false;
    if (SOCIAL_CRAWLER_BOT_RE.test(ua)) return true;
    // WhatsApp link-preview fetcher uses a short UA without a mobile WebView stack.
    if (/WhatsApp/i.test(ua)) return true;
    return false;
}

function shouldForceAppShell(query) {
    if (!query || typeof query !== 'object') return false;
    const app = query.app ?? query.open;
    return app === '1' || app === 'true';
}

function renderPrivateInvitationOgHtml(meta) {
    const title = escapeHtml(meta.title);
    const description = escapeHtml(meta.description);
    const image = escapeHtml(meta.image);
    const url = escapeHtml(meta.url);
    const type = escapeHtml(meta.type || 'website');
    const siteName = escapeHtml(meta.siteName || 'DineBuddies');
    const appShellUrlJs = JSON.stringify(appendAppShellQuery(meta.url));
    // 9:16 card export dimensions (html2canvas share capture)
    const ogImageWidth = meta.ogImageWidth || 1080;
    const ogImageHeight = meta.ogImageHeight || 1920;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="title" content="${title}" />
  <meta name="description" content="${description}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:site_name" content="${siteName}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="${ogImageWidth}" />
  <meta property="og:image:height" content="${ogImageHeight}" />
  <meta property="og:image:alt" content="${title}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${url}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <script>
    (function () {
      if (typeof navigator === 'undefined') return;
      var ua = navigator.userAgent || '';
      var knownBot = new RegExp(${JSON.stringify(SOCIAL_CRAWLER_BOT_RE.source)}, 'i').test(ua);
      var inAppWebView = /WhatsApp|Instagram|FBAN|FBAV|FB_IAB|Line\\/|MicroMessenger|Messenger/i.test(ua)
        && (/AppleWebKit/i.test(ua) || /Android/i.test(ua));
      if (!knownBot && inAppWebView) {
        window.location.replace(${appShellUrlJs});
      }
    })();
  </script>
</head>
<body>
  <p>${description}</p>
  <p><a href="${url}">${title}</a></p>
</body>
</html>`;
}

function extractShareTokenFromPath(pathname) {
    const match = String(pathname || '').match(/\/invite\/p\/([^/?#]+)/i);
    if (!match) return null;
    try {
        return decodeURIComponent(match[1]);
    } catch {
        return match[1];
    }
}

module.exports = {
    buildPrivateInvitationOgMeta,
    renderPrivateInvitationOgHtml,
    isSocialShareCrawler,
    isInAppSocialBrowser,
    shouldForceAppShell,
    appendAppShellQuery,
    extractShareTokenFromPath,
    resolveSiteOrigin,
    resolveShareOgImageUrl,
};
