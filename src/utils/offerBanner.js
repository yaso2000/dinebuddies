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

/** Wide banner aspect ratio used for the crop tool and full-width display. */
export const OFFER_BANNER_ASPECT = 16 / 7;

/**
 * Inline style for an offer banner. With an image, cover it and darken for text;
 * otherwise use the chosen gradient (or the default).
 * @param {{ imageUrl?: string|null, bgColor?: string|null }} offer
 */
export function offerBannerStyle(offer) {
  const bg = offer?.bgColor || DEFAULT_OFFER_BG;
  if (offer?.imageUrl) {
    const zoom = Number(offer.imageZoom) > 1 ? Number(offer.imageZoom) : 1;
    const px = Number.isFinite(Number(offer.imagePosX)) ? Number(offer.imagePosX) : 50;
    const py = Number.isFinite(Number(offer.imagePosY)) ? Number(offer.imagePosY) : 50;
    return {
      backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.6) 100%), url("${offer.imageUrl}")`,
      backgroundSize: `100% 100%, ${zoom > 1 ? `${zoom * 100}%` : 'cover'}`,
      backgroundPosition: `center, ${px}% ${py}%`,
      backgroundRepeat: 'no-repeat, no-repeat',
    };
  }
  return { background: bg };
}
