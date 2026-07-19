import React, { useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { FaChevronLeft } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import {
  resolveHostInvitationNavigationState,
} from '../utils/hostInvitationFromBusiness';
import InviteCreateTypePicker, { inviteCreateTypeSubtitle } from '../components/InviteCreateTypePicker';
import '../components/CreateInvitationSelector.css';
import { AppText } from '../components/base';

/**
 * Full-page entry (e.g. deep link from directory with restaurant prefill).
 * Pick invitation type → navigate to the create form.
 */
const CreateInvitationManualHub = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const { cannotCreateInvitations } = useAuth();
  const { restaurants } = useInvitations();

  const passthrough = useMemo(
    () =>
      resolveHostInvitationNavigationState({
        locationState: location.state,
        businessId: searchParams.get('businessId'),
        restaurants,
      }),
    [location.state, restaurants, searchParams]
  );

  useEffect(() => {
    if (cannotCreateInvitations) {
      showToast(t('business_cannot_create_invitation'), 'error');
      navigate('/', { replace: true });
    }
  }, [cannotCreateInvitations, navigate, showToast, t]);

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
          <AppText as="h1" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {t('invite_create_title')}
          </AppText>
          <AppText as="p" style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            {inviteCreateTypeSubtitle(t, passthrough?.restaurantData?.name)}
          </AppText>
        </div>
      </div>

      <div style={{ maxWidth: 450, margin: '0 auto' }}>
        <InviteCreateTypePicker
          variant="selector"
          navigationState={location.state}
          businessId={searchParams.get('businessId')}
        />
      </div>
    </div>
  );
};

export default CreateInvitationManualHub;
