import React from 'react';
import MenuShowcase from '../MenuShowcase';
import DeliveryLinksSection from '../DeliveryLinksSection';

export default function BusinessProfileMenuTab({ profile }) {
  const { activeTab, profileId, businessInfo, isOwner, isPaid, setMenuTabListingType, tc } = profile;

  if (activeTab !== 'menu') return null;

  return (
    <>
      <MenuShowcase
        profileId={profileId}
        menuData={Array.isArray(businessInfo.menu) ? businessInfo.menu : []}
        menuListingType={businessInfo.menuListingType || 'menu'}
        isOwner={isOwner}
        isPaid={isPaid}
        onListingTypeChange={setMenuTabListingType}
        theme={{ colors: tc }} />

      {/* Order via delivery apps — lives with the menu; DeliveryLinksSection hides
          itself for visitors when there are no links. */}
      <DeliveryLinksSection
        business={profile.business}
        isOwner={profile.isOwner}
        deliveryLinks={profile.deliveryLinks}
        tempDeliveryLinks={profile.tempDeliveryLinks}
        setTempDeliveryLinks={profile.setTempDeliveryLinks}
        editingDeliveryLinks={profile.editingDeliveryLinks}
        setEditingDeliveryLinks={profile.setEditingDeliveryLinks}
        onSave={profile.handleSaveDeliveryLinks}
        onCancel={profile.handleCancelDeliveryLinks} />
    </>);

}
