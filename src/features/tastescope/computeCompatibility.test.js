import { describe, expect, it } from 'vitest';
import { computeCompatibility } from './computeCompatibility';
import { AXES } from './tastescopeData';

const allPole = (idx) => AXES.reduce((m, a) => ((m[a.id] = a.poles[idx]), m), {});
const allA = allPole(0);
const allB = allPole(1);

describe('computeCompatibility', () => {
  it('identical answers + same title is capped at 98%', () => {
    const r = computeCompatibility(allA, allA, 'explorer', 'explorer');
    expect(r.axisMatches).toBe(10);
    expect(r.sameTitle).toBe(true);
    expect(r.percent).toBe(98); // (1.0 + 0.10) → clamped down to 98
  });

  it('complete opposites, unrelated titles floor at 35%', () => {
    const r = computeCompatibility(allA, allB, 'explorer', 'host');
    expect(r.axisMatches).toBe(0);
    expect(r.sameTitle).toBe(false);
    expect(r.complementary).toBe(false);
    expect(r.percent).toBe(35); // (0 + 0) → clamped up to 35
  });

  it('applies the +0.05 complementary bonus', () => {
    // 5 matching axes → base 0.5; host+companion are complementary → +0.05 → 55%.
    const answersB = { ...allA };
    ['heat', 'ritual', 'social', 'rhythm', 'simplicity'].forEach((ax) => {
      const axis = AXES.find((a) => a.id === ax);
      answersB[ax] = axis.poles[1]; // flip 5 axes
    });
    const r = computeCompatibility(allA, answersB, 'host', 'companion');
    expect(r.axisMatches).toBe(5);
    expect(r.complementary).toBe(true);
    expect(r.percent).toBe(55);
  });

  it('suggests breakfast when both chose morning', () => {
    const a = { ...allA, rhythm: 'morning' };
    const b = { ...allB, rhythm: 'morning' };
    expect(computeCompatibility(a, b).suggestedInvite).toBe('breakfast');
  });

  it('falls back to dinnerForTwo when no signature pole is shared', () => {
    // allA vs allB share nothing → none of the special poles match.
    expect(computeCompatibility(allA, allB).suggestedInvite).toBe('dinnerForTwo');
  });

  it('malformed input does not throw', () => {
    const r = computeCompatibility(null, undefined);
    expect(r.axisMatches).toBe(0);
    expect(r.percent).toBe(35);
  });
});
