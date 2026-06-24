import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaChevronLeft, FaGlobe, FaLock, FaHeart } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { blockPublicInviteFromBusinessVenue } from '../utils/publicInviteVenueGate';
import '../components/CreateInvitationSelector.css';

/**
 * Full-page entry (e.g. deep link from directory with restaurant prefill).
 * Pick invitation type → navigate to the classic create form.
 */import { AppText } from "../components/base";
const CreateInvitationManualHub = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { cannotCreateInvitations } = useAuth();
  const { canCreateSocialInvitation } = useInvitations();
  const [publicGateChecking, setPublicGateChecking] = useState(false);

  const passthrough =
  location.state && typeof location.state === 'object' ? { ...location.state } : {};

  useEffect(() => {
    if (cannotCreateInvitations) {
      showToast(
        t('business_cannot_create_invitation'),
        'error'
      );
      navigate('/', { replace: true });
    }
  }, [cannotCreateInvitations, navigate, showToast, t]);

  const goCreate = async (kind) => {
    if (cannotCreateInvitations || !kind) return;
    if (kind === 'public') {
      if (publicGateChecking) return;
      if (passthrough.restaurantData) {
        setPublicGateChecking(true);
        try {
          const blocked = await blockPublicInviteFromBusinessVenue({
            restaurantData: passthrough.restaurantData,
            showToast,
            t
          });
          if (blocked) return;
        } finally {
          setPublicGateChecking(false);
        }
      }
      navigate('/create', { state: passthrough });
      return;
    }
    if (kind === 'social') {
      const quotaInfo = canCreateSocialInvitation('social');
      if (!quotaInfo.profileLoading && !quotaInfo.canCreate) {
        showToast(
          t(
            'insufficient_dine_credits_wallet',
            'Not enough Dine Credits. Open Settings → Dine Credits to top up.'
          ),
          'error'
        );
        navigate('/settings/credits');
        return;
      }
      navigate('/create-social', { state: passthrough });
      return;
    }
    if (kind === 'private' || kind === 'dating') {
      const quotaInfo = canCreateSocialInvitation('private');
      if (!quotaInfo.profileLoading && !quotaInfo.canCreate) {
        showToast(
          t(
            'insufficient_dine_credits_wallet',
            'Not enough Dine Credits. Open Settings → Dine Credits to top up.'
          ),
          'error'
        );
        navigate('/settings/credits');
        return;
      }
      navigate('/create-private', { state: passthrough });
    }
  };

  return (
    <div className="page-container form-page" style={{ padding: '1rem', maxWidth: 520, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button
          type="button"
          className="back-btn"
          onClick={() => navigate(-1)}
          aria-label={t('go_back')}
          style={{ flexShrink: 0 }}>

                    <FaChevronLeft style={{ transform: i18n.dir() === 'rtl' ? 'rotate(180deg)' : undefined }} />
                </button>
                <div style={{ minWidth: 0 }}>
                    <AppText as="h1" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {t('invite_create_title', 'Create invitation')}
                    </AppText>
                    <AppText as="p" style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                        {t(
              'invite_create_subtitle',
              'Choose the type of invitation you want to create.'
            )}
                    </AppText>
                </div>
            </div>

            <div className="selector-options" style={{ maxWidth: 450, margin: '0 auto' }}>
                <div
          className="selector-card public"
          onClick={() => goCreate('public')}
          role="button"
          tabIndex={0}
          aria-busy={publicGateChecking}
          style={publicGateChecking ? { opacity: 0.65, pointerEvents: 'none' } : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              goCreate('public');
            }
          }}>

                    <div className="icon-wrapper">
                        <FaGlobe />
                    </div>
                    <div className="option-info">
                        <AppText as="h4">
                            {publicGateChecking ?
              t('detecting_location', 'Detecting location…') :
              t('invite_create_public_title', 'Public invitation')}
                        </AppText>
                        <AppText as="p">
                            {t(
                'invite_create_public_desc',
                'A discoverable invitation others can browse and join.'
              )}
                        </AppText>
                    </div>
                </div>
                <div
          className="selector-card social"
          onClick={() => goCreate('social')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              goCreate('social');
            }
          }}>

                    <div className="icon-wrapper">
                        <FaLock />
                    </div>
                    <div className="option-info">
                        <AppText as="h4">{t('invite_create_social_title', 'Social Invite')}</AppText>
                        <AppText as="p">
                            {t(
                'invite_create_social_desc',
                'Invite specific guests with a private link.'
              )}
                        </AppText>
                    </div>
                </div>
                <div
          className="selector-card personal"
          onClick={() => goCreate('private')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              goCreate('private');
            }
          }}>

                    <div className="icon-wrapper">
                        <FaHeart />
                    </div>
                    <div className="option-info">
                        <AppText as="h4">{t('invite_create_private_title', 'Personal Invite')}</AppText>
                        <AppText as="p">
                            {t(
                'invite_create_private_desc',
                'A private-style invitation for matched dining.'
              )}
                        </AppText>
                    </div>
                </div>
            </div>
        </div>);

};

export default CreateInvitationManualHub;