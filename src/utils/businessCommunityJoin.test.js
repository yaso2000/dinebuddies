import { describe, expect, it, vi } from 'vitest';
import {
  handleBusinessCommunityJoinClick,
  isJoinedToBusinessCommunity,
  resolveBusinessCommunityId,
  resolveBusinessLiveStage,
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

  it('enters the Stage when joined and a Stage is open', async () => {
    const joinCommunity = vi.fn();
    const navigate = vi.fn();
    const result = await handleBusinessCommunityJoinClick({
      navigate,
      goToLogin: vi.fn(),
      currentUser: { uid: 'u1' },
      communityId: 'biz-1',
      isJoined: true,
      joinCommunity,
      liveStageId: 'stage-9',
      stageOpen: true,
    });
    expect(joinCommunity).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/stage/stage-9');
    expect(result).toEqual({ ok: true, navigated: true });
  });

  it('does nothing when joined but no Stage is open', async () => {
    const joinCommunity = vi.fn();
    const navigate = vi.fn();
    const result = await handleBusinessCommunityJoinClick({
      navigate,
      goToLogin: vi.fn(),
      currentUser: { uid: 'u1' },
      communityId: 'biz-1',
      isJoined: true,
      joinCommunity,
      liveStageId: null,
      stageOpen: false,
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, reason: 'no_open_stage' });
  });
});

describe('resolveBusinessLiveStage', () => {
  const future = new Date(Date.now() + 3600e3).toISOString();
  const past = new Date(Date.now() - 3600e3).toISOString();

  it('open when the pointer has a future expiry', () => {
    expect(resolveBusinessLiveStage({ liveStageId: 'S1', liveStageExpiresAt: future }))
      .toEqual({ liveStageId: 'S1', stageOpen: true });
  });
  it('closed when the pointer has expired', () => {
    expect(resolveBusinessLiveStage({ liveStageId: 'S1', liveStageExpiresAt: past }).stageOpen).toBe(false);
  });
  it('reads from businessPublic (directory rows)', () => {
    expect(resolveBusinessLiveStage({ businessPublic: { liveStageId: 'S1', liveStageExpiresAt: future } }).stageOpen).toBe(true);
  });
  it('reads from businessInfo (mapped rows)', () => {
    expect(resolveBusinessLiveStage({ businessInfo: { liveStageId: 'S1', liveStageExpiresAt: future } }).liveStageId).toBe('S1');
  });
  it('no pointer → closed', () => {
    expect(resolveBusinessLiveStage({})).toEqual({ liveStageId: null, stageOpen: false });
  });
});
