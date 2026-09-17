import { describe, it, expect, vi } from 'vitest';

vi.mock('../firebase/config', () => ({ db: {}, app: {}, auth: {}, storage: {} }));
vi.mock('firebase/firestore', () => ({ doc: () => ({}), getDoc: async () => ({ exists: () => false }) }));
vi.mock('./followHelpers', () => ({
  isFollowing: (list, id) => Array.isArray(list) && list.includes(id),
  isMutualFollow: (a, b, aId, bId) => Array.isArray(a) && Array.isArray(b) && a.includes(bId) && b.includes(aId),
}));

const { profileShowsLikeButton, resolveConnectionKind, isConnectionCompleteSync, CONNECTION_KIND } =
  await import('./connectConnection');

/** The only Connect rule: Follow everywhere; a mutual Follow makes friends and unlocks chat. */
describe('Connect: single follow-based connection', () => {
  it('never shows a heart/like button', () => {
    expect(profileShowsLikeButton({}, {})).toBe(false);
    expect(profileShowsLikeButton(null, null)).toBe(false);
  });

  it('every connection is a friendship', () => {
    expect(resolveConnectionKind({}, {})).toBe('friendship');
    expect(CONNECTION_KIND).toEqual({ FRIENDSHIP: 'friendship' });
  });

  it('chat unlocks only on a mutual follow', () => {
    const base = { viewerId: 'a', targetId: 'b' };
    expect(isConnectionCompleteSync('friendship', { ...base, viewerFollowing: ['b'], targetFollowing: ['a'] })).toBe(true);
    expect(isConnectionCompleteSync('friendship', { ...base, viewerFollowing: ['b'], targetFollowing: [] })).toBe(false);
    expect(isConnectionCompleteSync('friendship', { ...base, viewerFollowing: [], targetFollowing: [] })).toBe(false);
    expect(isConnectionCompleteSync('friendship', { viewerId: 'a', targetId: 'a', viewerFollowing: ['a'], targetFollowing: ['a'] })).toBe(false);
  });
});
