import { describe, it, expect } from 'vitest';
import { sameAgeClass, canInteractPrivately, filterSameAgeClass } from './minorSafety';

const minor = { id: 'm', ageCategory: '16-17' };
const adult = { id: 'a', ageCategory: '25-34' };
const adult2 = { id: 'b', age_category: '55+' };
const unknown = { id: 'u' };

describe('minor safety (16–17 vs adults)', () => {
  it('minor and adult are different age classes', () => {
    expect(sameAgeClass(minor, adult)).toBe(false);
    expect(canInteractPrivately(minor, adult)).toBe(false);
    expect(canInteractPrivately(adult, minor)).toBe(false);
  });

  it('adults (any adult bucket) share a class; two minors share a class', () => {
    expect(sameAgeClass(adult, adult2)).toBe(true);
    expect(sameAgeClass(minor, { ageCategory: '16-17' })).toBe(true);
  });

  it('unknown age is treated as adult (server rules are the backstop)', () => {
    expect(sameAgeClass(unknown, adult)).toBe(true);
    expect(canInteractPrivately(null, adult)).toBe(true);
  });

  it('filters a member list to the viewer class', () => {
    expect(filterSameAgeClass(minor, [minor, adult, adult2]).map((u) => u.id)).toEqual(['m']);
    expect(filterSameAgeClass(adult, [minor, adult, adult2]).map((u) => u.id)).toEqual(['a', 'b']);
    expect(filterSameAgeClass(null, [minor, adult]).length).toBe(2);
  });
});
