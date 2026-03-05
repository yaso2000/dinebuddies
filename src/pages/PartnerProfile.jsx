import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useInvitations } from '../context/InvitationContext';
import { uploadImage, deleteImage } from '../utils/imageUpload';
import { FaArrowLeft, FaPhone, FaMapMarkerAlt, FaClock, FaGlobe, FaShareAlt, FaUserPlus, FaUsers, FaEdit, FaInstagram, FaTwitter, FaFacebook, FaExternalLinkAlt, FaShare, FaStar, FaImages, FaTimes, FaPlus, FaHeart, FaRegHeart } from 'react-icons/fa';
import { HiBuildingStorefront } from 'react-icons/hi2';
import { useAuth } from '../context/AuthContext';
import { ServiceIcon } from '../utils/serviceIcons.jsx';
import { updateSocialMetaTags, generatePartnerMetaTags, resetSocialMetaTags } from '../utils/socialMetaTags';
import { useTranslation } from 'react-i18next';
import { getSafeAvatar } from '../utils/avatarUtils';
import DeliveryLinksSection from '../components/DeliveryLinksSection';
import BusinessHours from '../components/BusinessHours';
import EnhancedGallery from '../components/EnhancedGallery';
import EnhancedReviews from '../components/EnhancedReviews';
import MenuShowcase from '../components/MenuShowcase';
import GroupChat from '../components/GroupChat';
import ShareButtons from '../components/ShareButtons';
import CreateInvitationSelector from '../components/CreateInvitationSelector';
import { generateShareCardBlob } from '../utils/shareCardCanvas';
import ServiceModal from '../components/ServiceModal';



const PartnerProfile = () => {
    const { partnerId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser, userProfile, updateUserProfile, isGuest } = useAuth();
    const { joinCommunity, leaveCommunity } = useInvitations();
    const { t } = useTranslation();

    // Ref to prevent snapshot from overwriting optimistic join/leave state
    const joiningRef = React.useRef(false);

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
    const [memberAvatars, setMemberAvatars] = useState([]); // photo_url for first 5 members
    const [joiningCommunity, setJoiningCommunity] = useState(false);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [selectorState, setSelectorState] = useState(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [headerCardPreviewUrl, setHeaderCardPreviewUrl] = useState(null);
    const [headerCardFile, setHeaderCardFile] = useState(null);
    // Inline editing states
    const [services, setServices] = useState([]);
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [editingService, setEditingService] = useState(null);

    const [showBasicInfoModal, setShowBasicInfoModal] = useState(false);
    const [basicInfoForm, setBasicInfoForm] = useState({ businessName: '', tagline: '', businessType: 'Restaurant', description: '' });

    const [showContactModal, setShowContactModal] = useState(false);
    const [contactForm, setContactForm] = useState({ phone: '', email: '', website: '', address: '', city: '' });

    const [savingInfo, setSavingInfo] = useState(false);
    const [coverUploading, setCoverUploading] = useState(false);
    const [logoUploading, setLogoUploading] = useState(false);



    const days = [
        { key: 'sunday', label: 'Sunday' },
        { key: 'monday', label: 'Monday' },
        { key: 'tuesday', label: 'Tuesday' },
        { key: 'wednesday', label: 'Wednesday' },
        { key: 'thursday', label: 'Thursday' },
        { key: 'friday', label: 'Friday' },
        { key: 'saturday', label: 'Saturday' }
    ];

    const fetchPartner = async () => {
        try {
            setLoading(true);
            const docRef = doc(db, 'users', partnerId);

            // Use onSnapshot for real-time updates
            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists() && (docSnap.data().role === 'business')) {
                    const data = docSnap.data();
                    setPartner({ uid: docSnap.id, ...data });

                    // Update member count and membership state in real-time
                    const memberIds = data.communityMembers || [];
                    setMemberCount(memberIds.length);
                    // Only update isMember from snapshot when NOT in the middle of a join/leave
                    if (currentUser?.uid && !joiningRef.current) {
                        setIsMember(memberIds.includes(currentUser.uid) || memberIds.includes(currentUser.id));
                    }

                    console.log('✅ Partner data updated:', data.subscriptionTier);
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
            console.error('Error fetching partner:', error);
            setLoading(false);
        }
    };

    const checkMembership = async () => {
        // Now handled by partner onSnapshot listener
    };

    const fetchMemberCount = async () => {
        // Now handled by partner onSnapshot listener
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
            } else {
                setAverageRating(0);
            }

            console.log('✅ Reviews loaded:', reviewsData.length);
        } catch (error) {
            console.error('❌ Error fetching reviews:', error);
        }
    };

    useEffect(() => {
        let unsubscribe;
        const setupListener = async () => {
            unsubscribe = await fetchPartner();
        };
        setupListener();
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [partnerId]);

    useEffect(() => {
        const loadAllData = async () => {
            if (partnerId) {
                await Promise.all([
                    fetchActiveInvitations(),
                    fetchReviews()
                ]);
                if (currentUser) {
                    await Promise.all([
                        checkMembership(),
                        fetchMemberCount()
                    ]);
                }
            }
        };
        loadAllData();
    }, [currentUser, partnerId, partner?.uid]); // Reduced dependency array

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

    // Load services when partner data changes
    useEffect(() => {
        if (partner?.businessInfo?.services) {
            setServices(partner.businessInfo.services);
        }
    }, [partner]);

    // Fetch avatars for first 5 community members
    useEffect(() => {
        const memberIds = partner?.communityMembers || [];
        if (memberIds.length === 0) { setMemberAvatars([]); return; }
        const top5 = memberIds.slice(0, 5);
        Promise.all(
            top5.map(uid =>
                getDoc(doc(db, 'users', uid))
                    .then(snap => snap.exists() ? (snap.data().photo_url || null) : null)
                    .catch(() => null)
            )
        ).then(photos => setMemberAvatars(photos.filter(Boolean)));
    }, [partner?.communityMembers?.length]);

    const viewTracked = useRef(false);
    useEffect(() => {
        const trackProfileView = async () => {
            if (viewTracked.current || currentUser?.uid === partnerId || !partner) return;

            const viewKey = `profile_view_${partnerId}`;
            const lastView = localStorage.getItem(viewKey);
            const now = Date.now();

            if (lastView && (now - parseInt(lastView)) < 24 * 60 * 60 * 1000) return;

            try {
                const partnerRef = doc(db, 'users', partnerId);
                const currentViews = partner?.businessInfo?.profileViews || 0;
                await updateDoc(partnerRef, { 'businessInfo.profileViews': currentViews + 1 });
                localStorage.setItem(viewKey, now.toString());
                viewTracked.current = true;
            } catch (error) {
                console.error('❌ Error tracking profile view:', error);
            }
        };

        if (partnerId && partner && !viewTracked.current) {
            trackProfileView();
        }
    }, [partnerId, partner?.uid, currentUser?.uid]);

    // Update social meta tags
    useEffect(() => {
        if (partner) {
            const metaData = generatePartnerMetaTags(partner);
            updateSocialMetaTags(metaData);
        }
        return () => resetSocialMetaTags();
    }, [partner]);

    // Robust Loading State
    // Loading check moved below all hooks to prevent order mismatch





    const handleSubmitReview = async () => {
        if (!currentUser) {
            alert('Please login to submit a review');
            return;
        }

        // Check if user is a business account
        if (userProfile?.isBusiness) {
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
                userPhoto: getSafeAvatar(userProfile || currentUser),
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




    const handleJoinCommunity = async () => {
        if (!currentUser) {
            navigate('/login');
            return;
        }

        if (userProfile?.isBusiness) {
            alert('Business accounts cannot join other communities.');
            return;
        }

        // Set flag BEFORE the optimistic update so snapshot won't override it
        joiningRef.current = true;
        setJoiningCommunity(true);

        // Optimistic UI
        const wasJoined = isMember;
        setIsMember(!wasJoined);
        setMemberCount(prev => wasJoined ? Math.max(0, prev - 1) : prev + 1);

        try {
            if (wasJoined) {
                await leaveCommunity(partnerId);
            } else {
                await joinCommunity(partnerId);
            }
        } catch (error) {
            console.error('Error toggling community membership:', error);
            // Revert on error
            setIsMember(wasJoined);
            setMemberCount(prev => wasJoined ? prev + 1 : Math.max(0, prev - 1));
        } finally {
            setJoiningCommunity(false);
            // Small delay then allow snapshot to sync naturally
            setTimeout(() => { joiningRef.current = false; }, 1500);
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

        // Open selector with prefilled data
        setSelectorState({
            prefilledData: {
                restaurantName: partner.display_name,
                restaurantImage: businessInfo.coverImage,
                location: businessInfo.address,
                city: businessInfo.city,
                lat: businessInfo.lat,
                lng: businessInfo.lng
            }
        });
        setIsSelectorOpen(true);
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
        if (!currentUser || isGuest) {
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
                    image: getSafeAvatar(partner),
                    address: partner.businessInfo?.address || '',
                    city: partner.businessInfo?.city || '',
                    source: 'business',
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

        try {
            let newFavorites = [...(userProfile.favoritePlaces || [])];

            if (isFavorite) {
                newFavorites = newFavorites.filter(p => p.businessId !== partnerId);
            } else {
                const favoritePlace = {
                    businessId: partner.uid,
                    name: partner.display_name,
                    image: getSafeAvatar(partner),
                    address: partner.businessInfo?.address || '',
                    city: partner.businessInfo?.city || '',
                    source: 'business',
                    addedAt: new Date().toISOString()
                };
                newFavorites.push(favoritePlace);
            }

            // Sync with context
            await updateUserProfile({ favoritePlaces: newFavorites });
        } catch (e) {
            console.error('❌ Error in handleToggleFavoriteSafe:', e);
        }
    };



    const handleShare = async () => {
        if (!partner) return;
        const shareTitle = partner.display_name || 'DineBuddies Partner';
        const storyData = {
            title: shareTitle,
            image: partner.businessInfo?.coverImage || getSafeAvatar(partner),
            description: partner.businessInfo?.description,
            location: partner.businessInfo?.address || partner.businessInfo?.city,
            hostName: shareTitle,
            hostImage: getSafeAvatar(partner),
        };
        try {
            setIsSharing(true);
            const blob = await generateShareCardBlob(storyData, 'partner');
            if (!blob) throw new Error('No blob');
            const file = new File([blob], 'business-card.png', { type: 'image/png' });
            // Always show the overlay — let the user share from fresh gesture
            setHeaderCardFile(file);
            setHeaderCardPreviewUrl(URL.createObjectURL(blob));
        } catch (err) {
            console.error('Share error:', err);
        } finally {
            setIsSharing(false);
        }
    };

    const handleShareFromOverlay = async () => {
        if (!headerCardFile) return;
        const shareTitle = partner?.display_name || 'DineBuddies Partner';
        const shareText = `Check out ${shareTitle} on DineBuddies!`;
        try {
            if (navigator.canShare && navigator.canShare({ files: [headerCardFile] })) {
                await navigator.share({ files: [headerCardFile], title: shareTitle, text: shareText });
            } else if (navigator.share) {
                await navigator.share({ title: shareTitle, text: shareText, url: window.location.href });
            }
        } catch (e) { /* cancelled */ }
    };

    const closeHeaderPreview = () => {
        if (headerCardPreviewUrl) URL.revokeObjectURL(headerCardPreviewUrl);
        setHeaderCardPreviewUrl(null);
        setHeaderCardFile(null);
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

    // Inline edit handlers
    const handleAddService = async (serviceData) => {
        try {
            let updated;
            if (editingService !== null) {
                updated = services.map((s, i) => i === editingService ? serviceData : s);
            } else {
                updated = [...services, serviceData];
            }
            setServices(updated);
            const userRef = doc(db, 'users', partnerId);
            await updateDoc(userRef, { 'businessInfo.services': updated });
            setShowServiceModal(false);
            setEditingService(null);
        } catch (err) { console.error('Error saving service:', err); }
    };

    const handleDeleteService = async (index) => {
        if (!window.confirm('Delete this service?')) return;
        const updated = services.filter((_, i) => i !== index);
        setServices(updated);
        const userRef = doc(db, 'users', partnerId);
        await updateDoc(userRef, { 'businessInfo.services': updated });
    };

    const handleCoverUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            setCoverUploading(true);
            const url = await uploadImage(file, `covers/${partnerId}/cover.jpg`, null, { maxSizeMB: 1, maxWidthOrHeight: 1600 });
            await updateDoc(doc(db, 'users', partnerId), { 'businessInfo.coverImage': url });
        } catch (err) { alert('Upload failed'); } finally { setCoverUploading(false); }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            setLogoUploading(true);
            const url = await uploadImage(file, `logos/${partnerId}/logo.jpg`, null, { maxSizeMB: 0.5, maxWidthOrHeight: 400 });
            await updateDoc(doc(db, 'users', partnerId), { photo_url: url });
        } catch (err) { alert('Upload failed'); } finally { setLogoUploading(false); }
    };

    const openBasicInfoModal = () => {
        setBasicInfoForm({
            businessName: partner.display_name || '',
            tagline: businessInfo.tagline || '',
            businessType: businessInfo.businessType || 'Restaurant',
            description: businessInfo.description || ''
        });
        setShowBasicInfoModal(true);
    };

    const saveBasicInfo = async () => {
        setSavingInfo(true);
        try {
            await updateDoc(doc(db, 'users', partnerId), {
                display_name: basicInfoForm.businessName,
                'businessInfo.tagline': basicInfoForm.tagline,
                'businessInfo.businessType': basicInfoForm.businessType,
                'businessInfo.description': basicInfoForm.description
            });
            setShowBasicInfoModal(false);
        } catch (err) { alert('Save failed'); } finally { setSavingInfo(false); }
    };

    const openContactModal = () => {
        setContactForm({
            phone: businessInfo.phone || '',
            email: businessInfo.email || '',
            website: businessInfo.website || '',
            address: businessInfo.address || '',
            city: businessInfo.city || ''
        });
        setShowContactModal(true);
    };

    const saveContact = async () => {
        setSavingInfo(true);
        try {
            await updateDoc(doc(db, 'users', partnerId), {
                'businessInfo.phone': contactForm.phone,
                'businessInfo.email': contactForm.email,
                'businessInfo.website': contactForm.website,
                'businessInfo.address': contactForm.address,
                'businessInfo.city': contactForm.city
            });
            setShowContactModal(false);
        } catch (err) { alert('Save failed'); } finally { setSavingInfo(false); }
    };




    if (loading || !partner) {
        return (
            <div className="page-container" style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                background: 'var(--bg-body)',
                padding: '2rem',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <div className="loader-ring"></div>
                <p style={{ marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {!partner && !loading ? t('partner_not_found', 'Partner not found') : t('loading_partner', 'Finding partner...')}
                </p>
                <button
                    onClick={() => navigate('/')}
                    style={{
                        marginTop: '20px',
                        padding: '10px 20px',
                        borderRadius: '12px',
                        background: 'rgba(139, 92, 246, 0.1)',
                        border: '1px solid var(--primary)',
                        color: 'var(--primary)',
                        cursor: 'pointer'
                    }}
                >
                    {t('back_to_home', 'Back to Home')}
                </button>
            </div>
        );
    }

    const businessInfo = partner.businessInfo || {};
    const tier = partner.subscriptionTier || 'free';
    const isPaid = tier === 'professional' || tier === 'elite' || tier === 'premium';
    const isElite = tier === 'elite' || tier === 'premium';
    const isPremium = isPaid;
    const isOwner = currentUser?.uid === partnerId;

    // ── Brand Kit: only apply custom colors when business has saved a Brand Kit
    const brandKit = businessInfo?.brandKit || {};
    const _p = brandKit.primaryColor;   // undefined → no brand kit
    const _s = brandKit.secondaryColor || _p;
    const _br = brandKit.buttonStyle || '14px';
    const _ff = brandKit.fontFamily || undefined;

    // tc = null for unbranded businesses → th() falls back to default CSS styles
    const tc = _p ? {
        accent: _p,
        accentText: '#ffffff',
        border: `${_p}55`,
        badgeBg: `${_p}22`,
        badgeText: _p,
        tabActive: _p,
        headerGlow: `0 0 40px ${_p}40`,
        swatchGradient: `linear-gradient(135deg, ${_p}, ${_s})`,
        gradientFrom: 'rgba(0,0,0,0.85)',
        gradientTo: 'rgba(0,0,0,0.97)',
        footerBg: `linear-gradient(135deg, ${_p}cc, ${_s}88)`,
        btnShadow: `0 8px 24px ${_p}44`,
        cardShadow: `0 4px 20px ${_p}22`,
        btnBorderRadius: _br,
        fontFamily: _ff,
        cardBg: undefined,
    } : null;

    // th() returns themed when brandKit active, fallback otherwise
    const th = (themed, fallback) => tc ? themed : fallback;


    // Verified = profile has both cover image and logo
    const isVerified = !!(businessInfo.coverImage && partner.photo_url);


    return (
        <div className="page-container" style={{
            paddingTop: '0',
            paddingBottom: '100px',
            background: th(tc?.cardBg, undefined),
            minHeight: '100vh'
        }}>
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
                        maxWidth: '200px',
                        fontFamily: tc?.fontFamily || undefined
                    }}>
                        {partner.display_name || 'Business'}
                        {isVerified && (
                            <span title="Verified Profile" style={{ marginLeft: '6px', fontSize: '0.9rem' }}>✅</span>
                        )}
                    </h3>

                    {/* Business Type + Cuisine + Price Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 8px',
                            background: th(tc?.badgeBg, 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(236, 72, 153, 0.15))'),
                            border: `1px solid ${th(tc?.border, 'rgba(139, 92, 246, 0.4)')}`,
                            borderRadius: '10px',
                            fontSize: '0.65rem',
                            fontWeight: '700',
                            color: th(tc?.badgeText, 'var(--primary)'),
                            letterSpacing: '0.3px'
                        }}>
                            {businessInfo.businessType || 'Restaurant'}
                        </div>
                        {businessInfo.cuisineType && (
                            <div style={{
                                display: 'inline-flex', alignItems: 'center',
                                padding: '2px 8px',
                                background: 'rgba(52,211,153,0.12)',
                                border: '1px solid rgba(52,211,153,0.35)',
                                borderRadius: '10px',
                                fontSize: '0.65rem', fontWeight: '700', color: '#34d399'
                            }}>
                                {businessInfo.cuisineType}
                            </div>
                        )}
                        {businessInfo.priceRange && (
                            <div style={{
                                display: 'inline-flex', alignItems: 'center',
                                padding: '2px 8px',
                                background: 'rgba(251,191,36,0.12)',
                                border: '1px solid rgba(251,191,36,0.35)',
                                borderRadius: '10px',
                                fontSize: '0.65rem', fontWeight: '700', color: '#fbbf24'
                            }}>
                                {businessInfo.priceRange}
                            </div>
                        )}
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
                    <button className="back-btn" onClick={handleShare} disabled={isSharing} title="Share">
                        {isSharing ? '⏳' : <FaShare />}
                    </button>
                </div>
            </header>

            {/* Card preview overlay */}
            {headerCardPreviewUrl && (
                <div
                    onClick={closeHeaderPreview}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        background: 'rgba(0,0,0,0.8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '20px',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: '#1e1e2e', borderRadius: 20, padding: 20,
                            maxWidth: 380, width: '100%', position: 'relative',
                            boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
                        }}
                    >
                        <button onClick={closeHeaderPreview} style={{
                            position: 'absolute', top: 10, right: 10,
                            width: 30, height: 30, borderRadius: '50%', border: 'none',
                            background: 'rgba(255,255,255,0.15)', color: 'white',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>✕</button>

                        <img
                            src={headerCardPreviewUrl} alt="Business Card"
                            style={{ width: '100%', borderRadius: 12, display: 'block', marginBottom: 14 }}
                        />

                        <div style={{ display: 'flex', gap: 10 }}>
                            {/* Share — fresh user gesture so navigator.share({files}) works like invitations */}
                            <button
                                onClick={handleShareFromOverlay}
                                style={{
                                    flex: 1, padding: '13px 0', borderRadius: 12, border: 'none',
                                    background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                                    color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                }}
                            >
                                📤 {t('share_image', 'Share Image')}
                            </button>

                            {/* Download fallback */}
                            <a
                                href={headerCardPreviewUrl} download="business-card.png"
                                style={{
                                    padding: '13px 16px', borderRadius: 12, textDecoration: 'none',
                                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                                    color: 'white', fontSize: '1rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                            >⬇</a>
                        </div>
                    </div>
                </div>
            )}

            {/* Cover Image with Logo and Status Badges */}
            <div style={{
                position: 'relative',
                width: '100%',
                height: '250px',
                background: businessInfo.coverImage
                    ? `url(${businessInfo.coverImage})`
                    : th(tc?.gradientFrom ? `linear-gradient(135deg, ${tc.gradientFrom}, ${tc.gradientTo})` : null, 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(236, 72, 153, 0.3))'),
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                boxShadow: tc ? tc.headerGlow : undefined,
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

                        {/* Logo Upload Overlay - Owner Only */}
                        {isOwner && (
                            <label style={{
                                position: 'absolute', inset: 0, borderRadius: '12px',
                                background: logoUploading ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', transition: 'background 0.2s', zIndex: 1
                            }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.45)'}
                                onMouseLeave={e => e.currentTarget.style.background = logoUploading ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)'}>
                                <span style={{ fontSize: logoUploading ? '0.6rem' : '1rem', color: 'white' }}>
                                    {logoUploading ? '⏳' : '📷'}
                                </span>
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} disabled={logoUploading} />
                            </label>
                        )}


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

                {/* Cover Upload Button - Owner Only */}
                {isOwner && (
                    <label style={{
                        position: 'absolute', bottom: '0.75rem', left: '1rem',
                        zIndex: 3, cursor: 'pointer',
                        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.25)', borderRadius: '10px',
                        padding: '6px 10px', color: 'white', fontSize: '0.75rem', fontWeight: '700',
                        display: 'flex', alignItems: 'center', gap: '5px'
                    }}>
                        {coverUploading ? '⏳' : '📷'} {coverUploading ? 'Uploading...' : 'Change Cover'}
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverUpload} disabled={coverUploading} />
                    </label>
                )}

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
                            if (currentUser && !userProfile?.isBusiness) {
                                if (isGuest) {
                                    navigate('/login');
                                } else {
                                    setShowReviewModal(true);
                                }
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
                            cursor: (currentUser && !userProfile?.isBusiness && !currentUser?.isGuest) ? 'pointer' : 'default',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            if (currentUser && !userProfile?.isBusiness) {
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
                        border: `1px solid ${tc?.accent ? tc.accent + '55' : 'rgba(139, 92, 246, 0.3)'}`,
                        borderRadius: '20px',
                        padding: '0.4rem 0.7rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        <span style={{ fontSize: '1rem' }}>👥</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '800', color: tc?.accent || '#a78bfa' }}>
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
                borderBottom: `1px solid ${th(tc?.border, 'var(--border-color)')}`,
                background: th(tc?.cardBg, undefined)
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
                    {/* Community Row: Avatar Stack + Join/Count Button */}
                    {currentUser?.uid !== partnerId && !userProfile?.isBusiness && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            background: th(tc?.footerBg, 'linear-gradient(135deg, #8b5cf6, #ec4899, #f97316)'),
                            borderRadius: th(tc?.btnBorderRadius, '14px'),
                            boxShadow: th(tc?.btnShadow, '0 4px 16px rgba(139,92,246,0.3)'),
                        }}>
                            {/* Avatar Stack */}
                            <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '4px' }}>
                                {memberAvatars.length > 0 ? (
                                    <>
                                        {memberAvatars.map((url, i) => (
                                            <img
                                                key={i}
                                                src={url}
                                                alt=""
                                                style={{
                                                    width: '26px', height: '26px',
                                                    borderRadius: '50%',
                                                    border: '2px solid rgba(255,255,255,0.6)',
                                                    objectFit: 'cover',
                                                    marginLeft: i === 0 ? 0 : '-8px',
                                                    zIndex: 10 - i,
                                                    position: 'relative'
                                                }}
                                            />
                                        ))}
                                        <span style={{ marginLeft: '10px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.95)', fontWeight: '700' }}>
                                            {memberCount}
                                        </span>
                                    </>
                                ) : (
                                    <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.85)', fontWeight: '600' }}>
                                        <FaUsers style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                        {memberCount > 0 ? memberCount : 'Community'}
                                    </span>
                                )}
                            </div>

                            {/* Join / Joined Button */}
                            <button
                                onClick={() => {
                                    if (isGuest) { navigate('/login'); return; }
                                    handleJoinCommunity();
                                }}
                                disabled={joiningCommunity}
                                style={{
                                    padding: isMember ? '6px 14px' : '7px 18px',
                                    background: isMember ? 'rgba(255,255,255,0.25)' : '#ffffff',
                                    border: isMember ? '1px solid rgba(255,255,255,0.4)' : 'none',
                                    borderRadius: th(tc?.btnBorderRadius, '12px'),
                                    color: isMember ? '#ffffff' : (tc?.accent || '#f97316'),
                                    fontWeight: '900',
                                    fontSize: '0.82rem',
                                    fontFamily: tc?.fontFamily || undefined,
                                    cursor: joiningCommunity ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    transition: 'all 0.2s',
                                    opacity: joiningCommunity ? 0.7 : 1,
                                    whiteSpace: 'nowrap',
                                    boxShadow: isMember ? 'none' : '0 2px 8px rgba(0,0,0,0.15)'
                                }}
                                onMouseEnter={(e) => {
                                    if (joiningCommunity) return;
                                    if (isMember) {
                                        e.currentTarget.style.background = 'rgba(239,68,68,0.3)';
                                        e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (joiningCommunity) return;
                                    e.currentTarget.style.background = isMember ? 'rgba(255,255,255,0.25)' : '#ffffff';
                                    e.currentTarget.style.borderColor = isMember ? 'rgba(255,255,255,0.4)' : 'transparent';
                                }}
                            >
                                {joiningCommunity ? '...' : isMember ? `✓ ${memberCount}` : '+ Join'}
                            </button>
                        </div>
                    )}


                    {/* Create Invitation Button - Only for regular users (not business accounts, not owner) and NOT guests */}
                    {currentUser?.uid !== partnerId && !userProfile?.isBusiness && !currentUser?.isGuest && (
                        <button
                            onClick={handleCreateInvitation}
                            style={{
                                padding: '16px 20px',
                                background: th(tc?.cardBg, 'var(--bg-card)'),
                                border: tc ? 'none' : '2px solid transparent',
                                backgroundImage: tc ? undefined : 'linear-gradient(var(--bg-card), var(--bg-card)), linear-gradient(135deg, #8b5cf6, #ec4899)',
                                backgroundOrigin: tc ? undefined : 'border-box',
                                backgroundClip: tc ? undefined : 'padding-box, border-box',
                                borderRadius: th(tc?.btnBorderRadius, '16px'),
                                color: th(tc?.accent, 'white'),
                                fontWeight: '800',
                                fontSize: '1rem',
                                letterSpacing: tc ? '0.5px' : undefined,
                                textShadow: tc ? `0 0 8px ${tc.accent}88` : undefined,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                transform: 'translateY(0)',
                                position: 'relative',
                                overflow: 'hidden',
                                boxShadow: th(tc?.btnShadow, 'none')
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-3px)';
                                e.currentTarget.style.filter = tc ? 'brightness(1.15)' : undefined;
                                e.currentTarget.style.boxShadow = th(tc?.btnShadow?.replace('0 8px 24px', '0 14px 36px'), '0 6px 30px rgba(139, 92, 246, 0.2)');
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.filter = '';
                                e.currentTarget.style.boxShadow = th(tc?.btnShadow, 'none');
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
                gap: '5px',
                padding: '0.5rem 10px',
                borderBottom: `1px solid ${th(tc?.border, 'var(--border-color)')}`,
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                justifyContent: 'center',
                background: th(tc?.cardBg, undefined)
            }}>
                {['about', 'menu', 'services', 'hours', 'contact'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '6px 10px',
                            background: activeTab === tab
                                ? (tc?.accent || 'var(--primary)')
                                : 'transparent',
                            border: activeTab === tab ? 'none' : '1px solid var(--border-color)',
                            color: activeTab === tab
                                ? (tc?.accentText || 'white')
                                : 'var(--text-main)',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontWeight: '700',
                            fontSize: '0.78rem',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s',
                            boxShadow: activeTab === tab && tc ? `0 0 12px ${tc.accent}55` : 'none'
                        }}
                    >
                        {tab === 'about' ? 'About' : tab === 'menu' ? 'Menu' : tab === 'services' ? 'Services' : tab === 'hours' ? 'Hours' : 'Contact'}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={{ padding: '0.6rem 1rem', maxWidth: '100%', boxSizing: 'border-box', background: th(tc?.cardBg, undefined) }}>
                {activeTab === 'about' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: th(tc?.accent, 'var(--text-main)') }}>About the Business</h3>
                            {isOwner && (
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={() => navigate('/business-pro/brand-kit')}
                                        style={{
                                            padding: '7px 13px', fontSize: '0.78rem', fontWeight: '700',
                                            background: tc ? tc.swatchGradient : 'rgba(139,92,246,0.15)',
                                            border: tc ? `1px solid ${tc.border}` : '1px solid rgba(139,92,246,0.4)',
                                            borderRadius: '10px',
                                            color: tc ? tc.accentText || '#fff' : 'var(--primary)',
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '5px'
                                        }}
                                    >
                                        🎨 Brand Kit
                                    </button>
                                    <button
                                        onClick={openBasicInfoModal}
                                        style={{
                                            padding: '7px 13px', fontSize: '0.78rem', fontWeight: '700',
                                            background: th(tc?.footerBg, 'linear-gradient(135deg, #8b5cf6, #f97316)'),
                                            border: tc ? `1px solid ${tc.border}` : 'none',
                                            borderRadius: '10px',
                                            color: th(tc?.accentText || '#fff', 'white'),
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '5px'
                                        }}
                                    >
                                        ✏️ Edit Info
                                    </button>
                                </div>
                            )}
                        </div>
                        {businessInfo.description ? (
                            <p style={{
                                color: th(tc?.badgeText, 'var(--text-secondary)'),
                                lineHeight: '1.8',
                                fontSize: '0.95rem',
                                marginBottom: '2rem',
                                borderLeft: tc ? `3px solid ${tc.accent}66` : undefined,
                                paddingLeft: tc ? '1rem' : undefined,
                                fontStyle: tc ? 'italic' : undefined
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
                            theme={{ colors: tc }}
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
                            theme={{ colors: tc }}
                        />



                    </div>
                )}

                {/* Menu Tab */}
                {activeTab === 'menu' && (
                    <MenuShowcase
                        partnerId={partnerId}
                        menuData={businessInfo.menu || []}
                        isOwner={isOwner}
                        theme={{ colors: tc }}
                    />
                )}

                {/* Services Tab */}
                {activeTab === 'services' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: th(tc?.accent, 'var(--text-main)') }}>Business Services</h3>
                            {isOwner && (
                                <button
                                    onClick={() => { setEditingService(null); setShowServiceModal(true); }}
                                    style={{
                                        padding: '8px 14px', fontSize: '0.8rem', fontWeight: '700',
                                        background: th(tc?.footerBg, 'linear-gradient(135deg, #8b5cf6, #f97316)'),
                                        border: tc ? `1px solid ${tc.border}` : 'none',
                                        borderRadius: '10px',
                                        color: th(tc?.accentText || '#fff', 'white'),
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                                    }}
                                >
                                    ➕ Add Service
                                </button>
                            )}
                        </div>
                        {services.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
                                {services.map((service, index) => (
                                    <div key={service.id || index} style={{
                                        background: th(tc?.badgeBg, 'var(--bg-card)'),
                                        border: `1px solid ${th(tc?.border, 'var(--border-color)')}`,
                                        borderRadius: '16px', padding: '1rem',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                                        textAlign: 'center', gap: '8px', position: 'relative',
                                        boxShadow: tc ? tc.cardShadow : undefined
                                    }}>
                                        <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>{service.icon || '⚙️'}</div>
                                        <h4 style={{ fontSize: '0.9rem', fontWeight: '700', margin: 0, color: th(tc?.accent, 'var(--text-main)') }}>{service.name}</h4>
                                        {service.description && (
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                                                {service.description}
                                            </p>
                                        )}
                                        {isOwner && (
                                            <div style={{ display: 'flex', gap: '5px', marginTop: '4px' }}>
                                                <button onClick={() => { setEditingService(index); setShowServiceModal(true); }}
                                                    style={{ padding: '3px 8px', fontSize: '0.7rem', background: th(tc?.badgeBg, 'rgba(139,92,246,0.15)'), border: `1px solid ${th(tc?.border, 'rgba(139,92,246,0.3)')}`, borderRadius: '8px', color: th(tc?.accent, 'var(--primary)'), cursor: 'pointer' }}>
                                                    Edit
                                                </button>
                                                <button onClick={() => handleDeleteService(index)}
                                                    style={{ padding: '3px 8px', fontSize: '0.7rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', cursor: 'pointer' }}>
                                                    Del
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No services listed yet.</p>
                                {isOwner && (
                                    <button
                                        onClick={() => { setEditingService(null); setShowServiceModal(true); }}
                                        style={{
                                            padding: '10px 20px', fontSize: '0.85rem', fontWeight: '700',
                                            background: 'linear-gradient(135deg, #8b5cf6, #f97316)',
                                            border: 'none', borderRadius: '12px', color: 'white', cursor: 'pointer'
                                        }}
                                    >
                                        ⚙️ Add Your First Service
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Hours Tab - NEW Business Hours Component */}
                {activeTab === 'hours' && (
                    <BusinessHours
                        partnerId={partnerId}
                        businessInfo={partner.businessInfo}
                        isOwner={isOwner}
                        theme={{ colors: tc }}
                    />
                )}

                {/* Contact Tab */}
                {activeTab === 'contact' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: th(tc?.accent, 'var(--text-main)') }}>Contact Information</h3>
                            {isOwner && (
                                <button
                                    onClick={openContactModal}
                                    style={{
                                        padding: '7px 13px', fontSize: '0.78rem', fontWeight: '700',
                                        background: th(tc?.footerBg, 'linear-gradient(135deg, #8b5cf6, #f97316)'),
                                        border: tc ? `1px solid ${tc.border}` : 'none',
                                        borderRadius: '10px',
                                        color: th(tc?.accentText || '#fff', 'white'),
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '5px'
                                    }}
                                >
                                    ✏️ Edit Contact
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {businessInfo.phone && (
                                <div style={{
                                    background: th(tc?.badgeBg, 'var(--bg-card)'),
                                    border: `1px solid ${th(tc?.border, 'var(--border-color)')}`,
                                    borderRadius: '12px',
                                    padding: '1.25rem',
                                    display: 'flex', alignItems: 'center', gap: '1rem',
                                    boxShadow: th(tc?.cardShadow, 'none')
                                }}>
                                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: th(tc?.badgeBg, 'rgba(34,197,94,0.1)'), border: tc ? `1px solid ${tc.border}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: th(tc?.accent, '#22c55e'), fontSize: '1.3rem' }}><FaPhone /></div>
                                    <div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Phone</div><div style={{ fontWeight: '700', color: th(tc?.accent, 'var(--text-main)') }}>{businessInfo.phone}</div></div>
                                </div>
                            )}
                            {businessInfo.address && (
                                <div style={{
                                    background: th(tc?.badgeBg, 'var(--bg-card)'),
                                    border: `1px solid ${th(tc?.border, 'var(--border-color)')}`,
                                    borderRadius: '12px',
                                    padding: '1.25rem',
                                    display: 'flex', alignItems: 'center', gap: '1rem',
                                    boxShadow: th(tc?.cardShadow, 'none')
                                }}>
                                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: th(tc?.badgeBg, 'rgba(239,68,68,0.1)'), border: tc ? `1px solid ${tc.border}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: th(tc?.accent, '#ef4444'), fontSize: '1.3rem' }}><FaMapMarkerAlt /></div>
                                    <div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Address</div><div style={{ fontWeight: '700', color: th(tc?.accent, 'var(--text-main)') }}>{businessInfo.address} {businessInfo.city && `, ${businessInfo.city}`}</div></div>
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
                                    {!isPaid && (
                                        <div style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            zIndex: 1,
                                            background: 'rgba(0,0,0,0)',
                                            cursor: 'not-allowed'
                                        }} title="Upgrade to interact with the map" />
                                    )}
                                </div>
                            )}

                            {/* Website Link */}
                            {businessInfo.website && (
                                <div style={{
                                    background: th(tc?.badgeBg, 'var(--bg-card)'),
                                    border: `1px solid ${isPremium ? th(tc?.border, 'var(--border-color)') : 'rgba(251, 191, 36, 0.3)'}`,
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
                                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: th(tc?.badgeBg, 'rgba(59,130,246,0.1)'), border: tc ? `1px solid ${tc.border}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: th(tc?.accent, '#3b82f6'), fontSize: '1.3rem' }}><FaGlobe /></div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Website</div>
                                        <div style={{ fontWeight: '700', color: th(tc?.accent, 'var(--text-main)') }}>{isPremium ? businessInfo.website : '••••••••'}</div>
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
                                        background: isPremium
                                            ? th(tc?.swatchGradient, 'linear-gradient(135deg, #8b5cf6, #f97316)')
                                            : 'rgba(156, 163, 175, 0.3)',
                                        border: tc ? `1px solid ${tc.border}` : 'none',
                                        borderRadius: tc ? '14px' : '12px',
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
                                        opacity: isPremium ? 1 : 0.6,
                                        boxShadow: tc && isPremium ? `0 4px 16px ${tc.accent}44` : 'none'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (isPremium) {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = tc
                                                ? `0 8px 24px ${tc.accent}66`
                                                : '0 8px 20px rgba(66, 133, 244, 0.4)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = tc && isPremium ? `0 4px 16px ${tc.accent}44` : 'none';
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
                            background: th(tc?.cardBg, 'var(--bg-card)'),
                            border: `1px solid ${th(tc?.border, 'var(--border-color)')}`,
                            borderRadius: '20px',
                            padding: '2rem',
                            maxWidth: '500px',
                            width: '100%',
                            boxShadow: tc ? tc.headerGlow : undefined
                        }}>
                            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: '800', color: th(tc?.accent, 'var(--text-main)') }}>
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
                                        background: th(tc?.badgeBg, 'var(--bg-primary)'),
                                        border: `1px solid ${th(tc?.border, 'var(--border-color)')}`,
                                        borderRadius: '12px',
                                        color: th(tc?.accent, 'var(--text-main)'),
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
                                        background: submittingReview ? '#6b7280' : th(tc?.footerBg, 'linear-gradient(135deg, var(--primary), #f97316)'),
                                        border: 'none',
                                        borderRadius: '12px',
                                        color: th(tc?.accentText || '#fff', 'white'),
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

            {showShareModal && (
                <div
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={(e) => { e.stopPropagation(); setShowShareModal(false); }}
                >
                    <div
                        style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', maxWidth: '90%', width: '320px' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 style={{ textAlign: 'center', marginBottom: '16px', color: 'white' }}>{t('share_profile') || 'Share Profile'}</h3>
                        <ShareButtons
                            url={window.location.href}
                            title={partner.display_name}
                            description={`Check out ${partner.display_name} on DineBuddies!`}
                            type="partner"
                            storyData={{
                                title: partner.display_name,
                                image: partner.businessInfo?.coverImage || getSafeAvatar(partner),
                                description: partner.businessInfo?.description,
                                location: partner.businessInfo?.address,
                                hostName: partner.display_name,
                                hostImage: getSafeAvatar(partner)
                            }}
                        />
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowShareModal(false); }}
                            style={{ width: '100%', marginTop: '16px', padding: '10px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '8px', cursor: 'pointer' }}
                        >
                            {t('close') || 'Close'}
                        </button>
                    </div>
                </div>
            )}
            {/* Invitation Type Selector Modal */}
            <CreateInvitationSelector
                isOpen={isSelectorOpen}
                onClose={() => setIsSelectorOpen(false)}
                navigationState={selectorState}
            />

            {/* Service Modal - Inline */}
            {showServiceModal && (
                <ServiceModal
                    service={editingService !== null ? services[editingService] : null}
                    onSave={handleAddService}
                    onClose={() => { setShowServiceModal(false); setEditingService(null); }}
                />
            )}

            {/* Basic Info Modal */}
            {showBasicInfoModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '1.5rem', width: '90%', maxWidth: '460px', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>✏️ Edit Basic Info</h3>
                            <button onClick={() => setShowBasicInfoModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
                        </div>
                        {[
                            { label: 'Business Name *', key: 'businessName', type: 'text' },
                            { label: 'Tagline', key: 'tagline', type: 'text' },
                            { label: 'Business Type', key: 'businessType', type: 'text' },
                        ].map(({ label, key, type }) => (
                            <div key={key} style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem' }}>{label}</label>
                                <input type={type} value={basicInfoForm[key]} onChange={e => setBasicInfoForm(p => ({ ...p, [key]: e.target.value }))}
                                    style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-main)', fontSize: '0.9rem' }} />
                            </div>
                        ))}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem' }}>Description</label>
                            <textarea rows={4} value={basicInfoForm.description} onChange={e => setBasicInfoForm(p => ({ ...p, description: e.target.value }))}
                                style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-main)', fontSize: '0.9rem', resize: 'vertical' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={() => setShowBasicInfoModal(false)} style={{ flex: 1, padding: '10px', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
                            <button onClick={saveBasicInfo} disabled={savingInfo} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6, #f97316)', color: 'white', cursor: 'pointer', fontWeight: '700' }}>
                                {savingInfo ? '💾 Saving...' : '💾 Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Contact Modal */}
            {showContactModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '1.5rem', width: '90%', maxWidth: '460px', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>📞 Edit Contact</h3>
                            <button onClick={() => setShowContactModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
                        </div>
                        {[
                            { label: 'Phone', key: 'phone', placeholder: '+61 400 000 000' },
                            { label: 'Email', key: 'email', placeholder: 'info@yourbusiness.com' },
                            { label: 'Website', key: 'website', placeholder: 'https://yourbusiness.com' },
                            { label: 'Address', key: 'address', placeholder: '123 Main St' },
                            { label: 'City', key: 'city', placeholder: 'Sydney' },
                        ].map(({ label, key, placeholder }) => (
                            <div key={key} style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem' }}>{label}</label>
                                <input type="text" value={contactForm[key]} placeholder={placeholder} onChange={e => setContactForm(p => ({ ...p, [key]: e.target.value }))}
                                    style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-main)', fontSize: '0.9rem' }} />
                            </div>
                        ))}
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                            <button onClick={() => setShowContactModal(false)} style={{ flex: 1, padding: '10px', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
                            <button onClick={saveContact} disabled={savingInfo} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6, #f97316)', color: 'white', cursor: 'pointer', fontWeight: '700' }}>
                                {savingInfo ? '💾 Saving...' : '💾 Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>


    );
};

export default PartnerProfile;
