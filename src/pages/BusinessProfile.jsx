import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useInvitations } from '../context/InvitationContext';
import { uploadImage, deleteImage } from '../utils/imageUpload';
import { FaArrowLeft, FaPhone, FaMapMarkerAlt, FaClock, FaGlobe, FaShareAlt, FaUserPlus, FaUsers, FaEdit, FaInstagram, FaTwitter, FaFacebook, FaExternalLinkAlt, FaShare, FaStar, FaImages, FaTimes, FaPlus, FaHeart, FaRegHeart, FaSave, FaEnvelope } from 'react-icons/fa';

import { HiBuildingStorefront } from 'react-icons/hi2';
import { SiTiktok } from 'react-icons/si';
import { useAuth } from '../context/AuthContext';
import { updateSocialMetaTags, generateBusinessMetaTags, resetSocialMetaTags } from '../utils/socialMetaTags';
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
import ServiceModal, { SERVICE_ICONS } from '../components/ServiceModal';
import { getContrastText } from '../utils/colorUtils';
import PremiumBadge from '../components/PremiumBadge';
import PremiumPaywallModal from '../components/PremiumPaywallModal';
import DraftSavedModal from '../components/DraftSavedModal';
import BrandKit from './business-pro/BrandKit';
import PlanBadge from '../components/PlanBadge';
import { useToast } from '../context/ToastContext';

const BUSINESS_TYPES = [
    'Restaurant', 'Cafe', 'Bar', 'Night Club', 'Food Truck', 'Fast Food'
];

// Business profile page; route /business/:businessId (legacy /partner/:id redirects to /business/)
const BusinessProfile = () => {
    const { businessId, partnerId } = useParams();
    const profileId = businessId ?? partnerId;
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser, userProfile, updateUserProfile, isGuest } = useAuth();
    const { joinCommunity, leaveCommunity } = useInvitations();
    const { t } = useTranslation();
    const { showToast } = useToast();

    // Brand Kit preview mode — reads live state from localStorage when ?preview=1
    const isPreviewMode = new URLSearchParams(location.search).get('preview') === '1';
    const [previewBrandKit, setPreviewBrandKit] = useState(() => {
        if (!isPreviewMode) return null;
        try { return JSON.parse(localStorage.getItem('bk_preview') || 'null'); } catch { return null; }
    });
    useEffect(() => {
        if (!isPreviewMode) return;
        const onStorage = (e) => {
            if (e.key === 'bk_preview') {
                try { setPreviewBrandKit(JSON.parse(e.newValue || 'null')); } catch { }
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [isPreviewMode]);

    // Ref to prevent snapshot from overwriting optimistic join/leave state
    const joiningRef = React.useRef(false);

    const [business, setBusiness] = useState(null);
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
    const [pendingServices, setPendingServices] = useState([]);
    const [savingServices, setSavingServices] = useState(false);
    const [showServiceDraftBanner, setShowServiceDraftBanner] = useState(false);
    const [showServiceAddForm, setShowServiceAddForm] = useState(false);
    const [serviceForm, setServiceForm] = useState({ name: '', description: '', icon: '⚙️' });
    const [serviceIconSearch, setServiceIconSearch] = useState('');

    const [showBasicInfoModal, setShowBasicInfoModal] = useState(false);
    const [basicInfoForm, setBasicInfoForm] = useState({ businessName: '', tagline: '', businessType: 'Restaurant', description: '' });

    const [showContactModal, setShowContactModal] = useState(false);
    const [contactForm, setContactForm] = useState({ phone: '', email: '', website: '', address: '', city: '' });
    const [proFieldsNotice, setProFieldsNotice] = useState(null); // list of filled pro field names

    const [savingInfo, setSavingInfo] = useState(false);


    // Premium / Paywall state
    const [showPaywall, setShowPaywall] = useState(false);
    const [paywallFeature, setPaywallFeature] = useState('');

    const [showBrandKitModal, setShowBrandKitModal] = useState(false);

    const [coverUploading, setCoverUploading] = useState(false);
    const [logoUploading, setLogoUploading] = useState(false);





    const fetchBusiness = async () => {
        try {
            setLoading(true);
            const docRef = doc(db, 'users', profileId);

            // Use onSnapshot for real-time updates
            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists() && (docSnap.data().role === 'business')) {
                    const data = docSnap.data();
                    setBusiness({ uid: docSnap.id, ...data });

                    // Update member count and membership state in real-time
                    const memberIds = data.communityMembers || [];
                    setMemberCount(memberIds.length);
                    // Only update isMember from snapshot when NOT in the middle of a join/leave
                    if (currentUser?.uid && !joiningRef.current) {
                        setIsMember(memberIds.includes(currentUser.uid) || memberIds.includes(currentUser.id));
                    }

                } else {
                    console.error('Business not found or not a business account');
                }
                setLoading(false);
            }, (error) => {
                console.error('Error fetching business:', error);
                setLoading(false);
            });

            // Return unsubscribe function
            return unsubscribe;
        } catch (error) {
            console.error('Error fetching business:', error);
            setLoading(false);
        }
    };


    const fetchActiveInvitations = async () => {
        try {
            const invitationsRef = collection(db, 'invitations');
            const q = query(
                invitationsRef,
                where('restaurantId', '==', profileId)
            );
            const snapshot = await getDocs(q);

            // Filter for active invitations (not expired)
            const now = new Date();
            const activeInvitations = snapshot.docs.filter(doc => {
                const data = doc.data();
                const inviteDate = new Date(`${data.date}T${data.time}`);
                return inviteDate > now;
            });

            setActiveInvitationsCount(activeInvitations.length);
        } catch (error) {
            console.error('❌ Error fetching active invitations:', error);
            setActiveInvitationsCount(0);
        }
    };

    const fetchReviews = async () => {
        try {
            const reviewsRef = collection(db, 'reviews');
            const q = query(
                reviewsRef,
                where('profileId', '==', profileId)
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

        } catch (error) {
            console.error('❌ Error fetching reviews:', error);
        }
    };

    useEffect(() => {
        let unsubscribe;
        const setupListener = async () => {
            unsubscribe = await fetchBusiness();
        };
        setupListener();
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [profileId]);

    useEffect(() => {
        const loadAllData = async () => {
            if (profileId) {
                await Promise.all([
                    fetchActiveInvitations(),
                    fetchReviews()
                ]);
            }
        };
        loadAllData();
    }, [currentUser, profileId, business?.uid]);

    // Load delivery links when partner data changes
    useEffect(() => {
        if (business?.businessInfo?.deliveryLinks) {
            const links = business.businessInfo.deliveryLinks;
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
    }, [business]);

    // Load services when partner data changes
    useEffect(() => {
        if (business?.businessInfo?.services) {
            setServices(business.businessInfo.services);
        }
    }, [business]);

    // Keep activeTab valid when visible tabs change (visitor: some tabs hidden when empty)
    const isOwnerProfile = !isPreviewMode && currentUser?.uid === profileId;
    useEffect(() => {
        const info = business?.businessInfo;
        if (!info) return;
        const hasContactInfo = !!(info.phone || info.email || info.address);
        const visibleIds = ['about'];
        if (isOwnerProfile || (info.menu?.length > 0)) visibleIds.push('menu');
        if (isOwnerProfile || (services?.length > 0)) visibleIds.push('services');
        if (isOwnerProfile || info.hours) visibleIds.push('hours');
        if (isOwnerProfile || hasContactInfo) visibleIds.push('contact');
        if (!visibleIds.includes(activeTab)) setActiveTab(visibleIds[0] || 'about');
    }, [isOwnerProfile, business?.businessInfo?.menu?.length, business?.businessInfo?.hours, business?.businessInfo?.phone, business?.businessInfo?.email, business?.businessInfo?.address, services?.length, activeTab]);

    useEffect(() => {
        const memberIds = business?.communityMembers || [];
        if (memberIds.length === 0) { setMemberAvatars([]); return; }
        const last5 = memberIds.slice(-5).reverse(); // last 5, newest first
        Promise.all(
            last5.map(uid =>
                getDoc(doc(db, 'users', uid))
                    .then(snap => snap.exists() ? (snap.data().photo_url || null) : null)
                    .catch(() => null)
            )
        ).then(photos => setMemberAvatars(photos.filter(Boolean)));
    }, [business?.communityMembers?.length]);

    const viewTracked = useRef(false);
    useEffect(() => {
        const trackProfileView = async () => {
            if (viewTracked.current || currentUser?.uid === profileId || !business) return;

            const viewKey = `profile_view_${profileId}`;
            const lastView = localStorage.getItem(viewKey);
            const now = Date.now();

            if (lastView && (now - parseInt(lastView)) < 24 * 60 * 60 * 1000) return;

            try {
                const businessRef = doc(db, 'users', profileId);
                const currentViews = business?.businessInfo?.profileViews || 0;
                await updateDoc(businessRef, { 'businessInfo.profileViews': currentViews + 1 });
                localStorage.setItem(viewKey, now.toString());
                viewTracked.current = true;
            } catch (error) {
                console.error('❌ Error tracking profile view:', error);
            }
        };

        if (profileId && business && !viewTracked.current) {
            trackProfileView();
        }
    }, [profileId, business?.uid, currentUser?.uid]);

    // Update social meta tags
    useEffect(() => {
        if (business) {
            const metaData = generateBusinessMetaTags(business);
            updateSocialMetaTags(metaData);
        }
        return () => resetSocialMetaTags();
    }, [business]);

    // Robust Loading State
    // Loading check moved below all hooks to prevent order mismatch





    const handleSubmitReview = async () => {
        if (!currentUser) {
            showToast(t('login_to_submit_review'), 'error');
            return;
        }

        if (userProfile?.isBusiness) {
            showToast(t('business_cannot_review'), 'error');
            return;
        }

        if (!newReview.comment.trim()) {
            showToast(t('please_write_comment'), 'error');
            return;
        }

        // Check if user already reviewed
        const existingReview = reviews.find(r => r.userId === currentUser.uid);
        if (existingReview) {
            showToast(t('already_reviewed'), 'error');
            return;
        }

        try {
            setSubmittingReview(true);

            // Check in database if user already reviewed
            const reviewsRef = collection(db, 'reviews');
            const existingReviewQuery = query(
                reviewsRef,
                where('profileId', '==', profileId),
                where('userId', '==', currentUser.uid)
            );
            const existingReviewSnapshot = await getDocs(existingReviewQuery);

            if (!existingReviewSnapshot.empty) {
                showToast(t('already_reviewed'), 'error');
                setSubmittingReview(false);
                setShowReviewModal(false);
                return;
            }

            await addDoc(reviewsRef, {
                profileId,
                userId: currentUser.uid,
                userName: userProfile?.displayName || userProfile?.display_name || currentUser.displayName || 'Anonymous',
                userPhoto: getSafeAvatar(userProfile || currentUser),
                rating: newReview.rating,
                comment: newReview.comment.trim(),
                createdAt: serverTimestamp()
            });


            // Small delay to ensure Firestore processes serverTimestamp
            await new Promise(resolve => setTimeout(resolve, 500));

            // Refresh reviews
            await fetchReviews();

            // Reset form
            setNewReview({ rating: 5, comment: '' });
            setShowReviewModal(false);

            showToast(t('review_submitted_success'), 'success');
        } catch (error) {
            console.error('Error submitting review:', error);
            showToast(t('review_submit_failed'), 'error');
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
            showToast(t('business_cannot_join_community'), 'error');
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
                await leaveCommunity(profileId);
            } else {
                await joinCommunity(profileId);
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

        const currentGallery = business?.businessInfo?.gallery || [];
        if (currentGallery.length >= 6) {
            showToast(t('gallery_max_images'), 'error');
            return;
        }

        try {
            setUploadingImage(true);

            // Upload to Firebase Storage using Utility
            const timestamp = Date.now();
            const path = `gallery/${profileId}/${timestamp}.jpg`;

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
            const businessRef = doc(db, 'users', profileId);
            await updateDoc(businessRef, {
                'businessInfo.gallery': updatedGallery
            });

        } catch (error) {
            console.error('❌ Error uploading image:', error);
            showToast(t('upload_image_failed'), 'error');
        } finally {
            setUploadingImage(false);
        }
    };

    const handleDeleteImage = async (imageUrl, index) => {
        if (!window.confirm(t('confirm_delete_image'))) return;

        try {
            // Delete from Storage using Utility
            await deleteImage(imageUrl);

            // Update Firestore
            const currentGallery = business?.businessInfo?.gallery || [];
            const updatedGallery = currentGallery.filter((_, i) => i !== index);
            const businessRef = doc(db, 'users', profileId);
            await updateDoc(businessRef, {
                'businessInfo.gallery': updatedGallery
            });

        } catch (error) {
            console.error('❌ Error deleting image:', error);
            showToast(t('delete_image_failed'), 'error');
        }
    };

    const handleCreateInvitation = () => {
        if (!currentUser) {
            navigate('/login');
            return;
        }

        const businessInfo = business.businessInfo || {};

        // Open selector with prefilled data
        setSelectorState({
            prefilledData: {
                restaurantName: business.display_name,
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
        navigate(`/business/${profileId}/invitations`);
    };

    const formatTime = (time) => {
        if (!time) return '';
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    const isFavorite = userProfile?.favoritePlaces?.some(p => p.businessId === profileId);

    const handleToggleFavorite = async () => {
        if (!currentUser || isGuest) {
            navigate('/login');
            return;
        }

        try {
            let newFavorites = [...(userProfile.favoritePlaces || [])];

            if (isFavorite) {
                // Remove from favorites
                newFavorites = newFavorites.filter(p => p.businessId !== profileId);
            } else {
                // Add to favorites
                const favoritePlace = {
                    businessId: business.uid,
                    name: business.display_name,
                    image: getSafeAvatar(business),
                    address: business.businessInfo?.address || '',
                    city: business.businessInfo?.city || '',
                    source: 'business',
                    addedAt: new Date().toISOString()
                };
                newFavorites.push(favoritePlace);
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
                newFavorites = newFavorites.filter(p => p.businessId !== profileId);
            } else {
                const favoritePlace = {
                    businessId: business.uid,
                    name: business.display_name,
                    image: getSafeAvatar(business),
                    address: business.businessInfo?.address || '',
                    city: business.businessInfo?.city || '',
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
        if (!business) return;
        const shareTitle = business.display_name || 'DineBuddies Business';
        const storyData = {
            title: shareTitle,
            image: business.businessInfo?.coverImage || getSafeAvatar(business),
            description: business.businessInfo?.description,
            location: business.businessInfo?.address || business.businessInfo?.city,
            hostName: shareTitle,
            hostImage: getSafeAvatar(business),
        };
        try {
            setIsSharing(true);
            const blob = await generateShareCardBlob(storyData, 'business');
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
        const shareTitle = business?.display_name || 'DineBuddies Business';
        const shareUrl = window.location.href;
        const shareText = `Check out ${shareTitle} on DineBuddies!\n\n🔗 ${shareUrl}`;
        try {
            if (navigator.canShare && navigator.canShare({ files: [headerCardFile] })) {
                await navigator.share({ files: [headerCardFile], title: shareTitle, text: shareText, url: shareUrl });
            } else if (navigator.share) {
                await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
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
        if (!currentUser || currentUser.uid !== profileId) {
            showToast(t('unauthorized'), 'error');
            return;
        }

        try {
            const userRef = doc(db, 'users', profileId);
            await updateDoc(userRef, {
                'businessInfo.deliveryLinks': tempDeliveryLinks
            });
            setDeliveryLinks(tempDeliveryLinks);
            setEditingDeliveryLinks(false);
        } catch (error) {
            console.error('❌ Error saving delivery links:', error);
            showToast(t('save_delivery_links_failed'), 'error');
        }
    };

    const handleCancelDeliveryLinks = () => {
        setTempDeliveryLinks(deliveryLinks);
        setEditingDeliveryLinks(false);
    };

    // Inline edit handlers
    // handleAddService: for editing existing (via modal) — saves immediately
    const handleAddService = (serviceData) => {
        if (editingService !== null) {
            const updated = services.map((s, i) => i === editingService ? serviceData : s);
            setServices(updated);
            const userRef = doc(db, 'users', profileId);
            updateDoc(userRef, { 'businessInfo.services': updated }).catch(console.error);
            setShowServiceModal(false);
            setEditingService(null);
        }
    };

    // handleAddServiceLocal: for inline add form — adds to pending, keeps form open
    const handleAddServiceLocal = () => {
        if (!serviceForm.name.trim()) return;
        setPendingServices(prev => [...prev, {
            ...serviceForm,
            id: Date.now().toString()
        }]);
        setServiceForm({ name: '', description: '', icon: '⚙️' });
        setServiceIconSearch('');
    };

    const handleSaveAllServices = async () => {
        if (pendingServices.length === 0) return;
        setSavingServices(true);
        try {
            const updated = [...services, ...pendingServices];
            setServices(updated);
            const userRef = doc(db, 'users', profileId);
            await updateDoc(userRef, { 'businessInfo.services': updated });
            setPendingServices([]);
            setShowServiceAddForm(false);
            setServiceForm({ name: '', description: '', icon: '⚙️' });
            if (!isPaid) {
                setShowServiceDraftBanner(true);
                setTimeout(() => setShowServiceDraftBanner(false), 30000);
            }
        } catch (err) { console.error('Error saving services:', err); }
        finally { setSavingServices(false); }
    };

    const handleDiscardServices = () => {
        setPendingServices([]);
        setShowServiceAddForm(false);
        setServiceForm({ name: '', description: '', icon: '⚙️' });
        setServiceIconSearch('');
    };

    const handleDeleteService = async (index) => {
        if (!window.confirm(t('delete_service_confirm'))) return;
        const updated = services.filter((_, i) => i !== index);
        setServices(updated);
        const userRef = doc(db, 'users', profileId);
        await updateDoc(userRef, { 'businessInfo.services': updated });
    };

    const handleCoverUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            setCoverUploading(true);
            const url = await uploadImage(file, `covers/${profileId}/cover.jpg`, null, { maxSizeMB: 1, maxWidthOrHeight: 1600 });
            await updateDoc(doc(db, 'users', profileId), { 'businessInfo.coverImage': url });
        } catch (err) { showToast(t('cover_upload_failed'), 'error'); } finally { setCoverUploading(false); }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            setLogoUploading(true);
            const url = await uploadImage(file, `logos/${profileId}/logo.jpg`, null, { maxSizeMB: 0.5, maxWidthOrHeight: 400 });
            await updateDoc(doc(db, 'users', profileId), { photo_url: url });
        } catch (err) { showToast(t('logo_upload_failed'), 'error'); } finally { setLogoUploading(false); }
    };

    const openBasicInfoModal = () => {
        setBasicInfoForm({
            businessName: business.display_name || '',
            tagline: businessInfo.tagline || '',
            businessType: BUSINESS_TYPES.includes(businessInfo.businessType) ? businessInfo.businessType : 'Restaurant',
            description: businessInfo.description || ''
        });
        setShowBasicInfoModal(true);
    };

    const saveBasicInfo = async () => {
        setSavingInfo(true);
        try {
            await updateDoc(doc(db, 'users', profileId), {
                display_name: basicInfoForm.businessName,
                'businessInfo.tagline': basicInfoForm.tagline,
                'businessInfo.businessType': basicInfoForm.businessType,
                'businessInfo.description': basicInfoForm.description
            });
            setShowBasicInfoModal(false);
        } catch (err) { showToast(t('save_failed'), 'error'); } finally { setSavingInfo(false); }
    };

    const openContactModal = () => {
        setContactForm({
            phone: businessInfo.phone || '',
            email: businessInfo.email || '',
            website: businessInfo.website || '',
            address: businessInfo.address || '',
            city: businessInfo.city || '',
            instagram: businessInfo.instagram || '',
            facebook: businessInfo.facebook || '',
            twitter: businessInfo.twitter || '',
            tiktok: businessInfo.tiktok || '',
        });
        setShowContactModal(true);
    };

    const saveContact = async () => {
        setSavingInfo(true);
        try {
            await updateDoc(doc(db, 'users', profileId), {
                'businessInfo.phone': contactForm.phone,
                'businessInfo.email': contactForm.email,
                'businessInfo.website': contactForm.website,
                'businessInfo.address': contactForm.address,
                'businessInfo.city': contactForm.city,
                'businessInfo.instagram': contactForm.instagram,
                'businessInfo.facebook': contactForm.facebook,
                'businessInfo.twitter': contactForm.twitter,
                'businessInfo.tiktok': contactForm.tiktok,
            });
            setShowContactModal(false);
            // Smart pro-fields notice for free users
            if (!isPaid) {
                const proFieldLabels = [
                    { key: 'website', label: '🌐 Website' },
                    { key: 'instagram', label: '📸 Instagram' },
                    { key: 'facebook', label: '👥 Facebook' },
                    { key: 'twitter', label: '🐦 Twitter / X' },
                    { key: 'tiktok', label: '🎵 TikTok' },
                ];
                const filled = proFieldLabels.filter(f => contactForm[f.key]?.trim());
                if (filled.length > 0) setProFieldsNotice(filled.map(f => f.label));
            }
        } catch (err) { showToast(t('save_failed'), 'error'); } finally { setSavingInfo(false); }
        };




    if (loading || !business) {
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
                    {!business && !loading ? t('business_not_found', 'Business not found') : t('loading_business', 'Finding business...')}
                </p>
                <button
                    type="button"
                    className="ui-btn ui-btn--secondary"
                    onClick={() => navigate('/')}
                    style={{ marginTop: '20px' }}
                >
                    {t('back_to_home', 'Back to Home')}
                </button>
            </div>
        );
    }

    const rawBusinessInfo = business.businessInfo || {};
    // In preview mode → show visitor view (no edit controls)
    const isOwner = !isPreviewMode && currentUser?.uid === profileId;

    // Merge drafts dynamically if viewing as owner
    const businessInfo = isOwner && rawBusinessInfo.drafts
        ? { ...rawBusinessInfo, ...rawBusinessInfo.drafts }
        : rawBusinessInfo;

    const hasDrafts = isOwner && rawBusinessInfo.drafts && Object.keys(rawBusinessInfo.drafts).length > 0;

    const tier = business.subscriptionTier || 'free';
    const isPaid = tier === 'professional' || tier === 'elite';
    const isElite = tier === 'elite';
    const isPremium = isPaid;

    // ── Brand Kit: only apply custom colors when business has saved a Brand Kit
    // In preview mode, use live state from localStorage (set by BrandKit editor)
    const brandKit = (isPreviewMode && previewBrandKit) ? previewBrandKit : (businessInfo?.brandKit || {});
    const _p = brandKit.primaryColor;   // undefined → no brand kit
    const _s = brandKit.secondaryColor || _p;
    const _br = brandKit.buttonStyle || '14px';
    // Font: always system-ui sans-serif regardless of any stored brandKit value
    const _ff = 'system-ui, sans-serif';

    // tc = null for unbranded businesses → th() falls back to default CSS styles
    const tc = _p ? (() => {
        // safeText: explicit textColor from brand kit, or auto-detected readable accent
        const lum = (hex) => {
            try {
                const h = hex.replace('#', '');
                const r = parseInt(h.slice(0, 2), 16) / 255;
                const g = parseInt(h.slice(2, 4), 16) / 255;
                const b = parseInt(h.slice(4, 6), 16) / 255;
                return 0.2126 * r + 0.7152 * g + 0.0722 * b;
            } catch { return 0; }
        };
        // Auto-detect a readable text color for dark cards. If primary is bright enough, use it, else default to white
        const _safeText = brandKit.textColor ||
            (lum(_p) > 0.4 ? _p : '#ffffff');
        return {
            accent: _p,
            safeText: _safeText,
            accentText: getContrastText(_p),
            border: `${_p}55`,
            badgeBg: `${_p}22`,
            badgeText: _safeText,
            tabActive: _p,
            // Tab button overrides
            tabBorderColor: brandKit.tabBorderColor || _p,
            tabBgColor: brandKit.tabBgColor || 'rgba(255,255,255,0.95)',
            tabTextColor: brandKit.tabTextColor || brandKit.tabBorderColor || _p,
            // Community / Join button
            joinBtnBg: brandKit.joinBtnBg || '#ffffff',
            joinBtnTextColor: brandKit.joinBtnTextColor || _p,
            // Create Invitation button
            inviteBtnBg: brandKit.inviteBtnBg || undefined,
            inviteBtnTextColor: brandKit.inviteBtnTextColor || '#ffffff',
            // Stars
            starColor: brandKit.starColor || _safeText,
            // CTA button overrides
            btnTextColor: brandKit.btnTextColor || undefined,
            btnBorderColor: brandKit.btnBorderColor || undefined,
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
        };
    })() : null;

    // Standardized floating Edit Button for all sections
    const EditActionBtn = ({ onClick, icon = <FaEdit size={16} /> }) => (
        <button
            onClick={onClick}
            title={t('edit_section')}
            style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: tc?.accent ? `${tc.accent}22` : 'var(--hover-overlay)',
                cursor: 'pointer',
                border: `1.5px solid ${tc?.accent || 'var(--border-color)'}`,
                color: tc?.accent || 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: tc?.accent ? `0 4px 14px ${tc.accent}44` : '0 2px 8px rgba(0,0,0,0.08)',
                transition: 'all 0.2s'
            }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.12)';
                e.currentTarget.style.background = tc?.accent ? `${tc.accent}44` : 'rgba(139, 92, 246, 0.12)';
                e.currentTarget.style.borderColor = tc?.accent || 'var(--primary)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = tc?.accent ? `${tc.accent}22` : 'var(--hover-overlay)';
                e.currentTarget.style.borderColor = tc?.accent || 'var(--border-color)';
            }}
        >
            {icon}
        </button>
    );

    // Plan badges — توضيح أن هذه الميزة لخطة Pro وElite
    const PlanBadges = () => (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span title="Professional Plan" style={{
                fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px',
                borderRadius: 20, border: '1px solid #8b5cf6',
                color: '#a78bfa', background: 'rgba(139,92,246,0.12)',
                display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap'
            }}>⚡ Pro</span>
            <span title="Elite Plan" style={{
                fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px',
                borderRadius: 20, border: '1px solid #f59e0b',
                color: '#fbbf24', background: 'rgba(245,158,11,0.12)',
                display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap'
            }}>👑 Elite</span>
        </div>
    );

    // th() returns themed when brandKit active, fallback otherwise    // Free badge — للأقسام المجانية
    const FreeBadge = () => (
        <span title="Free Feature" style={{
            fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px',
            borderRadius: 20, border: '1px solid #22c55e',
            color: '#4ade80', background: 'rgba(34,197,94,0.12)',
            display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap'
        }}>🆓 Free</span>
    );

    // IMPORTANT FIX: checks if themed is undefined, otherwise falls back
    const th = (themed, fallback) => (tc && themed !== undefined) ? themed : fallback;

    // Verified = profile has both cover image and logo
    const isVerified = !!(businessInfo.coverImage && business.photo_url);
    // ── Global Save: always saves directly (theme & all features are free) ──────────────────
    const handleGlobalSave = async () => {
        if (!currentUser || currentUser.uid !== profileId) return;
        setGlobalSaving(true);
        const userRef = doc(db, 'users', profileId);
        try {
            const updates = {};
            // Always promote drafts to live — no paywall
            if (rawBusinessInfo.drafts?.brandKit)
                updates['businessInfo.brandKit'] = rawBusinessInfo.drafts.brandKit;
            if (rawBusinessInfo.drafts?.deliveryLinks)
                updates['businessInfo.deliveryLinks'] = rawBusinessInfo.drafts.deliveryLinks;
            if (rawBusinessInfo.drafts?.theme)
                updates['businessInfo.theme'] = rawBusinessInfo.drafts.theme;
            if (Object.keys(updates).length > 0)
                await updateDoc(userRef, { ...updates, 'businessInfo.drafts': {} });
            setGlobalSaved(true);
            setTimeout(() => setGlobalSaved(false), 2500);
        } catch (e) {
            console.error('Global save error:', e);
        } finally {
            setGlobalSaving(false);
        }
    };

    return (
        <div className="profile-shell page-container" style={{
            paddingTop: '0',
            background: th(tc?.cardBg, undefined),
            fontFamily: 'system-ui, sans-serif',
        }}>

            {/* Card preview overlay */}
            {headerCardPreviewUrl && (
                <div onClick={closeHeaderPreview} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ background: '#1e1e2e', borderRadius: 20, padding: 20, maxWidth: 380, width: '100%', position: 'relative', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
                        <button onClick={closeHeaderPreview} style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.15)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                        <img src={headerCardPreviewUrl} alt="Business Card" style={{ width: '100%', borderRadius: 12, display: 'block', marginBottom: 14 }} />
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={handleShareFromOverlay} style={{ flex: 1, padding: '13px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>📤 {t('share_image', 'Share Image')}</button>
                            <a href={headerCardPreviewUrl} download="business-card.png" style={{ padding: '13px 16px', borderRadius: 12, textDecoration: 'none', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⬇</a>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Hero Design --- */}
            <div className="profile-header">

                {/* Cover & Top Nav */}
                <div style={{
                    width: '100%', flexShrink: 0, height: 300, minHeight: 300, maxHeight: 300,
                    background: businessInfo.coverImage ? `url(${businessInfo.coverImage})` : th(tc?.gradientFrom ? `linear-gradient(135deg, ${tc.gradientFrom}, ${tc.gradientTo})` : null, 'linear-gradient(135deg, #1e1e2e, #2d2b42)'),
                    backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                    borderBottomLeftRadius: '32px', borderBottomRightRadius: '32px',
                    boxShadow: tc?.headerGlow || '0 10px 40px rgba(0,0,0,0.3)',
                    position: 'relative', overflow: 'hidden'
                }}>
                    {/* Overlay gradient */}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.72) 100%)', borderRadius: 'inherit' }} />

                    {/* Top bar: back + status badges + actions */}
                    <div style={{ position: 'absolute', top: '1.2rem', left: '1.2rem', right: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
                        {/* Status badges (Open + Online) */}
                        {(() => {
                            const today = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
                            const isOpen = businessInfo.workingHours?.[today]?.isOpen;
                            const badgePill = (color, dot, label) => (
                                <span style={{
                                    padding: '5px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '800',
                                    background: `rgba(${color},0.18)`, border: `1px solid rgba(${color},0.45)`,
                                    color: `rgb(${color})`, display: 'inline-flex', alignItems: 'center', gap: '5px',
                                    backdropFilter: 'blur(8px)',
                                }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: `rgb(${dot})`, boxShadow: `0 0 5px rgb(${dot})`, display: 'inline-block' }} />
                                    {label}
                                </span>
                            );
                            return (
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    {business.isOnline && badgePill('16,185,129', '16,185,129', t('online'))}
                                    {badgePill(isOpen ? '74,222,128' : '248,113,113', isOpen ? '74,222,128' : '248,113,113', isOpen ? 'OPEN' : 'CLOSED')}
                                </div>
                            );
                        })()}

                        {/* Favourite + Share */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={handleToggleFavoriteSafe} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.2)', color: isFavorite ? '#ef4444' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                {isFavorite ? <FaHeart fontSize="1rem" /> : <FaRegHeart fontSize="1rem" />}
                            </button>
                            <button onClick={handleShare} disabled={isSharing} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                {isSharing ? '⏳' : <FaShare fontSize="1rem" />}
                            </button>
                        </div>
                    </div>

                    {/* Bottom-left: Logo + Business name + Category */}
                    <div style={{ position: 'absolute', bottom: '1.2rem', left: '1.2rem', display: 'flex', alignItems: 'flex-end', gap: '14px', zIndex: 10 }}>
                        {/* Logo */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <div style={{
                                width: '90px', height: '90px', borderRadius: '22px',
                                background: business.photo_url ? `url(${business.photo_url})` : tc?.swatchGradient || 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                                backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                                overflow: 'hidden',
                                border: `4px solid rgba(255,255,255,0.25)`,
                                boxShadow: tc ? `0 8px 24px ${tc.accent}66` : '0 8px 24px rgba(0,0,0,0.5)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.4rem'
                            }}>
                                {!business.photo_url && '🏪'}
                            </div>
                            {isOwner && (
                                <label style={{ position: 'absolute', inset: 0, borderRadius: '22px', background: logoUploading ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)', opacity: 0, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '4px solid transparent' }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = logoUploading ? 1 : 0}>
                                    <span style={{ fontSize: '1.3rem', color: 'white' }}>{logoUploading ? '⏳' : '📷'}</span>
                                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} disabled={logoUploading} />
                                </label>
                            )}
                            {/* Plan badge */}
                            {isPaid && !isOwner && (
                                <div style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#000000', border: `2px solid ${isElite ? '#f59e0b' : '#8b5cf6'}`, borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 8px ${isElite ? 'rgba(245,158,11,0.5)' : 'rgba(139,92,246,0.5)'}`, fontSize: '0.85rem' }} title={isElite ? t('elite_business', 'Elite Business') : t('professional_business', 'Professional Business')}>{isElite ? '👑' : '⚡'}</div>
                            )}
                        </div>

                        {/* Name + Category */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '4px' }}>
                            <span style={{ color: 'white', fontWeight: '900', fontSize: '1.15rem', textShadow: '0 2px 8px rgba(0,0,0,0.9)', letterSpacing: '0.3px', lineHeight: 1.2 }}>
                                {business.display_name || business.displayName || t('business')}
                            </span>
                            {(businessInfo.businessType || businessInfo.cuisineType) && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/restaurants?category=${encodeURIComponent(businessInfo.businessType || 'Venue')}`);
                                    }}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        alignSelf: 'flex-start',
                                        minHeight: '26px',
                                        padding: '4px 12px',
                                        fontSize: '0.82rem',
                                        fontWeight: '600',
                                        color: 'white',
                                        background: 'rgba(0,0,0,0.5)',
                                        backdropFilter: 'blur(8px)',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        textShadow: '0 1px 4px rgba(0,0,0,0.7)',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(139,92,246,0.6)';
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(0,0,0,0.5)';
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                                    }}
                                >
                                    {businessInfo.businessType}{businessInfo.cuisineType ? ` • ${businessInfo.cuisineType}` : ''}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Cover Update button — owner only */}
                    {isOwner && (
                        <label style={{ position: 'absolute', bottom: '1.2rem', right: '1.2rem', zIndex: 10, cursor: 'pointer', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '12px', padding: '7px 14px', color: 'white', fontSize: '0.78rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {coverUploading ? '⏳ Uploading...' : '📷 Edit Cover'}
                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverUpload} disabled={coverUploading} />
                        </label>
                    )}
                </div>


                {/* Glass Stats Box - uses BrandKit when available */}
                <div className="profile-stats" style={{
                    background: th(tc?.badgeBg, 'rgba(15,23,42,0.7)'),
                    border: `1px solid ${th(tc?.border, 'var(--border-color)')}`,
                    borderRadius: '24px', padding: '18px 16px',
                    boxShadow: th(tc?.cardShadow, '0 4px 24px rgba(0,0,0,0.25)'),
                    backdropFilter: 'blur(12px)'
                }}>
                    <div className="profile-stat-item" style={{ color: 'var(--text-secondary)' }}>
                        <div
                            className="profile-stat-value"
                            style={{
                                fontSize: '1.35rem',
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                boxShadow: 'none',
                                borderWidth: 0,
                                borderStyle: 'none',
                                borderColor: 'rgba(0, 0, 0, 0)',
                            }}
                        >
                            <FaUsers style={{ fontSize: '1.1rem', color: 'inherit' }} /> {memberCount}
                        </div>
                        <div className="profile-stat-label" style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginTop: '6px' }}>Members</div>
                    </div>
                    <div className="profile-stats-divider" />
                    <div
                        className="profile-stat-item"
                        style={{
                            cursor: (currentUser && !userProfile?.isBusiness && !isGuest) ? 'pointer' : 'default',
                            color: 'var(--text-secondary)',
                        }}
                        onClick={() => { if (currentUser && !userProfile?.isBusiness && !isGuest) setShowReviewModal(true); }}
                    >
                        <div
                            className="profile-stat-value"
                            style={{
                                fontSize: '1.35rem',
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                boxShadow: 'none',
                                borderWidth: 0,
                                borderStyle: 'none',
                                borderColor: 'rgba(0, 0, 0, 0)',
                            }}
                        >
                            <FaStar style={{ fontSize: '1.1rem' }} /> {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}
                        </div>
                        <div className="profile-stat-label" style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginTop: '6px' }}>{reviews.length} Reviews</div>
                    </div>
                    <div className="profile-stats-divider" />
                    <div className="profile-stat-item" style={{ color: 'var(--text-secondary)' }}>
                        <div
                            className="profile-stat-value"
                            style={{
                                fontSize: '1.35rem',
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                boxShadow: 'none',
                                borderWidth: 0,
                                borderStyle: 'none',
                                borderColor: 'rgba(0, 0, 0, 0)',
                            }}
                        >
                            <FaEnvelope style={{ fontSize: '1.1rem' }} /> {activeInvitationsCount}
                        </div>
                        <div className="profile-stat-label" style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginTop: '6px' }}>Invites</div>
                    </div>
                </div>

                {businessInfo.tagline && (
                    <p style={{ fontSize: '1rem', color: th(tc?.badgeText, 'var(--text-secondary)'), margin: '0 0 24px 0', fontStyle: 'italic', fontWeight: '500', textAlign: 'center', maxWidth: '90%' }}>"{businessInfo.tagline}"</p>
                )}

                {/* Actions Row */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', marginBottom: '1rem' }}>
                    {currentUser?.uid !== profileId && !userProfile?.isBusiness && (
                        <button onClick={() => { if (isGuest) { navigate('/login'); return; } handleJoinCommunity(); }} disabled={joiningCommunity} style={{ width: '100%', padding: '14px 16px', borderRadius: th(tc?.btnBorderRadius, '16px'), background: isMember ? 'var(--hover-overlay)' : th(tc?.joinBtnBg, 'linear-gradient(135deg, #8b5cf6, #f97316)'), border: isMember ? `1px solid var(--border-color)` : 'none', color: isMember ? 'var(--text-main)' : th(tc?.joinBtnTextColor, 'white'), fontWeight: '900', fontSize: '1.05rem', cursor: joiningCommunity ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.3s', boxShadow: isMember ? 'none' : th(tc?.btnShadow, '0 8px 24px rgba(139,92,246,0.3)'), opacity: joiningCommunity ? 0.7 : 1 }}>
                            {joiningCommunity ? '...' : (
                                <>
                                    {/* Overlapping member avatars — always visible */}
                                    {memberCount > 0 && memberAvatars.length > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                            <div style={{ display: 'flex', flexDirection: 'row-reverse' }}>
                                                {memberAvatars.slice(0, 5).map((url, i) => (
                                                    <img
                                                        key={i}
                                                        src={url}
                                                        alt=""
                                                        style={{
                                                            width: 26, height: 26, borderRadius: '50%',
                                                            objectFit: 'cover',
                                                            border: '2px solid rgba(255,255,255,0.4)',
                                                            marginLeft: i > 0 ? '-8px' : 0,
                                                            background: '#333',
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, opacity: 0.9 }}>{memberCount}</span>
                                        </div>
                                    )}
                                    {isMember ? `✓ Community Member (${memberCount})` : '+ Join Community'}
                                </>
                            )}
                        </button>
                    )}
                    {currentUser?.uid !== profileId && !userProfile?.isBusiness && !currentUser?.isGuest && (
                        <button onClick={handleCreateInvitation} style={{ width: '100%', padding: '16px', borderRadius: th(tc?.btnBorderRadius, '16px'), background: th(tc?.inviteBtnBg, 'var(--bg-card)'), border: `1px solid ${tc?.inviteBtnBg ? (tc?.tabBorderColor || 'var(--border-color)') : 'var(--border-color)'}`, color: th(tc?.inviteBtnTextColor, 'var(--text-main)'), fontWeight: '800', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                            <FaUserPlus style={{ fontSize: '1.2rem' }} /> Create Invitation
                        </button>
                    )}
                </div>
            </div>

            {/* Delivery Links Section - Premium Feature */}
            <DeliveryLinksSection
                business={business}
                isOwner={isOwner}
                deliveryLinks={deliveryLinks}
                tempDeliveryLinks={tempDeliveryLinks}
                setTempDeliveryLinks={setTempDeliveryLinks}
                editingDeliveryLinks={editingDeliveryLinks}
                setEditingDeliveryLinks={setEditingDeliveryLinks}
                onSave={handleSaveDeliveryLinks}
                onCancel={handleCancelDeliveryLinks}
            />

            {/* Tabs Navigation — scrollable on mobile, compact spacing */}
            {(() => {
                // Visitor: show only tabs that have content. Owner: sees all.
                const info = businessInfo || {};
                const hasContactInfo = !!(info.phone || info.email || info.address);
                const tabs = [
                    { id: 'about', label: t('tab_about'), locked: false },
                    { id: 'menu', label: t('tab_menu'), locked: false, hide: !isOwner && !(info.menu?.length > 0) },
                    { id: 'services', label: t('tab_services'), locked: false, hide: !isOwner && !(services?.length > 0) },
                    { id: 'hours', label: t('tab_hours'), locked: false, hide: !isOwner && !info.hours },
                    { id: 'contact', label: t('tab_contact'), locked: false, hide: !isOwner && !hasContactInfo },
                ];
                const visibleTabs = tabs.filter(tab => !tab.hide);
                return (
            <div
                className="ui-tabs ui-tabs--horizontal hide-scrollbar"
                style={{
                    position: 'sticky', top: '10px', zIndex: 50,
                    background: th(tc?.cardBg ? tc.cardBg + 'cc' : null, 'var(--bg-card)'),
                    border: `1px solid ${th(tc?.border, 'var(--border-color)')}`,
                    boxShadow: th(tc?.cardShadow, '0 4px 20px rgba(0,0,0,0.08)'),
                }}
            >
                {visibleTabs.map(({ id, label, locked }) => (
                    <button
                        key={id}
                        type="button"
                        className={`ui-tab ui-tab--compact ${activeTab === id && !locked ? 'ui-tab--active' : ''}`}
                        onClick={() => {
                            if (locked) { navigate('/business/pricing'); return; }
                            setActiveTab(id);
                        }}
                        style={{
                            background: activeTab === id && !locked ? th(tc?.accent, 'var(--primary)') : 'transparent',
                            boxShadow: activeTab === id && !locked ? th(tc?.btnShadow, '0 4px 12px rgba(139,92,246,0.3)') : 'none',
                            color: locked ? 'var(--text-muted)' : activeTab === id ? 'rgba(255, 255, 255, 1)' : 'var(--text-main)',
                            opacity: locked ? 0.75 : 1
                        }}
                    >
                        {label}
                        {locked && <PlanBadge tier="pro" />}
                    </button>
                ))}
            </div>
            );
            })()}

            {/* Content Area */}
            <div className="profile-content" style={{ padding: 'var(--profile-content-padding)' }}>

                {/* About Tab */}
                {activeTab === 'about' && (
                    <div className="profile-section-content">

                        {/* About Card */}
                        <div className="ui-card ui-card--lg" style={{
                            background: th(tc?.cardBg, 'var(--bg-card)'), border: `1px solid ${th(tc?.border, 'var(--border-color)')}`,
                            boxShadow: th(tc?.cardShadow, '0 4px 20px rgba(0,0,0,0.08)'),
                            position: 'relative', overflow: 'hidden'
                        }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: th(tc?.accent, 'linear-gradient(to bottom, #8b5cf6, #ec4899)') }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                                <h3 className="profile-section-header" style={{ fontSize: '1.3rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '1.5rem' }}>📄</span> About Us
                                </h3>
                                {isOwner && (
                                    <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <FreeBadge />
                                        <EditActionBtn onClick={() => setShowBrandKitModal(true)} icon={<span style={{ fontSize: '1rem' }}>🎨</span>} />
                                        <EditActionBtn onClick={openBasicInfoModal} />
                                    </div>
                                )}
                            </div>

                            {businessInfo.description ? (
                                <p style={{
                                    color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '1rem', margin: 0,
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {businessInfo.description}
                                </p>
                            ) : (
                                <div style={{ padding: '24px', textAlign: 'center', background: 'var(--hover-overlay)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
                                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem', fontWeight: '500' }}>No description available</p>
                                    {isOwner && <p style={{ color: 'var(--text-muted)', margin: '8px 0 0', fontSize: '0.85rem', opacity: 0.9 }}>Click Edit to add one</p>}
                                </div>
                            )}
                        </div>


                        {/* Enhanced Gallery Section */}
                        <EnhancedGallery
                            profileId={profileId}
                            business={business}
                            isOwner={isOwner}
                            theme={{ colors: tc }}
                        />



                        {/* Enhanced Reviews Section */}
                        <EnhancedReviews
                            reviews={reviews}
                            profileId={profileId}
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
                        profileId={profileId}
                        menuData={businessInfo.menu || []}
                        isOwner={isOwner}
                        isPaid={isPaid}
                        theme={{ colors: tc }}
                    />
                )}

                {/* Services Tab */}
                {activeTab === 'services' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* Draft Banner - Free Plan */}
                        {showServiceDraftBanner && (
                            <div className="ui-banner--warning">
                                <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>⚠️</span>
                                <div style={{ flex: 1 }}>
                                    <p className="ui-banner--warning__title">Saved as Draft</p>
                                    <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                        Your services were saved, but they <strong>won't appear on your public profile</strong> until you upgrade your plan.
                                    </p>
                                    <a href="/pricing" className="ui-banner--warning__link">🚀 Upgrade Plan</a>
                                </div>
                                <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setShowServiceDraftBanner(false)} style={{ padding: '4px', color: 'var(--text-muted)', fontSize: '1.1rem', flexShrink: 0 }}>✕</button>
                            </div>
                        )}

                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: th(tc?.cardBg, 'var(--bg-card)'), border: `1px solid ${th(tc?.border, 'rgba(255,255,255,0.05)')}`, borderRadius: '24px', padding: '16px 24px', boxShadow: th(tc?.cardShadow, '0 10px 30px rgba(0,0,0,0.15)') }}>
                            <h3 style={{ fontSize: '1.3rem', fontWeight: '900', margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.4rem' }}>✨</span> Business Services
                            </h3>
                            {isOwner && (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <PlanBadges />
                                    {/* ＋ Add button toggles inline form */}
                                    <button
                                        onClick={() => setShowServiceAddForm(v => !v)}
                                        title={showServiceAddForm ? t('close_form') : t('add_service')}
                                        style={{
                                            width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
                                            border: `1px solid ${showServiceAddForm ? 'var(--color-danger)' : 'var(--color-success)'}`,
                                            background: showServiceAddForm ? 'color-mix(in srgb, var(--color-danger) 10%, transparent)' : 'color-mix(in srgb, var(--color-success) 10%, transparent)',
                                            color: showServiceAddForm ? 'var(--color-danger)' : 'var(--color-success)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}
                                    >
                                        {showServiceAddForm ? <FaTimes size={15} /> : <FaPlus size={15} />}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* ── Inline Add Form ── */}
                        {isOwner && showServiceAddForm && (
                            <div className="ui-form-surface" style={{ background: th(tc?.cardBg, 'var(--bg-card)') }}>
                                <h4 style={{ margin: 0, fontWeight: '800', fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FaPlus style={{ color: 'var(--color-success)' }} /> Add Service
                                </h4>

                                {/* Pending preview */}
                                {pendingServices.length > 0 && (
                                    <div style={{
                                        padding: '0.75rem', borderRadius: '10px',
                                        background: 'color-mix(in srgb, var(--color-success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-success) 25%, transparent)',
                                    }}>
                                        <p style={{ margin: '0 0 6px', fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-success)' }}>
                                            ✅ {pendingServices.length} service{pendingServices.length > 1 ? 's' : ''} ready to save:
                                        </p>
                                        {pendingServices.map((s, i) => (
                                            <div key={i} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                                {s.icon} {s.name}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Icon preview + search */}
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{
                                        width: '64px', height: '64px', borderRadius: '16px', fontSize: '2.4rem',
                                        background: 'color-mix(in srgb, var(--primary) 10%, transparent)', border: '2px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px',
                                    }}>
                                        {serviceForm.icon}
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    className="ui-form-field"
                                    value={serviceIconSearch}
                                    onChange={e => setServiceIconSearch(e.target.value)}
                                    placeholder={t('search_icons')}
                                    style={{ padding: '8px 12px' }}
                                />
                                {/* Icon grid */}
                                <div style={{
                                    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px',
                                    maxHeight: '180px', overflowY: 'auto',
                                    border: '1px solid var(--border-color)', borderRadius: '12px',
                                    background: 'var(--bg-body)', padding: '6px',
                                }}>
                                    {(serviceIconSearch
                                        ? SERVICE_ICONS.filter(s => s.label.toLowerCase().includes(serviceIconSearch.toLowerCase()))
                                        : SERVICE_ICONS
                                    ).map(s => (
                                        <button
                                            key={s.icon} type="button" title={s.label}
                                            onClick={() => setServiceForm(f => ({ ...f, icon: s.icon }))}
                                            style={{
                                                fontSize: '1.5rem', padding: '6px', borderRadius: '8px', border: 'none',
                                                background: serviceForm.icon === s.icon ? 'color-mix(in srgb, var(--primary) 25%, transparent)' : 'transparent',
                                                outline: serviceForm.icon === s.icon ? '2px solid var(--primary)' : 'none',
                                                cursor: 'pointer',
                                            }}
                                        >{s.icon}</button>
                                    ))}
                                </div>

                                {/* Name */}
                                <div>
                                    <label className="ui-form-label">Service Name *</label>
                                    <input
                                        type="text"
                                        className="ui-form-field"
                                        value={serviceForm.name}
                                        onChange={e => setServiceForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder="e.g., Home Delivery, Live DJ..."
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="ui-form-label">Description (optional)</label>
                                    <textarea
                                        className="ui-form-field"
                                        value={serviceForm.description}
                                        onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))}
                                        rows={2}
                                        placeholder={t('service_info_placeholder')}
                                        style={{ resize: 'vertical' }}
                                    />
                                </div>

                                {/* Action buttons: Add / Save(N) / ✕ */}
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {/* + Add */}
                                    <button
                                        onClick={handleAddServiceLocal}
                                        disabled={!serviceForm.name.trim()}
                                        style={{
                                            flex: 1, padding: '0.65rem 1rem', borderRadius: '10px',
                                            border: '1px solid rgba(139,92,246,0.4)',
                                            background: serviceForm.name.trim() ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
                                            color: serviceForm.name.trim() ? '#a78bfa' : 'var(--text-muted)',
                                            fontWeight: '700', fontSize: '0.9rem',
                                            cursor: serviceForm.name.trim() ? 'pointer' : 'not-allowed',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        }}
                                    >
                                        <FaPlus size={13} /> + Add
                                    </button>

                                    {/* 💾 Save all */}
                                    <button
                                        onClick={handleSaveAllServices}
                                        disabled={savingServices || pendingServices.length === 0}
                                        style={{
                                            flex: 2, padding: '0.65rem 1rem', borderRadius: '10px',
                                            border: '1px solid color-mix(in srgb, var(--color-success) 40%, transparent)',
                                            background: pendingServices.length > 0 ? 'color-mix(in srgb, var(--color-success) 15%, transparent)' : 'var(--hover-overlay)',
                                            color: pendingServices.length > 0 ? 'var(--color-success)' : 'var(--text-muted)',
                                            fontWeight: '700', fontSize: '0.9rem',
                                            cursor: pendingServices.length > 0 ? 'pointer' : 'not-allowed',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        }}
                                    >
                                        <FaSave size={13} /> {savingServices ? t('save_pending') : t('save_count', { count: pendingServices.length })}
                                    </button>

                                    {/* ✕ Discard */}
                                    <button
                                        type="button"
                                        className="ui-btn ui-btn--danger-outline"
                                        onClick={handleDiscardServices}
                                        style={{ padding: '0.65rem 0.9rem' }}
                                        title={t('discard_pending')}
                                    >
                                        <FaTimes size={14} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Services grid */}
                        {services.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
                                {services.map((service, index) => (
                                    <div key={service.id || index} style={{
                                        background: th(tc?.cardBg, 'var(--bg-card)'), border: `1px solid ${th(tc?.border, 'rgba(255,255,255,0.05)')}`,
                                        borderRadius: '20px', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                                        gap: '12px', position: 'relative', boxShadow: th(tc?.cardShadow, '0 8px 24px rgba(0,0,0,0.15)'), transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = th(tc?.btnShadow, '0 16px 40px rgba(139,92,246,0.3)'); }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = th(tc?.cardShadow, '0 8px 24px rgba(0,0,0,0.15)'); }}>
                                        <div style={{ fontSize: '3rem', filter: tc ? `drop-shadow(0 4px 8px ${tc.accent}55)` : 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}>{service.icon || '⚙️'}</div>
                                        <h4 style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>{service.name}</h4>
                                        {service.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{service.description}</p>}
                                        {isOwner && (
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', opacity: 0.8 }} className="service-actions">
                                                <button onClick={() => { setEditingService(index); setShowServiceModal(true); }} style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: '700', background: 'var(--hover-overlay)', border: 'none', borderRadius: '8px', color: 'var(--text-main)', cursor: 'pointer' }}>Edit</button>
                                                <button type="button" className="ui-btn ui-btn--danger-outline" onClick={() => handleDeleteService(index)} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>Del</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : !showServiceAddForm && (
                            <div style={{ textAlign: 'center', padding: '3rem 1rem', background: th(tc?.cardBg, 'rgba(255,255,255,0.03)'), borderRadius: '24px', border: `1px dashed ${th(tc?.border, 'rgba(255,255,255,0.1)')}` }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🔧</div>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '1rem' }}>No services listed yet.</p>
                                {isOwner && (
                                    <button onClick={() => setShowServiceAddForm(true)} style={{ padding: '12px 24px', fontSize: '0.9rem', fontWeight: '800', background: th(tc?.footerBg, 'linear-gradient(135deg, #8b5cf6, #f97316)'), border: 'none', borderRadius: '16px', color: 'white', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                                        ➕ Add Your First Service
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Hours Tab - NEW Business Hours Component */}
                {activeTab === 'hours' && (
                    <BusinessHours
                        businessId={profileId}
                        businessInfo={business.businessInfo}
                        isOwner={isOwner}
                        theme={{ colors: tc }}
                    />
                )}

                {/* Contact Tab */}
                {activeTab === 'contact' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: th(tc?.cardBg, 'var(--bg-card)'), border: `1px solid ${th(tc?.border, 'rgba(255,255,255,0.05)')}`, borderRadius: '24px', padding: '16px 24px', boxShadow: th(tc?.cardShadow, '0 10px 30px rgba(0,0,0,0.15)') }}>
                            <h3 style={{ fontSize: '1.3rem', fontWeight: '900', margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.4rem' }}>📞</span> Contact Information
                            </h3>
                            {isOwner && (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <PlanBadges />
                                    <EditActionBtn onClick={openContactModal} />
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                            {businessInfo.phone && (
                                <div style={{ background: th(tc?.cardBg, 'var(--bg-card)'), border: `1px solid ${th(tc?.border, 'rgba(255,255,255,0.05)')}`, borderRadius: '20px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: th(tc?.cardShadow, '0 8px 24px rgba(0,0,0,0.1)'), transition: 'transform 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'} onClick={() => window.location.href = `tel:${businessInfo.phone}`}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: th(tc?.badgeBg, 'rgba(34,197,94,0.15)'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: th(tc?.accent, '#22c55e'), fontSize: '1.5rem', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.1)' }}><FaPhone /></div>
                                    <div><div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone</div><div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '1.1rem' }}>{businessInfo.phone}</div></div>
                                </div>
                            )}

                            {/* Website — Pro only */}
                            {isPaid && businessInfo.website && (
                                <div onClick={() => window.open(businessInfo.website.startsWith('http') ? businessInfo.website : `https://${businessInfo.website}`, '_blank')} style={{ background: th(tc?.cardBg, 'var(--bg-card)'), border: `1px solid ${th(tc?.border, 'rgba(255,255,255,0.05)')}`, borderRadius: '20px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: th(tc?.cardShadow, '0 8px 24px rgba(0,0,0,0.1)'), transition: 'all 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: th(tc?.badgeBg, 'rgba(59,130,246,0.15)'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: th(tc?.accent, '#3b82f6'), fontSize: '1.5rem', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.1)' }}><FaGlobe /></div>
                                    <div style={{ flex: 1 }}><div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Website</div><div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '1.1rem', wordBreak: 'break-all' }}>{businessInfo.website.replace(/^(https?:\/\/|\/\/)/, '')}</div></div>
                                    <FaExternalLinkAlt style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }} />
                                </div>
                            )}
                        </div>

                        {businessInfo.address && (
                            <div style={{ background: th(tc?.cardBg, 'var(--bg-card)'), border: `1px solid ${th(tc?.border, 'rgba(255,255,255,0.05)')}`, borderRadius: '24px', padding: '24px', boxShadow: th(tc?.cardShadow, '0 10px 30px rgba(0,0,0,0.15)') }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: th(tc?.badgeBg, 'rgba(239,68,68,0.15)'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: th(tc?.accent, '#ef4444'), fontSize: '1.5rem', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.1)' }}><FaMapMarkerAlt /></div>
                                    <div><div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Address</div><div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '1.1rem' }}>{businessInfo.address} {businessInfo.city && `, ${businessInfo.city}`}</div></div>
                                </div>

                                <div style={{ height: '320px', borderRadius: '20px', overflow: 'hidden', border: `2px solid ${th(tc?.border, 'rgba(255,255,255,0.1)')}`, position: 'relative', boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.1)' }}>
                                    <iframe src={`https://maps.google.com/maps?q=${encodeURIComponent(businessInfo.address + (businessInfo.city ? ', ' + businessInfo.city : '') + (businessInfo.country ? ', ' + businessInfo.country : ''))}&output=embed`} style={{ width: '100%', height: '100%', border: 0 }} loading="lazy" allowFullScreen title="Business Location" />
                                    {!isPaid && (
                                        <div onClick={() => { setPaywallFeature("Interactive Maps"); setShowPaywall(true); }} style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(30,30,46,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }} title={t('upgrade_map')}>
                                            <div style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)', padding: '12px 24px', borderRadius: '16px', color: 'white', fontWeight: '800', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                                                🔒 Map Interaction Locked
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* Google Maps link — Pro only */}
                                {isPaid && (
                                    <button onClick={() => { const addr = encodeURIComponent(businessInfo.address + (businessInfo.city ? ', ' + businessInfo.city : '') + (businessInfo.country ? ', ' + businessInfo.country : '')); window.open(`https://www.google.com/maps/search/?api=1&query=${addr}`, '_blank'); }} style={{ width: '100%', padding: '16px', background: th(tc?.swatchGradient, 'linear-gradient(135deg, #8b5cf6, #f97316)'), border: 'none', borderRadius: '16px', color: 'white', fontWeight: '800', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '20px', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = th(tc?.btnShadow, '0 8px 24px rgba(139,92,246,0.4)'); }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                                        <FaMapMarkerAlt style={{ fontSize: '1.2rem' }} />
                                        Open in Google Maps
                                        <FaExternalLinkAlt style={{ fontSize: '0.9rem' }} />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Social Media — Pro only */}
                        {isPaid && (businessInfo.instagram || businessInfo.twitter || businessInfo.facebook) && (
                            <div style={{ background: th(tc?.cardBg, 'var(--bg-card)'), border: `1px solid ${th(tc?.border, 'rgba(255,255,255,0.05)')}`, borderRadius: '24px', padding: '24px', boxShadow: th(tc?.cardShadow, '0 10px 30px rgba(0,0,0,0.15)') }}>
                                <h4 style={{ fontSize: '1.1rem', fontWeight: '900', margin: '0 0 20px 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '1.3rem' }}>🌐</span> Follow Us
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '16px' }}>
                                    {businessInfo.instagram && (
                                        <button onClick={() => window.open(`https://instagram.com/${businessInfo.instagram.replace('@', '')}`, '_blank')} style={{ padding: '16px', background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', border: 'none', borderRadius: '16px', color: 'white', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 24px rgba(220,39,67,0.4)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                                            <FaInstagram style={{ fontSize: '2rem' }} />
                                            Instagram
                                        </button>
                                    )}
                                    {businessInfo.twitter && (
                                        <button onClick={() => window.open(`https://twitter.com/${businessInfo.twitter.replace('@', '')}`, '_blank')} style={{ padding: '16px', background: 'linear-gradient(135deg, #1DA1F2, #0d8bd9)', border: 'none', borderRadius: '16px', color: 'white', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 24px rgba(29,161,242,0.4)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                                            <FaTwitter style={{ fontSize: '2rem' }} />
                                            Twitter
                                        </button>
                                    )}
                                    {businessInfo.facebook && (
                                        <button onClick={() => window.open(businessInfo.facebook.startsWith('http') ? businessInfo.facebook : `https://facebook.com/${businessInfo.facebook}`, '_blank')} style={{ padding: '16px', background: 'linear-gradient(135deg, #1877F2, #0d65d9)', border: 'none', borderRadius: '16px', color: 'white', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 24px rgba(24,119,242,0.4)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                                            <FaFacebook style={{ fontSize: '2rem' }} />
                                            Facebook
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
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
                            <h2 style={{
                                marginBottom: '1.5rem',
                                fontSize: '1.5rem',
                                fontWeight: '800',
                                color: 'var(--text-main)',
                                textShadow: 'none'
                            }}>
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
                                    placeholder={t('share_experience')}
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
                                    }}
                                />
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
                                    style={{ flex: 1, padding: '12px' }}
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
                                    {submittingReview ? t('submitting_review') : t('submit_review')}
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
                            src={(business?.businessInfo?.gallery || [])[lightboxIndex]}
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
                        {(business?.businessInfo?.gallery || []).length > 1 && (
                            <>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setLightboxIndex((prev) =>
                                            prev === 0 ? (business?.businessInfo?.gallery || []).length - 1 : prev - 1
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
                                            prev === (business?.businessInfo?.gallery || []).length - 1 ? 0 : prev + 1
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
                            {lightboxIndex + 1} / {(business?.businessInfo?.gallery || []).length}
                        </div>
                    </div>
                )
            }

            {
                showShareModal && (
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
                                title={business.display_name}
                                description={`Check out ${business.display_name} on DineBuddies!`}
                                type="business"
                                storyData={{
                                    title: business.display_name,
                                    image: business.businessInfo?.coverImage || getSafeAvatar(business),
                                    description: business.businessInfo?.description,
                                    location: business.businessInfo?.address,
                                    hostName: business.display_name,
                                    hostImage: getSafeAvatar(business)
                                }}
                            />
                            <button
                                type="button"
                                className="ui-btn ui-btn--ghost"
                                onClick={(e) => { e.stopPropagation(); setShowShareModal(false); }}
                                style={{ width: '100%', marginTop: '16px', padding: '10px' }}
                            >
                                {t('close') || 'Close'}
                            </button>
                        </div>
                    </div>
                )
            }
            {/* Invitation Type Selector Modal */}
            <PremiumPaywallModal
                isOpen={showPaywall}
                onClose={() => setShowPaywall(false)}
                featureName={paywallFeature}
            />


            {/* Invitation Type Selector Modal */}
            <CreateInvitationSelector
                isOpen={isSelectorOpen}
                onClose={() => setIsSelectorOpen(false)}
                navigationState={selectorState}
            />

            {/* Service Modal - Inline */}
            {
                showServiceModal && (
                    <ServiceModal
                        service={editingService !== null ? services[editingService] : null}
                        onSave={handleAddService}
                        onClose={() => { setShowServiceModal(false); setEditingService(null); }}
                    />
                )
            }

            {/* Basic Info Modal */}
            {
                showBasicInfoModal && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                        <div style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '1.5rem', width: '90%', maxWidth: '460px', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>✏️ Edit Basic Info</h3>
                                <button onClick={() => setShowBasicInfoModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
                            </div>
                            {[
                                { label: t('business_name_label'), key: 'businessName', type: 'text' },
                                { label: t('tagline_label'), key: 'tagline', type: 'text' },
                            ].map(({ label, key, type }) => (
                                <div key={key} style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-main)' }}>{label}</label>
                                    <input type={type} value={basicInfoForm[key]} onChange={e => setBasicInfoForm(p => ({ ...p, [key]: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-main)', fontSize: '0.9rem' }} />
                                </div>
                            ))}
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-main)' }}>{t('business_type_label')}</label>
                                <select
                                    value={BUSINESS_TYPES.includes(basicInfoForm.businessType) ? basicInfoForm.businessType : 'Restaurant'}
                                    onChange={e => setBasicInfoForm(p => ({ ...p, businessType: e.target.value }))}
                                    style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-main)', fontSize: '0.9rem', appearance: 'none' }}
                                >
                                    {BUSINESS_TYPES.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-main)' }}>Description</label>
                                <textarea rows={4} value={basicInfoForm.description} onChange={e => setBasicInfoForm(p => ({ ...p, description: e.target.value }))}
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
                )
            }

            {/* Contact Modal */}
            {
                showContactModal && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                        <div style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '1.5rem', width: '90%', maxWidth: '460px', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>📞 Edit Contact</h3>
                                <button onClick={() => setShowContactModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
                            </div>
                            {/* Free Fields Section Header */}
                            <div style={{ margin: '0 0 0.8rem', padding: '0.5rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Basic Info</span>
                                <span style={{ border: '1px solid #22c55e', borderRadius: '5px', padding: '1px 6px', fontSize: '0.65rem', fontWeight: '800', color: '#4ade80', background: 'rgba(34,197,94,0.12)' }}>🆓 Free</span>
                            </div>
                            {[
                                { label: '📞 Phone', key: 'phone', placeholder: '+61 400 000 000' },
                                { label: '✉️ Email', key: 'email', placeholder: 'info@yourbusiness.com' },
                                { label: '📍 Address', key: 'address', placeholder: '123 Main St' },
                                { label: `🏙️ ${t('city_label')}`, key: 'city', placeholder: 'Sydney' },
                            ].map(({ label, key, placeholder }) => (
                                <div key={key} style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem' }}>{label}</label>
                                    <input type="text" value={contactForm[key]} placeholder={placeholder} onChange={e => setContactForm(p => ({ ...p, [key]: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-main)', fontSize: '0.9rem' }} />
                                </div>
                            ))}
                            {/* Pro Features — Website & Social Media */}
                            <div style={{ margin: '1.2rem 0 0.8rem', padding: '0.6rem 0 0.6rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pro Features</span>
                                <span style={{ border: '1px solid #8b5cf6', borderRadius: '5px', padding: '1px 6px', fontSize: '0.65rem', fontWeight: '800', color: '#a78bfa', background: 'rgba(139,92,246,0.12)' }}>⚡ Pro</span>
                                <span style={{ border: '1px solid #f59e0b', borderRadius: '5px', padding: '1px 6px', fontSize: '0.65rem', fontWeight: '800', color: '#fbbf24', background: 'rgba(245,158,11,0.12)' }}>👑 Elite</span>
                            </div>
                            {[
                                { icon: <FaGlobe color="#8b5cf6" />, label: t('website_label'), key: 'website', placeholder: 'https://yourbusiness.com' },
                                { icon: <FaInstagram color="#E1306C" />, label: t('instagram_label'), key: 'instagram', placeholder: '@yourbusiness' },
                                { icon: <FaFacebook color="#1877F2" />, label: t('facebook_label'), key: 'facebook', placeholder: 'facebook.com/yourbusiness' },
                                { icon: <FaTwitter color="#1DA1F2" />, label: t('twitter_label'), key: 'twitter', placeholder: '@yourbusiness' },
                                { icon: <SiTiktok color="#fff" />, label: t('tiktok_label'), key: 'tiktok', placeholder: '@yourbusiness' },
                            ].map(({ icon, label, key, placeholder }) => (
                                <div key={key} style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem' }}>{icon} {label}</label>
                                    <input type="text" value={contactForm[key] || ''} placeholder={placeholder} onChange={e => setContactForm(p => ({ ...p, [key]: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-main)', fontSize: '0.9rem' }} />
                                </div>
                            ))}
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                <button onClick={() => setShowContactModal(false)} style={{ flex: 1, padding: '10px', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '600' }}>{t('cancel_btn')}</button>
                                <button onClick={saveContact} disabled={savingInfo} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6, #f97316)', color: 'white', cursor: 'pointer', fontWeight: '700' }}>
                                    {savingInfo ? `💾 ${t('save_pending')}` : `💾 ${t('save_btn')}`}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Pro Fields Upgrade Notice */}
            {
                proFieldsNotice && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                        <div style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '2rem', width: '90%', maxWidth: '420px', border: '1px solid rgba(245,158,11,0.3)', boxShadow: '0 0 40px rgba(245,158,11,0.15)', textAlign: 'center' }}>
                            {/* Icon */}
                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#000', border: '2px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 1rem' }}>👑</div>
                            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: '900', color: 'var(--text-primary)' }}>Information Saved!</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 0 1.2rem', lineHeight: 1.6 }}>
                                The following fields require a <strong style={{ color: '#f59e0b' }}>Pro plan</strong> to be visible to visitors:
                            </p>
                            {/* Fields list */}
                            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '14px', padding: '1rem', marginBottom: '1.2rem', textAlign: 'left' }}>
                                {proFieldsNotice.map(field => (
                                    <div key={field} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.9rem' }}>
                                        <span style={{ color: '#f59e0b' }}>•</span> {field}
                                    </div>
                                ))}
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 1.5rem' }}>
                                Your data is saved and will become visible once you upgrade.
                            </p>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => setProFieldsNotice(null)} style={{ flex: 1, padding: '11px', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>
                                    Got it
                                </button>
                                <button onClick={() => { setProFieldsNotice(null); navigate('/business/pricing'); }} style={{ flex: 1, padding: '11px', border: 'none', borderRadius: '12px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', cursor: 'pointer', fontWeight: '800', fontSize: '0.9rem' }}>
                                    ⚡ Upgrade to Pro
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Brand Kit Modal Editor */}
            {
                showBrandKitModal && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg-body)', overflowY: 'auto' }}>
                        <BrandKit onBack={() => setShowBrandKitModal(false)} />
                    </div>
                )
            }



        </div >


    );
};

export default BusinessProfile;
