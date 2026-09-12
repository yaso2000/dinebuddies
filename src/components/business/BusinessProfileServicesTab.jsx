import React from 'react';
import MenuShowcase from '../MenuShowcase';

/** Services tab — same unified list, filtered to kind === 'service'. */
export default function BusinessProfileServicesTab({ profile }) {
  const { activeTab, profileId, businessInfo, isOwner, isPaid, tc } = profile;

  if (activeTab !== 'services') return null;

  return (
    <MenuShowcase
      profileId={profileId}
      menuData={Array.isArray(businessInfo.menu) ? businessInfo.menu : []}
      kind="service"
      isOwner={isOwner}
      isPaid={isPaid}
      theme={{ colors: tc }}
    />
  );
}
