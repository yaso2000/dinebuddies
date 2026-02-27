import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { FaStar, FaRegStar, FaStarHalfAlt, FaUserCircle } from 'react-icons/fa';

const PartnerReviews = ({ partnerId, partnerName }) => {
    const { currentUser } = useAuth();
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddReview, setShowAddReview] = useState(false);
    const [newReview, setNewReview] = useState({
        rating: 5,
        comment: ''
    });
    const [stats, setStats] = useState({
        average: 0,
        total: 0,
        breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchReviews();
    }, [partnerId]);

    const fetchReviews = async () => {
        try {
            setLoading(true);
            const reviewsRef = collection(db, 'reviews');
            const q = query(
                reviewsRef,
                where('partnerId', '==', partnerId),
                orderBy('createdAt', 'desc'),
                limit(50)
            );

            const snapshot = await getDocs(q);
            const reviewsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setReviews(reviewsData);
            calculateStats(reviewsData);
        } catch (error) {
            console.error('Error fetching reviews:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (reviewsData) => {
        if (reviewsData.length === 0) {
            setStats({ average: 0, total: 0, breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });
            return;
        }

        const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        let sum = 0;

        reviewsData.forEach(review => {
            const rating = review.rating;
            breakdown[rating]++;
            sum += rating;
        });

        setStats({
            average: (sum / reviewsData.length).toFixed(1),
            total: reviewsData.length,
            breakdown
        });
    };

    const handleSubmitReview = async (e) => {
        e.preventDefault();

        if (!currentUser) {
            alert('Please login to leave a review');
            return;
        }

        if (currentUser.uid === partnerId) {
            alert('You cannot review your own business');
            return;
        }

        // Check if user has already reviewed
        const hasUserReviewed = reviews.some(r => r.userId === currentUser.uid);
        if (hasUserReviewed) {
            alert('You have already reviewed this business. You can only submit one review per business.');
            return;
        }

        if (!newReview.comment.trim()) {
            alert('Please write a comment');
            return;
        }

        try {
            setSubmitting(true);

            const reviewData = {
                partnerId,
                partnerName,
                userId: currentUser.uid,
                userName: currentUser.displayName || 'Anonymous',
                userPhoto: currentUser.photoURL || null,
                rating: newReview.rating,
                comment: newReview.comment.trim(),
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, 'reviews'), reviewData);

            // Reset form
            setNewReview({ rating: 5, comment: '' });
            setShowAddReview(false);

            // Refresh reviews
            await fetchReviews();

            alert('Review submitted successfully!');
        } catch (error) {
            console.error('Error submitting review:', error);
            alert('Failed to submit review. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const renderStars = (rating, size = '1rem') => {
        const stars = [];
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;

        for (let i = 1; i <= 5; i++) {
            if (i <= fullStars) {
                stars.push(<FaStar key={i} style={{ color: '#fbbf24', fontSize: size }} />);
            } else if (i === fullStars + 1 && hasHalfStar) {
                stars.push(<FaStarHalfAlt key={i} style={{ color: '#fbbf24', fontSize: size }} />);
            } else {
                stars.push(<FaRegStar key={i} style={{ color: '#94a3b8', fontSize: size }} />);
            }
        }

        return <div style={{ display: 'flex', gap: '4px' }}>{stars}</div>;
    };

    const renderRatingBar = (star, count) => {
        const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;

        return (
            <div key={star} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '8px'
            }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', width: '60px' }}>
                    {star} stars
                </span>
                <div style={{
                    flex: 1,
                    height: '8px',
                    background: 'var(--bg-input)',
                    borderRadius: '4px',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        height: '100%',
                        width: `${percentage}%`,
                        background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
                        transition: 'width 0.3s'
                    }} />
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', width: '40px' }}>
                    {count}
                </span>
            </div>
        );
    };

    if (loading) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    border: '4px solid var(--border-color)',
                    borderTop: '4px solid var(--primary)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto'
                }} />
            </div>
        );
    }

    return (
        <div style={{ marginTop: '2rem' }}>
            {/* Stats Summary */}
            <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '1.5rem',
                marginBottom: '1.5rem'
            }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1rem' }}>
                    Reviews & Ratings
                </h3>

                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                    {/* Average Rating */}
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', fontWeight: '900', color: 'var(--primary)' }}>
                            {stats.average}
                        </div>
                        {renderStars(parseFloat(stats.average), '1.2rem')}
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                            {stats.total} {stats.total === 1 ? 'review' : 'reviews'}
                        </div>
                    </div>

                    {/* Rating Breakdown */}
                    <div style={{ flex: 1 }}>
                        {[5, 4, 3, 2, 1].map(star => renderRatingBar(star, stats.breakdown[star]))}
                    </div>
                </div>

                {/* Add Review Button */}
                {currentUser && currentUser.uid !== partnerId && !reviews.some(r => r.userId === currentUser.uid) && (
                    <button
                        onClick={() => setShowAddReview(!showAddReview)}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: showAddReview ? 'var(--bg-input)' : 'linear-gradient(135deg, var(--primary), #f97316)',
                            border: showAddReview ? '1px solid var(--border-color)' : 'none',
                            borderRadius: '12px',
                            color: 'white',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        {showAddReview ? 'Cancel' : '✍️ Write a Review'}
                    </button>
                )}
            </div>

            {/* Add Review Form */}
            {showAddReview && (
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    marginBottom: '1.5rem'
                }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>
                        Share Your Experience
                    </h4>

                    <form onSubmit={handleSubmitReview}>
                        {/* Star Rating Selector */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-muted)' }}>
                                Your Rating
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setNewReview({ ...newReview, rating: star })}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '2rem',
                                            padding: '4px',
                                            transition: 'transform 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                        {star <= newReview.rating ? (
                                            <FaStar style={{ color: '#fbbf24' }} />
                                        ) : (
                                            <FaRegStar style={{ color: '#94a3b8' }} />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Comment */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-muted)' }}>
                                Your Review
                            </label>
                            <textarea
                                value={newReview.comment}
                                onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                                placeholder="Share your experience with this business..."
                                required
                                style={{
                                    width: '100%',
                                    minHeight: '100px',
                                    padding: '12px',
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    color: 'white',
                                    fontSize: '0.95rem',
                                    resize: 'vertical',
                                    fontFamily: 'inherit'
                                }}
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={submitting}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: submitting ? 'var(--bg-input)' : 'linear-gradient(135deg, #10b981, #f59e0b)',
                                border: 'none',
                                borderRadius: '12px',
                                color: 'white',
                                fontWeight: '700',
                                cursor: submitting ? 'not-allowed' : 'pointer',
                                opacity: submitting ? 0.6 : 1
                            }}
                        >
                            {submitting ? 'Submitting...' : 'Submit Review'}
                        </button>
                    </form>
                </div>
            )}

            {/* Reviews List */}
            <div>
                <h4 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>
                    Customer Reviews ({stats.total})
                </h4>

                {reviews.length === 0 ? (
                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '16px',
                        padding: '2rem',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
                        <p style={{ color: 'var(--text-muted)' }}>No reviews yet. Be the first to review!</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {reviews.map(review => (
                            <div key={review.id} style={{
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '16px',
                                padding: '1.25rem'
                            }}>
                                {/* User Info */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                    {review.userPhoto ? (
                                        <img
                                            src={review.userPhoto}
                                            alt={review.userName}
                                            style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '50%',
                                                objectFit: 'cover'
                                            }}
                                        />
                                    ) : (
                                        <FaUserCircle style={{ fontSize: '40px', color: 'var(--text-muted)' }} />
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                                            {review.userName}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {review.createdAt?.toDate().toLocaleDateString()}
                                        </div>
                                    </div>
                                    {renderStars(review.rating, '0.9rem')}
                                </div>

                                {/* Comment */}
                                <p style={{
                                    color: 'var(--text-secondary)',
                                    lineHeight: '1.6',
                                    fontSize: '0.95rem'
                                }}>
                                    {review.comment}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PartnerReviews;
