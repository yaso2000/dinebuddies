import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTimes } from 'react-icons/fa';
import { useBusinessEvents } from '../../hooks/useBusinessEvents';
import { useBusinessSections } from '../../hooks/useBusinessSections';
import BusinessSectionPicker from './BusinessSectionPicker';
import { TAB_SECTIONS, tabLabel, resolveInitialTab } from '../../config/businessProfileConfig';

/** Item kind, tolerant of pre-migration data. */
const itemKind = (it) =>
  it?.kind === 'service' || it?.kind === 'dish'
    ? it.kind
    : it?.listingKind === 'services'
      ? 'service'
      : 'dish';

/**
 * The three-tab bar (Menu / Services / Events), owner-curated. A tab shows to a
 * VISITOR only when it is enabled AND has content; owners see every enabled tab
 * (each with a × to remove) plus a + to add any removed section back. The config
 * decides which tab opens first, falling back to the first available one.
 */
export default function BusinessProfileTabBar({ profile }) {
  const { i18n } = useTranslation();
  const isArabic = (i18n.language || 'ar').startsWith('ar');
  const { businessInfo, isOwner, activeTab, setActiveTab, tc, business, profileId } = profile;

  const info = businessInfo || {};
  const businessType = info.businessType || 'Restaurant';
  const businessId = business?.uid || business?.id || profileId || '';

  const { enabled, disabled, removeSection, addSection } = useBusinessSections(profile);

  const items = Array.isArray(info.menu) ? info.menu : [];
  const hasContent = {
    menu: items.some((it) => itemKind(it) === 'dish'),
    services: items.some((it) => itemKind(it) === 'service'),
    events: useBusinessEvents(businessId, { includeEnded: false }).hasUpcoming,
  };

  // Enabled tab-sections, then (for visitors) only those with content.
  const enabledTabs = TAB_SECTIONS.filter((t) => enabled.includes(t));
  const visible = enabledTabs.filter((t) => isOwner || hasContent[t]);

  // Resolve/repair the active tab.
  useEffect(() => {
    if (visible.length === 0) return;
    if (!visible.includes(activeTab)) {
      const nonEmpty = { menu: visible.includes('menu'), services: visible.includes('services'), events: visible.includes('events') };
      setActiveTab(resolveInitialTab(businessType, nonEmpty) || visible[0]);
    }
  }, [activeTab, visible.join(','), businessType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nothing to show and not an owner → no tab bar at all.
  if (visible.length === 0 && !isOwner) return null;

  return (
    <div
      className="ui-tabs ui-tabs--horizontal hide-scrollbar business-profile-tabs"
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        border: tc?.accent ? `1px solid color-mix(in srgb, ${tc.accent} 28%, var(--border-color))` : undefined,
        boxShadow: tc?.btnShadow || undefined,
      }}
    >
      {visible.map((tab) => (
        <span key={tab} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <button
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
          {isOwner && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeSection(tab); }}
              aria-label={isArabic ? 'إزالة التبويب' : 'remove tab'}
              title={isArabic ? 'إزالة التبويب (يبقى محتواه محفوظًا)' : 'Remove tab (content is kept)'}
              style={{
                marginInlineStart: -4, width: 20, height: 20, borderRadius: 999, border: 'none',
                background: 'transparent', color: 'var(--text-tertiary,#9ca3af)', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
              }}
            >
              <FaTimes />
            </button>
          )}
        </span>
      ))}

      {isOwner && <BusinessSectionPicker disabled={disabled} type={businessType} onAdd={addSection} />}
    </div>
  );
}
