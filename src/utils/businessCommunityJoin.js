/**
 * Shared business community join UX:
 * - 1st click: join only (button becomes "Join chat")
 * - 2nd click (already joined): navigate to community chat
 */

export function resolveBusinessCommunityId(joinedCommunities = [], { ownerId, businessId } = {}) {
  const joined = Array.isArray(joinedCommunities) ? joinedCommunities : [];
  if (ownerId && joined.includes(ownerId)) return ownerId;
  if (businessId && joined.includes(businessId)) return businessId;
  return ownerId || businessId || null;
}

export function isJoinedToBusinessCommunity(joinedCommunities = [], communityId) {
  return Boolean(communityId && (joinedCommunities || []).includes(communityId));
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
 */
export function handleBusinessCommunityJoinClick({
  event,
  navigate,
  goToLogin,
  currentUser,
  communityId,
  isJoined,
  joinCommunity,
  returnPath,
}) {
  event?.stopPropagation?.();
  event?.preventDefault?.();

  const uid = currentUser?.uid || currentUser?.id;
  if (!uid || currentUser?.isGuest || currentUser?.id === 'guest') {
    goToLogin(returnPath ? { returnPath } : undefined);
    return;
  }
  if (!communityId) return;

  if (isJoined) {
    navigate(`/community/${communityId}`);
    return;
  }

  void joinCommunity(communityId).catch(() => {});
}
