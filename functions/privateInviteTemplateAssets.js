/** Cloud Functions mirror of `src/constants/privateInviteTemplateAssets.js` asset paths. */
const PRIVATE_INVITE_TEMPLATE_ASSET_BY_ID = {
    'private-luxury-floral': 'private-invitation-templates/date/Luxury Floral Balcony Dinner.webp',
    'private-heart-roses': 'private-invitation-templates/date/Heart-Shaped Rose Arrangement.webp',
    'private-rose-pathway': 'private-invitation-templates/date/Romantic Rose Pathway.webp',
    'private-candlelight-table': 'private-invitation-templates/date/Candlelight Rose Table.webp',
    'private-golden-love-night': 'private-invitation-templates/date/Golden Love Night.webp',
    'private-love-in-bloom': 'private-invitation-templates/date/Love in Bloom.webp',
    'private-neon-hearts-date': 'private-invitation-templates/date/Neon Hearts Date.webp',
    'private-roses-candlelight': 'private-invitation-templates/date/Roses & Candlelight.webp',
    'private-sunset-romance': 'private-invitation-templates/date/Sunset Romance.webp',
    'private-sweetheart-rooftop': 'private-invitation-templates/date/Sweetheart Rooftop.webp',
    'private-valentines-evening': 'private-invitation-templates/date/Valentine\u2019s Evening.webp',
    'private-velvet-lounge-evening': 'private-invitation-templates/date/Velvet Lounge Evening.webp',
    'private-restaurant-chemistry': 'private-invitation-templates/date/Luxury Restaurant Chemistry.webp',
    'private-rooftop-dinner': 'private-invitation-templates/date/Romantic Rooftop Dinner Invitation.webp',
    'private-sunset-beach': 'private-invitation-templates/date/Sunset Beach Dinner Invitation.webp',
    'private-rainy-coffee': 'private-invitation-templates/date/Cozy Rainy Coffee Date.webp',
    'private-mystery-entrance': 'private-invitation-templates/date/Elegant Mystery Entrance.webp',
    'private-midnight-city-lights': 'private-invitation-templates/date/Midnight City Lights.webp',
    'private-neon-coffee-date': 'private-invitation-templates/date/Neon Coffee Date.webp',
    'private-candle-room': 'private-invitation-templates/date/Romantic Candle Room.webp',
    'private-romantic-coffee-escape': 'private-invitation-templates/date/Romantic Coffee Escape.webp',
    'private-secret-garden-date': 'private-invitation-templates/date/Secret Garden Date.webp',
    'private-sunset-walk-together': 'private-invitation-templates/date/Sunset Walk Together.webp',
    'private-date-ai-cover': 'private-invitation-templates/date/gpt-image-2-1_1781363698304_84560878.webp',
    'private-friend-work-4': 'private-invitation-templates/friendship/work-4.webp',
    'private-friend-work-5': 'private-invitation-templates/friendship/work-5.webp',
    'private-friend-work-6': 'private-invitation-templates/friendship/work-6.webp',
    'private-friend-work-7': 'private-invitation-templates/friendship/work-7.webp',
    'private-friend-work-8': 'private-invitation-templates/friendship/work-8.webp',
    'private-friend-work-10': 'private-invitation-templates/friendship/work-10.webp',
    'private-friend-ai-cover': 'private-invitation-templates/friendship/gpt-image-2-1_1781363698304_84560878.webp',
    'private-social-1': 'private-invitation-templates/social/social-1.webp',
    'private-social-2': 'private-invitation-templates/social/social-2.webp',
    'private-social-3': 'private-invitation-templates/social/social-3.webp',
    'private-social-4': 'private-invitation-templates/social/social-4.webp',
    'private-social-5': 'private-invitation-templates/social/social-5.webp',
    'private-social-6': 'private-invitation-templates/social/social-6.webp',
    'private-social-7': 'private-invitation-templates/social/social-7.webp',
    'private-social-9': 'private-invitation-templates/social/social-9.webp',
    'private-social-10': 'private-invitation-templates/social/social-10.webp',
    'private-social-cozy-coffee': 'private-invitation-templates/social/Cozy Rainy Coffee Date.webp',
    'private-social-ai-cover': 'private-invitation-templates/social/gpt-image-2-1_1781363698304_84560878.webp',
};

const LEGACY_PERSONAL_BACKGROUND_DIRS = {
    dating: 'dating',
    friendship: 'friendship',
    social: 'icebreaker',
    icebreaker: 'icebreaker',
};

function encodePublicAssetPath(relPath) {
    return String(relPath || '')
        .replace(/^\/+/, '')
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/');
}

function resolveLegacyPersonalTemplateFileStem(bgId) {
    if (!bgId || typeof bgId !== 'string') return null;
    if (bgId.startsWith('private-friend-')) return `friendship-${bgId.slice('private-friend-'.length)}`;
    if (bgId.startsWith('private-social-')) return `social-${bgId.slice('private-social-'.length)}`;
    if (bgId.startsWith('dating-')) return bgId;
    if (bgId.startsWith('private-')) return `dating-${bgId.slice('private-'.length)}`;
    return bgId;
}

function resolvePersonalInviteBackgroundDir(inv) {
    const raw = String(inv?.personalInviteCategory || '').trim().toLowerCase();
    if (raw === 'friendship' || raw === 'social' || raw === 'icebreaker' || raw === 'dating') {
        return LEGACY_PERSONAL_BACKGROUND_DIRS[raw] || LEGACY_PERSONAL_BACKGROUND_DIRS.dating;
    }
    return LEGACY_PERSONAL_BACKGROUND_DIRS.dating;
}

function resolvePersonalTemplateAssetPath(bgId) {
    return PRIVATE_INVITE_TEMPLATE_ASSET_BY_ID[bgId] || null;
}

module.exports = {
    PRIVATE_INVITE_TEMPLATE_ASSET_BY_ID,
    encodePublicAssetPath,
    resolveLegacyPersonalTemplateFileStem,
    resolvePersonalInviteBackgroundDir,
    resolvePersonalTemplateAssetPath,
};
