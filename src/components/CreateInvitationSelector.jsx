import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaGlobe, FaLock, FaTimes } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import './CreateInvitationSelector.css';

const CreateInvitationSelector = ({ isOpen, onClose, navigationState }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const { canCreatePrivateInvitation } = useInvitations();

    if (!isOpen) return null;

    const handleSelect = (type) => {
        if (type === 'public') {
            navigate('/create', { state: navigationState });
        } else {
            const quotaInfo = canCreatePrivateInvitation();
            if (quotaInfo.canCreate) {
                navigate('/create-private', { state: navigationState });
            } else {
                alert(t('insufficient_private_credits', 'Sorry, you have used all your private invitation credits. Upgrade to get more.'));
                navigate('/pricing');
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
                            <h4>{t('create_public_invitation')}</h4>
                            <p>{t('public_invitation_desc')}</p>
                        </div>
                    </div>

                    <div className="selector-card private" onClick={() => handleSelect('private')}>
                        <div className="icon-wrapper">
                            <FaLock />
                        </div>
                        <div className="option-info">
                            <h4>{t('create_private_invitation')}</h4>
                            <p>{t('private_invitation_desc')}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateInvitationSelector;
