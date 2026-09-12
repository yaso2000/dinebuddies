import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBusinessEvents } from '../../hooks/useBusinessEvents';
import { BUSINESS_TABS, tabLabel, resolveInitialTab } from '../../config/businessProfileConfig';

/** Item kind, tolerant of pre-migration data (listingKind / no field). */
const itemKind = (it) =>
  it?.kind === 'service' || it?.kind === 'dish'
    ? it.kind
    : it?.listingKind === 'services'
      ? 'service'
      : 'dish';

/**
 * The three-tab bar shared by every business type: Menu, Services, Events.
 * An empty tab is never shown; the config decides which opens first (falling
 * back to the first non-empty tab). See businessProfileConfig.
 */
export default function BusinessProfileTabBar({ profile }) {
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.language || 'ar').startsWith('ar');
  const { businessInfo, isOwner, activeTab, setActiveTab, tc, business, profileId } = profile;

  const info = businessInfo || {};
  const businessType = info.businessType || 'Restaurant';
  const businessId = business?.uid || business?.id || profileId || '';

  const items = Array.isArray(info.menu) ? info.menu : [];
  const hasDishes = items.some((it) => itemKind(it) === 'dish');
  const hasServices = items.some((it) => itemKind(it) === 'service');
  const { hasUpcoming } = useBusinessEvents(businessId, { includeEnded: false });

  // Owners always see all three (to add content); visitors only non-empty ones.
  const nonEmpty = {
    menu: isOwner || hasDishes,
    services: isOwner || hasServices,
    events: isOwner || hasUpcoming,
  };
  const visible = BUSINESS_TABS.filter((tab) => nonEmpty[tab]);

  // Resolve/repair the active tab: config default (per type) when its tab has
  // content, else the first non-empty tab.
  useEffect(() => {
    if (visible.length === 0) return;
    if (!visible.includes(activeTab)) {
      setActiveTab(resolveInitialTab(businessType, nonEmpty) || visible[0]);
    }
  }, [activeTab, visible.join(','), businessType]); // eslint-disable-line react-hooks/exhaustive-deps

  if (visible.length === 0) return null;

  return (
    <div
      className="ui-tabs ui-tabs--horizontal hide-scrollbar business-profile-tabs"
      style={{
        border: tc?.accent
          ? `1px solid color-mix(in srgb, ${tc.accent} 28%, var(--border-color))`
          : undefined,
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
          {tabLabel(tab, businessType, isArabic)}
        </button>
      ))}
    </div>
  );
}
