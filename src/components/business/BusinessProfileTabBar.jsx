import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBusinessEvents } from '../../hooks/useBusinessEvents';
import { deliveryLinksReadyToSave } from '../../utils/deliveryLinkMeta';
import { PROFILE_SECTIONS, sectionLabel, getBusinessTypeConfig } from '../../config/businessProfileConfig';

/** Item kind, tolerant of pre-migration data. */
const itemKind = (it) =>
  it?.kind === 'service' || it?.kind === 'dish'
    ? it.kind
    : it?.listingKind === 'services'
      ? 'service'
      : 'dish';

/**
 * All profile sections as side-by-side tabs (about, menu, services, events,
 * hours, contact, delivery). Open one at a time. Simple rule, no curation UI:
 * the owner always sees every tab; a visitor sees a tab only when it has content.
 * To hide a section from customers, the owner just leaves it empty.
 */
export default function BusinessProfileTabBar({ profile }) {
  const { i18n } = useTranslation();
  const isArabic = (i18n.language || 'ar').startsWith('ar');
  const { businessInfo, isOwner, activeTab, setActiveTab, tc, business, profileId, isPaid } = profile;

  const info = businessInfo || {};
  const businessType = info.businessType || 'Restaurant';
  const businessId = business?.uid || business?.id || profileId || '';

  const items = Array.isArray(info.menu) ? info.menu : [];
  const hasContent = {
    about: Boolean(info.description || (info.gallery?.length) || (info.galleryEnhanced?.length)),
    menu: items.some((it) => itemKind(it) === 'dish'),
    services: items.some((it) => itemKind(it) === 'service'),
    events: useBusinessEvents(businessId, { includeEnded: false }).hasUpcoming,
    hours: Boolean(info.hours || info.openingHours || business?.openingHours),
    contact: Boolean(info.phone || info.email || info.address || info.website),
    delivery: deliveryLinksReadyToSave(profile?.deliveryLinks || info.deliveryLinks).length > 0 && Boolean(isPaid),
  };

  // Canonical order; visitors keep only sections that have content.
  const visible = PROFILE_SECTIONS.filter((s) => isOwner || hasContent[s]);

  // Resolve/repair the active tab: the type's default when visible, else first.
  useEffect(() => {
    if (visible.length === 0) return;
    if (!visible.includes(activeTab)) {
      const preferred = getBusinessTypeConfig(businessType).defaultTab;
      setActiveTab(visible.includes(preferred) ? preferred : visible[0]);
    }
  }, [activeTab, visible.join(','), businessType]); // eslint-disable-line react-hooks/exhaustive-deps

  if (visible.length === 0 && !isOwner) return null;

  return (
    <div
      className="ui-tabs ui-tabs--horizontal hide-scrollbar business-profile-tabs"
      style={{
        border: tc?.accent ? `1px solid color-mix(in srgb, ${tc.accent} 28%, var(--border-color))` : undefined,
        boxShadow: tc?.btnShadow || undefined,
      }}
    >
      {visible.map((tab) => (
        <button
          key={tab}
          type="button"
          className={`ui-tab ui-tab--compact ${activeTab === tab ? 'ui-tab--active' : ''}`}
          onClick={() => setActiveTab(tab)}
          style={
            activeTab === tab && tc?.accent
              ? { background: tc.footerBg, color: tc.accentText || '#fff', boxShadow: tc.btnShadow }
              : undefined
          }
        >
          {sectionLabel(tab, businessType, isArabic)}
        </button>
      ))}
    </div>
  );
}
