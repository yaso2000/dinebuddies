import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaStar, FaRegStar, FaEdit, FaReply, FaFilter, FaSortAmountDown, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase/config';
import './EnhancedReviews.css';

const REVIEWS_PER_PAGE = 5;
const SORT_OPTIONS = [
    { id: 'recent', label: 'Most Recent' },
    { id: 'highest', label: 'Highest Rating' },
    { id: 'lowest', label: 'Lowest Rating' }
];

const EnhancedReviews = ({
    reviews,
    partnerId,
    isOwner,
    currentUser,
    userProfile,
    onWriteReview,
    averageRating
}) => {
    const { t } = useTranslation();
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
        reviews.forEach(review => {
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
            filtered = filtered.filter(r => r.rating === filterRating);
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
    const displayedReviews = showAll
        ? filteredReviews.slice((currentPage - 1) * REVIEWS_PER_PAGE, currentPage * REVIEWS_PER_PAGE)
        : filteredReviews.slice(0, 3);

    const handleReply = async (reviewId) => {
        if (!replyText.trim() || !isOwner) return;

        try {
            setSubmittingReply(true);

            const reviewIndex = reviews.findIndex(r => r.id === reviewId);
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
            alert('Failed to post reply');
        } finally {
            setSubmittingReply(false);
        }
    };

    const renderStars = (rating) => {
        return (
            <div className="stars">
                {[1, 2, 3, 4, 5].map(star => (
                    star <= rating
                        ? <FaStar key={star} className="star filled" />
                        : <FaRegStar key={star} className="star empty" />
                ))}
            </div>
        );
    };

    return (
        <div className="enhanced-reviews-section">
            {/* Header */}
            <div className="reviews-header">
                <div className="header-left">
                    <h3>
                        <FaStar style={{ color: '#fbbf24' }} />
                        {t('reviews', 'Reviews')} ({totalReviews})
                    </h3>
                    {averageRating > 0 && (
                        <div className="average-rating">
                            <span className="rating-number">{averageRating.toFixed(1)}</span>
                            {renderStars(Math.round(averageRating))}
                        </div>
                    )}
                </div>
                {currentUser && userProfile?.accountType !== 'business' && (
                    <button className="write-review-btn" onClick={onWriteReview}>
                        <FaStar />
                        {t('write_review', 'Write Review')}
                    </button>
                )}
            </div>

            {/* Rating Distribution */}
            {totalReviews > 0 && (
                <div className="rating-distribution">
                    <h4>{t('rating_breakdown', 'Rating Breakdown')}</h4>
                    <div className="distribution-bars">
                        {[5, 4, 3, 2, 1].map(rating => {
                            const count = distribution[rating] || 0;
                            const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;

                            return (
                                <div
                                    key={rating}
                                    className="distribution-row"
                                    onClick={() => setFilterRating(filterRating === rating ? 0 : rating)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="rating-label">
                                        {rating} <FaStar className="mini-star" />
                                    </div>
                                    <div className="bar-container">
                                        <div
                                            className="bar-fill"
                                            style={{
                                                width: `${percentage}%`,
                                                opacity: filterRating === 0 || filterRating === rating ? 1 : 0.3
                                            }}
                                        />
                                    </div>
                                    <div className="count">{count}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Filters and Sort */}
            {totalReviews > 3 && (
                <div className="reviews-controls">
                    <div className="control-group">
                        <FaFilter />
                        <span>{t('filter', 'Filter')}:</span>
                        <select
                            value={filterRating}
                            onChange={(e) => {
                                setFilterRating(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="control-select"
                        >
                            <option value={0}>{t('all_ratings', 'All Ratings')}</option>
                            {[5, 4, 3, 2, 1].map(r => (
                                <option key={r} value={r}>{r} {t('stars', 'Stars')}</option>
                            ))}
                        </select>
                    </div>
                    <div className="control-group">
                        <FaSortAmountDown />
                        <span>{t('sort', 'Sort')}:</span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="control-select"
                        >
                            {SORT_OPTIONS.map(opt => (
                                <option key={opt.id} value={opt.id}>
                                    {t(opt.id, opt.label)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Reviews List */}
            {filteredReviews.length === 0 ? (
                <div className="reviews-empty">
                    <div className="empty-icon">📝</div>
                    <p>{filterRating > 0
                        ? t('no_reviews_filter', `No ${filterRating}-star reviews yet`)
                        : t('no_reviews', 'No reviews yet. Be the first to review!')
                    }</p>
                </div>
            ) : (
                <>
                    <div className="reviews-list">
                        {displayedReviews.map(review => (
                            <div key={review.id} className="review-card">
                                {/* Review Header */}
                                <div className="review-header">
                                    <div className="user-info">
                                        <div
                                            className="user-avatar"
                                            style={{
                                                backgroundImage: review.userPhoto ? `url(${review.userPhoto})` : 'none'
                                            }}
                                        >
                                            {!review.userPhoto && (review.userName?.charAt(0) || '?')}
                                        </div>
                                        <div className="user-details">
                                            <div className="user-name">
                                                {review.userName || 'Anonymous'}
                                            </div>
                                            <div className="review-date">
                                                {review.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                                            </div>
                                        </div>
                                    </div>
                                    {renderStars(review.rating)}
                                </div>

                                {/* Review Content */}
                                <div className="review-content">
                                    {review.comment}
                                </div>

                                {/* Business Reply */}
                                {review.businessReply && (
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
                                )}

                                {/* Reply Button for Owner */}
                                {isOwner && !review.businessReply && (
                                    <>
                                        {replyingTo === review.id ? (
                                            <div className="reply-form">
                                                <textarea
                                                    value={replyText}
                                                    onChange={(e) => setReplyText(e.target.value)}
                                                    placeholder={t('write_reply', 'Write your response...')}
                                                    rows={3}
                                                />
                                                <div className="reply-actions">
                                                    <button
                                                        className="btn-cancel"
                                                        onClick={() => {
                                                            setReplyingTo(null);
                                                            setReplyText('');
                                                        }}
                                                    >
                                                        {t('cancel', 'Cancel')}
                                                    </button>
                                                    <button
                                                        className="btn-submit"
                                                        onClick={() => handleReply(review.id)}
                                                        disabled={!replyText.trim() || submittingReply}
                                                    >
                                                        {submittingReply ? t('posting', 'Posting...') : t('post_reply', 'Post Reply')}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                className="reply-btn"
                                                onClick={() => setReplyingTo(review.id)}
                                            >
                                                <FaReply />
                                                {t('reply', 'Reply')}
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Pagination & Show More */}
                    {filteredReviews.length > 3 && (
                        <div className="reviews-footer">
                            {!showAll ? (
                                <button
                                    className="show-all-btn"
                                    onClick={() => {
                                        setShowAll(true);
                                        setCurrentPage(1);
                                    }}
                                >
                                    {t('show_all_reviews', `Show All ${filteredReviews.length} Reviews`)}
                                </button>
                            ) : (
                                <>
                                    {totalPages > 1 && (
                                        <div className="pagination">
                                            <button
                                                className="page-btn"
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                            >
                                                <FaChevronLeft />
                                            </button>
                                            <span className="page-info">
                                                {t('page', 'Page')} {currentPage} {t('of', 'of')} {totalPages}
                                            </span>
                                            <button
                                                className="page-btn"
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                disabled={currentPage === totalPages}
                                            >
                                                <FaChevronRight />
                                            </button>
                                        </div>
                                    )}
                                    <button
                                        className="show-less-btn"
                                        onClick={() => {
                                            setShowAll(false);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        {t('show_less', 'Show Less')}
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default EnhancedReviews;
