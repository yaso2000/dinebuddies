import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppText } from '../base';

export default function BusinessProfileSetupBanner({ profile }) {
  const { t } = useTranslation();
  const { isOwner, business } = profile;

  if (!(isOwner && business?.businessProfileSetupPending === true)) return null;

  return (
    <div
      className="ui-banner--warning"
      style={{
        margin: '12px 16px 0',
        alignItems: 'flex-start',
        gap: '12px'
      }}>

            <AppText as="span" style={{ fontSize: '1.35rem', flexShrink: 0 }}>📋</AppText>
            <div style={{ flex: 1, minWidth: 0 }}>
                <AppText as="p" className="ui-banner--warning__title">
                    {t('business_profile_setup_banner_title', 'Finish your business profile')}
                </AppText>
                <AppText as="p" style={{ margin: '6px 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    {t(
            'business_profile_setup_banner_desc',
            'Add your name, contact, address, and photos so customers can discover you.'
          )}
                </AppText>
            </div>
        </div>);

}
