import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaFacebook, FaGlobe, FaInstagram, FaTwitter } from 'react-icons/fa';
import { SiTiktok } from 'react-icons/si';
import { AppText, AppTextInput } from '../base';
import { BUSINESS_TYPES } from '../../hooks/useBusinessProfile';

export default function BusinessProfileInfoModals({ profile }) {
  const { t } = useTranslation();
  const {
    showBasicInfoModal,
    setShowBasicInfoModal,
    basicInfoForm,
    setBasicInfoForm,
    savingInfo,
    saveBasicInfo,
    showContactModal,
    setShowContactModal,
    contactForm,
    setContactForm,
    saveContact,
    proFieldsNotice,
    setProFieldsNotice,
    navigate,
  } = profile;

  return (
    <>
            {/* Basic Info Modal */}
            {
    showBasicInfoModal &&
    <div className="business-profile-modal-overlay" style={{ zIndex: 3000 }}>
                    <div className="business-profile-modal-card" style={{ padding: '1.5rem', maxWidth: '460px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <AppText as="h3" style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>✏️ Edit Basic Info</AppText>
                            <button onClick={() => setShowBasicInfoModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
                        </div>
                        {[
      { label: t('business_name_label'), key: 'businessName', type: 'text' },
      { label: t('tagline_label'), key: 'tagline', type: 'text' }].
      map(({ label, key, type }) =>
      <div key={key} style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-main)' }}>{label}</label>
                                <AppTextInput type={type} value={basicInfoForm[key]} onChange={(e) => setBasicInfoForm((p) => ({ ...p, [key]: e.target.value }))}
        style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-main)', fontSize: '0.9rem' }} />
                            </div>
      )}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-main)' }}>{t('business_type_label')}</label>
                            <select
        value={BUSINESS_TYPES.includes(basicInfoForm.businessType) ? basicInfoForm.businessType : 'Restaurant'}
        onChange={(e) => setBasicInfoForm((p) => ({ ...p, businessType: e.target.value }))}
        style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-main)', fontSize: '0.9rem', appearance: 'none' }}>

                                {BUSINESS_TYPES.map((type) =>
        <option key={type} value={type}>{type}</option>
        )}
                            </select>
                        </div>
                        {/* Cuisine Type — restaurants only */}
                        {basicInfoForm.businessType === 'Restaurant' &&
      <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-main)' }}>🍽️ Cuisine Type</label>
                                <select
        value={basicInfoForm.cuisineType || ''}
        onChange={(e) => setBasicInfoForm((p) => ({ ...p, cuisineType: e.target.value }))}
        style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '10px', color: basicInfoForm.cuisineType ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '0.9rem', appearance: 'none' }}>

                                    <option value="">{t('business_select_cuisine_type', 'Select cuisine type…')}</option>
                                    {['Italian', 'Asian', 'Chinese', 'Japanese', 'Indian', 'Lebanese', 'Mexican', 'Greek', 'Thai', 'Vietnamese', 'Korean', 'Turkish', 'French', 'Spanish', 'American', 'Australian', 'Middle Eastern', 'Mediterranean', 'Seafood', 'Steakhouse', 'Vegetarian', 'Vegan', 'Other'].map((type) =>
        <option key={type} value={type}>{type}</option>
        )}
                                </select>
                            </div>
      }
                        <div style={{ marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <label style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-main)', margin: 0 }}>{t('description', 'Description')}</label>
                                <AppText as="span" style={{ fontSize: '0.75rem', color: (basicInfoForm.description?.length || 0) >= 300 ? 'var(--secondary)' : 'var(--text-muted)' }}>
                                    {basicInfoForm.description?.length || 0}/300
                                </AppText>
                            </div>
                            <AppTextInput as="textarea" rows={4} value={basicInfoForm.description} onChange={(e) => setBasicInfoForm((p) => ({ ...p, description: e.target.value }))}
      maxLength={300}
      style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-main)', fontSize: '0.9rem', resize: 'vertical' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={() => setShowBasicInfoModal(false)} style={{ flex: 1, padding: '10px', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '600' }}>{t('cancel_btn')}</button>
                            <button onClick={saveBasicInfo} disabled={savingInfo} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6, #f97316)', color: 'white', cursor: 'pointer', fontWeight: '700' }}>
                                {savingInfo ? `💾 ${t('save_pending')}` : `💾 ${t('save_btn')}`}
                            </button>
                        </div>
                    </div>
                </div>

    }

            {/* Contact Modal */}
            {
    showContactModal &&
    <div className="business-profile-modal-overlay" style={{ zIndex: 3000 }}>
                    <div className="business-profile-modal-card" style={{ padding: '1.5rem', maxWidth: '460px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <AppText as="h3" style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>📞 Edit Contact</AppText>
                            <button onClick={() => setShowContactModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
                        </div>
                        {/* Free Fields Section Header */}
                        <div style={{ margin: '0 0 0.8rem', padding: '0.5rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AppText as="span" style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('business_basic_info_section', 'Basic info')}</AppText>
                            <AppText as="span" style={{ border: '1px solid #22c55e', borderRadius: '5px', padding: '1px 6px', fontSize: '0.65rem', fontWeight: '800', color: '#4ade80', background: 'rgba(34,197,94,0.12)' }}>🆓 Free</AppText>
                        </div>
                        {[
      { label: '📞 Phone', key: 'phone', placeholder: '+61 400 000 000' },
      { label: '✉️ Email', key: 'email', placeholder: 'info@yourbusiness.com' },
      { label: '📍 Address', key: 'address', placeholder: '123 Main St' },
      { label: `🏙️ ${t('city_label')}`, key: 'city', placeholder: 'Sydney' }].
      map(({ label, key, placeholder }) =>
      <div key={key} style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem' }}>{label}</label>
                                <AppTextInput type="text" value={contactForm[key]} placeholder={placeholder} onChange={(e) => setContactForm((p) => ({ ...p, [key]: e.target.value }))}
        style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-main)', fontSize: '0.9rem' }} />
                            </div>
      )}
                        {/* Pro Features — Website & Social Media */}
                        <div style={{ margin: '1.2rem 0 0.8rem', padding: '0.6rem 0 0.6rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AppText as="span" style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('biz_plan_paid_features', 'Paid features')}</AppText>
                            <AppText as="span" style={{ border: '1px solid #f59e0b', borderRadius: '5px', padding: '1px 6px', fontSize: '0.65rem', fontWeight: '800', color: '#fbbf24', background: 'rgba(245,158,11,0.12)' }}>👑 {t('biz_plan_paid_name', 'Paid')}</AppText>
                        </div>
                        {[
      { icon: <FaGlobe color="#8b5cf6" />, label: t('website_label'), key: 'website', placeholder: 'https://yourbusiness.com' },
      { icon: <FaInstagram color="#E1306C" />, label: t('instagram_label'), key: 'instagram', placeholder: '@yourbusiness' },
      { icon: <FaFacebook color="#1877F2" />, label: t('facebook_label'), key: 'facebook', placeholder: 'facebook.com/yourbusiness' },
      { icon: <FaTwitter color="#1DA1F2" />, label: t('twitter_label'), key: 'twitter', placeholder: '@yourbusiness' },
      { icon: <SiTiktok color="#fff" />, label: t('tiktok_label'), key: 'tiktok', placeholder: '@yourbusiness' }].
      map(({ icon, label, key, placeholder }) =>
      <div key={key} style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem' }}>{icon} {label}</label>
                                <AppTextInput type="text" value={contactForm[key] || ''} placeholder={placeholder} onChange={(e) => setContactForm((p) => ({ ...p, [key]: e.target.value }))}
        style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-main)', fontSize: '0.9rem' }} />
                            </div>
      )}
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                            <button onClick={() => setShowContactModal(false)} style={{ flex: 1, padding: '10px', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '600' }}>{t('cancel_btn')}</button>
                            <button onClick={saveContact} disabled={savingInfo} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6, #f97316)', color: 'white', cursor: 'pointer', fontWeight: '700' }}>
                                {savingInfo ? `💾 ${t('save_pending')}` : `💾 ${t('save_btn')}`}
                            </button>
                        </div>
                    </div>
                </div>

    }
            {/* Pro Fields Upgrade Notice */}
            {
    proFieldsNotice &&
    <div className="business-profile-modal-overlay" style={{ background: 'rgba(0,0,0,0.88)', zIndex: 4000 }}>
                    <div className="business-profile-modal-card" style={{ padding: '2rem', maxWidth: '420px', border: '1px solid rgba(245,158,11,0.3)', boxShadow: '0 0 40px rgba(245,158,11,0.15)', textAlign: 'center' }}>
                        {/* Icon */}
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#000', border: '2px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 1rem' }}>👑</div>
                        <AppText as="h3" style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: '900', color: 'var(--text-primary)' }}>{t('business_info_saved_title', 'Information saved!')}</AppText>
                        <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 0 1.2rem', lineHeight: 1.6 }}>
                            {t('business_pro_fields_notice', 'The following fields require a Pro plan to be visible to visitors:')}
                        </AppText>
                        {/* Fields list */}
                        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '14px', padding: '1rem', marginBottom: '1.2rem', textAlign: 'left' }}>
                            {proFieldsNotice.map((field) =>
      <div key={field} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.9rem' }}>
                                    <AppText as="span" style={{ color: '#f59e0b' }}>•</AppText> {field}
                                </div>
      )}
                        </div>
                        <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 1.5rem' }}>
                            {t('business_pro_fields_saved_hint', 'Your data is saved and will become visible once you upgrade.')}
                        </AppText>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setProFieldsNotice(null)} style={{ flex: 1, padding: '11px', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>
                                {t('got_it', 'Got it')}
                            </button>
                            <button onClick={() => {setProFieldsNotice(null);navigate('/settings/subscription');}} style={{ flex: 1, padding: '11px', border: 'none', borderRadius: '12px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', cursor: 'pointer', fontWeight: '800', fontSize: '0.9rem' }}>
                                ⚡ {t('business_upgrade_to_pro', 'Upgrade to Pro')}
                            </button>
                        </div>
                    </div>
                </div>

    }
        </>);

}
