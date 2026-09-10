/**
 * Shared look for special-offer banners: background-colour presets + a helper
 * that turns an offer into a banner background (image cover, else the gradient).
 */

export const OFFER_BG_PRESETS = [
  { id: 'purple', css: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)' },
  { id: 'sunset', css: 'linear-gradient(135deg, #ff6a3d 0%, #ff2e63 100%)' },
  { id: 'ocean', css: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)' },
  { id: 'forest', css: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { id: 'gold', css: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)' },
  { id: 'night', css: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
];

export const DEFAULT_OFFER_BG = OFFER_BG_PRESETS[0].css;

/**
 * Inline style for an offer banner. With an image, cover it and darken for text;
 * otherwise use the chosen gradient (or the default).
 * @param {{ imageUrl?: string|null, bgColor?: string|null }} offer
 */
export function offerBannerStyle(offer) {
  const bg = offer?.bgColor || DEFAULT_OFFER_BG;
  if (offer?.imageUrl) {
    return {
      backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.6) 100%), url("${offer.imageUrl}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  return { background: bg };
}
