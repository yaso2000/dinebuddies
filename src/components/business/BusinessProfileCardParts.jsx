import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaEdit } from 'react-icons/fa';
import { AppText } from '../base';

// Standardized floating Edit Button for all sections
export function EditActionBtn({ onClick, icon = <FaEdit size={16} />, tc }) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      title={t('edit_section')}
      style={{
        width: '40px', height: '40px', borderRadius: '50%',
        background: 'color-mix(in srgb, var(--brand-primary) 15%, transparent)',
        cursor: 'pointer',
        border: `1.5px solid var(--brand-primary)`,
        color: 'var(--brand-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: tc?.accent ? `0 4px 14px ${tc.accent}44` : '0 2px 8px rgba(0,0,0,0.08)',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.12)';
        e.currentTarget.style.background = 'color-mix(in srgb, var(--brand-primary) 25%, transparent)';
        e.currentTarget.style.borderColor = 'var(--brand-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.background = 'color-mix(in srgb, var(--brand-primary) 15%, transparent)';
        e.currentTarget.style.borderColor = 'var(--brand-primary)';
      }}>

            {icon}
        </button>);

}

// Standardized section wrapper — replaces the ad-hoc "ui-card ui-card--lg"
// header patterns previously duplicated per section (About/Contact) and
// gives sections that had no shared card at all (Feedback/Highlights) one.
export function BusinessSectionCard({ icon, title, actions, className = '', children }) {
  return (
    <section className={`business-profile-card ${className}`}>
            {(title || actions) &&
    <div className={`business-profile-card__header${children ? '' : ' business-profile-card__header--tight'}`}>
                    {title &&
      <AppText as="h3" className="business-profile-card__heading">
                            {icon && <span className="business-profile-card__heading-icon" aria-hidden>{icon}</span>}
                            {title}
                        </AppText>
      }
                    {actions && <div className="business-profile-card__actions">{actions}</div>}
                </div>
    }
            {children}
        </section>);

}
