import React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HiBuildingStorefront } from 'react-icons/hi2';
import { AppText } from '../components/base';
import { useBusinessProfile } from '../hooks/useBusinessProfile';
import DeliveryLinksSection from '../components/DeliveryLinksSection';
import BusinessProfileSeoHead from '../components/business/BusinessProfileSeoHead';
import BusinessProfileSetupBanner from '../components/business/BusinessProfileSetupBanner';
import BusinessProfileCardPreviewOverlay from '../components/business/BusinessProfileCardPreviewOverlay';
import BusinessProfileHero from '../components/business/BusinessProfileHero';
import BusinessProfileTabBar from '../components/business/BusinessProfileTabBar';
import BusinessProfileAboutTab from '../components/business/BusinessProfileAboutTab';
import BusinessProfileMenuTab from '../components/business/BusinessProfileMenuTab';
import BusinessProfileServicesTab from '../components/business/BusinessProfileServicesTab';
import BusinessProfileHoursTab from '../components/business/BusinessProfileHoursTab';
import BusinessProfileContactTab from '../components/business/BusinessProfileContactTab';
import BusinessProfileReviewModal from '../components/business/BusinessProfileReviewModal';
import BusinessProfileInfoModals from '../components/business/BusinessProfileInfoModals';
import BusinessProfileMiscModals from '../components/business/BusinessProfileMiscModals';
import './BusinessProfileHero.css';
import './BusinessProfile.css';

// Business profile page; route /business/:businessId (legacy /partner/:id redirects to /business/)
const BusinessProfile = () => {
  const { businessId, partnerId } = useParams();
  const profileId = businessId ?? partnerId;
  const { t } = useTranslation();
  const profile = useBusinessProfile(profileId);
  const { loading, publicProfileHidden, isOwner, business, navigate, tc, _s, _br, _ff, th } = profile;

  if (loading) {
    return (
      <div className="page-container" style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--bg-body)',
        padding: '2rem',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
                <div className="loader-ring"></div>
                <AppText as="p" style={{ marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600, textAlign: 'center', maxWidth: '300px', lineHeight: 1.45 }}>
                    {t('loading_business', 'Loading this profile…')}
                </AppText>
                <AppText as="p" style={{ marginTop: '10px', color: 'var(--text-muted)', fontSize: '0.8rem', opacity: 0.85, textAlign: 'center', maxWidth: '320px', lineHeight: 1.5 }}>
                    {t('loading_business_hint', 'This usually takes a moment.')}
                </AppText>
            </div>);

  }

  // OWNER BYPASS: Owners never see the "Hidden" screen.
  if (publicProfileHidden && !isOwner) {
    return (
      <div className="page-container" style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: 'var(--bg-body)',
        padding: '2rem',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        maxWidth: '420px',
        margin: '0 auto'
      }}>
                <HiBuildingStorefront style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: '1rem' }} />
                <AppText as="h1" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                    {t('business_profile_not_public_yet_title', 'Profile not available')}
                </AppText>
                <AppText as="p" style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.55, marginBottom: '1.5rem' }}>
                    {t(
            'business_profile_not_public_until_email',
            'This page is not shown to the public until the business verifies their email. The owner can still open and edit their profile from the business dashboard.'
          )}
                </AppText>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" className="ui-btn ui-btn--secondary" onClick={() => navigate('/')}>
                        {t('back_to_home', 'Back to Home')}
                    </button>
                    <button type="button" className="ui-btn ui-btn--primary" onClick={() => window.location.reload()}>
                        {t('retry', 'Retry')}
                    </button>
                </div>
            </div>);

  }

  if (!business) {
    return (
      <div className="page-container" style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--bg-body)',
        padding: '2rem',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
                <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {t('business_not_found', 'Business not found')}
                </AppText>
                <button
          type="button"
          className="ui-btn ui-btn--secondary"
          onClick={() => navigate('/')}
          style={{ marginTop: '20px' }}>

                    {t('back_to_home', 'Back to Home')}
                </button>
            </div>);

  }

  return (
    <div
      className="profile-shell page-container"
      style={{
        ...(tc?.accent ?
        {
          '--primary': tc.accent,
          '--brand-primary': tc.accent,
          '--primary-hover': _s || tc.accent
        } :
        {}),
        ...(_s ? { '--primary-dark': _s, '--brand-secondary': _s } : {}),
        '--brand-radius': _br,
        '--brand-font': _ff,
        paddingTop: '0',
        background: th(tc?.cardBg, undefined),
        fontFamily: 'var(--brand-font), sans-serif'
      }}>

            <BusinessProfileSeoHead profile={profile} />
            <BusinessProfileSetupBanner profile={profile} />
            <BusinessProfileCardPreviewOverlay profile={profile} />

            {/* --- Hero Design --- */}
            <BusinessProfileHero profile={profile} />

            {/* Delivery + tabs: unified vertical rhythm (same gap as profile sections) */}
            <div
        className="business-profile-nav-stack"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--profile-stack-gap)',
          marginTop: 'var(--profile-stack-gap)',
          marginBottom: 'var(--profile-stack-gap)'
        }}>

                <DeliveryLinksSection
          business={profile.business}
          isOwner={profile.isOwner}
          deliveryLinks={profile.deliveryLinks}
          tempDeliveryLinks={profile.tempDeliveryLinks}
          setTempDeliveryLinks={profile.setTempDeliveryLinks}
          editingDeliveryLinks={profile.editingDeliveryLinks}
          setEditingDeliveryLinks={profile.setEditingDeliveryLinks}
          onSave={profile.handleSaveDeliveryLinks}
          onCancel={profile.handleCancelDeliveryLinks} />


                {/* Tabs Navigation — scrollable on mobile */}
                <BusinessProfileTabBar profile={profile} />
            </div>

            {/* Content Area */}
            <div className="profile-content" style={{ padding: 'var(--profile-content-padding)' }}>
                <BusinessProfileAboutTab profile={profile} />
                <BusinessProfileMenuTab profile={profile} />
                <BusinessProfileServicesTab profile={profile} />
                <BusinessProfileHoursTab profile={profile} />
                <BusinessProfileContactTab profile={profile} />
            </div>

            <BusinessProfileReviewModal profile={profile} />
            <BusinessProfileInfoModals profile={profile} />
            <BusinessProfileMiscModals profile={profile} />
        </div>);

};

export default BusinessProfile;
