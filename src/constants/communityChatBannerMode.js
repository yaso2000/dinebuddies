/** Host-controlled banner visibility for community chat (normal chat vs banner chat). */

export function resolveCommunityChatBannerVisible(partner) {
  const raw =
    partner?.communityChatBannerVisible ??
    partner?.businessInfo?.communityChatBannerVisible ??
    partner?.businessInfo?.drafts?.communityChatBannerVisible;

  if (raw === false) return false;
  return true;
}
