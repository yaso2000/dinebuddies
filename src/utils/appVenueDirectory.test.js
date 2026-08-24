import { describe, it, expect, vi } from 'vitest';

vi.mock('../firebase/config', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  getDocs: async () => ({ docs: [] }),
  limit: () => ({}),
  query: () => ({}),
  where: () => ({}),
}));
vi.mock('./avatarUtils', () => ({ getSafeAvatar: () => '' }));
vi.mock('./invitationVenueSearch', () => ({ sortDineBuddiesVenues: (rows) => rows }));

const { __testables } = await import('./appVenueDirectory');

describe('Country scope matches venues however their country was stored', () => {
  const match = (venueCountry, wanted) =>
    __testables.venueMatchesCountry(venueCountry, wanted, new Map());

  it('matches an ISO code against an ISO code', () => {
    expect(match({ countryCode: 'AU' }, 'AU')).toBe(true);
  });

  it('matches a full country name against an ISO code', () => {
    expect(match({ countryCode: 'Australia' }, 'AU')).toBe(true);
    expect(match({ country: 'Australia' }, 'AU')).toBe(true);
  });

  it('is case and spacing tolerant', () => {
    expect(match({ countryCode: '  australia ' }, 'AU')).toBe(true);
  });

  it('excludes a genuinely different country', () => {
    expect(match({ countryCode: 'France' }, 'AU')).toBe(false);
    expect(match({ countryCode: 'FR' }, 'AU')).toBe(false);
  });

  it('keeps venues that record no country at all', () => {
    expect(match({}, 'AU')).toBe(true);
  });

  it('keeps venues whose country text cannot be resolved', () => {
    expect(match({ countryCode: 'Somewhere' }, 'AU')).toBe(true);
  });
});
