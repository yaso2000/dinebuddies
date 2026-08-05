import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaStar, FaRegStar, FaEdit, FaReply, FaFilter, FaSortAmountDown, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { useToast } from '../context/ToastContext';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase/config';
import './EnhancedReviews.css';
import { AppText, AppTextInput } from "./base";

const REVIEWS_PER_PAGE = 5;
const SORT_OPTIONS = [
{ id: 'recent', label: 'Most Recent' },
{ id: 'highest', label: 'Highest Rating' },
{ id: 'lowest', label: 'Lowest Rating' }];


const EnhancedReviews = ({
  reviews,
  partnerId,
  isOwner,
  currentUser,
  userProfile,
  onWriteReview,
  averageRating,
  theme
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const tc = theme?.colors || null;
  const th = (themed, fallback) => tc ? themed : fallback;
  const [showAll, setShowAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('recent');
  const [filterRating, setFilterRating] = useState(0);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Calculate rating distribution
  const getRatingDistribution = () => {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((review) => {
      distribution[review.rating] = (distribution[review.rating] || 0) + 1;
    });
    return distribution;
  };

  const distribution = getRatingDistribution();
  const totalReviews = reviews.length;

  // Filter and sort reviews
  const getFilteredAndSortedReviews = () => {
    let filtered = [...reviews];

    // Filter by rating
    if (filterRating > 0) {
      filtered = filtered.filter((r) => r.rating === filterRating);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
        case 'highest':
          return b.rating - a.rating;
        case 'lowest':
          return a.rating - b.rating;
        default:
          return 0;
      }
    });

    return filtered;
  };

  const filteredReviews = getFilteredAndSortedReviews();
  const totalPages = Math.ceil(filteredReviews.length / REVIEWS_PER_PAGE);
  const displayedReviews = showAll ?
  filteredReviews.slice((currentPage - 1) * REVIEWS_PER_PAGE, currentPage * REVIEWS_PER_PAGE) :
  filteredReviews.slice(0, 3);

  const handleReply = async (reviewId) => {
    if (!replyText.trim() || !isOwner) return;

    try {
      setSubmittingReply(true);

      const reviewIndex = reviews.findIndex((r) => r.id === reviewId);
      if (reviewIndex === -1) return;

      const updatedReviews = [...reviews];
      updatedReviews[reviewIndex].businessReply = {
        text: replyText.trim(),
        repliedAt: new Date().toISOString(),
        repliedBy: currentUser.displayName || 'Business Owner'
      };

      // Update in Firestore (assuming reviews are stored in a subcollection)
      // You'll need to adjust this based on your actual data structure

      setReplyText('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Error posting reply:', error);
      showToast(t('review_reply_failed', 'Failed to post reply'), 'error');
    } finally {
      setSubmittingReply(false);
    }
  };

  const renderStars = (rating) => {
    const starCol = 'var(--stat-reviews)';
    return (
      <div className="stars">
                {[1, 2, 3, 4, 5].map((star) =>
        star <= rating ?
        <FaStar key={star} className="star filled" style={{ color: starCol }} /> :
        <FaRegStar key={star} className="star empty" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
        )}
            </div>);

  };

  return (
    <div className="enhanced-reviews-section" style={{ background: 'var(--bg-card)' }}>
            {/* Header */}
            <div className="reviews-header">
                <div className="header-left">
                    <AppText as="h3" style={{ color: 'var(--text-main)', textShadow: 'none' }}>
                        <FaStar style={{ color: 'var(--stat-reviews)' }} />
                        {t('reviews', 'Reviews')} ({totalReviews})
                    </AppText>
                    {averageRating > 0 &&
          <div className="average-rating">
                            <AppText as="span" className="rating-number" style={{ color: 'var(--brand-primary)' }}>{averageRating.toFixed(1)}</AppText>
                            {renderStars(Math.round(averageRating))}
                        </div>
          }
                </div>
                {currentUser && userProfile?.role !== 'business' &&
        <button
          className="write-review-btn"
          onClick={onWriteReview}
          style={tc ? {
            background: tc.footerBg,
            border: `1px solid ${tc.border}`,
            color: tc.accentText || '#fff',
            boxShadow: tc.btnShadow,
            borderRadius: tc.btnBorderRadius
          } : {}}>
          
                        <FaStar />
                        {t('write_review', 'Write Review')}
                    </button>
        }
            </div>

            {/* Rating Distribution — compact horizontal layout */}
            {totalReviews > 0 &&
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 0', marginBottom: '0.5rem', flexWrap: 'wrap'
      }}>
                    {/* Big average number */}
                    <div style={{ textAlign: 'center', minWidth: '48px' }}>
                        <div style={{ fontSize: '1.8rem', fontWeight: '900', lineHeight: 1, color: 'var(--text-main)' }}>
                            {averageRating > 0 ? averageRating.toFixed(1) : '–'}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '2px' }}>/ 5</div>
                    </div>
                    {/* Mini bars */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {[5, 4, 3, 2, 1].map((rating) => {
            const count = distribution[rating] || 0;
            const percentage = totalReviews > 0 ? count / totalReviews * 100 : 0;
            return (
              <div
                key={rating}
                onClick={() => setFilterRating(filterRating === rating ? 0 : rating)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                
                                    <AppText as="span" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', width: '10px', textAlign: 'right' }}>{rating}</AppText>
                                    <FaStar style={{ fontSize: '0.55rem', color: 'var(--brand-primary)', flexShrink: 0 }} />
                                    <div style={{
                  flex: 1, height: '5px', borderRadius: '3px',
                  background: 'var(--border-color)', overflow: 'hidden'
                }}>
                                        <div style={{
                    width: `${percentage}%`, height: '100%',
                    background: 'var(--brand-primary)',
                    opacity: filterRating === 0 || filterRating === rating ? 1 : 0.3,
                    borderRadius: '3px', transition: 'width 0.3s'
                  }} />
                                    </div>
                                    <AppText as="span" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', width: '14px' }}>{count}</AppText>
                                </div>);

          })}
                    </div>
                </div>
      }

            {/* Filters and Sort */}
            {totalReviews > 3 &&
      <div className="reviews-controls">
                    <div className="control-group">
                        <FaFilter />
                        <AppText as="span">{t('filter', 'Filter')}:</AppText>
                        <select
            value={filterRating}
            onChange={(e) => {
              setFilterRating(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="control-select">
            
                            <option value={0}>{t('all_ratings', 'All Ratings')}</option>
                            {[5, 4, 3, 2, 1].map((r) =>
            <option key={r} value={r}>{r} {t('stars', 'Stars')}</option>
            )}
                        </select>
                    </div>
                    <div className="control-group">
                        <FaSortAmountDown />
                        <AppText as="span">{t('sort', 'Sort')}:</AppText>
                        <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="control-select">
            
                            {SORT_OPTIONS.map((opt) =>
            <option key={opt.id} value={opt.id}>
                                    {t(opt.id, opt.label)}
                                </option>
            )}
                        </select>
                    </div>
                </div>
      }

            {/* Reviews List */}
            {filteredReviews.length === 0 ?
      <div className="reviews-empty">
                    <div className="empty-icon">📝</div>
                    <AppText as="p">{filterRating > 0 ?
          t('no_reviews_filter', 'No reviews for this rating yet') :
          t('no_reviews', 'No reviews yet. Be the first to review!')
          }</AppText>
                </div> :

      <>
                    <div className="reviews-list">
                        {displayedReviews.map((review) =>
          <div
            key={review.id}
            className="review-card"
            style={tc ? {
              background: tc.badgeBg,
              border: `1px solid ${tc.border}`,
              boxShadow: tc.cardShadow
            } : {}}>
            
                                {/* Review Header */}
                                <div className="review-header">
                                    <div className="user-info">
                                        <div
                  className="user-avatar"
                  style={{
                    backgroundImage: review.userPhoto ? `url(${review.userPhoto})` : 'none',
                    border: tc ? `2px solid ${tc.accent}66` : undefined
                  }}>
                  
                                            {!review.userPhoto && (review.userName?.charAt(0) || '?')}
                                        </div>
                                        <div className="user-details">
                                            <div
                    className="user-name"
                    style={{
                      color: 'var(--text-main)',
                      textShadow: 'none',
                      fontWeight: '700'
                    }}>
                    
                                                {review.userName || 'Anonymous'}
                                            </div>
                                            <div
                    className="review-date"
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      marginTop: '2px'
                    }}>
                    
                                                {review.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                                            </div>
                                        </div>
                                    </div>
                                    {renderStars(review.rating)}
                                </div>

                                {/* Review Content */}
                                <div className="review-content" style={{ color: 'var(--text-main)', textShadow: '0 1px 3px rgba(0,0,0,0.5)', marginTop: '10px', lineHeight: '1.5' }}>
                                    {review.comment}
                                </div>

                                {/* Business Reply */}
                                {review.businessReply &&
            <div className="business-reply">
                                        <div className="reply-header">
                                            <FaReply />
                                            <strong>{t('business_response', 'Business Response')}</strong>
                                        </div>
                                        <div className="reply-content">
                                            {review.businessReply.text}
                                        </div>
                                        <div className="reply-date">
                                            {new Date(review.businessReply.repliedAt).toLocaleDateString()}
                                        </div>
                                    </div>
            }

                                {/* Reply Button for Owner */}
                                {isOwner && !review.businessReply &&
            <>
                                        {replyingTo === review.id ?
              <div className="reply-form">
                                                <AppTextInput as="textarea"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={t('write_reply', 'Write your response...')}
                rows={3} />
                
                                                <div className="reply-actions">
                                                    <button
                    className="btn-cancel"
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyText('');
                    }}>
                    
                                                        {t('cancel', 'Cancel')}
                                                    </button>
                                                    <button
                    className="btn-submit"
                    onClick={() => handleReply(review.id)}
                    disabled={!replyText.trim() || submittingReply}>
                    
                                                        {submittingReply ? t('posting', 'Posting...') : t('post_reply', 'Post Reply')}
                                                    </button>
                                                </div>
                                            </div> :

              <button
                className="reply-btn"
                onClick={() => setReplyingTo(review.id)}>
                
                                                <FaReply />
                                                {t('reply', 'Reply')}
                                            </button>
              }
                                    </>
            }
                            </div>
          )}
                    </div>

                    {/* Pagination & Show More */}
                    {filteredReviews.length > 3 &&
        <div className="reviews-footer">
                            {!showAll ?
          <button
            className="show-all-btn"
            onClick={() => {
              setShowAll(true);
              setCurrentPage(1);
            }}>
            
                                    {t('show_all_reviews', 'Show All Reviews')}
                                </button> :

          <>
                                    {totalPages > 1 &&
            <div className="pagination">
                                            <button
                className="page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}>
                
                                                <FaChevronLeft />
                                            </button>
                                            <AppText as="span" className="page-info">
                                                {t('page', 'Page')} {currentPage} {t('of', 'of')} {totalPages}
                                            </AppText>
                                            <button
                className="page-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}>
                
                                                <FaChevronRight />
                                            </button>
                                        </div>
            }
                                    <button
              className="show-less-btn"
              onClick={() => {
                setShowAll(false);
                setCurrentPage(1);
              }}>
              
                                        {t('show_less', 'Show Less')}
                                    </button>
                                </>
          }
                        </div>
        }
                </>
      }
        </div>);

};

export default EnhancedReviews;