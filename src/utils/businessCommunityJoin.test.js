import { describe, expect, it, vi } from 'vitest';
import {
  handleBusinessCommunityJoinClick,
  isJoinedToBusinessCommunity,
  resolveBusinessCommunityId,
} from './businessCommunityJoin';

describe('resolveBusinessCommunityId', () => {
  it('prefers already-joined id', () => {
    expect(
      resolveBusinessCommunityId(['place-1'], {
        ownerId: 'owner-1',
        businessId: 'place-1',
        isVirtual: true,
      })
    ).toBe('place-1');
  });

  it('uses owner for claimed listings', () => {
    expect(
      resolveBusinessCommunityId([], {
        ownerId: 'owner-1',
        businessId: 'place-1',
        isVirtual: false,
      })
    ).toBe('owner-1');
  });
});

describe('isJoinedToBusinessCommunity', () => {
  it('detects membership', () => {
    expect(isJoinedToBusinessCommunity(['a', 'b'], 'b')).toBe(true);
    expect(isJoinedToBusinessCommunity(['a'], 'z')).toBe(false);
  });
});

describe('handleBusinessCommunityJoinClick', () => {
  it('joins when not a member', async () => {
    const joinCommunity = vi.fn().mockResolvedValue(true);
    const navigate = vi.fn();
    const result = await handleBusinessCommunityJoinClick({
      navigate,
      goToLogin: vi.fn(),
      currentUser: { uid: 'u1' },
      communityId: 'biz-1',
      isJoined: false,
      joinCommunity,
    });
    expect(joinCommunity).toHaveBeenCalledWith('biz-1');
    expect(navigate).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, reason: undefined });
  });

  it('navigates when already joined and chat enabled', async () => {
    const joinCommunity = vi.fn();
    const navigate = vi.fn();
    const result = await handleBusinessCommunityJoinClick({
      navigate,
      goToLogin: vi.fn(),
      currentUser: { uid: 'u1' },
      communityId: 'biz-1',
      isJoined: true,
      joinCommunity,
      chatEnabled: true,
    });
    expect(joinCommunity).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/community/biz-1');
    expect(result).toEqual({ ok: true, navigated: true });
  });

  it('does not open chat when joined but chat disabled (Free)', async () => {
    const joinCommunity = vi.fn();
    const navigate = vi.fn();
    const result = await handleBusinessCommunityJoinClick({
      navigate,
      goToLogin: vi.fn(),
      currentUser: { uid: 'u1' },
      communityId: 'biz-1',
      isJoined: true,
      joinCommunity,
      chatEnabled: false,
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, reason: 'chat_disabled' });
  });
});
