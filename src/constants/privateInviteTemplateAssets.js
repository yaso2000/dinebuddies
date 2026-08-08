/**
 * Maps private invite template ids → files under
 * `public/private-invitation-templates/{date|friendship|social}/`.
 */
export const PERSONAL_INVITE_CATEGORY_DIRS = {
    dating: 'date',
    friendship: 'friendship',
    social: 'social',
    icebreaker: 'social',
};

/** @param {string} category @param {string} fileName */
export function personalInviteTemplateAssetPath(category, fileName) {
    const dir = PERSONAL_INVITE_CATEGORY_DIRS[category] || category;
    return `private-invitation-templates/${dir}/${fileName}`;
}

function tpl(id, labelKey, category, fileName, extra = {}) {
    return {
        id,
        labelKey,
        category,
        assetPath: personalInviteTemplateAssetPath(category, fileName),
        ...extra,
    };
}

export const PRIVATE_INVITE_DATE_TEMPLATES = [
    tpl('private-luxury-floral', 'private_tpl_luxury_floral', 'dating', 'Luxury Floral Balcony Dinner.webp'),
    tpl('private-heart-roses', 'private_tpl_heart_roses', 'dating', 'Heart-Shaped Rose Arrangement.webp'),
    tpl('private-rose-pathway', 'private_tpl_rose_pathway', 'dating', 'Romantic Rose Pathway.webp'),
    tpl('private-candlelight-table', 'private_tpl_candlelight_table', 'dating', 'Candlelight Rose Table.webp'),
    tpl('private-golden-love-night', 'private_tpl_golden_love_night', 'dating', 'Golden Love Night.webp'),
    tpl('private-love-in-bloom', 'private_tpl_love_in_bloom', 'dating', 'Love in Bloom.webp'),
    tpl('private-neon-hearts-date', 'private_tpl_neon_hearts_date', 'dating', 'Neon Hearts Date.webp'),
    tpl('private-roses-candlelight', 'private_tpl_roses_candlelight', 'dating', 'Roses & Candlelight.webp'),
    tpl('private-sunset-romance', 'private_tpl_sunset_romance', 'dating', 'Sunset Romance.webp'),
    tpl('private-sweetheart-rooftop', 'private_tpl_sweetheart_rooftop', 'dating', 'Sweetheart Rooftop.webp'),
    tpl('private-valentines-evening', 'private_tpl_valentines_evening', 'dating', 'Valentine\u2019s Evening.webp'),
    tpl('private-velvet-lounge-evening', 'private_tpl_velvet_lounge_evening', 'dating', 'Velvet Lounge Evening.webp'),
    tpl('private-restaurant-chemistry', 'private_tpl_restaurant_chemistry', 'dating', 'Luxury Restaurant Chemistry.webp'),
    tpl('private-rooftop-dinner', 'private_tpl_rooftop_dinner', 'dating', 'Romantic Rooftop Dinner Invitation.webp'),
    tpl('private-sunset-beach', 'private_tpl_sunset_beach', 'dating', 'Sunset Beach Dinner Invitation.webp'),
    tpl('private-rainy-coffee', 'private_tpl_rainy_coffee', 'dating', 'Cozy Rainy Coffee Date.webp'),
    tpl('private-mystery-entrance', 'private_tpl_mystery_entrance', 'dating', 'Elegant Mystery Entrance.webp'),
    tpl('private-midnight-city-lights', 'private_tpl_midnight_city_lights', 'dating', 'Midnight City Lights.webp'),
    tpl('private-neon-coffee-date', 'private_tpl_neon_coffee_date', 'dating', 'Neon Coffee Date.webp'),
    tpl('private-candle-room', 'private_tpl_candle_room', 'dating', 'Romantic Candle Room.webp'),
    tpl('private-romantic-coffee-escape', 'private_tpl_romantic_coffee_escape', 'dating', 'Romantic Coffee Escape.webp'),
    tpl('private-secret-garden-date', 'private_tpl_secret_garden_date', 'dating', 'Secret Garden Date.webp'),
    tpl('private-sunset-walk-together', 'private_tpl_sunset_walk_together', 'dating', 'Sunset Walk Together.webp'),
    tpl('private-date-ai-cover', 'private_tpl_ai_cover', 'dating', 'gpt-image-2-1_1781363698304_84560878.webp'),
];

export const PRIVATE_INVITE_FRIENDSHIP_TEMPLATES = [
    tpl('private-friend-work-4', 'private_tpl_friend_work_4', 'friendship', 'work-4.webp'),
    tpl('private-friend-work-5', 'private_tpl_friend_work_5', 'friendship', 'work-5.webp'),
    tpl('private-friend-work-6', 'private_tpl_friend_work_6', 'friendship', 'work-6.webp'),
    tpl('private-friend-work-7', 'private_tpl_friend_work_7', 'friendship', 'work-7.webp'),
    tpl('private-friend-work-8', 'private_tpl_friend_work_8', 'friendship', 'work-8.webp'),
    tpl('private-friend-work-10', 'private_tpl_friend_work_10', 'friendship', 'work-10.webp'),
    tpl('private-friend-ai-cover', 'private_tpl_ai_cover', 'friendship', 'gpt-image-2-1_1781363698304_84560878.webp'),
];

export const PRIVATE_INVITE_SOCIAL_TEMPLATES = [
    tpl('private-social-1', 'private_tpl_social_1', 'social', 'social-1.webp'),
    tpl('private-social-2', 'private_tpl_social_2', 'social', 'social-2.webp'),
    tpl('private-social-3', 'private_tpl_social_3', 'social', 'social-3.webp'),
    tpl('private-social-4', 'private_tpl_social_4', 'social', 'social-4.webp'),
    tpl('private-social-5', 'private_tpl_social_5', 'social', 'social-5.webp'),
    tpl('private-social-6', 'private_tpl_social_6', 'social', 'social-6.webp'),
    tpl('private-social-7', 'private_tpl_social_7', 'social', 'social-7.webp'),
    tpl('private-social-9', 'private_tpl_social_9', 'social', 'social-9.webp'),
    tpl('private-social-10', 'private_tpl_social_10', 'social', 'social-10.webp'),
    tpl('private-social-cozy-coffee', 'private_tpl_rainy_coffee', 'social', 'Cozy Rainy Coffee Date.webp'),
    tpl('private-social-ai-cover', 'private_tpl_ai_cover', 'social', 'gpt-image-2-1_1781363698304_84560878.webp'),
];

/** @param {string} assetPath */
export function encodePersonalInviteAssetUrl(assetPath, publicAssetUrl) {
    const parts = String(assetPath || '')
        .replace(/^\/+/, '')
        .split('/')
        .filter(Boolean);
    return publicAssetUrl(parts.map((p) => encodeURIComponent(p)).join('/'));
}
