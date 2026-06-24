import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTimes, FaGlobe, FaLock, FaHeart } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useInvitations } from '../context/InvitationContext';
import { blockPublicInviteFromBusinessVenue } from '../utils/publicInviteVenueGate';
import './CreateInvitationSelector.css';
import { AppText } from "./base";

const CreateInvitationSelector = ({ isOpen, onClose, navigationState }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { cannotCreateInvitations } = useAuth();
  const { canCreateSocialInvitation } = useInvitations();
  const [publicGateChecking, setPublicGateChecking] = useState(false);

  if (!isOpen) return null;

  const baseState =
  navigationState && typeof navigationState === 'object' ? { ...navigationState } : {};

  const handleClose = () => {
    onClose();
  };

  const goCreate = async (kind) => {
    if (cannotCreateInvitations) {
      showToast(
        t('business_cannot_create_invitation'),
        'error'
      );
      handleClose();
      return;
    }
    if (kind === 'public') {
      if (publicGateChecking) return;
      if (baseState.restaurantData) {
        setPublicGateChecking(true);
        try {
          const blocked = await blockPublicInviteFromBusinessVenue({
            restaurantData: baseState.restaurantData,
            showToast,
            t
          });
          if (blocked) return;
        } finally {
          setPublicGateChecking(false);
        }
      }
      navigate('/create', { state: baseState });
      handleClose();
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
        handleClose();
        return;
      }
      navigate('/create-social', { state: baseState });
      handleClose();
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
        handleClose();
        return;
      }
      navigate('/create-private', { state: baseState });
      handleClose();
    }
  };

  return (
    <div className="selector-overlay" onClick={handleClose}>
            <div className="selector-content" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="close-btn" onClick={handleClose}>
                    <FaTimes />
                </button>

                <AppText as="h3" className="selector-title">{t('invite_create_title', 'Create invitation')}</AppText>
                <AppText as="p" className="selector-subtitle">
                    {t(
            'invite_create_subtitle',
            'Choose the type of invitation you want to create.'
          )}
                </AppText>

                <div className="selector-options">
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
            </div>
        </div>);

};

export default CreateInvitationSelector;