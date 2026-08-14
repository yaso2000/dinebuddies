import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaEnvelope, FaExternalLinkAlt, FaFacebook, FaGlobe, FaInstagram, FaMapMarkerAlt, FaPhone, FaTwitter } from 'react-icons/fa';
import { AppText } from '../base';
import { BusinessSectionCard, EditActionBtn } from './BusinessProfileCardParts';
import PremiumBadge from '../PremiumBadge';
import BusinessLocationMap from '../BusinessLocationMap';
import { openExternalUrl } from '../../platform/externalLinks';
import { formatPhoneForDisplay, phoneNumberLtrStyle, phoneToTelHref } from '../../utils/phoneUtils';

export default function BusinessProfileContactTab({ profile }) {
  const { t } = useTranslation();
  const {
    activeTab,
    businessInfo,
    isOwner,
    openContactModal,
    tc,
    canClickExternalLinks,
    canOpenBusinessMapsAndDelivery,
    showGoogleImportedExtras,
    isPaid,
    hasMapCoords,
    hasSocialLinks,
    profileMapCoords,
  } = profile;

  if (activeTab !== 'contact') return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--profile-stack-gap)' }}>
            <BusinessSectionCard
      icon={<FaPhone />}
      title={t('contact_information', 'Contact Information')}
      actions={isOwner &&
      <>
          <PremiumBadge mode="pro" text={t('biz_plan_paid_name', 'Paid')} />
          <EditActionBtn tc={tc} onClick={openContactModal} />
        </>
      } />

            <div className="business-profile-contact-grid">
                {businessInfo.phone &&
      <div className="business-profile-contact-tile business-profile-contact-tile--clickable" onClick={() => {const tel = phoneToTelHref(businessInfo.phone);if (tel) window.location.href = `tel:${tel}`;}}>
                        <div className="business-profile-contact-tile__icon"><FaPhone /></div>
                        <div className="business-profile-contact-tile__body"><div className="business-profile-contact-tile__label">{t('phone', 'Phone')}</div><div className="business-profile-contact-tile__value" style={phoneNumberLtrStyle()} dir="ltr">{formatPhoneForDisplay(businessInfo.phone)}</div></div>
                    </div>
      }

                {businessInfo.email &&
      <div className="business-profile-contact-tile business-profile-contact-tile--clickable" onClick={() => window.location.href = `mailto:${businessInfo.email}`}>
                        <div className="business-profile-contact-tile__icon"><FaEnvelope /></div>
                        <div className="business-profile-contact-tile__body"><div className="business-profile-contact-tile__label">{t('email', 'Email')}</div><div className="business-profile-contact-tile__value">{businessInfo.email}</div></div>
                    </div>
      }

                {/* Website — Paid (clickable) or Google import (display only on Free) */}
                {(isPaid || showGoogleImportedExtras) && businessInfo.website &&
      <div
        onClick={
        canClickExternalLinks ?
        () =>
        window.open(
          businessInfo.website.startsWith('http') ?
          businessInfo.website :
          `https://${businessInfo.website}`,
          '_blank'
        ) :
        undefined
        }
        className={`business-profile-contact-tile${canClickExternalLinks ? ' business-profile-contact-tile--clickable' : ' business-profile-contact-tile--locked'}`}>

                            <div className="business-profile-contact-tile__icon"><FaGlobe /></div>
                            <div className="business-profile-contact-tile__body" style={{ flex: 1 }}><div className="business-profile-contact-tile__label">{t('btn_website', 'Website')}</div><div className="business-profile-contact-tile__value" style={{ wordBreak: 'break-all', whiteSpace: 'normal' }}>{businessInfo.website.replace(/^(https?:\/\/|\/\/)/, '')}</div></div>
                            {canClickExternalLinks ?
        <FaExternalLinkAlt style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }} /> :

        <AppText as="span" style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)' }} title={t('biz_plan_links_paid_to_open', 'Upgrade to open links')}>🔒</AppText>
        }
                        </div>
      }
            </div>

            {businessInfo.address &&
      <div className="business-profile-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                        <div className="business-profile-contact-tile__icon"><FaMapMarkerAlt /></div>
                        <div><div className="business-profile-contact-tile__label">{t('address', 'Address')}</div><div className="business-profile-contact-tile__value" style={{ whiteSpace: 'normal' }}>{businessInfo.address} {businessInfo.city && `, ${businessInfo.city}`}</div></div>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <BusinessLocationMap
          lat={businessInfo.lat ?? profileMapCoords?.lat}
          lng={businessInfo.lng ?? profileMapCoords?.lng}
          businessName={businessInfo.name || businessInfo.businessName}
          address={businessInfo.address}
          city={businessInfo.city}
          country={businessInfo.country}
          allowExternalLinks={canOpenBusinessMapsAndDelivery} />

                        {!canOpenBusinessMapsAndDelivery &&
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            pointerEvents: 'none',
            background: 'rgba(15,23,42,0.82)',
            backdropFilter: 'blur(6px)',
            padding: '8px 14px',
            borderRadius: '12px',
            color: 'white',
            fontWeight: 700,
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: '1px solid rgba(255,255,255,0.12)',
            whiteSpace: 'nowrap'
          }}
          aria-hidden>

                                        🔒 {t('biz_plan_map_view_only', 'Map preview only')}
                                    </div>
        }
                    </div>
                    {canOpenBusinessMapsAndDelivery && hasMapCoords &&
      <button type="button" onClick={() => {
        const addr = encodeURIComponent(
          businessInfo.address +
            (businessInfo.city ? ', ' + businessInfo.city : '') +
            (businessInfo.country ? ', ' + businessInfo.country : '')
        );
        openExternalUrl(
          `https://www.google.com/maps/search/?api=1&query=${addr}`,
          { allow: 'business_maps' }
        );
      }} style={{ width: '100%', padding: '16px', background: 'var(--brand-primary)', border: 'none', borderRadius: '16px', color: 'white', fontWeight: '800', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '20px', transition: 'all 0.2s' }} onMouseEnter={(e) => {e.currentTarget.style.transform = 'translateY(-2px)';e.currentTarget.style.boxShadow = '0 8px 24px color-mix(in srgb, var(--brand-primary) 30%, transparent)';}} onMouseLeave={(e) => {e.currentTarget.style.transform = 'translateY(0)';e.currentTarget.style.boxShadow = 'none';}}>
                            <FaMapMarkerAlt style={{ fontSize: '1.2rem' }} />
                            Open in Google Maps
                            <FaExternalLinkAlt style={{ fontSize: '0.9rem' }} />
                        </button>
      }
                </div>
      }

            {/* Social — Paid (clickable) or Google import (display only on Free) */}
            {(isPaid || showGoogleImportedExtras) && hasSocialLinks &&
      <div className="business-profile-card">
                    <AppText as="h4" style={{ fontSize: '1.1rem', fontWeight: '900', margin: '0 0 20px 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AppText as="span" style={{ fontSize: '1.3rem' }}>🌐</AppText> {t('follow_us', 'Follow Us')}
                        {!canClickExternalLinks &&
        <AppText as="span" style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', marginInlineStart: 'auto' }}>🔒</AppText>
        }
                    </AppText>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '16px' }}>
                        {businessInfo.instagram &&
        <button type="button" disabled={!canClickExternalLinks} onClick={canClickExternalLinks ? () => window.open(`https://instagram.com/${businessInfo.instagram.replace('@', '')}`, '_blank') : undefined} className={`business-profile-social-btn${canClickExternalLinks ? ' business-profile-social-btn--clickable' : ''}`} style={{ background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' }}>
                                <FaInstagram style={{ fontSize: '2rem' }} />
                                Instagram
                            </button>
        }
                        {businessInfo.twitter &&
        <button type="button" disabled={!canClickExternalLinks} onClick={canClickExternalLinks ? () => window.open(`https://twitter.com/${businessInfo.twitter.replace('@', '')}`, '_blank') : undefined} className={`business-profile-social-btn${canClickExternalLinks ? ' business-profile-social-btn--clickable' : ''}`} style={{ background: 'linear-gradient(135deg, #1DA1F2, #0d8bd9)' }}>
                                <FaTwitter style={{ fontSize: '2rem' }} />
                                Twitter
                            </button>
        }
                        {businessInfo.facebook &&
        <button type="button" disabled={!canClickExternalLinks} onClick={canClickExternalLinks ? () => window.open(businessInfo.facebook.startsWith('http') ? businessInfo.facebook : `https://facebook.com/${businessInfo.facebook}`, '_blank') : undefined} className={`business-profile-social-btn${canClickExternalLinks ? ' business-profile-social-btn--clickable' : ''}`} style={{ background: 'linear-gradient(135deg, #1877F2, #0d65d9)' }}>
                                <FaFacebook style={{ fontSize: '2rem' }} />
                                Facebook
                            </button>
        }
                    </div>
                </div>
      }
        </div>);

}
