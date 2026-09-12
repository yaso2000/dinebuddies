import React from 'react';
import MenuShowcase from '../MenuShowcase';

/** Menu tab — dishes only (kind === 'dish'). */
export default function BusinessProfileMenuTab({ profile }) {
  const { activeTab, profileId, businessInfo, isOwner, isPaid, tc } = profile;

  if (activeTab !== 'menu') return null;

  return (
    <MenuShowcase
      profileId={profileId}
      menuData={Array.isArray(businessInfo.menu) ? businessInfo.menu : []}
      kind="dish"
      isOwner={isOwner}
      isPaid={isPaid}
      theme={{ colors: tc }}
    />
  );
}
