import React from 'react';
import { useTranslation } from 'react-i18next';
import BusinessProfileAboutTab from './BusinessProfileAboutTab';
import BusinessProfileHoursTab from './BusinessProfileHoursTab';
import BusinessProfileContactTab from './BusinessProfileContactTab';
import BusinessProfileDeliveryTab from './BusinessProfileDeliveryTab';
import { deliveryLinksReadyToSave } from '../../utils/deliveryLinkMeta';

/**
 * Always-visible header block below the hero: about, hours (open-now), contact,
 * delivery — shown for EVERY business type. Empty panels are NOT shown to
 * consumers: each section renders for a visitor only when it has content (owners
 * always see them, to edit). Rendered with a forced active id so the reused tab
 * components display outside the tab system (which now holds only menu/services/
 * events).
 */
export default function BusinessProfileHeaderInfo({ profile }) {
  const { t } = useTranslation();
  const info = profile?.businessInfo || {};
  const isOwner = Boolean(profile?.isOwner);

  const hasHours = Boolean(info.hours || info.openingHours || profile?.business?.openingHours);
  const hasContact = Boolean(info.phone || info.email || info.address || info.website);
  const hasDelivery = deliveryLinksReadyToSave(profile?.deliveryLinks || info.deliveryLinks).length > 0;
  const showDelivery = isOwner || (hasDelivery && profile?.isPaid);

  return (
    <div
      className="business-profile-header-info"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--profile-stack-gap)' }}
    >
      {/* Owner guidance: empty lists/sections stay hidden from customers. */}
      {isOwner && (
        <div
          style={{
            display: 'flex', gap: 8, alignItems: 'flex-start',
            padding: '10px 14px', borderRadius: 12,
            background: 'var(--bg-card, #f3f4f6)', border: '1px dashed var(--border-color, #e5e7eb)',
            fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--text-secondary, #6b7280)',
          }}
        >
          <span style={{ fontSize: 15 }}>💡</span>
          <span>
            {t(
              'business_empty_sections_hint',
              'الأقسام والقوائم الفارغة لا تظهر للزبائن. اترك ما لا يخصّ نشاطك فارغًا (مثلًا: نادٍ ليلي بلا منيو أو توصيل).',
            )}
          </span>
        </div>
      )}

      <BusinessProfileAboutTab profile={{ ...profile, activeTab: 'about' }} />
      {(isOwner || hasHours) && <BusinessProfileHoursTab profile={{ ...profile, activeTab: 'hours' }} />}
      {(isOwner || hasContact) && <BusinessProfileContactTab profile={{ ...profile, activeTab: 'contact' }} />}
      {showDelivery && <BusinessProfileDeliveryTab profile={{ ...profile, activeTab: 'delivery' }} />}
    </div>
  );
}
