import { resolveOccasionCategoryId } from '../components/Invitations/socialCard/socialCardOccasionMap';
import { resolveCardBackgroundUrlCandidates } from '../components/Invitations/socialCard/socialCardBackgrounds';
import { resolvePrivateCardBackgroundUrlCandidates } from '../components/Invitations/privateCard/privateCardBackgrounds';
import { sanitizeNextPath } from './safeInternalPath';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const PENDING_SHARE_TOKEN_KEY = 'dinebuddies_pending_private_invite_token';
const DEFAULT_SITE_ORIGIN = 'https://www.dinebuddies.com';
const DEFAULT_OG_IMAGE = `${DEFAULT_SITE_ORIGIN}/icon-light-512.png`;

/** Public marketing URL shared outside the app (not /invite/p/ tokens). */
export function buildAppSiteShareUrl() {
    if (typeof window !== 'undefined' && window.location?.origin) {
        const origin = window.location.origin.replace(/\/+$/, '');
        if (/dinebuddies\.com/i.test(origin)) return origin;
    }
    return DEFAULT_SITE_ORIGIN;
}

/** Host profile on DineBuddies — recipients join via the app, not a private invite token. */
export function buildHostProfileShareUrl(authorId) {
    const id = String(authorId || '').trim();
    if (!id) return buildAppSiteShareUrl();
    return `${buildAppSiteShareUrl()}/profile/${encodeURIComponent(id)}`;
}

/** External WhatsApp/SMS share link: host profile when known, else app home. */
export function resolveSocialInvitationExternalShareUrl(invitation) {
    const hostId =
        invitation?.authorId ||
        invitation?.author?.id ||
        invitation?.author?.uid ||
        null;
    return buildHostProfileShareUrl(hostId);
}

/**
 * Fast Firestore read for shareToken — avoids Cloud Function + rate limits (P0).
 * @param {string} invitationId
 * @returns {Promise<string|null>}
 */
export async function readPrivateInvitationShareToken(invitationId) {
    if (!invitationId) return null;
    try {
        const snap = await getDoc(doc(db, 'social_invitations', invitationId));
        if (!snap.exists()) return null;
        const data = snap.data() || {};
        if (data.status !== 'published' || !data.publishedAt) return null;
        const token = data.shareToken;
        return typeof token === 'string' && token.trim() ? token.trim() : null;
    } catch {
        return null;
    }
}
export function buildPrivateInvitationSharePath(token) {
    const t = String(token || '').trim();
    if (!t) return null;
    return `/invite/p/${encodeURIComponent(t)}`;
}

/** @param {string} token */
export function buildPrivateInvitationShareUrl(token) {
    const path = buildPrivateInvitationSharePath(token);
    if (!path || typeof window === 'undefined') return path || '';
    return `${window.location.origin}${path}`;
}

/** @param {string | undefined} dateRaw @param {string} [language] */
export function formatInvitationShareDate(dateRaw, language = 'en') {
    if (!dateRaw) return '';
    const parsed = new Date(dateRaw);
    if (Number.isNaN(parsed.getTime())) return String(dateRaw).trim();
    const locale = String(language || 'en').startsWith('ar') ? 'ar-u-nu-latn' : undefined;
    return parsed.toLocaleDateString(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

/** @param {string | undefined} timeRaw */
export function formatInvitationShareTime(timeRaw) {
    if (!timeRaw) return '';
    const raw = String(timeRaw).trim();
    if (raw.includes('T')) return raw.split('T')[1].substring(0, 5);
    return raw;
}

function absoluteShareAssetUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!trimmed || trimmed.startsWith('data:')) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (typeof window === 'undefined') return trimmed;
    return `${window.location.origin}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

/**
 * Best-effort OG image for client-side meta tags (matches server crawler logic).
 * @param {{ type?: string; occasionType?: string; cardBackgroundId?: string|null; customImage?: string|null; videoThumbnail?: string|null; image?: string|null }} invitation
 */
export function resolvePrivateInvitationShareOgImage(invitation) {
    if (!invitation) return DEFAULT_OG_IMAGE;

    const heroCandidates = [
        invitation.shareOgImageUrl,
        invitation.customImage,
        invitation.image,
        invitation.cardImageUrl,
        invitation.videoThumbnail,
    ];
    for (const candidate of heroCandidates) {
        const abs = absoluteShareAssetUrl(candidate);
        if (abs) return abs;
    }

    const bgId = invitation.cardBackgroundId;
    if (bgId) {
        const isDating =
            invitation.type === 'Private' ||
            String(invitation.occasionType || '').trim().toLowerCase() === 'dating';
        const bgCandidates = isDating
            ? resolvePrivateCardBackgroundUrlCandidates(bgId, invitation.personalInviteCategory || 'dating')
            : resolveCardBackgroundUrlCandidates(
                  resolveOccasionCategoryId(invitation.occasionType),
                  bgId
              );
        for (const candidate of bgCandidates) {
            const abs = absoluteShareAssetUrl(candidate);
            if (abs && !abs.startsWith('data:')) return abs;
        }
    }

    return DEFAULT_OG_IMAGE;
}

/**
 * @param {{ title?: string; description?: string; date?: string; time?: string; location?: string; inviterName?: string; type?: string; occasionType?: string; cardBackgroundId?: string|null; customImage?: string|null; videoThumbnail?: string|null; image?: string|null }} invitation
 * @param {string} shareUrl
 * @param {(key: string, opts?: Record<string, unknown>) => string} t
 * @param {{ language?: string }} [opts]
 */
export function buildPrivateInvitationShareMessage(invitation, shareUrl, t, opts = {}) {
    const language = opts.language || 'en';
    const title = String(invitation?.title || '').trim();
    const inviter = String(invitation?.inviterName || '').trim();
    const formattedDate = formatInvitationShareDate(invitation?.date, language);
    const formattedTime = formatInvitationShareTime(invitation?.time);
    const whenLine = [formattedDate, formattedTime].filter(Boolean).join(' · ');
    const location = String(invitation?.location || invitation?.venueName || '').trim();

    const greeting = inviter
        ? t('social_share_greeting_named', {
              defaultValue: '🎉 {{host}} invites you!',
              host: inviter,
          })
        : t('social_share_greeting', { defaultValue: "🎉 You're invited!" });

    const lines = [greeting, ''];

    if (title) {
        lines.push(
            t('social_share_line_event', {
                defaultValue: '📌 {{title}}',
                title,
            })
        );
    }
    if (whenLine) {
        lines.push(
            t('social_share_line_when', {
                defaultValue: '📅 {{when}}',
                when: whenLine,
            })
        );
    }
    if (location) {
        lines.push(
            t('social_share_line_where', {
                defaultValue: '📍 {{location}}',
                location,
            })
        );
    }

    lines.push('');
    const cta = inviter
        ? t('social_share_cta_app_named', {
              defaultValue: 'Join {{host}} on DineBuddies:',
              host: inviter,
          })
        : t('social_share_cta_app', {
              defaultValue: 'Join us on DineBuddies:',
          });
    lines.push(cta);
    if (shareUrl) {
        lines.push(shareUrl);
    }

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** @param {string} token */
export function stashPendingPrivateInviteToken(token) {
    if (!token || typeof sessionStorage === 'undefined') return;
    try {
        sessionStorage.setItem(PENDING_SHARE_TOKEN_KEY, token);
    } catch {
        /* ignore */
    }
}

export function consumePendingPrivateInviteToken() {
    if (typeof sessionStorage === 'undefined') return null;
    try {
        const token = sessionStorage.getItem(PENDING_SHARE_TOKEN_KEY);
        if (token) sessionStorage.removeItem(PENDING_SHARE_TOKEN_KEY);
        return token || null;
    } catch {
        return null;
    }
}

/** @param {string | null | undefined} returnPath */
export function buildLoginUrlWithNext(returnPath) {
    const path = sanitizeNextPath(returnPath);
    if (!path) return '/login';
    return `/login?next=${encodeURIComponent(path)}`;
}
