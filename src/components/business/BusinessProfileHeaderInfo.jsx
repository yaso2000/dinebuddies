import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaTimes } from 'react-icons/fa';
import BusinessProfileAboutTab from './BusinessProfileAboutTab';
import BusinessProfileHoursTab from './BusinessProfileHoursTab';
import BusinessProfileContactTab from './BusinessProfileContactTab';
import BusinessProfileDeliveryTab from './BusinessProfileDeliveryTab';
import { deliveryLinksReadyToSave } from '../../utils/deliveryLinkMeta';
import { useBusinessSections } from '../../hooks/useBusinessSections';
import { sectionLabel, HEADER_SECTIONS } from '../../config/businessProfileConfig';

/** Owner-only remove (×) chrome around a header section. */
function OwnerSection({ id, type, isOwner, onRemove, isArabic, children }) {
  if (!isOwner) return children;
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => onRemove(id)}
        aria-label={`${sectionLabel(id, type, isArabic)} — ${isArabic ? 'إزالة القسم' : 'remove section'}`}
        title={isArabic ? 'إزالة القسم (يبقى محتواه محفوظًا)' : 'Remove section (content is kept)'}
        style={{
          position: 'absolute', top: 6, insetInlineEnd: 6, zIndex: 2,
          width: 26, height: 26, borderRadius: 999, border: '1px solid var(--border-color,#e5e7eb)',
          background: 'var(--bg-card,#fff)', color: 'var(--text-secondary,#6b7280)', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
        }}
      >
        <FaTimes />
      </button>
      {children}
    </div>
  );
}

/**
 * Always-visible header block below the hero: about, hours (open-now), contact,
 * delivery — for every business type, in the owner's chosen order. A section is
 * shown to a VISITOR only when it is enabled AND has content (empty panels never
 * reach consumers). Owners see every enabled section (to edit) with a × to
 * remove it; removal only hides the section — content is preserved.
 */
export default function BusinessProfileHeaderInfo({ profile }) {
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.language || 'ar').startsWith('ar');
  const info = profile?.businessInfo || {};
  const type = info.businessType || 'Restaurant';
  const { enabled, isOwner, removeSection } = useBusinessSections(profile);

  const hasDelivery = deliveryLinksReadyToSave(profile?.deliveryLinks || info.deliveryLinks).length > 0;
  const hasContent = {
    about: true, // identity/type chip always meaningful
    hours: Boolean(info.hours || info.openingHours || profile?.business?.openingHours),
    contact: Boolean(info.phone || info.email || info.address || info.website),
    delivery: hasDelivery && Boolean(profile?.isPaid),
  };

  const components = {
    about: <BusinessProfileAboutTab profile={{ ...profile, activeTab: 'about' }} />,
    hours: <BusinessProfileHoursTab profile={{ ...profile, activeTab: 'hours' }} />,
    contact: <BusinessProfileContactTab profile={{ ...profile, activeTab: 'contact' }} />,
    delivery: <BusinessProfileDeliveryTab profile={{ ...profile, activeTab: 'delivery' }} />,
  };

  // Header sections in the owner's order (only the header ones).
  const ordered = enabled.filter((id) => HEADER_SECTIONS.includes(id));
  const shown = ordered.filter((id) => isOwner || hasContent[id]);

  return (
    <div
      className="business-profile-header-info"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--profile-stack-gap)' }}
    >
      {isOwner && (
        <div
          style={{
            display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 12,
            background: 'var(--bg-card, #f3f4f6)', border: '1px dashed var(--border-color, #e5e7eb)',
            fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--text-secondary, #6b7280)',
          }}
        >
          <span style={{ fontSize: 15 }}>💡</span>
          <span>
            {t(
              'business_sections_hint',
              'أنت تتحكّم بأقسام صفحتك: أزل ما لا يخصّ نشاطك بزر ×، وأضِف أي قسم بزر + في شريط التبويبات. الأقسام الفارغة لا تظهر للزبائن، والإزالة لا تحذف المحتوى.',
            )}
          </span>
        </div>
      )}

      {shown.map((id) => (
        <OwnerSection key={id} id={id} type={type} isOwner={isOwner} onRemove={removeSection} isArabic={isArabic}>
          {components[id]}
        </OwnerSection>
      ))}
    </div>
  );
}
