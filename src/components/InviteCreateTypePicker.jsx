import React from 'react';
import { FaChevronRight, FaGlobe, FaHeart, FaLock, FaMicrophone } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { AppText } from './base';
import { useInviteCreateNavigation } from '../hooks/useInviteCreateNavigation';
import './CreateInvitationSelector.css';

export function inviteCreateTypeSubtitle(t, venueName) {
  if (venueName) {
    return t('host_invitation_at_venue', {
      defaultValue: 'Hosting at {{name}} — choose invitation type.',
      name: venueName,
    });
  }
  return t('invite_create_subtitle', 'Choose the type of invitation you want to create.');
}

/**
 * Canonical invitation-type picker (public / social / private).
 * @param {'selector' | 'sheet'} variant
 */
export default function InviteCreateTypePicker({
  variant = 'selector',
  navigationState = null,
  businessId = null,
  onAfterNavigate = null,
  className = '',
}) {
  const { t } = useTranslation();
  const { goCreate, publicGateChecking } = useInviteCreateNavigation({
    navigationState,
    businessId,
    onAfterNavigate,
  });

  const options = [
    {
      kind: 'public',
      className: 'public',
      sheetIconClass: 'business-create-option__icon--public',
      icon: FaGlobe,
      title: publicGateChecking
        ? t('detecting_location', 'Detecting location…')
        : t('invite_create_public_title'),
      desc: t('invite_create_public_desc'),
      busy: publicGateChecking,
    },
    {
      kind: 'social',
      className: 'social',
      sheetIconClass: 'business-create-option__icon--private',
      icon: FaLock,
      title: t('invite_create_social_title'),
      desc: t('invite_create_social_desc'),
    },
    {
      kind: 'private',
      className: 'personal',
      sheetIconClass: 'business-create-option__icon--dating',
      icon: FaHeart,
      title: t('invite_create_private_title'),
      desc: t('invite_create_private_desc'),
    },
    {
      kind: 'stage',
      className: 'social',
      sheetIconClass: 'business-create-option__icon--private',
      icon: FaMicrophone,
      title: t('invite_create_stage_title', 'Stage'),
      desc: t(
        'invite_create_stage_desc',
        'Open a private event chat with mutual follows.'
      ),
    },
  ];

  if (variant === 'sheet') {
    return (
      <div className={`business-create-sheet__options${className ? ` ${className}` : ''}`}>
        {options.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.kind}
              type="button"
              className="business-create-option"
              disabled={Boolean(opt.busy)}
              aria-busy={opt.busy || undefined}
              onClick={() => goCreate(opt.kind)}
            >
              <AppText
                as="span"
                className={`business-create-option__icon ${opt.sheetIconClass}`}
                aria-hidden
              >
                <Icon />
              </AppText>
              <AppText as="span" className="business-create-option__text">
                <AppText as="span" className="business-create-option__label">
                  {opt.title}
                </AppText>
                <AppText as="span" className="business-create-option__desc">
                  {opt.desc}
                </AppText>
              </AppText>
              <FaChevronRight className="business-create-option__arrow" aria-hidden />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`selector-options${className ? ` ${className}` : ''}`}>
      {options.map((opt) => {
        const Icon = opt.icon;
        return (
          <div
            key={opt.kind}
            className={`selector-card ${opt.className}`}
            onClick={() => goCreate(opt.kind)}
            role="button"
            tabIndex={0}
            aria-busy={opt.busy || undefined}
            style={opt.busy ? { opacity: 0.65, pointerEvents: 'none' } : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                goCreate(opt.kind);
              }
            }}
          >
            <div className="icon-wrapper">
              <Icon />
            </div>
            <div className="option-info">
              <AppText as="h4">{opt.title}</AppText>
              <AppText as="p">{opt.desc}</AppText>
            </div>
          </div>
        );
      })}
    </div>
  );
}
