import React from 'react';
import { useTranslation } from 'react-i18next';
import PremiumBadge from '../PremiumBadge';

export default function BusinessProfileTabBar({ profile }) {
  const { t } = useTranslation();
  const { businessInfo, isOwner, menuTabListingType, activeTab, setActiveTab, tc, navigate } = profile;

  const info = businessInfo || {};
  const hasContactInfo = !!(info.phone || info.email || info.address || info.website);
  const menuTabLabel = menuTabListingType === 'services' ? t('tab_services') : t('tab_menu');
  const tabs = [
  { id: 'about', label: t('tab_about'), locked: false },
  { id: 'menu', label: menuTabLabel, locked: false, hide: !isOwner && !(info.menu?.length > 0) },
  { id: 'services', label: t('tab_services'), locked: false, hide: true },
  { id: 'hours', label: t('tab_hours'), locked: false, hide: !isOwner && !info.hours },
  { id: 'contact', label: t('tab_contact'), locked: false, hide: !isOwner && !hasContactInfo }];

  const visibleTabs = tabs.filter((tab) => !tab.hide);
  return (
    <div
      className="ui-tabs ui-tabs--horizontal hide-scrollbar business-profile-tabs"
      style={{
        border: tc?.accent ?
        `1px solid color-mix(in srgb, ${tc.accent} 28%, var(--border-color))` :
        undefined,
        boxShadow: tc?.btnShadow || undefined
      }}>

            {visibleTabs.map(({ id, label, locked }) =>
      <button
        key={id}
        type="button"
        className={`ui-tab ui-tab--compact ${activeTab === id && !locked ? 'ui-tab--active' : ''}${locked ? ' business-profile-tab--locked' : ''}`}
        onClick={() => {
          if (locked) {navigate('/settings/subscription');return;}
          setActiveTab(id);
        }}
        style={
        activeTab === id && !locked && tc?.accent ?
        {
          background: tc.footerBg,
          color: tc.accentText || '#fff',
          boxShadow: tc.btnShadow
        } :
        undefined
        }>

                    {label}
                    {locked && <PremiumBadge mode="pro" text={t('biz_plan_paid_name', 'Paid')} />}
                </button>
      )}
        </div>);

}
