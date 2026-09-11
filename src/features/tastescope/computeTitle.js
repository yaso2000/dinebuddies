/**
 * TasteScope — computeTitle (pure). See TASTESCOPE_SPEC.md §4.
 *
 *   score(title)  = number of the title's signature poles present in the answers
 *   winner        = highest score, tie-broken by:
 *     1) higher weighted score (adventure/social/sharing weigh 2, others 1)
 *     2) fewer signature poles (a tighter archetype wins)
 *     3) fixed TITLES order (deterministic)
 */
import { TITLES, TITLES_BY_ID, POLE_TO_AXIS, axisWeight } from './tastescopeData';

/**
 * @param {Record<string,string>} answers  { [axisId]: poleId } — up to 10 keys.
 * @returns {{ titleId: string, runnerUpId: string, scores: Record<string,number> }}
 */
export function computeTitle(answers) {
  const chosen = answers && typeof answers === 'object' ? answers : {};
  // Set of poles the user chose (answer values).
  const chosenPoles = new Set(Object.values(chosen).filter(Boolean));

  const ranked = TITLES.map((title, index) => {
    // Poles of this title's signature that the user actually chose.
    const matchedPoles = title.signature.filter((pole) => chosenPoles.has(pole));
    const score = matchedPoles.length;
    // Weighted score: sum of the weight of each matched pole's axis.
    const weighted = matchedPoles.reduce((sum, pole) => sum + axisWeight(POLE_TO_AXIS[pole]), 0);
    return { id: title.id, score, weighted, size: title.signature.length, index };
  }).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score; // 1) more matches
    if (b.weighted !== a.weighted) return b.weighted - a.weighted; // tie-break 1: weighted
    if (a.size !== b.size) return a.size - b.size; // tie-break 2: tighter archetype
    return a.index - b.index; // tie-break 3: fixed order
  });

  const scores = ranked.reduce((m, r) => ((m[r.id] = r.score), m), {});
  return {
    titleId: ranked[0].id,
    runnerUpId: ranked[1] ? ranked[1].id : ranked[0].id,
    scores,
  };
}

/**
 * Explain a title from the answers: which of the title's signature poles the
 * user actually chose (`matched`) and which they didn't (`missing`). Pure — used
 * by the result screen to show *why* this title was assigned (the link between
 * the picks and the name). See TASTESCOPE_SPEC.md §3–§4.
 *
 * @param {Record<string,string>} answers  { [axisId]: poleId }
 * @param {string} titleId
 * @returns {{ matched: string[], missing: string[] }}  pole ids
 */
export function explainTitle(answers, titleId) {
  const title = TITLES_BY_ID[titleId];
  if (!title) return { matched: [], missing: [] };
  const chosen = answers && typeof answers === 'object' ? answers : {};
  const chosenPoles = new Set(Object.values(chosen).filter(Boolean));
  const matched = title.signature.filter((pole) => chosenPoles.has(pole));
  const missing = title.signature.filter((pole) => !chosenPoles.has(pole));
  return { matched, missing };
}

export default computeTitle;
