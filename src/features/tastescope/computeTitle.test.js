import { describe, expect, it } from 'vitest';
import { computeTitle } from './computeTitle';
import { TITLES, TITLE_IDS, POLE_TO_AXIS, AXES } from './tastescopeData';

/** Build an answers map from a set of poles: { [axisOf(pole)]: pole }. */
const answersFromPoles = (poles) =>
  poles.reduce((m, pole) => ((m[POLE_TO_AXIS[pole]] = pole), m), {});

const allPole = (idx) => AXES.reduce((m, a) => ((m[a.id] = a.poles[idx]), m), {});

describe('computeTitle', () => {
  it('each title’s exact signature resolves to that title', () => {
    for (const title of TITLES) {
      const answers = answersFromPoles(title.signature);
      const { titleId } = computeTitle(answers);
      expect(titleId, `signature of ${title.id}`).toBe(title.id);
    }
  });

  it('returns a runner-up distinct from the winner for a full answer set', () => {
    const answers = answersFromPoles(TITLES[0].signature); // explorer
    const { titleId, runnerUpId } = computeTitle(answers);
    expect(titleId).toBe('explorer');
    expect(TITLE_IDS).toContain(runnerUpId);
    expect(runnerUpId).not.toBe(titleId);
  });

  it('all-A and all-B answer sets are deterministic and never throw', () => {
    const allA = allPole(0);
    const allB = allPole(1);
    const a1 = computeTitle(allA);
    const a2 = computeTitle(allA);
    const b1 = computeTitle(allB);
    expect(TITLE_IDS).toContain(a1.titleId);
    expect(TITLE_IDS).toContain(b1.titleId);
    expect(a1.titleId).toBe(a2.titleId); // deterministic
  });

  it('empty / malformed input does not throw and returns a valid title', () => {
    expect(TITLE_IDS).toContain(computeTitle({}).titleId);
    expect(TITLE_IDS).toContain(computeTitle(null).titleId);
    expect(TITLE_IDS).toContain(computeTitle(undefined).titleId);
  });

  it('tie is broken by weighted score (adventure/social/sharing weigh 2)', () => {
    // unknown∈adventure(w2) matches explorer & connoisseur; sweet∈sweetness(w1)
    // matches dreamer & warm. All four score 1 → the weighted axis must win.
    const answers = { adventure: 'unknown', sweetness: 'sweet' };
    const { titleId, scores } = computeTitle(answers);
    expect(scores.explorer).toBe(1);
    expect(scores.dreamer).toBe(1);
    expect(scores.explorer).toBe(scores.dreamer); // same raw score → weight breaks it
    expect(titleId).toBe('explorer'); // weighted (adventure=2) beats sweetness=1
  });
});
