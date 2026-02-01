import React, { useState } from 'react';
import { FaStar, FaThumbsUp } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const RestaurantRating = ({ restaurant, currentUser, submitRestaurantRating }) => {
    const { t, i18n } = useTranslation();
    const [showRatingForm, setShowRatingForm] = useState(false);
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState('');

    const reviews = restaurant.reviews || [];
    const userHasReviewed = reviews.some(r => r.userId === currentUser.id);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (rating === 0) return;

        submitRestaurantRating(restaurant.id, {
            rating,
            comment
        });

        setShowRatingForm(false);
        setRating(0);
        setComment('');
    };

    const getRatingDistribution = () => {
        const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        reviews.forEach(r => {
            distribution[r.rating] = (distribution[r.rating] || 0) + 1;
        });
        return distribution;
    };

    const distribution = getRatingDistribution();
    const totalReviews = reviews.length;

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return i18n.language === 'ar' ? 'اليوم' : 'Today';
        if (diffDays === 1) return i18n.language === 'ar' ? 'أمس' : 'Yesterday';
        if (diffDays < 7) return i18n.language === 'ar' ? `منذ ${diffDays} أيام` : `${diffDays} days ago`;
        if (diffDays < 30) return i18n.language === 'ar' ? `منذ ${Math.floor(diffDays / 7)} أسابيع` : `${Math.floor(diffDays / 7)} weeks ago`;
        return i18n.language === 'ar' ? `منذ ${Math.floor(diffDays / 30)} شهور` : `${Math.floor(diffDays / 30)} months ago`;
    };

    return (
        <div style={{ marginTop: '2rem' }}>
            {/* Rating Summary */}
            <div style={{
                background: 'var(--bg-card)',
                padding: '1.5rem',
                borderRadius: '20px',
                border: '1px solid var(--border-color)',
                marginBottom: '1.5rem'
            }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '900', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaStar style={{ color: 'var(--luxury-gold)' }} />
                    {i18n.language === 'ar' ? 'التقييمات' : 'Reviews'}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    {/* Overall Rating */}
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', fontWeight: '900', color: 'var(--luxury-gold)' }}>
                            {restaurant.rating}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '0.5rem' }}>
                            {[1, 2, 3, 4, 5].map(star => (
                                <FaStar
                                    key={star}
                                    style={{ color: star <= Math.round(restaurant.rating) ? 'var(--luxury-gold)' : '#444', fontSize: '1.2rem' }}
                                />
                            ))}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            {totalReviews} {i18n.language === 'ar' ? 'تقييم' : 'reviews'}
                        </div>
                    </div>

                    {/* Rating Distribution */}
                    <div>
                        {[5, 4, 3, 2, 1].map(star => {
                            const count = distribution[star] || 0;
                            const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                            return (
                                <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                                    <span style={{ fontSize: '0.85rem', width: '20px' }}>{star}⭐</span>
                                    <div style={{ flex: 1, height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${percentage}%`,
                                            height: '100%',
                                            background: 'var(--luxury-gold)',
                                            transition: 'width 0.3s ease'
                                        }} />
                                    </div>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', width: '30px', textAlign: 'right' }}>
                                        {count}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Add Review Button */}
                {!userHasReviewed && (
                    <button
                        onClick={() => setShowRatingForm(!showRatingForm)}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: showRatingForm ? 'transparent' : 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                            border: showRatingForm ? '1px solid var(--border-color)' : 'none',
                            color: 'white',
                            fontWeight: '700',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.3s'
                        }}
                    >
                        {showRatingForm
                            ? (i18n.language === 'ar' ? 'إلغاء' : 'Cancel')
                            : (i18n.language === 'ar' ? '✍️ اكتب تقييمك' : '✍️ Write a Review')
                        }
                    </button>
                )}
            </div>

            {/* Rating Form */}
            {showRatingForm && (
                <form onSubmit={handleSubmit} style={{
                    background: 'var(--bg-card)',
                    padding: '1.5rem',
                    borderRadius: '20px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '1.5rem'
                }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '1rem' }}>
                        {i18n.language === 'ar' ? 'أضف تقييمك' : 'Add Your Review'}
                    </h4>

                    {/* Star Rating */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                            {i18n.language === 'ar' ? 'التقييم' : 'Rating'}
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {[1, 2, 3, 4, 5].map(star => (
                                <FaStar
                                    key={star}
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    style={{
                                        fontSize: '2rem',
                                        color: star <= (hoverRating || rating) ? 'var(--luxury-gold)' : '#444',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Comment */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                            {i18n.language === 'ar' ? 'التعليق (اختياري)' : 'Comment (Optional)'}
                        </label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder={i18n.language === 'ar' ? 'شاركنا تجربتك...' : 'Share your experience...'}
                            rows={4}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                color: 'white',
                                fontSize: '0.95rem',
                                resize: 'vertical'
                            }}
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={rating === 0}
                        style={{
                            width: '100%',
                            padding: '14px',
                            background: rating === 0 ? '#444' : 'linear-gradient(135deg, var(--accent) 0%, var(--luxury-gold) 100%)',
                            border: 'none',
                            color: rating === 0 ? '#888' : 'white',
                            fontWeight: '900',
                            borderRadius: '12px',
                            cursor: rating === 0 ? 'not-allowed' : 'pointer',
                            fontSize: '1rem'
                        }}
                    >
                        {i18n.language === 'ar' ? '✨ نشر التقييم' : '✨ Submit Review'}
                    </button>
                </form>
            )}

            {/* Reviews List */}
            {reviews.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '1rem' }}>
                        {i18n.language === 'ar' ? `جميع التقييمات (${reviews.length})` : `All Reviews (${reviews.length})`}
                    </h4>
                    {reviews.slice().reverse().map(review => (
                        <div
                            key={review.id}
                            style={{
                                background: 'var(--bg-card)',
                                padding: '1.25rem',
                                borderRadius: '16px',
                                border: '1px solid var(--border-color)',
                                marginBottom: '1rem'
                            }}
                        >
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
                                <img
                                    src={review.userAvatar}
                                    alt={review.userName}
                                    style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }}
                                />
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                        <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{review.userName}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {formatDate(review.date)}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '2px' }}>
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <FaStar
                                                key={star}
                                                style={{
                                                    fontSize: '0.85rem',
                                                    color: star <= review.rating ? 'var(--luxury-gold)' : '#444'
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {review.comment && (
                                <p style={{ fontSize: '0.9rem', lineHeight: '1.5', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                    {review.comment}
                                </p>
                            )}
                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                <button
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '4px 8px',
                                        borderRadius: '8px',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                        e.currentTarget.style.color = 'var(--accent)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = 'var(--text-muted)';
                                    }}
                                >
                                    <FaThumbsUp style={{ fontSize: '0.75rem' }} />
                                    {i18n.language === 'ar' ? 'مفيد' : 'Helpful'} ({review.helpful || 0})
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RestaurantRating;
