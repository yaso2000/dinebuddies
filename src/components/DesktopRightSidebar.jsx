import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import RankingSidebarWidget from './RankingSidebarWidget';
import SuggestedFriendsSidebarWidget from './SuggestedFriendsSidebarWidget';
import PublicInvitationsSidebarWidget from './PublicInvitationsSidebarWidget';
import { AppText } from './base';

/** Desktop-only right column — stable component (must not be defined inside Layout). */
export default function DesktopRightSidebar() {
  const { t } = useTranslation();

  return (
    <aside className="ds-right-sidebar">
      <RankingSidebarWidget />
      <SuggestedFriendsSidebarWidget />
      <PublicInvitationsSidebarWidget />
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingLeft: '4px', lineHeight: 2, display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        <AppText as="span" dir="ltr">© {new Date().getFullYear()} DineBuddies</AppText>
        {' · '}
        <Link to="/settings" style={{ color: 'var(--text-muted)' }}>{t('settings', 'Settings')}</Link>
      </div>
    </aside>
  );
}
