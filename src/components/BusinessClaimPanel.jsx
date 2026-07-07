import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FaStore, FaEnvelope, FaTimes } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { BusinessPhoneFields } from './BusinessSignup';
import { finalizeBusinessSignup } from '../services/businessPhoneSignupApi';
import { useToast } from '../context/ToastContext';
import { AppText, AppTextInput } from "./base";

const CLAIM_BTN_GREEN = {
  background: 'linear-gradient(135deg, #4ade80 0%, #16a34a 55%, #15803d 100%)',
  border: '2px solid #bbf7d0',
  color: '#052e16',
  boxShadow: '0 6px 22px rgba(34, 197, 94, 0.55), inset 0 1px 0 rgba(255,255,255,0.35)'
};

const HERO_CLAIM_BTN = {
  ...CLAIM_BTN_GREEN,
  height: '48px',
  minHeight: '48px',
  padding: '0 20px',
  borderRadius: '24px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '10px',
  fontSize: '0.9rem',
  fontWeight: 900,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  letterSpacing: '0.02em',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
};

/**
 * Claim CTA for unclaimed `restaurants/{id}` admin imports (phone OTP + ownership transaction).
 * @param {{ restaurantId: string; businessName?: string; businessPhoneE164?: string; variant?: 'default' | 'hero' }} props
 */
export default function BusinessClaimPanel({ restaurantId, businessName, businessPhoneE164 = '', variant = 'default' }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [phoneVerification, setPhoneVerification] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleClaimSubmit = async (e) => {
    e.preventDefault();
    if (!phoneVerification?.idToken || !email.trim()) return;
    setSubmitting(true);
    try {
      const { ok, data } = await finalizeBusinessSignup(
        {
          standardizedPhone: phoneVerification.standardizedPhone,
          email: email.trim().toLowerCase(),
          claimBusinessId: restaurantId,
          businessId: restaurantId
        },
        phoneVerification.idToken
      );
      if (!ok) {
        showToast(data?.message || t('claim_business_failed', 'Could not claim this business'), 'error');
        return;
      }
      showToast(t('claim_business_success', 'Business claimed successfully'), 'success');
      setOpen(false);
      navigate(`/business/${data.uid || phoneVerification.firebaseUid}`, { replace: true });
    } catch (err) {
      showToast(err?.message || t('claim_business_failed', 'Could not claim this business'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const isHero = variant === 'hero';

  const modal =
  open &&
  createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-business-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50000,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={() => !submitting && setOpen(false)}>
      
                <div
        style={{
          position: 'relative',
          zIndex: 50001,
          width: '100%',
          maxWidth: 480,
          background: 'var(--bg-card, #1a1a1a)',
          borderRadius: 16,
          border: '1px solid var(--border-color)',
          padding: '1.25rem',
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)'
        }}
        onClick={(ev) => ev.stopPropagation()}>
        
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <AppText as="h2" id="claim-business-title" style={{ margin: 0, fontSize: '1.1rem' }}>
                            {t('claim_business_request', 'Claim Business')}
                        </AppText>
                        <button
            type="button"
            aria-label={t('close', 'Close')}
            onClick={() => !submitting && setOpen(false)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            
                            <FaTimes />
                        </button>
                    </div>
                    {businessName &&
        <AppText as="p" style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            {t('claim_business_for', { name: businessName, defaultValue: 'Claim {{name}}' })}
                        </AppText>
        }
                    <AppText as="p" style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {t(
            'claim_business_phone_locked_hint',
            'Verify the Google Maps phone number for this business via SMS. The number cannot be changed.'
          )}
                    </AppText>

                    <BusinessPhoneFields
          lockedPhoneE164={businessPhoneE164}
          lockFieldsAfterSend={false}
          onVerified={(payload) => setPhoneVerification(payload)} />
        

                    <form onSubmit={handleClaimSubmit} style={{ marginTop: '1rem' }}>
                        <label
            style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '0.35rem'
            }}>
            
                            <FaEnvelope style={{ marginInlineEnd: 6 }} />
                            {t('email', 'Email')}
                        </label>
                        <AppTextInput
            type="email"
            required
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            disabled={!phoneVerification || submitting}
            style={{
              width: '100%',
              padding: '0.65rem',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-body)',
              color: 'var(--text-primary)'
            }} />
          
                        <button
            type="submit"
            disabled={!phoneVerification || !email.trim() || submitting}
            style={{
              marginTop: '1rem',
              width: '100%',
              minHeight: '48px',
              padding: '12px 16px',
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: '1rem',
              cursor:
              !phoneVerification || !email.trim() || submitting ?
              'not-allowed' :
              'pointer',
              opacity: !phoneVerification || !email.trim() || submitting ? 0.55 : 1,
              ...CLAIM_BTN_GREEN
            }}>
            
                            {submitting ?
            t('claim_business_submitting', 'Claiming…') :
            t('claim_business_confirm', 'Confirm claim')}
                        </button>
                    </form>
                </div>
            </div>,
    document.body
  );

  return (
    <>
            <button
        type="button"
        style={
        isHero ?
        HERO_CLAIM_BTN :
        {
          marginTop: '1rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          minHeight: '48px',
          padding: '12px 20px',
          borderRadius: '14px',
          fontWeight: 800,
          fontSize: '0.95rem',
          cursor: 'pointer',
          ...CLAIM_BTN_GREEN
        }
        }
        onClick={() => setOpen(true)}
        onMouseEnter={(e) => {
          if (isHero) {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow =
            '0 8px 28px rgba(34, 197, 94, 0.65), inset 0 1px 0 rgba(255,255,255,0.35)';
          }
        }}
        onMouseLeave={(e) => {
          if (isHero) {
            e.currentTarget.style.transform = '';
            e.currentTarget.style.boxShadow = HERO_CLAIM_BTN.boxShadow;
          }
        }}>
        
                <FaStore aria-hidden />
                {t('claim_business_request', 'Claim Business')}
            </button>
            {modal}
        </>);

}