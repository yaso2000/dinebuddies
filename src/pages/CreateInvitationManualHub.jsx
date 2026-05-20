import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaChevronLeft, FaGlobe, FaLock, FaHeart } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import '../components/CreateInvitationSelector.css';

/**
 * Full-page entry (e.g. deep link from directory with restaurant prefill).
 * Pick invitation type → navigate to the classic create form.
 */
const CreateInvitationManualHub = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToast();
    const { isBusiness } = useAuth();
    const { canCreatePrivateInvitation } = useInvitations();

    const passthrough =
        location.state && typeof location.state === 'object' ? { ...location.state } : {};

    useEffect(() => {
        if (isBusiness) {
            showToast(
                t('business_cannot_create_invitation', 'Business accounts cannot create or publish invitations.'),
                'error'
            );
            navigate('/', { replace: true });
        }
    }, [isBusiness, navigate, showToast, t]);

    const goCreate = (kind) => {
        if (isBusiness || !kind) return;
        if (kind === 'public') {
            navigate('/create', { state: passthrough });
            return;
        }
        if (kind === 'private') {
            const quotaInfo = canCreatePrivateInvitation('private');
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
            return;
        }
        if (kind === 'dating') {
            const quotaInfo = canCreatePrivateInvitation('dating');
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
            navigate('/create-dating', { state: passthrough });
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
                    style={{ flexShrink: 0 }}
                >
                    <FaChevronLeft style={{ transform: i18n.dir() === 'rtl' ? 'rotate(180deg)' : undefined }} />
                </button>
                <div style={{ minWidth: 0 }}>
                    <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {t('invite_create_title', 'Create invitation')}
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                        {t(
                            'invite_create_subtitle',
                            'Choose the type of invitation you want to create.'
                        )}
                    </p>
                </div>
            </div>

            <div className="selector-options" style={{ maxWidth: 450, margin: '0 auto' }}>
                <div
                    className="selector-card public"
                    onClick={() => goCreate('public')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            goCreate('public');
                        }
                    }}
                >
                    <div className="icon-wrapper">
                        <FaGlobe />
                    </div>
                    <div className="option-info">
                        <h4>{t('invite_create_public_title', 'Public invitation')}</h4>
                        <p>
                            {t(
                                'invite_create_public_desc',
                                'A discoverable invitation others can browse and join.'
                            )}
                        </p>
                    </div>
                </div>
                <div
                    className="selector-card private"
                    onClick={() => goCreate('private')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            goCreate('private');
                        }
                    }}
                >
                    <div className="icon-wrapper">
                        <FaLock />
                    </div>
                    <div className="option-info">
                        <h4>{t('invite_create_private_title', 'Private invitation')}</h4>
                        <p>
                            {t(
                                'invite_create_private_desc',
                                'Invite specific guests with a private link.'
                            )}
                        </p>
                    </div>
                </div>
                <div
                    className="selector-card dating"
                    onClick={() => goCreate('dating')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            goCreate('dating');
                        }
                    }}
                >
                    <div className="icon-wrapper">
                        <FaHeart />
                    </div>
                    <div className="option-info">
                        <h4>{t('invite_create_dating_title', 'Dating invitation')}</h4>
                        <p>
                            {t(
                                'invite_create_dating_desc',
                                'A dating-style invitation for matched dining.'
                            )}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateInvitationManualHub;
