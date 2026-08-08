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
  chatEnabled = true,
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
    if (!chatEnabled) {
      return { ok: true, reason: 'chat_disabled' };
    }
    navigate(`/community/${communityId}`);
    return { ok: true, navigated: true };
  }

  try {
    const ok = await joinCommunity(communityId);
    return { ok: Boolean(ok), reason: ok ? undefined : 'join_failed' };
  } catch {
    return { ok: false, reason: 'join_failed' };
  }
}
