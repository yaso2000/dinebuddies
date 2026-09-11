/**
 * TasteScope — resolve a titleId to its display strings (gendered Arabic form),
 * routed through i18n keys with the data file as the default. Shared by the
 * result screen, profile badge, and compatibility UI so nothing duplicates the
 * gender/locale logic. See TASTESCOPE_SPEC.md §3, §8.
 */
import { TITLES_BY_ID } from './tastescopeData';

/** 'male' | 'female' (from normalizeUserGender) → 'm' | 'f'; default masculine. */
export const genderKey = (gender) => (gender === 'female' ? 'f' : 'm');

/** Gendered display name, e.g. "المستكشفة" / "The Explorer". */
export function titleName(t, titleId, gender, isArabic) {
  const title = TITLES_BY_ID[titleId];
  if (!title) return '';
  const g = genderKey(gender);
  const fallback = isArabic ? title.ar[g] : title.en;
  return t(`tastescope.title.${titleId}.${g}`, fallback);
}

/** One-line description in the active language, gendered like the title name. */
export function titleDesc(t, titleId, gender, isArabic) {
  const title = TITLES_BY_ID[titleId];
  if (!title) return '';
  const g = genderKey(gender);
  const fallback = isArabic ? title.desc.ar : title.desc.en;
  return t(`tastescope.title.${titleId}.desc.${g}`, fallback);
}

/** Emoji + accent color for a title (both from the data file). */
export function titleVisuals(titleId) {
  const title = TITLES_BY_ID[titleId];
  return { emoji: title?.emoji || '🍽️', accent: title?.accent || 'var(--primary, #ef4444)' };
}
