import React from 'react';
import MenuShowcase from '../MenuShowcase';

export default function BusinessProfileMenuTab({ profile }) {
  const { activeTab, profileId, businessInfo, isOwner, isPaid, setMenuTabListingType, tc } = profile;

  if (activeTab !== 'menu') return null;

  return (
    <MenuShowcase
      profileId={profileId}
      menuData={Array.isArray(businessInfo.menu) ? businessInfo.menu : []}
      menuListingType={businessInfo.menuListingType || 'menu'}
      isOwner={isOwner}
      isPaid={isPaid}
      onListingTypeChange={setMenuTabListingType}
      theme={{ colors: tc }} />);

}
