import React from 'react';
import DeliveryLinksSection from '../DeliveryLinksSection';

/** Delivery tab — order-via-app links as a first-class profile section. */
export default function BusinessProfileDeliveryTab({ profile }) {
  if (profile.activeTab !== 'delivery') return null;
  return (
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
  );
}
