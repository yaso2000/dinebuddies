/**
 * TasteScope — computeCompatibility (pure). See TASTESCOPE_SPEC.md §5.
 *
 *   axisMatches = axes where both chose the same pole (0..10)
 *   base        = axisMatches / 10
 *   bonus       = +0.10 same title, +0.05 complementary pair
 *   percent     = clamp(round((base + bonus) * 100), 35, 98)   // horoscope bounds
 */
import { AXES, areComplementary } from './tastescopeData';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Pick a suggested invite from poles the two users share (spec §5 order).
 * @returns {'breakfast'|'lateDinner'|'groupTable'|'fineDining'|'cafe'|'dinnerForTwo'}
 */
function suggestedInvite(a, b) {
  const both = (axisId, pole) => a?.[axisId] === pole && b?.[axisId] === pole;
  if (both('rhythm', 'morning')) return 'breakfast';
  if (both('rhythm', 'night')) return 'lateDinner';
  if (both('social', 'group')) return 'groupTable';
  if (both('ritual', 'formal')) return 'fineDining';
  if (both('ritual', 'casual')) return 'cafe';
  return 'dinnerForTwo';
}

/**
 * @param {Record<string,string>} answersA
 * @param {Record<string,string>} answersB
 * @param {string} [titleA]
 * @param {string} [titleB]
 * @returns {{ percent, axisMatches, matchedAxes, suggestedInvite, sameTitle, complementary }}
 */
export function computeCompatibility(answersA, answersB, titleA, titleB) {
  const a = answersA && typeof answersA === 'object' ? answersA : {};
  const b = answersB && typeof answersB === 'object' ? answersB : {};

  const matchedAxes = AXES.filter((axis) => a[axis.id] != null && a[axis.id] === b[axis.id]).map((axis) => axis.id);
  const axisMatches = matchedAxes.length;
  const base = axisMatches / AXES.length;

  const sameTitle = Boolean(titleA && titleB && titleA === titleB);
  const complementary = areComplementary(titleA, titleB);
  const bonus = (sameTitle ? 0.1 : 0) + (complementary ? 0.05 : 0);

  const percent = clamp(Math.round((base + bonus) * 100), 35, 98);

  return {
    percent,
    axisMatches,
    matchedAxes,
    suggestedInvite: suggestedInvite(a, b),
    sameTitle,
    complementary,
  };
}

export default computeCompatibility;
