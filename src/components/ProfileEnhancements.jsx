import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
    FaCamera,
    FaCog,
    FaStar,
    FaTrophy,
    FaFire,
    FaHeart,
    FaMapMarkerAlt,
    FaInstagram,
    FaTwitter,
    FaGlobe,
    FaPlus,
    FaTimes,
    FaLock,
    FaCheckCircle
} from 'react-icons/fa';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import './ProfileEnhancements.css';

// ================================
// 1. COVER PHOTO COMPONENT
// ================================
export const CoverPhoto = ({ userId, coverPhoto, onUpdate }) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [uploading, setUploading] = useState(false);
    const [hovered, setHovered] = useState(false);

    const handleCoverUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file
        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showToast('File too large. Max 5MB', 'error');
            return;
        }

        setUploading(true);
        try {
            // Upload to Firebase Storage
            const storageRef = ref(storage, `covers/${userId}_${Date.now()}.jpg`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            // Update Firestore
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                cover_photo: downloadURL
            });

            onUpdate && onUpdate(downloadURL);
        } catch (error) {
            console.error('Error uploading cover:', error);
            showToast('Failed to upload cover photo', 'error');
        } finally {
            setUploading(false);
        }
    };

    const defaultCover = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

    return (
        <div
            className="profile-cover"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                background: coverPhoto ? `url(${coverPhoto})` : defaultCover
            }}
        >
            <div className="cover-overlay" style={{ opacity: hovered ? 1 : 0 }}>
                <label className="cover-upload-btn">
                    <FaCamera />
                    <span>{uploading ? t('uploading', 'Uploading...') : t('edit_cover', 'Edit Cover')}</span>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleCoverUpload}
                        disabled={uploading}
                        style={{ display: 'none' }}
                    />
                </label>
            </div>
        </div>
    );
};

// ================================
// 2. STATISTICS CARDS COMPONENT
// ================================
export const StatisticsCards = ({ userId }) => {
    const { t } = useTranslation();
    const { userProfile: viewerProfile } = useAuth();
    const [stats, setStats] = useState({
        totalPosts: 0,
        publicPosts: 0,
        privatePosts: 0,
        totalJoined: 0,
        avgRating: 0,
        attendanceRate: 0,
        reviewCount: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const viewerId = viewerProfile?.uid || viewerProfile?.id;
                const isOwner = viewerId === userId;

                // Fetch invitations where user is host
                const invitationsRef = collection(db, 'invitations');
                const postedQuery = query(invitationsRef, where('hostId', '==', userId));
                const postedSnap = await getDocs(postedQuery);
                const allPosted = postedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Filter based on visibility
                const visiblePosted = allPosted.filter(inv => {
                    if (inv.privacy !== 'private') return true;
                    if (isOwner) return true;
                    if (inv.invitedFriends?.includes(viewerId)) return true;
                    return false;
                });

                // Fetch invitations where user joined
                const joinedQuery = query(invitationsRef, where('attendees', 'array-contains', userId));
                const joinedSnap = await getDocs(joinedQuery);
                const allJoined = joinedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Filter joined based on visibility
                const visibleJoined = allJoined.filter(inv => {
                    if (inv.privacy !== 'private') return true;
                    if (isOwner) return true;
                    if (inv.invitedFriends?.includes(viewerId)) return true;
                    return false;
                });

                const totalJoined = visibleJoined.length;

                // Fetch reviews
                const reviewsRef = collection(db, 'users', userId, 'reviews');
                const reviewsSnap = await getDocs(reviewsRef);
                const reviews = reviewsSnap.docs.map(doc => doc.data());
                const totalReviews = reviews.length;
                const avgRating = totalReviews > 0
                    ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
                    : 0;

                // Calculate REAL attendance rate
                let attendedCount = 0;
                if (totalJoined > 0) {
                    visibleJoined.forEach(inv => {
                        const userStatus = inv.participantStatus?.[userId];
                        const isCompleted = inv.meetingStatus === 'completed';

                        if (isCompleted || userStatus === 'arrived' || userStatus === 'completed') {
                            attendedCount++;
                        }
                    });
                }

                const attendanceRate = totalJoined > 0
                    ? Math.round((attendedCount / totalJoined) * 100)
                    : 0;

                setStats({
                    totalPosts: visiblePosted.length,
                    publicPosts: visiblePosted.filter(p => p.privacy !== 'private').length,
                    privatePosts: visiblePosted.filter(p => p.privacy === 'private').length,
                    totalJoined,
                    avgRating: avgRating.toFixed(1),
                    attendanceRate,
                    reviewCount: totalReviews
                });
            } catch (error) {
                console.error('Error fetching stats:', error);
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            fetchStats();
        }
    }, [userId, viewerProfile]);

    if (loading) {
        return (
            <div className="statistics-cards loading">
                <div className="skeleton-card"></div>
                <div className="skeleton-card"></div>
                <div className="skeleton-card"></div>
                <div className="skeleton-card"></div>
            </div>
        );
    }

    const cards = [
        {
            icon: '📝',
            value: stats.totalPosts,
            label: t('posted_invites', 'Posted'),
            sublabel: (stats.publicPosts > 0 || stats.privatePosts > 0)
                ? `🌐 ${stats.publicPosts} | 🔒 ${stats.privatePosts}`
                : '',
            color: '#8b5cf6'
        },
        {
            icon: '✅',
            value: stats.totalJoined,
            label: t('attended_events', 'Attended'),
            color: '#10b981'
        },
        {
            icon: '⭐',
            value: stats.avgRating > 0 ? `${stats.avgRating}` : '-',
            label: t('avg_rating', 'Rating'),
            sublabel: stats.reviewCount > 0 ? `${stats.reviewCount} ${t('reviews', 'reviews')}` : '',
            color: '#f59e0b'
        },
        {
            icon: '📊',
            value: stats.attendanceRate > 0 ? `${stats.attendanceRate}%` : '-',
            label: t('attendance_rate', 'Rate'),
            color: '#3b82f6'
        }
    ];

    return (
        <div className="statistics-cards">
            {cards.map((card, idx) => (
                <div key={idx} className="stat-card" style={{ '--accent': card.color }}>
                    <div className="stat-icon">{card.icon}</div>
                    <div className="stat-value">{card.value}</div>
                    <div className="stat-label">{card.label}</div>
                    {card.sublabel && <div className="stat-sublabel">{card.sublabel}</div>}
                </div>
            ))}
        </div>
    );
};

// ================================
// 3. ACHIEVEMENTS COMPONENT
// ================================
export const Achievements = ({ userId }) => {
    const { t } = useTranslation();
    const [achievements, setAchievements] = useState([]);
    const [loading, setLoading] = useState(true);

    // Define all possible achievements
    const achievementDefinitions = [
        {
            id: 'first_event',
            title: t('ach_first_event', 'First Event'),
            description: t('ach_first_event_desc', 'Created your first invitation'),
            icon: '🥇',
            condition: (stats) => stats.totalPosts >= 1
        },
        {
            id: 'social_starter',
            title: t('ach_social_starter', '5 Events'),
            description: t('ach_social_starter_desc', 'Attended 5 events'),
            icon: '🎉',
            condition: (stats) => stats.totalJoined >= 5
        },
        {
            id: 'five_star',
            title: t('ach_five_star', 'Five Star'),
            description: t('ach_five_star_desc', 'Received a 5-star review'),
            icon: '⭐',
            condition: (stats) => stats.hasFiveStarReview
        },
        {
            id: 'host_master',
            title: t('ach_host_master', 'Host Master'),
            description: t('ach_host_master_desc', 'Hosted 10 events'),
            icon: '👑',
            condition: (stats) => stats.totalPosts >= 10
        },
        {
            id: 'social_butterfly',
            title: t('ach_social_butterfly', 'Social Butterfly'),
            description: t('ach_social_butterfly_desc', 'Attended 20 events'),
            icon: '🦋',
            condition: (stats) => stats.totalJoined >= 20
        },
        {
            id: 'popular',
            title: t('ach_popular', 'Popular'),
            description: t('ach_popular_desc', '50 followers'),
            icon: '🌟',
            condition: (stats) => stats.followersCount >= 50
        }
    ];

    useEffect(() => {
        const checkAchievements = async () => {
            try {
                // Fetch user stats
                const invitationsRef = collection(db, 'invitations');
                const postedQuery = query(invitationsRef, where('hostId', '==', userId));
                const joinedQuery = query(invitationsRef, where('attendees', 'array-contains', userId));

                const [postedSnap, joinedSnap] = await Promise.all([
                    getDocs(postedQuery),
                    getDocs(joinedQuery)
                ]);

                // Fetch reviews
                const reviewsRef = collection(db, 'users', userId, 'reviews');
                const reviewsSnap = await getDocs(reviewsRef);
                const reviews = reviewsSnap.docs.map(doc => doc.data());
                const hasFiveStarReview = reviews.some(r => r.rating === 5);

                // Fetch user doc for followers
                const userDoc = await getDoc(doc(db, 'users', userId));
                const followersCount = userDoc.data()?.followersCount || 0;

                const stats = {
                    totalPosts: postedSnap.size,
                    totalJoined: joinedSnap.size,
                    hasFiveStarReview,
                    followersCount
                };

                // Check which achievements are unlocked
                const achievementsStatus = achievementDefinitions.map(ach => ({
                    ...ach,
                    unlocked: ach.condition(stats)
                }));

                setAchievements(achievementsStatus);
            } catch (error) {
                console.error('Error checking achievements:', error);
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            checkAchievements();
        }
    }, [userId]);

    if (loading) {
        return <div className="achievements loading">Loading achievements...</div>;
    }

    const unlockedCount = achievements.filter(a => a.unlocked).length;

    return (
        <div className="achievements-section">
            <div className="section-header">
                <h3>
                    <FaTrophy style={{ color: '#fbbf24', marginRight: '0.5rem' }} />
                    {t('achievements', 'Achievements')}
                </h3>
                <span className="achievement-count">
                    {unlockedCount}/{achievements.length}
                </span>
            </div>

            <div className="achievements-grid">
                {achievements.map(ach => (
                    <div
                        key={ach.id}
                        className={`achievement ${ach.unlocked ? 'unlocked' : 'locked'}`}
                        title={ach.description}
                    >
                        <div className="ach-icon">{ach.icon}</div>
                        <div className="ach-title">{ach.title}</div>
                        {ach.unlocked && (
                            <div className="ach-check">
                                <FaCheckCircle />
                            </div>
                        )}
                        {!ach.unlocked && (
                            <div className="ach-lock">
                                <FaLock />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default { CoverPhoto, StatisticsCards, Achievements };
