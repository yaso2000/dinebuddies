import {
  FaThumbsUp,
  FaCoffee,
  FaBirthdayCake,
  FaHeart,
  FaWineGlass,
  FaGift,
  FaCrown,
  FaGem,
} from 'react-icons/fa';
import { GiDonut } from 'react-icons/gi';

/** Base URL for gift images in `public/profile-gift-images/`. */
export const PROFILE_GIFT_IMAGES_BASE = '/profile-gift-images';

/** Uniform display box for gift images (grid + confirm). */
export const PROFILE_GIFT_IMAGE_BOX = {
  card: { width: 36, height: 36 },
  confirm: { width: 220, height: 220 },
};

/**
 * Catalog of profile gifts.
 * `imageFile` — file in public/profile-gift-images/
 */
export const PROFILE_GIFTS = [
  {
    id: 'like',
    imageFile: 'like.png',
    icon: FaThumbsUp,
    accent: '#60a5fa',
    credits: 10,
    nameKey: 'gift_like_name',
    descKey: 'gift_like_desc',
    previewDescKey: 'gift_like_preview',
    defaultName: 'Like',
    defaultDesc: 'Show someone you like them',
    defaultPreview: 'A simple like to brighten their day 👍',
  },
  {
    id: 'coffee',
    imageFile: 'coffee1.png',
    icon: FaCoffee,
    accent: '#fbbf24',
    credits: 25,
    nameKey: 'gift_coffee_name',
    descKey: 'gift_coffee_desc',
    previewDescKey: 'gift_coffee_preview',
    defaultName: 'Coffee',
    defaultDesc: 'A warm coffee to start a great conversation',
    defaultPreview: 'A warm coffee to start a great conversation ☕',
  },
  {
    id: 'cake',
    imageFile: 'cake1.png',
    icon: FaBirthdayCake,
    accent: '#f472b6',
    credits: 50,
    nameKey: 'gift_cake_name',
    descKey: 'gift_cake_desc',
    previewDescKey: 'gift_cake_preview',
    defaultName: 'Cake',
    defaultDesc: 'Sweet moments deserve sweet treats',
    defaultPreview: 'Sweet moments deserve sweet treats 🍰',
  },
  {
    id: 'rose',
    imageFile: 'rose.png',
    icon: FaHeart,
    accent: '#ef4444',
    credits: 75,
    nameKey: 'gift_rose_name',
    descKey: 'gift_rose_desc',
    previewDescKey: 'gift_rose_preview',
    defaultName: 'Rose',
    defaultDesc: 'A classic romantic gesture',
    defaultPreview: 'A classic romantic gesture 🌹',
  },
  {
    id: 'donut',
    imageFile: 'donut.png',
    icon: GiDonut,
    accent: '#f9a8d4',
    credits: 120,
    nameKey: 'gift_donut_name',
    descKey: 'gift_donut_desc',
    previewDescKey: 'gift_donut_preview',
    defaultName: 'Donut',
    defaultDesc: 'A sweet treat to share the joy',
    defaultPreview: 'A sweet donut to share the joy 🍩',
  },
  {
    id: 'wine',
    imageFile: 'wine glass.png',
    icon: FaWineGlass,
    accent: '#c084fc',
    credits: 180,
    nameKey: 'gift_wine_name',
    descKey: 'gift_wine_desc',
    previewDescKey: 'gift_wine_preview',
    defaultName: 'Fine Glass',
    defaultDesc: 'Cheers to a special connection',
    defaultPreview: 'Cheers to a special connection 🍷',
  },
  {
    id: 'gift_box',
    imageFile: 'gift.png',
    icon: FaGift,
    accent: '#a78bfa',
    credits: 300,
    nameKey: 'gift_box_name',
    descKey: 'gift_box_desc',
    previewDescKey: 'gift_box_preview',
    defaultName: 'Gift Box',
    defaultDesc: 'A thoughtful surprise',
    defaultPreview: 'A thoughtful surprise 🎁',
  },
  {
    id: 'crown',
    imageFile: 'crown.png',
    icon: FaCrown,
    accent: '#facc15',
    credits: 600,
    nameKey: 'gift_crown_name',
    descKey: 'gift_crown_desc',
    previewDescKey: 'gift_crown_preview',
    defaultName: 'Golden Crown',
    defaultDesc: 'Make them feel like royalty',
    defaultPreview: 'Make them feel like royalty 👑',
  },
  {
    id: 'diamond',
    imageFile: 'diamond.png',
    icon: FaGem,
    accent: '#38bdf8',
    credits: 1200,
    nameKey: 'gift_diamond_name',
    descKey: 'gift_diamond_desc',
    previewDescKey: 'gift_diamond_preview',
    defaultName: 'Diamond',
    defaultDesc: 'The ultimate gesture of appreciation',
    defaultPreview: 'The ultimate gesture of appreciation 💎',
  },
];

/** @param {{ imageFile?: string }} gift */
export function getProfileGiftImageSrc(gift) {
  if (!gift?.imageFile) return null;
  const segments = String(gift.imageFile).split('/').map((s) => encodeURIComponent(s));
  return `${PROFILE_GIFT_IMAGES_BASE}/${segments.join('/')}`;
}

export function getProfileGiftById(id) {
  if (id === 'pizza') return PROFILE_GIFTS.find((g) => g.id === 'donut') || null;
  return PROFILE_GIFTS.find((g) => g.id === id) || null;
}
