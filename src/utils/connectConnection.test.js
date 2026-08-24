import { describe, it, expect, vi } from 'vitest';

// The module pulls in Firestore for fetchLikePair; the rules under test are pure.
vi.mock('../firebase/config', () => ({ db: {}, app: {}, auth: {}, storage: {} }));
vi.mock('firebase/firestore', () => ({ doc: () => ({}), getDoc: async () => ({ exists: () => false }) }));
vi.mock('./followHelpers', () => ({ isFollowing: () => false, isMutualFollow: () => false }));
vi.mock('./discoveryProfile', () => ({ getDiscoveryLikeRef: () => ({}) }));

const { profileShowsLikeButton, resolveConnectionKind } = await import('./connectConnection');

const open = { openToDating: true };
const closed = { openToDating: false };

/**
 * The agreed Connect rule:
 *   heart  → only when BOTH sides are open to dating
 *   follow → whenever either side is not
 * and the pair's relationship follows the same two switches.
 */
describe('Connect: which action a profile shows', () => {
  it('shows the heart only when both sides are open to dating', () => {
    expect(profileShowsLikeButton(open, open)).toBe(true);
  });

  it('shows follow when only the viewer is open to dating', () => {
    expect(profileShowsLikeButton(open, closed)).toBe(false);
  });

  it('shows follow when only the target is open to dating', () => {
    expect(profileShowsLikeButton(closed, open)).toBe(false);
  });

  it('shows follow when neither is open to dating', () => {
    expect(profileShowsLikeButton(closed, closed)).toBe(false);
  });

  it('falls back to follow when the target is unknown', () => {
    expect(profileShowsLikeButton(open, null)).toBe(false);
  });
});

describe('Connect: the resulting relationship', () => {
  it('both open → dating', () => {
    expect(resolveConnectionKind(open, open)).toBe('dating');
  });

  it('one open, one not → acquaintance', () => {
    expect(resolveConnectionKind(open, closed)).toBe('acquaintance');
    expect(resolveConnectionKind(closed, open)).toBe('acquaintance');
  });

  it('neither open → friendship', () => {
    expect(resolveConnectionKind(closed, closed)).toBe('friendship');
  });
});
