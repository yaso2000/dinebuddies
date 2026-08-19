/**
 * OG preview + SPA shell for /story/:id (Vercel) — same crawler/in-app-webview split as
 * privateInvitationShareOgCore.js, reused directly rather than duplicated.
 */
const {
    isSocialShareCrawler,
    isInAppSocialBrowser,
    shouldForceAppShell,
    appendAppShellQuery,
    resolveSiteOrigin,
} = require('./privateInvitationShareOgCore.js');

const DEFAULT_OG_IMAGE_PATH = '/icon-light-512.png';
const SOCIAL_CRAWLER_BOT_RE =
    /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|PinterestBot|Googlebot(?:-Image)?/i;

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function absoluteAssetUrl(url, siteOrigin) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    const origin = resolveSiteOrigin(siteOrigin);
    return `${origin}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

/** Video stories: the poster frame is the only real image available (the video body itself
 * isn't a valid og:image). Image/text stories: the story's own media/background. */
function resolveStoryOgImageUrl(story, siteOrigin) {
    const origin = resolveSiteOrigin(siteOrigin);
    const candidates = [
        story?.type === 'video' ? story?.posterUrl : story?.url,
        story?.posterUrl,
        story?.url,
    ];
    for (const candidate of candidates) {
        const abs = absoluteAssetUrl(candidate, origin);
        if (abs) return abs;
    }
    return `${origin}${DEFAULT_OG_IMAGE_PATH}`;
}

function isStoryExpired(story) {
    const expiresAt = story?.expiresAt;
    if (!expiresAt) return false;
    const ms = typeof expiresAt.toDate === 'function' ?
    expiresAt.toDate().getTime() :
    typeof expiresAt._seconds === 'number' ?
    expiresAt._seconds * 1000 :
    new Date(expiresAt).getTime();
    if (Number.isNaN(ms)) return false;
    return ms <= Date.now();
}

/**
 * @param {Record<string, unknown>} story Firestore story doc
 * @param {string} storyId
 * @param {{ siteOrigin?: string }} [opts]
 */
function buildStoryOgMeta(story, storyId, opts = {}) {
    const siteOrigin = resolveSiteOrigin(opts.siteOrigin);
    const pageUrl = `${siteOrigin}/story/${encodeURIComponent(String(storyId || ''))}`;
    const ownerName = String(story?.userName || 'Someone').trim() || 'Someone';
    const title = `${ownerName}'s Story · DineBuddies`;
    const caption = String(story?.text || '').trim();
    const description = caption ?
    `${ownerName}: "${caption.slice(0, 160)}"` :
    `${ownerName} posted a story on DineBuddies — open the link to watch before it disappears.`;
    const image = resolveStoryOgImageUrl(story, siteOrigin);

    return {
        title,
        description,
        image,
        url: pageUrl,
        type: 'website',
        siteName: 'DineBuddies',
        ogImageWidth: undefined,
        ogImageHeight: undefined,
    };
}

function renderStoryOgHtml(meta) {
    const title = escapeHtml(meta.title);
    const description = escapeHtml(meta.description);
    const image = escapeHtml(meta.image);
    const url = escapeHtml(meta.url);
    const type = escapeHtml(meta.type || 'website');
    const siteName = escapeHtml(meta.siteName || 'DineBuddies');
    const appShellUrlJs = JSON.stringify(appendAppShellQuery(meta.url));

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

module.exports = {
    buildStoryOgMeta,
    renderStoryOgHtml,
    isStoryExpired,
    isSocialShareCrawler,
    isInAppSocialBrowser,
    shouldForceAppShell,
    resolveSiteOrigin,
};
