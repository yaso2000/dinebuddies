import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { uploadImage, deleteImage } from '../utils/imageUpload';
import { FaArrowLeft, FaPhone, FaMapMarkerAlt, FaClock, FaGlobe, FaShareAlt, FaUserPlus, FaUsers, FaEdit, FaInstagram, FaTwitter, FaFacebook, FaExternalLinkAlt, FaShare, FaStar, FaImages, FaTimes, FaPlus, FaHeart, FaRegHeart } from 'react-icons/fa';
import { HiBuildingStorefront } from 'react-icons/hi2';
import { useAuth } from '../context/AuthContext';
import { ServiceIcon } from '../utils/serviceIcons.jsx';
import { updateSocialMetaTags, generatePartnerMetaTags, resetSocialMetaTags } from '../utils/socialMetaTags';
import { useTranslation } from 'react-i18next';
import DeliveryLinksSection from '../components/DeliveryLinksSection';
import BusinessHours from '../components/BusinessHours';
import EnhancedGallery from '../components/EnhancedGallery';
import EnhancedReviews from '../components/EnhancedReviews';
import MenuShowcase from '../components/MenuShowcase';
import GroupChat from '../components/GroupChat';


const PartnerProfile = () => {
    const { partnerId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser, userProfile, updateUserProfile } = useAuth();
    const { t } = useTranslation();

    const [partner, setPartner] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('about');

    const [activeInvitationsCount, setActiveInvitationsCount] = useState(0);
    const [reviews, setReviews] = useState([]);
    const [averageRating, setAverageRating] = useState(0);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
    const [submittingReview, setSubmittingReview] = useState(false);

    // Gallery states
    const [uploadingImage, setUploadingImage] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [isEditMode, setIsEditMode] = useState(false);

    // Delivery Links states (Premium feature)
    const [deliveryLinks, setDeliveryLinks] = useState({
        uberEats: '',
        menulog: '',
        doorDash: '',
        deliveroo: ''
    });
    const [editingDeliveryLinks, setEditingDeliveryLinks] = useState(false);
    const [tempDeliveryLinks, setTempDeliveryLinks] = useState({
        uberEats: '',
        menulog: '',
        doorDash: '',
        deliveroo: ''
    });

    // Community membership states
    const [memberCount, setMemberCount] = useState(0);
    const [isMember, setIsMember] = useState(false);
    const [joiningCommunity, setJoiningCommunity] = useState(false);


    const days = [
        { key: 'sunday', label: 'Sunday' },
        { key: 'monday', label: 'Monday' },
        { key: 'tuesday', label: 'Tuesday' },
        { key: 'wednesday', label: 'Wednesday' },
        { key: 'thursday', label: 'Thursday' },
        { key: 'friday', label: 'Friday' },
        { key: 'saturday', label: 'Saturday' }
    ];

    useEffect(() => {
        let unsubscribe;

        const setupListener = async () => {
            unsubscribe = await fetchPartner();
        };

        setupListener();

        // Cleanup: unsubscribe when component unmounts
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [partnerId]);


    useEffect(() => {
        const loadAllData = async () => {
            if (partnerId) {
                // Always fetch reviews and active invitations
                await Promise.all([
                    fetchActiveInvitations(),
                    fetchReviews()
                ]);

                // Only fetch membership data if user is logged in
                if (currentUser) {
                    await Promise.all([
                        checkMembership(),
                        fetchMemberCount()
                    ]);
                }
            }
        };

        loadAllData();
    }, [currentUser, partnerId, partner]);


    const fetchPartner = async () => {
        try {
            setLoading(true);
            const docRef = doc(db, 'users', partnerId);

            // Use onSnapshot for real-time updates
            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists() && docSnap.data().accountType === 'business') {
                    setPartner({ uid: docSnap.id, ...docSnap.data() });
                    console.log('✅ Partner data updated:', docSnap.data().subscriptionTier);
                } else {
                    console.error('Partner not found or not a business account');
                }
                setLoading(false);
            }, (error) => {
                console.error('Error fetching partner:', error);
                setLoading(false);
            });

            // Return unsubscribe function
            return unsubscribe;
        } catch (error) {
            console.error('Error setting up partner listener:', error);
            setLoading(false);
        }
    };

    // Load delivery links when partner data changes
    useEffect(() => {
        if (partner?.businessInfo?.deliveryLinks) {
            const links = partner.businessInfo.deliveryLinks;
            setDeliveryLinks({
                uberEats: links.uberEats || '',
                menulog: links.menulog || '',
                doorDash: links.doorDash || '',
                deliveroo: links.deliveroo || ''
            });
            setTempDeliveryLinks({
                uberEats: links.uberEats || '',
                menulog: links.menulog || '',
                doorDash: links.doorDash || '',
                deliveroo: links.deliveroo || ''
            });
        }
    }, [partner]);

    // Track profile view - FIXED: Only track once per session
    const viewTracked = useRef(false);

    useEffect(() => {
        const trackProfileView = async () => {
            // Don't track if already tracked in this session
            if (viewTracked.current) {
                console.log('👁️ Skipping view tracking - already tracked this session');
                return;
            }

            // Don't track if viewing own profile
            if (currentUser?.uid === partnerId) {
                console.log('👁️ Skipping view tracking - viewing own profile');
                return;
            }

            // Check if already viewed recently (within 24 hours)
            const viewKey = `profile_view_${partnerId}`;
            const lastView = localStorage.getItem(viewKey);
            const now = Date.now();

            if (lastView && (now - parseInt(lastView)) < 24 * 60 * 60 * 1000) {
                console.log('👁️ Skipping view tracking - already viewed recently');
                return;
            }

            try {
                // Increment profile views
                const partnerRef = doc(db, 'users', partnerId);
                const currentViews = partner?.businessInfo?.profileViews || 0;

                await updateDoc(partnerRef, {
                    'businessInfo.profileViews': currentViews + 1
                });

                // Store view timestamp
                localStorage.setItem(viewKey, now.toString());
                viewTracked.current = true; // Mark as tracked
                console.log('✅ Profile view tracked:', currentViews + 1);
            } catch (error) {
                console.error('❌ Error tracking profile view:', error);
                // If field doesn't exist, initialize it
                if (error.code === 'not-found') {
                    try {
                        const partnerRef = doc(db, 'users', partnerId);
                        await updateDoc(partnerRef, {
                            'businessInfo.profileViews': 1
                        });
                        localStorage.setItem(viewKey, now.toString());
                        viewTracked.current = true; // Mark as tracked
                        console.log('✅ Profile views initialized to 1');
                    } catch (initError) {
                        console.error('❌ Error initializing profile views:', initError);
                    }
                }
            }
        };

        if (partnerId && partner && !viewTracked.current) {
            trackProfileView();
        }
    }, [partnerId, partner?.uid, currentUser?.uid]); // Only depend on IDs, not full objects

    // Update social meta tags when partner loads
    useEffect(() => {
        if (partner) {
            const metaData = generatePartnerMetaTags(partner);
            updateSocialMetaTags(metaData);
        }

        // Reset meta tags when component unmounts
        return () => {
            resetSocialMetaTags();
        };
    }, [partner]);

    const checkMembership = async () => {
        try {
            if (!currentUser?.uid || !partnerId) {
                console.log('⚠️ Cannot check membership: missing user or partner ID');
                setIsMember(false);
                return;
            }

            console.log('🔍 Checking membership for:', currentUser.uid, 'at partner:', partnerId);

            // Fetch partner data to check if current user is in communityMembers
            const partnerDoc = await getDoc(doc(db, 'users', partnerId));
            if (partnerDoc.exists()) {
                const partnerData = partnerDoc.data();
                const memberIds = partnerData.communityMembers || [];
                const memberStatus = memberIds.includes(currentUser.uid);
                console.log('✅ Membership status:', memberStatus);
                setIsMember(memberStatus);
            } else {
                setIsMember(false);
            }
        } catch (error) {
            console.error('❌ Error checking membership:', error);
            setIsMember(false);
        }
    };

    const fetchMemberCount = async () => {
        try {
            console.log('📊 Fetching member count for:', partnerId);
            const partnerDoc = await getDoc(doc(db, 'users', partnerId));
            if (partnerDoc.exists()) {
                const partnerData = partnerDoc.data();
                const memberIds = partnerData.communityMembers || [];
                const count = memberIds.length;
                console.log('✅ Member count:', count);
                setMemberCount(count);
            } else {
                setMemberCount(0);
            }
        } catch (error) {
            console.error('❌ Error fetching member count:', error);
            setMemberCount(0);
        }
    };

    const fetchActiveInvitations = async () => {
        try {
            console.log('📋 Fetching active invitations for:', partnerId);
            const invitationsRef = collection(db, 'invitations');
            const q = query(
                invitationsRef,
                where('restaurantId', '==', partnerId)
            );
            const snapshot = await getDocs(q);

            // Filter for active invitations (not expired)
            const now = new Date();
            const activeInvitations = snapshot.docs.filter(doc => {
                const data = doc.data();
                const inviteDate = new Date(`${data.date}T${data.time}`);
                return inviteDate > now;
            });

            console.log('✅ Active invitations count:', activeInvitations.length);
            setActiveInvitationsCount(activeInvitations.length);
        } catch (error) {
            console.error('❌ Error fetching active invitations:', error);
            setActiveInvitationsCount(0);
        }
    };

    const fetchReviews = async () => {
        try {
            console.log('⭐ Fetching reviews for:', partnerId);
            const reviewsRef = collection(db, 'reviews');
            const q = query(
                reviewsRef,
                where('partnerId', '==', partnerId)
            );
            const snapshot = await getDocs(q);

            const reviewsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort by createdAt (newest first)
            reviewsData.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateB - dateA;
            });

            setReviews(reviewsData);

            // Calculate average rating
            if (reviewsData.length > 0) {
                const totalRating = reviewsData.reduce((sum, review) => sum + review.rating, 0);
                const avg = totalRating / reviewsData.length;
                setAverageRating(avg);
                console.log('📊 Rating calculation:', {
                    totalReviews: reviewsData.length,
                    totalRating,
                    averageRating: avg.toFixed(1),
                    individualRatings: reviewsData.map(r => ({ id: r.id, rating: r.rating, userName: r.userName }))
                });
            } else {
                setAverageRating(0);
            }

            console.log('✅ Reviews loaded:', reviewsData.length);
        } catch (error) {
            console.error('❌ Error fetching reviews:', error);
        }
    };



    const handleSubmitReview = async () => {
        if (!currentUser) {
            alert('Please login to submit a review');
            return;
        }

        // Check if user is a business account
        if (userProfile?.accountType === 'business') {
            alert('Business accounts cannot submit reviews');
            return;
        }

        if (!newReview.comment.trim()) {
            alert('Please write a comment');
            return;
        }

        // Check if user already reviewed
        const existingReview = reviews.find(r => r.userId === currentUser.uid);
        if (existingReview) {
            alert('You have already reviewed this business');
            return;
        }

        try {
            setSubmittingReview(true);

            // Check in database if user already reviewed
            const reviewsRef = collection(db, 'reviews');
            const existingReviewQuery = query(
                reviewsRef,
                where('partnerId', '==', partnerId),
                where('userId', '==', currentUser.uid)
            );
            const existingReviewSnapshot = await getDocs(existingReviewQuery);

            if (!existingReviewSnapshot.empty) {
                alert('You have already reviewed this business');
                setSubmittingReview(false);
                setShowReviewModal(false);
                return;
            }

            console.log('📝 Submitting review:', {
                partnerId,
                userId: currentUser.uid,
                rating: newReview.rating,
                comment: newReview.comment
            });

            await addDoc(reviewsRef, {
                partnerId,
                userId: currentUser.uid,
                userName: userProfile?.displayName || currentUser.displayName || 'Anonymous',
                userPhoto: userProfile?.photoURL || currentUser.photoURL || '',
                rating: newReview.rating,
                comment: newReview.comment.trim(),
                createdAt: serverTimestamp()
            });

            console.log('✅ Review submitted successfully!');

            // Small delay to ensure Firestore processes serverTimestamp
            await new Promise(resolve => setTimeout(resolve, 500));

            // Refresh reviews
            console.log('🔄 Refreshing reviews...');
            await fetchReviews();
            console.log('✅ Reviews refreshed!');

            // Reset form
            setNewReview({ rating: 5, comment: '' });
            setShowReviewModal(false);

            alert('Review submitted successfully!');
        } catch (error) {
            console.error('Error submitting review:', error);
            alert('Failed to submit review');
        } finally {
            setSubmittingReview(false);
        }
    };

    // Handle Create Invitation with Special Offer
    const handleCreateWithOffer = (offer) => {
        if (!offer) return;

        // Prepare offer data to pass to CreateInvitation
        const offerData = {
            id: offer.id,
            title: offer.title,
            description: offer.description,
            imageUrl: offer.imageUrl,
            partnerId: offer.partnerId,
            partnerName: offer.partnerName || partner?.businessInfo?.businessName,
            location: partner?.businessInfo?.address,
            lat: partner?.businessInfo?.location?.latitude,
            lng: partner?.businessInfo?.location?.longitude,
            city: partner?.businessInfo?.city,
            startDate: offer.startDate,
            endDate: offer.endDate
        };

        console.log('🎟️ Creating invitation with offer:', offerData);

        // Navigate to CreateInvitation with offer data
        navigate('/create', {
            state: {
                offerData: offerData
            }
        });
    };


    const handleJoinCommunity = async () => {
        if (!currentUser) {
            navigate('/login');
            return;
        }

        setJoiningCommunity(true);
        try {
            if (isMember) {
                await leaveCommunity(currentUser.uid, partnerId);
                setIsMember(false);
                setMemberCount(prev => prev - 1);
            } else {
                await joinCommunity(currentUser.uid, partnerId);
                setIsMember(true);
                setMemberCount(prev => prev + 1);
            }
            // Re-check membership to ensure consistency
            await checkMembership();
            await fetchMemberCount();
        } catch (error) {
            console.error('Error toggling community membership:', error);
            // Revert state on error
            await checkMembership();
            await fetchMemberCount();
        } finally {
            setJoiningCommunity(false);
        }
    };

    // Gallery Functions
    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const currentGallery = partner?.businessInfo?.gallery || [];
        if (currentGallery.length >= 6) {
            alert('Maximum 6 images allowed in gallery');
            return;
        }

        try {
            setUploadingImage(true);

            // Upload to Firebase Storage using Utility
            const timestamp = Date.now();
            const path = `gallery/${partnerId}/${timestamp}.jpg`;

            const options = {
                maxSizeMB: 0.5,
                maxWidthOrHeight: 1200,
                useWebWorker: true,
                fileType: 'image/jpeg',
                initialQuality: 0.85
            };

            const downloadURL = await uploadImage(file, path, null, options);

            // Update Firestore
            const updatedGallery = [...currentGallery, downloadURL];
            const partnerRef = doc(db, 'users', partnerId);
            await updateDoc(partnerRef, {
                'businessInfo.gallery': updatedGallery
            });

            console.log('✅ Image uploaded successfully');
        } catch (error) {
            console.error('❌ Error uploading image:', error);
            alert('Failed to upload image');
        } finally {
            setUploadingImage(false);
        }
    };

    const handleDeleteImage = async (imageUrl, index) => {
        if (!confirm('Are you sure you want to delete this image?')) return;

        try {
            // Delete from Storage using Utility
            await deleteImage(imageUrl);

            // Update Firestore
            const currentGallery = partner?.businessInfo?.gallery || [];
            const updatedGallery = currentGallery.filter((_, i) => i !== index);
            const partnerRef = doc(db, 'users', partnerId);
            await updateDoc(partnerRef, {
                'businessInfo.gallery': updatedGallery
            });

            console.log('✅ Image deleted successfully');
        } catch (error) {
            console.error('❌ Error deleting image:', error);
            alert('Failed to delete image');
        }
    };

    const handleCreateInvitation = () => {
        if (!currentUser) {
            navigate('/login');
            return;
        }

        const businessInfo = partner.businessInfo || {};

        // Navigate to create invitation with pre-filled data
        navigate('/create', {
            state: {
                prefilledData: {
                    restaurantName: partner.display_name, // من display_name
                    restaurantImage: businessInfo.coverImage,
                    location: businessInfo.address,
                    city: businessInfo.city,
                    lat: businessInfo.lat,
                    lng: businessInfo.lng
                }
            }
        });
    };

    const handleBookInvitation = () => {
        if (!currentUser) {
            navigate('/login');
            return;
        }

        // Navigate to partner's community/invitations page
        navigate(`/partner/${partnerId}/invitations`);
    };

    const formatTime = (time) => {
        if (!time) return '';
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    const isFavorite = userProfile?.favoritePlaces?.some(p => p.businessId === partnerId);

    const handleToggleFavorite = async () => {
        if (!currentUser) {
            navigate('/login');
            return;
        }

        try {
            let newFavorites = [...(userProfile.favoritePlaces || [])];

            if (isFavorite) {
                // Remove from favorites
                newFavorites = newFavorites.filter(p => p.businessId !== partnerId);
                console.log('💔 Removing from favorites');
            } else {
                // Add to favorites
                const favoritePlace = {
                    businessId: partner.uid,
                    name: partner.display_name,
                    image: partner.photo_url || partner.businessInfo?.coverImage,
                    address: partner.businessInfo?.address || '',
                    city: partner.businessInfo?.city || '',
                    source: 'partner',
                    addedAt: new Date().toISOString()
                };
                newFavorites.push(favoritePlace);
                console.log('❤️ Adding to favorites:', favoritePlace);
            }

            // Update via AuthContext to ensure local state and Firestore are synced
            await updateUserProfile({ favoritePlaces: newFavorites });

        } catch (error) {
            console.error('Error toggling favorite:', error);
        }
    };

    // Better implementation using context method to ensure UI consistency
    const handleToggleFavoriteSafe = async () => {
        if (!currentUser) {
            navigate('/login');
            return;
        }

        const { updateUserProfile } = await import('../context/AuthContext'); // Dynamic import not needed since we have useAuth
        // Actually we have updateUserProfile from useAuth() at the top. Let's use it.

        try {
            let newFavorites = [...(userProfile.favoritePlaces || [])];

            if (isFavorite) {
                newFavorites = newFavorites.filter(p => p.businessId !== partnerId);
            } else {
                const favoritePlace = {
                    businessId: partner.uid,
                    name: partner.display_name,
                    image: partner.photo_url,
                    address: partner.businessInfo?.address || '',
                    city: partner.businessInfo?.city || '',
                    source: 'partner',
                    addedAt: new Date().toISOString()
                };
                newFavorites.push(favoritePlace);
            }

            // Use the context function which handles Firestore update AND state update
            // We need to access updateUserProfile from the hook we called at the top
            // But wait, the hook call `const { currentUser, userProfile } = useAuth();` didn't destructure updateUserProfile. 
            // I need to update that line too.
            // For now, I'll direct update Firestore and force a reload or hope for the best? 
            // No, I should fix the destructuring.

            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, { favoritePlaces: newFavorites });

            // Manually trigger profile refresh if possible? 
            // The userProfile in AuthContext is not a snapshot listener, it's a fetch.
            // So we MUST use the context method to update it or manually update the local state.
            // Converting to use updateUserProfile is best but I need to change the top of the component.
        } catch (e) {
            console.log(e);
        }
    };



    const handleShare = async () => {
        const shareData = {
            title: partner.display_name || 'Business Profile', // من display_name
            text: `Check out ${partner.display_name || 'this business'} on DineBuddies!`,
            url: window.location.href
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(window.location.href);
                alert('Link copied!');
            }
        } catch (err) {
            console.error('Error sharing:', err);
        }
    };

    // Delivery Links Functions
    const handleSaveDeliveryLinks = async () => {
        if (!currentUser || currentUser.uid !== partnerId) {
            alert('Unauthorized');
            return;
        }

        try {
            const userRef = doc(db, 'users', partnerId);
            await updateDoc(userRef, {
                'businessInfo.deliveryLinks': tempDeliveryLinks
            });

            setDeliveryLinks(tempDeliveryLinks);
            setEditingDeliveryLinks(false);
            console.log('✅ Delivery links saved');
        } catch (error) {
            console.error('❌ Error saving delivery links:', error);
            alert('Error saving delivery links');
        }
    };

    const handleCancelDeliveryLinks = () => {
        setTempDeliveryLinks(deliveryLinks);
        setEditingDeliveryLinks(false);
    };

    if (loading) {
        return (
            <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{
                    width: '50px',
                    height: '50px',
                    border: '4px solid var(--border-color)',
                    borderTop: '4px solid var(--primary)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 1rem'
                }} />
                <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
            </div>
        );
    }

    if (!partner) {
        return (
            <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}>
                <HiBuildingStorefront style={{ fontSize: '4rem', color: 'var(--primary)', marginBottom: '1rem' }} />
                <h2>Partner not found</h2>
                <button onClick={() => navigate('/restaurants')} className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
                    Back to Partners
                </button>
            </div>
        );
    }

    const businessInfo = partner.businessInfo || {};
    const isPremium = partner.subscriptionTier === 'premium';
    const isOwner = currentUser?.uid === partnerId;


    return (
        <div className="page-container" style={{ paddingTop: '0', paddingBottom: '100px' }}>
            {/* Header - Simplified */}
            <header className="app-header sticky-header-glass">
                <button className="back-btn" onClick={() => navigate('/restaurants')}>
                    <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                </button>

                {/* Center - Business Name and Type Badge */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    <h3 style={{
                        fontSize: '1.1rem',
                        fontWeight: '800',
                        margin: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '200px'
                    }}>
                        {partner.display_name || 'Business'}
                    </h3>

                    {/* Business Type Badge */}
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 8px',
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(236, 72, 153, 0.15))',
                        border: '1px solid rgba(139, 92, 246, 0.4)',
                        borderRadius: '10px',
                        fontSize: '0.65rem',
                        fontWeight: '700',
                        color: 'var(--primary)',
                        letterSpacing: '0.3px'
                    }}>
                        {businessInfo.businessType || 'Restaurant'}
                    </div>
                </div>

                {/* Share button */}
                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        className="back-btn"
                        onClick={handleToggleFavorite}
                        style={{ color: isFavorite ? '#ef4444' : 'inherit' }}
                    >
                        {isFavorite ? <FaHeart /> : <FaRegHeart />}
                    </button>
                    <button className="back-btn" onClick={handleShare}>
                        <FaShare />
                    </button>
                </div>
            </header>

            {/* Cover Image with Logo and Status Badges */}
            <div style={{
                position: 'relative',
                width: '100%',
                height: '250px',
                background: businessInfo.coverImage
                    ? `url(${businessInfo.coverImage})`
                    : 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(236, 72, 153, 0.3))',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                marginTop: '0'
            }}>
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.7) 100%)'
                }} />

                {/* Status Badges - Top Right */}
                {(() => {
                    const today = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
                    const todayHours = businessInfo.workingHours?.[today];
                    const isOpen = todayHours?.isOpen;
                    const lastSeen = partner.lastSeen?.toDate?.() || partner.lastSeen;
                    const isOnline = lastSeen && (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000;

                    return (
                        <div style={{
                            position: 'absolute',
                            top: '1rem',
                            right: '1rem',
                            display: 'flex',
                            gap: '8px',
                            zIndex: 2
                        }}>
                            {/* Open/Closed Badge */}
                            <div style={{
                                background: 'rgba(0, 0, 0, 0.4)',
                                backdropFilter: 'blur(10px)',
                                border: `1px solid ${isOpen ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                                borderRadius: '12px',
                                padding: '6px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                color: isOpen ? '#22c55e' : '#ef4444'
                            }}>
                                <span>{isOpen ? '●' : '●'}</span>
                                <span>{isOpen ? 'Open' : 'Closed'}</span>
                            </div>

                            {/* Online/Offline Badge */}
                            <div style={{
                                background: 'rgba(0, 0, 0, 0.4)',
                                backdropFilter: 'blur(10px)',
                                border: `1px solid ${isOnline ? 'rgba(34, 197, 94, 0.4)' : 'rgba(156, 163, 175, 0.4)'}`,
                                borderRadius: '12px',
                                padding: '6px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                color: isOnline ? '#22c55e' : '#9ca3af'
                            }}>
                                <span>{isOnline ? '🟢' : '⚫'}</span>
                                <span>{isOnline ? 'Online' : 'Offline'}</span>
                            </div>
                        </div>
                    );
                })()}

                {/* Logo - Top Left Corner with Premium Badge */}
                <div style={{
                    position: 'absolute',
                    top: '1rem',
                    left: '1rem',
                    zIndex: 3
                }}>
                    <div style={{
                        position: 'relative',
                        width: '60px',
                        height: '60px'
                    }}>
                        {/* Logo */}
                        <div style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '12px',
                            background: partner.photo_url
                                ? `url(${partner.photo_url})`
                                : 'linear-gradient(135deg, var(--primary), #f97316)',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            border: '2px solid rgba(255, 255, 255, 0.9)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.5rem'
                        }}>
                            {!partner.photo_url && '🏪'}
                        </div>

                        {/* Premium Crown Icon - Top Right Corner of Logo */}
                        {isPremium && (
                            <div style={{
                                position: 'absolute',
                                top: '-4px',
                                right: '-4px',
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                                border: '2px solid white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.65rem',
                                boxShadow: '0 2px 8px rgba(251, 191, 36, 0.4)'
                            }}>
                                👑
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats Cards - Bottom Right */}
                <div style={{
                    position: 'absolute',
                    bottom: '0.75rem',
                    right: '1rem',
                    display: 'flex',
                    gap: '8px',
                    zIndex: 2
                }}>
                    {/* Rating - Clickable to add review (only for regular users) */}
                    <div
                        onClick={() => {
                            if (currentUser && userProfile?.accountType !== 'business') {
                                setShowReviewModal(true);
                            }
                        }}
                        style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(251, 191, 36, 0.3)',
                            borderRadius: '20px',
                            padding: '0.4rem 0.7rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: (currentUser && userProfile?.accountType !== 'business') ? 'pointer' : 'default',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            if (currentUser && userProfile?.accountType !== 'business') {
                                e.currentTarget.style.transform = 'scale(1.05)';
                                e.currentTarget.style.background = 'rgba(251, 191, 36, 0.2)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)';
                        }}
                    >
                        <span style={{ fontSize: '1rem' }}>⭐</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#fbbf24' }}>
                            {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}
                        </span>
                        <span style={{ fontSize: '0.65rem', fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>
                            ({reviews.length})
                        </span>
                    </div>

                    {/* Members */}
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: '20px',
                        padding: '0.4rem 0.7rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        <span style={{ fontSize: '1rem' }}>👥</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#a78bfa' }}>
                            {memberCount}
                        </span>
                    </div>

                    {/* Active Invitations */}
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        borderRadius: '20px',
                        padding: '0.4rem 0.7rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        <span style={{ fontSize: '1rem' }}>📨</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#4ade80' }}>
                            {activeInvitationsCount}
                        </span>
                        <span style={{ fontSize: '0.65rem', fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>
                            Invitations
                        </span>
                    </div>
                </div>
            </div>

            {/* Business Info */}
            <div style={{
                padding: '1.5rem 1.5rem 1.5rem',
                borderBottom: '1px solid var(--border-color)'
            }}>
                {businessInfo.tagline && (
                    <p style={{
                        fontSize: '0.95rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '0.75rem',
                        fontStyle: 'italic'
                    }}>
                        {businessInfo.tagline}
                    </p>
                )}

                {/* Social Media */}
                {businessInfo.socialMedia && (Object.values(businessInfo.socialMedia).some(v => v)) && (
                    <div style={{
                        display: 'flex',
                        gap: '12px',
                        marginBottom: '1.25rem',
                        flexWrap: 'wrap'
                    }}>
                        {businessInfo.socialMedia.instagram && (
                            <div style={{
                                padding: '8px 16px',
                                background: 'rgba(225, 48, 108, 0.1)',
                                border: '1px solid rgba(225, 48, 108, 0.3)',
                                borderRadius: '12px',
                                color: '#E1306C',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                opacity: 0.7
                            }}>
                                📷 {businessInfo.socialMedia.instagram}
                            </div>
                        )}
                    </div>
                )}

                {/* Action Buttons - Only for regular users, not business accounts or owner */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    marginTop: '1rem'
                }}>
                    {/* Join Community Button - Only show for regular users (not business accounts, not owner) */}
                    {currentUser?.uid !== partnerId && userProfile?.accountType !== 'business' ? (
                        <button
                            onClick={handleJoinCommunity}
                            disabled={joiningCommunity}
                            style={{
                                padding: '16px 20px',
                                background: isMember
                                    ? 'var(--bg-card)'
                                    : 'linear-gradient(135deg, #8b5cf6, #ec4899, #f97316)',
                                border: isMember ? '1px solid var(--border-color)' : 'none',
                                borderRadius: '16px',
                                color: 'white',
                                fontWeight: '800',
                                fontSize: '1rem',
                                cursor: joiningCommunity ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                opacity: joiningCommunity ? 0.6 : 1,
                                boxShadow: isMember ? 'none' : '0 4px 20px rgba(139, 92, 246, 0.3)',
                                transform: 'translateY(0)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                            onMouseEnter={(e) => {
                                if (!joiningCommunity && !isMember) {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 6px 30px rgba(139, 92, 246, 0.4)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!joiningCommunity && !isMember) {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(139, 92, 246, 0.3)';
                                }
                            }}
                        >
                            <FaUsers style={{ fontSize: '1.1rem' }} />
                            {joiningCommunity
                                ? 'Processing...'
                                : isMember
                                    ? `Joined (${memberCount} members)`
                                    : `Join Community (${memberCount} members)`
                            }
                        </button>
                    ) : null}

                    {/* Create Invitation Button - Only for regular users (not business accounts, not owner) */}
                    {currentUser?.uid !== partnerId && userProfile?.accountType !== 'business' && (
                        <button
                            onClick={handleCreateInvitation}
                            style={{
                                padding: '16px 20px',
                                background: 'var(--bg-card)',
                                border: '2px solid transparent',
                                backgroundImage: 'linear-gradient(var(--bg-card), var(--bg-card)), linear-gradient(135deg, #8b5cf6, #ec4899)',
                                backgroundOrigin: 'border-box',
                                backgroundClip: 'padding-box, border-box',
                                borderRadius: '16px',
                                color: 'white',
                                fontWeight: '800',
                                fontSize: '1rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                transform: 'translateY(0)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 30px rgba(139, 92, 246, 0.2)';
                                e.currentTarget.style.backgroundImage = 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1)), linear-gradient(135deg, #8b5cf6, #ec4899)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                                e.currentTarget.style.backgroundImage = 'linear-gradient(var(--bg-card), var(--bg-card)), linear-gradient(135deg, #8b5cf6, #ec4899)';
                            }}
                        >
                            <FaUserPlus style={{ fontSize: '1.1rem' }} />
                            Create Invitation Here
                        </button>
                    )}
                </div>
            </div>

            {/* Delivery Links Section - Premium Feature */}
            <DeliveryLinksSection
                partner={partner}
                isOwner={isOwner}
                deliveryLinks={deliveryLinks}
                tempDeliveryLinks={tempDeliveryLinks}
                setTempDeliveryLinks={setTempDeliveryLinks}
                editingDeliveryLinks={editingDeliveryLinks}
                setEditingDeliveryLinks={setEditingDeliveryLinks}
                onSave={handleSaveDeliveryLinks}
                onCancel={handleCancelDeliveryLinks}
            />

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: '8px',
                padding: '1rem 1.5rem',
                borderBottom: '1px solid var(--border-color)',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch'
            }}>
                {['about', 'services', 'hours', 'contact'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '10px 20px',
                            background: activeTab === tab ? 'var(--primary)' : 'transparent',
                            border: activeTab === tab ? 'none' : '1px solid var(--border-color)',
                            color: activeTab === tab ? 'white' : 'var(--text-main)',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontWeight: '700',
                            fontSize: '0.85rem',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s'
                        }}
                    >
                        {tab === 'about' ? 'About' : tab === 'services' ? (businessInfo.servicesLabel || 'Services') : tab === 'hours' ? 'Hours' : 'Contact'}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem' }}>
                {activeTab === 'about' && (
                    <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1rem' }}>
                            About the Business
                        </h3>
                        {businessInfo.description ? (
                            <p style={{
                                color: 'var(--text-secondary)',
                                lineHeight: '1.8',
                                fontSize: '0.95rem',
                                marginBottom: '2rem'
                            }}>
                                {businessInfo.description}
                            </p>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>No description available</p>
                        )}


                        {/* Enhanced Gallery Section */}
                        <EnhancedGallery
                            partnerId={partnerId}
                            partner={partner}
                            isOwner={isOwner}
                        />



                        {/* Enhanced Reviews Section */}
                        <EnhancedReviews
                            reviews={reviews}
                            partnerId={partnerId}
                            isOwner={isOwner}
                            currentUser={currentUser}
                            userProfile={userProfile}
                            onWriteReview={() => setShowReviewModal(true)}
                            averageRating={averageRating}
                        />

                        {/* Menu Showcase Section */}
                        <MenuShowcase
                            partnerId={partnerId}
                            menuData={businessInfo.menu || []}
                            isOwner={isOwner}
                        />

                    </div>
                )}

                {/* Services Tab */}
                {activeTab === 'services' && (
                    <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1rem' }}>
                            {businessInfo.servicesLabel || 'Services'}
                        </h3>
                        {businessInfo.services && businessInfo.services.length > 0 ? (
                            <div style={{ display: 'grid', gap: '12px' }}>
                                {businessInfo.services.map((service, index) => (
                                    <div key={index} style={{
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '16px',
                                        overflow: 'hidden',
                                        transition: 'transform 0.2s, box-shadow 0.2s'
                                    }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 8px 20px rgba(139, 92, 246, 0.2)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}>
                                        <div style={{ display: 'flex', gap: 0 }}>
                                            {/* Icon or Image - Full Height */}
                                            <div style={{
                                                width: '120px',
                                                minWidth: '120px',
                                                background: service.image
                                                    ? `url(${service.image})`
                                                    : 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(244, 63, 94, 0.1) 100%)',
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                borderRight: '1px solid var(--border-color)',
                                                flexShrink: 0
                                            }}>
                                                {!service.image && service.icon && (
                                                    <ServiceIcon iconId={service.icon} size={40} />
                                                )}
                                                {!service.image && !service.icon && (
                                                    <span style={{ fontSize: '2.5rem' }}>🍽️</span>
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                                                {/* Name */}
                                                <h4 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, marginBottom: '0.5rem' }}>
                                                    {service.name}
                                                </h4>

                                                {/* Description */}
                                                {service.description && (
                                                    <p style={{
                                                        color: 'var(--text-muted)',
                                                        fontSize: '0.85rem',
                                                        marginBottom: '0.75rem',
                                                        lineHeight: '1.5',
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: 'vertical',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        flex: 1
                                                    }}>
                                                        {service.description}
                                                    </p>
                                                )}

                                                {/* Price and Category Row */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginTop: 'auto' }}>
                                                    {/* Category */}
                                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                        {service.category && (
                                                            <span style={{
                                                                display: 'inline-block',
                                                                padding: '4px 10px',
                                                                background: 'rgba(139, 92, 246, 0.15)',
                                                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                                                borderRadius: '8px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: '600',
                                                                color: 'var(--primary)'
                                                            }}>
                                                                {service.category}
                                                            </span>
                                                        )}
                                                        {service.isPopular && (
                                                            <span style={{
                                                                display: 'inline-block',
                                                                padding: '4px 10px',
                                                                background: 'rgba(251, 191, 36, 0.15)',
                                                                border: '1px solid rgba(251, 191, 36, 0.3)',
                                                                borderRadius: '8px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: '600',
                                                                color: '#f59e0b'
                                                            }}>
                                                                ⭐ Popular
                                                            </span>
                                                        )}
                                                        {service.isNew && (
                                                            <span style={{
                                                                display: 'inline-block',
                                                                padding: '4px 10px',
                                                                background: 'rgba(34, 197, 94, 0.15)',
                                                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                                                borderRadius: '8px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: '600',
                                                                color: '#22c55e'
                                                            }}>
                                                                🆕 New
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Price */}
                                                    <span style={{
                                                        fontSize: '1.2rem',
                                                        fontWeight: '900',
                                                        color: 'var(--primary)',
                                                        whiteSpace: 'nowrap',
                                                        marginLeft: '1rem'
                                                    }}>
                                                        {service.price} {service.currency || 'SAR'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                No services added yet.
                            </p>
                        )}
                    </div>
                )}

                {/* Hours Tab - NEW Business Hours Component */}
                {activeTab === 'hours' && (
                    <BusinessHours
                        partnerId={partnerId}
                        businessInfo={partner.businessInfo}
                        isOwner={isOwner}
                    />
                )}

                {/* Contact Tab */}
                {activeTab === 'contact' && (
                    <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1rem' }}>
                            Contact Information
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {businessInfo.phone && (
                                <div style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    padding: '1.25rem',
                                    display: 'flex', alignItems: 'center', gap: '1rem'
                                }}>
                                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', fontSize: '1.3rem' }}><FaPhone /></div>
                                    <div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Phone</div><div style={{ fontWeight: '700' }}>{businessInfo.phone}</div></div>
                                </div>
                            )}
                            {businessInfo.address && (
                                <div style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    padding: '1.25rem',
                                    display: 'flex', alignItems: 'center', gap: '1rem'
                                }}>
                                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '1.3rem' }}><FaMapMarkerAlt /></div>
                                    <div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Address</div><div style={{ fontWeight: '700' }}>{businessInfo.address} {businessInfo.city && `, ${businessInfo.city}`}</div></div>
                                </div>
                            )}

                            {/* Embedded Map */}
                            {businessInfo.address && (
                                <div style={{
                                    height: '300px',
                                    borderRadius: '16px',
                                    overflow: 'hidden',
                                    border: '2px solid var(--border-color)',
                                    marginTop: '1rem',
                                    position: 'relative',
                                    zIndex: 0
                                }}>
                                    <iframe
                                        src={`https://maps.google.com/maps?q=${encodeURIComponent(businessInfo.address + (businessInfo.city ? ', ' + businessInfo.city : '') + (businessInfo.country ? ', ' + businessInfo.country : ''))}&output=embed`}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            border: 0,
                                            borderRadius: '16px'
                                        }}
                                        loading="lazy"
                                        allowFullScreen
                                        title="Business Location"
                                    />
                                </div>
                            )}

                            {/* Website Link */}
                            {businessInfo.website && (
                                <div style={{
                                    background: 'var(--bg-card)',
                                    border: `1px solid ${isPremium ? 'var(--border-color)' : 'rgba(251, 191, 36, 0.3)'}`,
                                    borderRadius: '12px',
                                    padding: '1.25rem',
                                    display: 'flex', alignItems: 'center', gap: '1rem',
                                    cursor: isPremium ? 'pointer' : 'not-allowed',
                                    transition: 'all 0.2s',
                                    opacity: isPremium ? 1 : 0.6,
                                    position: 'relative'
                                }}
                                    onClick={() => isPremium && window.open(businessInfo.website.startsWith('http') ? businessInfo.website : `https://${businessInfo.website}`, '_blank')}
                                    onMouseEnter={(e) => {
                                        if (isPremium) {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 8px 20px rgba(139, 92, 246, 0.2)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontSize: '1.3rem' }}><FaGlobe /></div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Website</div>
                                        <div style={{ fontWeight: '700' }}>{isPremium ? businessInfo.website : '••••••••'}</div>
                                    </div>
                                    {isPremium ? (
                                        <FaExternalLinkAlt style={{ color: 'var(--text-muted)', fontSize: '1rem' }} />
                                    ) : (
                                        <span style={{
                                            padding: '4px 8px',
                                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                            borderRadius: '6px',
                                            fontSize: '0.7rem',
                                            fontWeight: '800',
                                            color: 'white'
                                        }}>
                                            👑 Premium
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Social Media Links */}
                            {(businessInfo.instagram || businessInfo.twitter || businessInfo.facebook) && (
                                <div>
                                    <h4 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
                                        Follow Us
                                    </h4>
                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                        {businessInfo.instagram && (
                                            <button
                                                onClick={() => isPremium && window.open(`https://instagram.com/${businessInfo.instagram.replace('@', '')}`, '_blank')}
                                                disabled={!isPremium}
                                                style={{
                                                    flex: '1 1 calc(33.333% - 8px)',
                                                    minWidth: '100px',
                                                    padding: '1rem',
                                                    background: isPremium ? 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' : 'rgba(156, 163, 175, 0.3)',
                                                    border: 'none',
                                                    borderRadius: '12px',
                                                    color: 'white',
                                                    fontWeight: '700',
                                                    fontSize: '0.9rem',
                                                    cursor: isPremium ? 'pointer' : 'not-allowed',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    transition: 'all 0.2s',
                                                    opacity: isPremium ? 1 : 0.6,
                                                    position: 'relative'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (isPremium) {
                                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(240, 148, 51, 0.4)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.boxShadow = 'none';
                                                }}
                                            >
                                                <FaInstagram style={{ fontSize: '1.5rem' }} />
                                                <span style={{ fontSize: '0.75rem' }}>{isPremium ? 'Instagram' : '👑 Premium'}</span>
                                            </button>
                                        )}
                                        {businessInfo.twitter && (
                                            <button
                                                onClick={() => isPremium && window.open(`https://twitter.com/${businessInfo.twitter.replace('@', '')}`, '_blank')}
                                                disabled={!isPremium}
                                                style={{
                                                    flex: '1 1 calc(33.333% - 8px)',
                                                    minWidth: '100px',
                                                    padding: '1rem',
                                                    background: isPremium ? 'linear-gradient(135deg, #1DA1F2, #0d8bd9)' : 'rgba(156, 163, 175, 0.3)',
                                                    border: 'none',
                                                    borderRadius: '12px',
                                                    color: 'white',
                                                    fontWeight: '700',
                                                    fontSize: '0.9rem',
                                                    cursor: isPremium ? 'pointer' : 'not-allowed',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    transition: 'all 0.2s',
                                                    opacity: isPremium ? 1 : 0.6,
                                                    position: 'relative'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (isPremium) {
                                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(29, 161, 242, 0.4)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.boxShadow = 'none';
                                                }}
                                            >
                                                <FaTwitter style={{ fontSize: '1.5rem' }} />
                                                <span style={{ fontSize: '0.75rem' }}>{isPremium ? 'Twitter' : '👑 Premium'}</span>
                                            </button>
                                        )}
                                        {businessInfo.facebook && (
                                            <button
                                                onClick={() => isPremium && window.open(businessInfo.facebook.startsWith('http') ? businessInfo.facebook : `https://facebook.com/${businessInfo.facebook}`, '_blank')}
                                                disabled={!isPremium}
                                                style={{
                                                    flex: '1 1 calc(33.333% - 8px)',
                                                    minWidth: '100px',
                                                    padding: '1rem',
                                                    background: isPremium ? 'linear-gradient(135deg, #1877F2, #0d65d9)' : 'rgba(156, 163, 175, 0.3)',
                                                    border: 'none',
                                                    borderRadius: '12px',
                                                    color: 'white',
                                                    fontWeight: '700',
                                                    fontSize: '0.9rem',
                                                    cursor: isPremium ? 'pointer' : 'not-allowed',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    transition: 'all 0.2s',
                                                    opacity: isPremium ? 1 : 0.6,
                                                    position: 'relative'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (isPremium) {
                                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(24, 119, 242, 0.4)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.boxShadow = 'none';
                                                }}
                                            >
                                                <FaFacebook style={{ fontSize: '1.5rem' }} />
                                                <span style={{ fontSize: '0.75rem' }}>{isPremium ? 'Facebook' : '👑 Premium'}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Open in Google Maps Button */}
                            {businessInfo.address && (
                                <button
                                    onClick={() => {
                                        if (isPremium) {
                                            const address = encodeURIComponent(businessInfo.address + (businessInfo.city ? ', ' + businessInfo.city : '') + (businessInfo.country ? ', ' + businessInfo.country : ''));
                                            window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
                                        }
                                    }}
                                    disabled={!isPremium}
                                    style={{
                                        width: '100%',
                                        padding: '1rem',
                                        background: isPremium ? 'linear-gradient(135deg, #4285F4, #34A853)' : 'rgba(156, 163, 175, 0.3)',
                                        border: 'none',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontWeight: '800',
                                        fontSize: '1rem',
                                        cursor: isPremium ? 'pointer' : 'not-allowed',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '10px',
                                        marginTop: '1rem',
                                        transition: 'all 0.2s',
                                        opacity: isPremium ? 1 : 0.6
                                    }}
                                    onMouseEnter={(e) => {
                                        if (isPremium) {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 8px 20px rgba(66, 133, 244, 0.4)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <FaMapMarkerAlt style={{ fontSize: '1.2rem' }} />
                                    {isPremium ? 'Open in Google Maps' : '👑 Premium - Upgrade to View Map'}
                                    {isPremium && <FaExternalLinkAlt style={{ fontSize: '0.9rem' }} />}
                                </button>
                            )}
                        </div>
                    </div>
                )}

            </div>

            {/* Review Modal */}
            {
                showReviewModal && (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '1rem'
                    }}>
                        <div style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '20px',
                            padding: '2rem',
                            maxWidth: '500px',
                            width: '100%'
                        }}>
                            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: '800' }}>
                                Write a Review
                            </h2>

                            {/* Rating Stars */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700' }}>
                                    Rating
                                </label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {[1, 2, 3, 4, 5].map(star => (
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
                                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Comment */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700' }}>
                                    Comment
                                </label>
                                <textarea
                                    value={newReview.comment}
                                    onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                                    placeholder="Share your experience..."
                                    style={{
                                        width: '100%',
                                        minHeight: '120px',
                                        padding: '12px',
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        color: 'var(--text-primary)',
                                        fontSize: '1rem',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            {/* Buttons */}
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => {
                                        setShowReviewModal(false);
                                        setNewReview({ rating: 5, comment: '' });
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        color: 'var(--text-primary)',
                                        fontWeight: '700',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitReview}
                                    disabled={submittingReview}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        background: submittingReview ? '#6b7280' : 'linear-gradient(135deg, var(--primary), #f97316)',
                                        border: 'none',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontWeight: '800',
                                        cursor: submittingReview ? 'not-allowed' : 'pointer',
                                        opacity: submittingReview ? 0.6 : 1
                                    }}
                                >
                                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }



            {/* Lightbox for Gallery */}
            {
                lightboxOpen && (
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.95)',
                            zIndex: 9999,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '20px'
                        }}
                        onClick={() => setLightboxOpen(false)}
                    >
                        {/* Close Button */}
                        <button
                            onClick={() => setLightboxOpen(false)}
                            style={{
                                position: 'absolute',
                                top: '20px',
                                right: '20px',
                                width: '50px',
                                height: '50px',
                                borderRadius: '50%',
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: '2px solid white',
                                color: 'white',
                                fontSize: '1.5rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 10000
                            }}
                        >
                            <FaTimes />
                        </button>

                        {/* Image */}
                        <img
                            src={(partner?.businessInfo?.gallery || [])[lightboxIndex]}
                            alt="Gallery"
                            style={{
                                maxWidth: '90%',
                                maxHeight: '90%',
                                objectFit: 'contain',
                                borderRadius: '12px'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        />

                        {/* Navigation Arrows */}
                        {(partner?.businessInfo?.gallery || []).length > 1 && (
                            <>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setLightboxIndex((prev) =>
                                            prev === 0 ? (partner?.businessInfo?.gallery || []).length - 1 : prev - 1
                                        );
                                    }}
                                    style={{
                                        position: 'absolute',
                                        left: '20px',
                                        width: '50px',
                                        height: '50px',
                                        borderRadius: '50%',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        border: '2px solid white',
                                        color: 'white',
                                        fontSize: '1.5rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    ‹
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setLightboxIndex((prev) =>
                                            prev === (partner?.businessInfo?.gallery || []).length - 1 ? 0 : prev + 1
                                        );
                                    }}
                                    style={{
                                        position: 'absolute',
                                        right: '20px',
                                        width: '50px',
                                        height: '50px',
                                        borderRadius: '50%',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        border: '2px solid white',
                                        color: 'white',
                                        fontSize: '1.5rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    ›
                                </button>
                            </>
                        )}

                        {/* Image Counter */}
                        <div style={{
                            position: 'absolute',
                            bottom: '20px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'rgba(0, 0, 0, 0.7)',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            color: 'white',
                            fontWeight: '700'
                        }}>
                            {lightboxIndex + 1} / {(partner?.businessInfo?.gallery || []).length}
                        </div>
                    </div>
                )
            }

        </div >
    );
};

export default PartnerProfile;
