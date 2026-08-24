import { describe, it, expect } from 'vitest';
import {
  getDatingToggleLock,
  DATING_TOGGLE_GRACE_MS,
  DATING_TOGGLE_LOCK_MS,
} from './datingToggleLock';

const NOW = Date.UTC(2026, 7, 24, 12, 0, 0);
const authUserCreatedAt = (ms) => ({ metadata: { creationTime: new Date(ms).toUTCString() } });
const changedAt = (ms) => ({ openToDatingChangedAt: { toMillis: () => ms } });

describe('open-to-dating switch: when it may be changed', () => {
  it('is free for the first day after signing up', () => {
    const lock = getDatingToggleLock({
      authUser: authUserCreatedAt(NOW - 2 * 60 * 60 * 1000),
      profile: {},
      nowMs: NOW,
    });
    expect(lock).toMatchObject({ locked: false, inGrace: true });
  });

  it('stays free during the opening day even after a change', () => {
    const lock = getDatingToggleLock({
      authUser: authUserCreatedAt(NOW - 3 * 60 * 60 * 1000),
      profile: changedAt(NOW - 60 * 60 * 1000),
      nowMs: NOW,
    });
    expect(lock.locked).toBe(false);
    expect(lock.inGrace).toBe(true);
  });

  it('allows the first change once the opening day is over', () => {
    const lock = getDatingToggleLock({
      authUser: authUserCreatedAt(NOW - DATING_TOGGLE_GRACE_MS - 1000),
      profile: {},
      nowMs: NOW,
    });
    expect(lock).toMatchObject({ locked: false, inGrace: false });
  });

  it('locks for a week after a change outside the opening day', () => {
    const changed = NOW - 2 * 24 * 60 * 60 * 1000;
    const lock = getDatingToggleLock({
      authUser: authUserCreatedAt(NOW - 30 * 24 * 60 * 60 * 1000),
      profile: changedAt(changed),
      nowMs: NOW,
    });
    expect(lock.locked).toBe(true);
    expect(lock.retryAtMs).toBe(changed + DATING_TOGGLE_LOCK_MS);
  });

  it('frees up once the week has passed', () => {
    const lock = getDatingToggleLock({
      authUser: authUserCreatedAt(NOW - 30 * 24 * 60 * 60 * 1000),
      profile: changedAt(NOW - DATING_TOGGLE_LOCK_MS - 1000),
      nowMs: NOW,
    });
    expect(lock.locked).toBe(false);
  });

  it('does not lock an existing account that has never changed the switch', () => {
    const lock = getDatingToggleLock({ authUser: undefined, profile: {}, nowMs: NOW });
    expect(lock.locked).toBe(false);
  });
});
