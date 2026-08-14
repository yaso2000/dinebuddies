import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaStar } from 'react-icons/fa';
import { AppText, AppTextInput } from '../base';

export default function BusinessProfileReviewModal({ profile }) {
  const { t } = useTranslation();
  const { showReviewModal, setShowReviewModal, newReview, setNewReview, submittingReview, handleSubmitReview, tc } = profile;

  if (!showReviewModal) return null;

  return (
    <div className="business-profile-modal-overlay" style={{
      background: 'rgba(0, 0, 0, 0.7)',
      zIndex: 1000
    }}>
            <div className="business-profile-modal-card" style={{
      padding: '2rem',
      maxWidth: '500px',
      boxShadow: tc ? tc.headerGlow : undefined
    }}>
                <AppText as="h2" style={{
        marginBottom: '1.5rem',
        fontSize: '1.5rem',
        fontWeight: '800',
        color: 'var(--text-main)',
        textShadow: 'none'
      }}>{t('write_review', 'Write a Review')}</AppText>

                {/* Rating Stars */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700' }}>
                        Rating
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[1, 2, 3, 4, 5].map((star) =>
        <FaStar
          key={star}
          onClick={() => setNewReview({ ...newReview, rating: star })}
          style={{
            fontSize: '2rem',
            color: star <= newReview.rating ? '#fbbf24' : '#4b5563',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'} />

        )}
                    </div>
                </div>

                {/* Comment */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label style={{ display: 'block', fontWeight: '700', margin: 0 }}>
                            Comment
                        </label>
                        <AppText as="span" style={{ fontSize: '0.75rem', color: (newReview.comment?.length || 0) >= 300 ? 'var(--secondary)' : 'var(--text-muted)' }}>
                            {newReview.comment?.length || 0}/300
                        </AppText>
                    </div>
                    <AppTextInput as="textarea"
      value={newReview.comment}
      onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
      placeholder={t('share_experience')}
      maxLength={300}
      style={{
        width: '100%',
        minHeight: '120px',
        padding: '12px',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        color: 'var(--text-main)',
        fontSize: '1rem',
        resize: 'vertical'
      }} />

                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
      type="button"
      className="ui-btn ui-btn--ghost"
      onClick={() => {
        setShowReviewModal(false);
        setNewReview({ rating: 5, comment: '' });
      }}
      style={{ flex: 1, padding: '12px' }}>
      {t('cancel', 'Cancel')}</button>

                    <button
      onClick={handleSubmitReview}
      disabled={submittingReview}
      style={{
        flex: 1,
        padding: '12px',
        background: submittingReview ? '#6b7280' : 'var(--brand-primary)',
        border: 'none',
        borderRadius: '12px',
        color: 'var(--text-on-brand)',
        fontWeight: '800',
        cursor: submittingReview ? 'not-allowed' : 'pointer',
        opacity: submittingReview ? 0.6 : 1
      }}>

                        {submittingReview ? t('submitting_review') : t('submit_review')}
                    </button>
                </div>
            </div>
        </div>);

}
