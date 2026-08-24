/**
 * Shared business community join UX:
 * - 1st click: join only (membership; works on Free + Paid)
 * - 2nd click (already joined): open community chat only when Paid
 * Business Stage open is separate and disabled for business accounts.
 */

import { getBusinessSubscriptionAccess } from './businessSubscription';

/**
 * Resolve the Firestore community owner id for join / chat navigation.
 * - Virtual Google imports: `restaurants/{placeId}` (not placeholder admin `ownerId`)
 * - Claimed businesses with a real owner uid: prefer `ownerId` when distinct from doc id
 * - Always prefer whichever id is already in `joinedCommunities`
 */
export function resolveBusinessCommunityId(
  joinedCommunities = [],
  { ownerId, businessId, isVirtual } = {}
) {
  const joined = Array.isArray(joinedCommunities) ? joinedCommunities : [];
  if (businessId && joined.includes(businessId)) return businessId;
  if (ownerId && joined.includes(ownerId)) return ownerId;

  if (isVirtual && businessId) return businessId;
  if (ownerId && businessId && ownerId !== businessId) return ownerId;
  return businessId || ownerId || null;
}

export function isJoinedToBusinessCommunity(joinedCommunities = [], communityId) {
  return Boolean(communityId && (joinedCommunities || []).includes(communityId));
}

/**
 * A business's chat is its Stage — the permanent community chat was retired.
 * A member can only enter when the business has an open Stage. Reads the pointer
 * projected onto the business row (public_profiles.businessPublic.liveStageId),
 * from whichever shape the caller holds, and ignores a pointer past its expiry
 * (the hourly purge clears the field a little after the real expiry).
 *
 * @param {object|null|undefined} business
 * @returns {{ liveStageId: string|null, stageOpen: boolean }}
 */
export function resolveBusinessLiveStage(business) {
  if (!business || typeof business !== 'object') return { liveStageId: null, stageOpen: false };
  const bi = business.businessInfo && typeof business.businessInfo === 'object' ? business.businessInfo : {};
  const bp = business.businessPublic && typeof business.businessPublic === 'object' ? business.businessPublic : {};
  const liveStageId =
    business.liveStageId || bi.liveStageId || bp.liveStageId || null;
  const expiresAt =
    business.liveStageExpiresAt || bi.liveStageExpiresAt || bp.liveStageExpiresAt || null;
  if (!liveStageId) return { liveStageId: null, stageOpen: false };
  if (!expiresAt) return { liveStageId, stageOpen: true };
  const ms = Date.parse(expiresAt);
  return { liveStageId, stageOpen: Number.isNaN(ms) || ms > Date.now() };
}

/** Whether this business listing may open permanent community group chat. */
export function isBusinessCommunityChatEnabled(subscriptionTier) {
  return getBusinessSubscriptionAccess(subscriptionTier).canUseCommunityGroupChat === true;
}

/**
 * @param {object} opts
 * @param {Event} [opts.event]
 * @param {(path: string) => void} opts.navigate
 * @param {(options?: { returnPath?: string }) => void} opts.goToLogin
 * @param {object|null|undefined} opts.currentUser
 * @param {string|null|undefined} opts.communityId
 * @param {boolean} opts.isJoined
 * @param {(communityId: string) => Promise<unknown>} opts.joinCommunity
 * @param {string} [opts.returnPath]
 * @param {boolean} [opts.chatEnabled] — default true for backward compat; pass false for Free
 * @returns {Promise<{ ok: boolean, navigated?: boolean, reason?: string }>}
 */
export async function handleBusinessCommunityJoinClick({
  event,
  navigate,
  goToLogin,
  currentUser,
  communityId,
  isJoined,
  joinCommunity,
  returnPath,
  // Business chat is the Stage. A member's tap enters the open Stage; with no
  // open Stage the button is disabled in the UI, so this is a guard.
  liveStageId = null,
  stageOpen = false,
}) {
  event?.stopPropagation?.();
  event?.preventDefault?.();

  const uid = currentUser?.uid || currentUser?.id;
  if (!uid || currentUser?.isGuest || currentUser?.id === 'guest') {
    goToLogin(returnPath ? { returnPath } : undefined);
    return { ok: false, reason: 'login' };
  }
  if (!communityId) return { ok: false, reason: 'missing_community' };
  if (typeof joinCommunity !== 'function') return { ok: false, reason: 'unavailable' };

  if (isJoined) {
    if (stageOpen && liveStageId) {
      navigate(`/stage/${liveStageId}`);
      return { ok: true, navigated: true };
    }
    // Member, but the business has no open Stage — nothing to enter.
    return { ok: true, reason: 'no_open_stage' };
  }

  try {
    const ok = await joinCommunity(communityId);
    return { ok: Boolean(ok), reason: ok ? undefined : 'join_failed' };
  } catch {
    return { ok: false, reason: 'join_failed' };
  }
}
