/** Base URL for shield PNGs in `public/gift-shields/`. */
export const GIFT_SHIELD_IMAGES_BASE = '/gift-shields';

/** Visual theme per shield tier — PNG art + SVG fallback colors. */
export const GIFT_SHIELD_VISUAL_THEMES = {
    bronze: {
        imageFile: 'Bronze.png',
        fillTop: '#e8a45c',
        fillMid: '#c87832',
        fillBottom: '#7a4518',
        rim: '#5c3210',
        highlight: 'rgba(255, 228, 180, 0.65)',
        shadow: 'rgba(60, 30, 8, 0.55)',
        ringTrack: 'rgba(255, 255, 255, 0.14)',
        ringProgress: '#f0a040',
        glow: 'rgba(232, 132, 48, 0.55)',
    },
    silver: {
        imageFile: 'Silver.png',
        fillTop: '#f0f3f8',
        fillMid: '#b8bec8',
        fillBottom: '#6e7682',
        rim: '#525964',
        highlight: 'rgba(255, 255, 255, 0.75)',
        shadow: 'rgba(30, 35, 45, 0.5)',
        ringTrack: 'rgba(255, 255, 255, 0.14)',
        ringProgress: '#d8dee8',
        glow: 'rgba(192, 200, 212, 0.45)',
    },
    gold: {
        imageFile: 'gold.png',
        fillTop: '#ffe566',
        fillMid: '#f0b429',
        fillBottom: '#a66f08',
        rim: '#7a5206',
        highlight: 'rgba(255, 248, 190, 0.7)',
        shadow: 'rgba(80, 50, 0, 0.45)',
        ringTrack: 'rgba(255, 255, 255, 0.14)',
        ringProgress: '#ffd54a',
        glow: 'rgba(255, 200, 40, 0.5)',
    },
    platinum: {
        imageFile: 'Platinum.png',
        fillTop: '#f5fbff',
        fillMid: '#c5d8e8',
        fillBottom: '#7a96ad',
        rim: '#5a7288',
        highlight: 'rgba(255, 255, 255, 0.8)',
        shadow: 'rgba(25, 45, 65, 0.45)',
        ringTrack: 'rgba(255, 255, 255, 0.14)',
        ringProgress: '#e8f4fc',
        glow: 'rgba(180, 210, 235, 0.5)',
    },
    diamond: {
        imageFile: 'Diamond.png',
        fillTop: '#e8fbff',
        fillMid: '#7dd3fc',
        fillBottom: '#0284c7',
        rim: '#0369a1',
        highlight: 'rgba(255, 255, 255, 0.85)',
        shadow: 'rgba(0, 50, 90, 0.45)',
        ringTrack: 'rgba(255, 255, 255, 0.14)',
        ringProgress: '#7dd3fc',
        glow: 'rgba(56, 189, 248, 0.55)',
    },
};

/** @param {string} tierId */
export function getGiftShieldVisualTheme(tierId) {
    return GIFT_SHIELD_VISUAL_THEMES[tierId] || GIFT_SHIELD_VISUAL_THEMES.bronze;
}

/** @param {{ imageFile?: string } | null | undefined} theme */
export function getGiftShieldImageSrc(theme) {
    if (!theme?.imageFile) return null;
    const segments = String(theme.imageFile).split('/').map((s) => encodeURIComponent(s));
    return `${GIFT_SHIELD_IMAGES_BASE}/${segments.join('/')}`;
}
