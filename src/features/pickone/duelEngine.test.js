import { describe, expect, it } from 'vitest';
import { createDuel, isFinished, pick, orderEntries, makeRng, runnerUp, slots } from './duelEngine';
import { LISTS } from './pickoneData';

const list = LISTS[0];

describe('pickoneData', () => {
  it('every list has 20 unique entries with en/ar names and 5–8 tier-1 names', () => {
    for (const l of LISTS) {
      expect(l.entries.length, l.id).toBe(20);
      const ids = new Set(l.entries.map((e) => e.id));
      expect(ids.size, l.id).toBe(20);
      for (const e of l.entries) {
        expect(e.name.en, e.id).toBeTruthy();
        expect(e.name.ar, e.id).toBeTruthy();
        expect(e.image, e.id).toMatch(/^\/pickone\/singers\/[a-z0-9-]+\.webp$/);
      }
      const tier1 = l.entries.filter((e) => e.tier === 1).length;
      expect(tier1, `${l.id} tier1`).toBeGreaterThanOrEqual(5);
      expect(tier1, `${l.id} tier1`).toBeLessThanOrEqual(8);
    }
  });
});

describe('duelEngine', () => {
  it('is reproducible from its seed', () => {
    const a = createDuel(list.entries, { seed: 42 });
    const b = createDuel(list.entries, { seed: 42 });
    expect(a.queue.map((e) => e.id)).toEqual(b.queue.map((e) => e.id));
    expect(a.champion.id).toBe(b.champion.id);
    expect(a.championSlot).toBe(b.championSlot);
  });

  it('pushes every tier-1 entry into the second half', () => {
    for (let seed = 1; seed < 50; seed += 1) {
      const ordered = orderEntries(list.entries, makeRng(seed));
      const half = Math.floor(ordered.length / 2);
      ordered.forEach((e, i) => {
        if (e.tier === 1) expect(i, `seed ${seed} ${e.id}`).toBeGreaterThanOrEqual(half);
      });
      expect(new Set(ordered.map((e) => e.id)).size).toBe(20);
    }
  });

  it('ends after exactly 19 picks with no duplicate challengers', () => {
    let s = createDuel(list.entries, { seed: 7 });
    const seen = new Set([s.champion.id, s.challenger.id]);
    let picks = 0;
    while (!isFinished(s)) {
      s = pick(s, picks % 3 === 0 ? 'challenger' : 'champion');
      picks += 1;
      if (s.challenger) {
        expect(seen.has(s.challenger.id)).toBe(false);
        seen.add(s.challenger.id);
      }
    }
    expect(picks).toBe(19);
    expect(s.history.length).toBe(19);
    expect(seen.size).toBe(20);
    expect(runnerUp(s)).toBe(s.history[18].loserId);
  });

  it('keeps the winner in its physical slot', () => {
    let s = createDuel(list.entries, { seed: 3 });
    const before = slots(s);
    // choose whichever is at the bottom
    s = pick(s, before.bottom.side);
    const after = slots(s);
    expect(after.bottom.entry.id).toBe(before.bottom.entry.id);
    expect(after.top.entry.id).not.toBe(before.top.entry.id);
  });

  it('ignores picks after the game is over and rejects bad sides', () => {
    let s = createDuel(list.entries, { seed: 9 });
    while (!isFinished(s)) s = pick(s, 'champion');
    expect(pick(s, 'champion')).toBe(s);
    expect(() => pick(createDuel(list.entries, { seed: 1 }), 'left')).toThrow();
  });
});
