import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaGlobe, FaLock, FaHeart, FaTimes } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import './CreateInvitationSelector.css';

const CreateInvitationSelector = ({ isOpen, onClose, navigationState }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { isBusiness } = useAuth();

    const { canCreatePrivateInvitation } = useInvitations();

    if (!isOpen) return null;

    const handleSelect = (type) => {
        if (isBusiness) {
            showToast(t('business_cannot_create_invitation', 'Business accounts cannot create or publish invitations.'), 'error');
            onClose();
            return;
        }
        if (type === 'public') {
            navigate('/create', { state: navigationState });
        } else if (type === 'private') {
            const quotaInfo = canCreatePrivateInvitation('private');
            if (quotaInfo.canCreate) {
                navigate('/create-private', { state: navigationState });
            } else {
                showToast(
                    t(
                        'insufficient_dine_credits_wallet',
                        'Not enough Dine Credits. Open Settings → Dine Credits to top up.'
                    ),
                    'error'
                );
                navigate('/settings/credits');
            }
        } else if (type === 'dating') {
            const quotaInfo = canCreatePrivateInvitation('dating');
            if (quotaInfo.canCreate) {
                navigate('/create-dating', { state: navigationState });
            } else {
                showToast(
                    t(
                        'insufficient_dine_credits_wallet',
                        'Not enough Dine Credits. Open Settings → Dine Credits to top up.'
                    ),
                    'error'
                );
                navigate('/settings/credits');
            }
        }
        onClose();
    };

    return (
        <div className="selector-overlay" onClick={onClose}>
            <div className="selector-content" onClick={e => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose}>
                    <FaTimes />
                </button>

                <h3 className="selector-title">{t('select_invitation_type')}</h3>
                <p className="selector-subtitle">{t('choose_invitation_type_to_continue', 'Choose invitation type to continue')}</p>

                <div className="selector-options">
                    <div className="selector-card public" onClick={() => handleSelect('public')}>
                        <div className="icon-wrapper">
                            <FaGlobe />
                        </div>
                        <div className="option-info">
                            <h4>{t('dinebuddy_open', 'DineBuddy Open')}</h4>
                            <p>{t('public_invitation_desc', 'Open to everyone — find new dining companions')}</p>
                        </div>
                    </div>

                    <div className="selector-card private" onClick={() => handleSelect('private')}>
                        <div className="icon-wrapper">
                            <FaLock />
                        </div>
                        <div className="option-info">
                            <h4>{t('dinebuddy_private', 'DineBuddy Private')}</h4>
                            <p>{t('private_invitation_desc', 'Invite specific friends for an exclusive gathering')}</p>
                        </div>
                    </div>

                    <div className="selector-card dating" onClick={() => handleSelect('dating')}>
                        <div className="icon-wrapper">
                            <FaHeart />
                        </div>
                        <div className="option-info">
                            <h4>{t('dinebuddy_date', 'DineBuddy Date')}</h4>
                            <p>{t('dating_invitation_selector_desc', 'Send an exclusive private date to someone special')}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateInvitationSelector;


