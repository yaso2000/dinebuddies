/**
 * Pick One — pure duel engine (no React, no DOM). See PICKONE_SPEC.md §1.
 *
 *   createDuel(entries, { seed }) → state
 *   pick(state, 'champion' | 'challenger') → state
 *   isFinished(state) → boolean
 *
 * State shape:
 *   { seed, queue: Entry[], champion: Entry, challenger: Entry, championSlot: 'top'|'bottom',
 *     round: number (1-based), total: number, history: [{ round, winnerId, loserId }] }
 */

/** mulberry32 — small seeded PRNG so a session is reproducible from its seed. */
export function makeRng(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(items, rng) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Order entries for a session: shuffle, then push every tier-1 entry into the
 * second half (shuffled among themselves) so the biggest names arrive late and
 * the champion is not effectively decided in the first rounds.
 */
export function orderEntries(entries, rng) {
  const shuffled = shuffle(entries, rng);
  const strong = shuffle(shuffled.filter((e) => e.tier === 1), rng);
  const rest = shuffled.filter((e) => e.tier !== 1);
  if (strong.length === 0 || rest.length === 0) return shuffled;

  const n = shuffled.length;
  const half = Math.floor(n / 2);
  // Second-half positions available for the strong entries.
  const positions = shuffle(Array.from({ length: n - half }, (_, i) => half + i), rng).slice(0, strong.length).sort((a, b) => a - b);
  const out = new Array(n).fill(null);
  positions.forEach((pos, i) => { out[pos] = strong[i]; });
  let r = 0;
  for (let i = 0; i < n; i += 1) if (out[i] === null) out[i] = rest[r++];
  return out;
}

export function createDuel(entries, { seed } = {}) {
  if (!Array.isArray(entries) || entries.length < 2) throw new Error('createDuel: need at least 2 entries');
  const s = Number.isFinite(Number(seed)) ? Number(seed) >>> 0 : (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  const rng = makeRng(s);
  const ordered = orderEntries(entries, rng);
  const [champion, challenger, ...queue] = ordered;
  return {
    seed: s,
    queue,
    champion,
    challenger,
    championSlot: rng() < 0.5 ? 'top' : 'bottom',
    round: 1,
    total: entries.length - 1,
    history: [],
  };
}

export function isFinished(state) {
  return Boolean(state) && state.history.length >= state.total;
}

/**
 * Apply a pick. The winner keeps its physical slot; the next queue item takes
 * the loser's slot. Returns a new state (input untouched).
 */
export function pick(state, who) {
  if (isFinished(state)) return state;
  if (who !== 'champion' && who !== 'challenger') throw new Error(`pick: unknown side "${who}"`);
  const winner = who === 'champion' ? state.champion : state.challenger;
  const loser = who === 'champion' ? state.challenger : state.champion;
  const winnerSlot = who === 'champion' ? state.championSlot : (state.championSlot === 'top' ? 'bottom' : 'top');
  const [next, ...queue] = state.queue;
  const history = state.history.concat({ round: state.round, winnerId: winner.id, loserId: loser.id });
  return {
    ...state,
    queue,
    champion: winner,
    challenger: next || null,
    championSlot: winnerSlot,
    round: Math.min(state.round + 1, state.total),
    history,
  };
}

/** Convenience for the result screen. */
export function runnerUp(state) {
  if (!isFinished(state) || state.history.length === 0) return null;
  return state.history[state.history.length - 1].loserId;
}

/** Entries for the two slots, so the UI never has to reason about sides. */
export function slots(state) {
  const top = state.championSlot === 'top' ? state.champion : state.challenger;
  const bottom = state.championSlot === 'top' ? state.challenger : state.champion;
  return {
    top: { entry: top, side: state.championSlot === 'top' ? 'champion' : 'challenger' },
    bottom: { entry: bottom, side: state.championSlot === 'top' ? 'challenger' : 'champion' },
  };
}
