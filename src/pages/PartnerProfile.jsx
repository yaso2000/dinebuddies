import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useInvitations } from '../context/InvitationContext';
import { uploadImage, deleteImage } from '../utils/imageUpload';
import { FaArrowLeft, FaPhone, FaMapMarkerAlt, FaClock, FaGlobe, FaShareAlt, FaUserPlus, FaUsers, FaEdit, FaInstagram, FaTwitter, FaFacebook, FaExternalLinkAlt, FaShare, FaStar, FaImages, FaTimes, FaPlus, FaHeart, FaRegHeart, FaSave } from 'react-icons/fa';

import { HiBuildingStorefront } from 'react-icons/hi2';
import { SiTiktok } from 'react-icons/si';
import { useAuth } from '../context/AuthContext';
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
import ServiceModal, { SERVICE_ICONS } from '../components/ServiceModal';
import { getContrastText } from '../utils/colorUtils';
import PremiumBadge from '../components/PremiumBadge';
import PremiumPaywallModal from '../components/PremiumPaywallModal';
import DraftSavedModal from '../components/DraftSavedModal';
import BrandKit from './business-pro/BrandKit';
import PlanBadge from '../components/PlanBadge';



const PartnerProfile = () => {
    const { partnerId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser, userProfile, updateUserProfile, isGuest } = useAuth();
    const { joinCommunity, leaveCommunity } = useInvitations();
    const { t } = useTranslation();

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


    const fetchActiveInvitations = async () => {
        try {
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
            }
        };
        loadAllData();
    }, [currentUser, partnerId, partner?.uid]);

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

    // Fetch avatars for last 5 community members (most recent)
    useEffect(() => {
        const memberIds = partner?.communityMembers || [];
        if (memberIds.length === 0) { setMemberAvatars([]); return; }
        const last5 = memberIds.slice(-5).reverse(); // last 5, newest first
        Promise.all(
            last5.map(uid =>
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

            await addDoc(reviewsRef, {
                partnerId,
                userId: currentUser.uid,
                userName: userProfile?.displayName || currentUser.displayName || 'Anonymous',
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
    // handleAddService: for editing existing (via modal) — saves immediately
    const handleAddService = (serviceData) => {
        if (editingService !== null) {
            const updated = services.map((s, i) => i === editingService ? serviceData : s);
            setServices(updated);
            const userRef = doc(db, 'users', partnerId);
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
            const userRef = doc(db, 'users', partnerId);
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
            await updateDoc(doc(db, 'users', partnerId), {
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

    const rawBusinessInfo = partner.businessInfo || {};
    // In preview mode → show visitor view (no edit controls)
    const isOwner = !isPreviewMode && currentUser?.uid === partnerId;

    // Merge drafts dynamically if viewing as owner
    const businessInfo = isOwner && rawBusinessInfo.drafts
        ? { ...rawBusinessInfo, ...rawBusinessInfo.drafts }
        : rawBusinessInfo;

    const hasDrafts = isOwner && rawBusinessInfo.drafts && Object.keys(rawBusinessInfo.drafts).length > 0;

    const tier = partner.subscriptionTier || 'free';
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
            title="Edit Section"
            style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: tc?.accent ? `${tc.accent}22` : 'rgba(255,255,255,0.12)', cursor: 'pointer',
                border: `1.5px solid ${tc?.accent || 'rgba(255,255,255,0.3)'}`,
                color: tc?.accent || 'rgba(255,255,255,0.85)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: tc?.accent ? `0 4px 14px ${tc.accent}44` : '0 4px 12px rgba(0,0,0,0.3)',
                transition: 'all 0.2s'
            }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.12)';
                e.currentTarget.style.background = tc?.accent ? `${tc.accent}44` : 'rgba(255,255,255,0.22)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = tc?.accent ? `${tc.accent}22` : 'rgba(255,255,255,0.12)';
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
    const isVerified = !!(businessInfo.coverImage && partner.photo_url);
    // ── Global Save: always saves directly (theme & all features are free) ──────────────────
    const handleGlobalSave = async () => {
        if (!currentUser || currentUser.uid !== partnerId) return;
        setGlobalSaving(true);
        const userRef = doc(db, 'users', partnerId);
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
        <div className="page-container" style={{
            paddingTop: '0',
            paddingBottom: '100px',
            background: th(tc?.cardBg, undefined),
            minHeight: '100vh',
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
            <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                {/* Cover & Top Nav */}
                <div style={{
                    width: '100%', height: '300px',
                    background: businessInfo.coverImage ? `url(${businessInfo.coverImage})` : th(tc?.gradientFrom ? `linear-gradient(135deg, ${tc.gradientFrom}, ${tc.gradientTo})` : null, 'linear-gradient(135deg, #1e1e2e, #2d2b42)'),
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    borderBottomLeftRadius: '32px', borderBottomRightRadius: '32px',
                    boxShadow: tc?.headerGlow || '0 10px 40px rgba(0,0,0,0.3)',
                    position: 'relative'
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
                                    {partner.isOnline && badgePill('16,185,129', '16,185,129', 'Online')}
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
                                background: partner.photo_url ? `url(${partner.photo_url})` : tc?.swatchGradient || 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                                backgroundSize: 'cover', backgroundPosition: 'center',
                                border: `4px solid rgba(255,255,255,0.25)`,
                                boxShadow: tc ? `0 8px 24px ${tc.accent}66` : '0 8px 24px rgba(0,0,0,0.5)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.4rem'
                            }}>
                                {!partner.photo_url && '🏪'}
                            </div>
                            {isOwner && (
                                <label style={{ position: 'absolute', inset: 0, borderRadius: '22px', background: logoUploading ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)', opacity: 0, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '4px solid transparent' }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = logoUploading ? 1 : 0}>
                                    <span style={{ fontSize: '1.3rem', color: 'white' }}>{logoUploading ? '⏳' : '📷'}</span>
                                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} disabled={logoUploading} />
                                </label>
                            )}
                            {/* Plan badge */}
                            {isPaid && !isOwner && (
                                <div style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#000000', border: `2px solid ${isElite ? '#f59e0b' : '#8b5cf6'}`, borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 8px ${isElite ? 'rgba(245,158,11,0.5)' : 'rgba(139,92,246,0.5)'}`, fontSize: '0.85rem' }} title={isElite ? 'Elite Partner' : 'Professional Partner'}>{isElite ? '👑' : '⚡'}</div>
                            )}
                        </div>

                        {/* Name + Category */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingBottom: '4px' }}>
                            <span style={{ color: 'white', fontWeight: '900', fontSize: '1.15rem', textShadow: '0 2px 8px rgba(0,0,0,0.9)', letterSpacing: '0.3px', lineHeight: 1.2 }}>
                                {partner.display_name || 'Business'}
                            </span>
                            {(businessInfo.businessType || businessInfo.cuisineType) && (
                                <span style={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.82rem', fontWeight: '600', textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>
                                    {businessInfo.businessType}{businessInfo.cuisineType ? ` • ${businessInfo.cuisineType}` : ''}
                                </span>
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


                {/* Glass Stats Box */}
                <div style={{ display: 'flex', width: '100%', background: th(tc?.badgeBg, 'rgba(255,255,255,0.03)'), border: `1px solid ${th(tc?.border, 'rgba(255,255,255,0.08)')}`, borderRadius: '24px', padding: '16px', boxShadow: th(tc?.cardShadow, '0 8px 32px rgba(0,0,0,0.2)'), backdropFilter: 'blur(12px)', marginBottom: '24px' }}>
                    <div onClick={() => { if (currentUser && !userProfile?.isBusiness && !isGuest) setShowReviewModal(true); }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: (currentUser && !userProfile?.isBusiness && !isGuest) ? 'pointer' : 'default' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>⭐ {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginTop: '4px' }}>{reviews.length} Reviews</div>
                    </div>
                    <div style={{ width: '1px', background: th(tc?.border, 'rgba(255,255,255,0.1)'), margin: '0 8px' }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: '900', color: th(tc?.badgeText || tc?.accent, '#a78bfa'), display: 'flex', alignItems: 'center', gap: '6px' }}>👥 {memberCount}</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginTop: '4px' }}>Members</div>
                    </div>
                    <div style={{ width: '1px', background: th(tc?.border, 'rgba(255,255,255,0.1)'), margin: '0 8px' }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '6px' }}>📨 {activeInvitationsCount}</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginTop: '4px' }}>Invites</div>
                    </div>
                </div>

                {businessInfo.tagline && (
                    <p style={{ fontSize: '1rem', color: th(tc?.badgeText, 'var(--text-secondary)'), margin: '0 0 24px 0', fontStyle: 'italic', fontWeight: '500', textAlign: 'center', maxWidth: '90%' }}>"{businessInfo.tagline}"</p>
                )}

                {/* Actions Row */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', marginBottom: '1rem' }}>
                    {currentUser?.uid !== partnerId && !userProfile?.isBusiness && (
                        <button onClick={() => { if (isGuest) { navigate('/login'); return; } handleJoinCommunity(); }} disabled={joiningCommunity} style={{ width: '100%', padding: '14px 16px', borderRadius: th(tc?.btnBorderRadius, '16px'), background: isMember ? 'rgba(255,255,255,0.1)' : th(tc?.joinBtnBg, 'linear-gradient(135deg, #8b5cf6, #f97316)'), border: isMember ? `1px solid ${th(tc?.border, 'rgba(255,255,255,0.2)')}` : 'none', color: isMember ? 'white' : th(tc?.joinBtnTextColor, 'white'), fontWeight: '900', fontSize: '1.05rem', cursor: joiningCommunity ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.3s', boxShadow: isMember ? 'none' : th(tc?.btnShadow, '0 8px 24px rgba(139,92,246,0.3)'), opacity: joiningCommunity ? 0.7 : 1 }}>
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
                    {currentUser?.uid !== partnerId && !userProfile?.isBusiness && !currentUser?.isGuest && (
                        <button onClick={handleCreateInvitation} style={{ width: '100%', padding: '16px', borderRadius: th(tc?.btnBorderRadius, '16px'), background: th(tc?.inviteBtnBg, 'rgba(255,255,255,0.05)'), border: `1px solid ${th(tc?.inviteBtnBg ? 'transparent' : (tc?.border || 'rgba(255,255,255,0.1)'), 'rgba(255,255,255,0.1)')}`, color: th(tc?.inviteBtnTextColor, 'white'), fontWeight: '800', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.3s', backdropFilter: 'blur(8px)' }}>
                            <FaUserPlus style={{ fontSize: '1.2rem' }} /> Create Invitation
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

            {/* Tabs Navigation */}
            <div style={{
                position: 'sticky', top: '10px', zIndex: 50,
                display: 'flex',
                flexWrap: 'wrap',
                padding: 'clamp(4px, 1vw, 6px)',
                margin: '0 clamp(4px, 2vw, 1rem) 1rem clamp(4px, 2vw, 1rem)',
                background: th(tc?.cardBg ? tc.cardBg + 'cc' : 'rgba(255,255,255,0.05)', 'rgba(30, 30, 46, 0.85)'),
                backdropFilter: 'blur(16px)',
                border: `1px solid ${th(tc?.border, 'rgba(255,255,255,0.1)')}`,
                borderRadius: '24px',
                boxShadow: th(tc?.cardShadow, '0 8px 32px rgba(0,0,0,0.2)'),
                gap: '4px',
            }}>
                {[
                    { id: 'about', label: 'About', locked: false },
                    { id: 'menu', label: 'Menu', locked: false, hide: !isOwner && (!isPaid || !(businessInfo.menu?.length > 0)) },
                    { id: 'services', label: 'Services', locked: false, hide: !isOwner && (!isPaid || !(services?.length > 0)) },
                    { id: 'hours', label: 'Hours', locked: false, hide: !isOwner && !businessInfo.hours },
                    { id: 'contact', label: 'Contact', locked: false, hide: !isOwner && !(businessInfo.phone || businessInfo.email || businessInfo.address) },
                ].filter(tab => !tab.hide).map(({ id, label, locked }) => (
                    <button
                        key={id}
                        onClick={() => {
                            if (locked) { navigate('/business/pricing'); return; }
                            setActiveTab(id);
                        }}
                        style={{
                            padding: '8px 14px',
                            background: activeTab === id && !locked ? th(tc?.accent, 'var(--primary)') : 'transparent',
                            boxShadow: activeTab === id && !locked ? th(tc?.btnShadow, '0 4px 12px rgba(139,92,246,0.3)') : 'none',
                            color: locked ? 'var(--text-muted)' : activeTab === id ? th(tc?.accentText || '#ffffff', 'white') : th(tc?.badgeText, 'var(--text-secondary)'),
                            borderRadius: '16px', border: 'none', cursor: 'pointer',
                            fontWeight: activeTab === id && !locked ? '800' : '600',
                            fontSize: '13px', whiteSpace: 'nowrap',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', opacity: locked ? 0.75 : 1
                        }}
                    >
                        {label}
                        {locked && <PlanBadge tier="pro" />}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div style={{ padding: '0 1rem 2rem 1rem', maxWidth: '100%', boxSizing: 'border-box' }}>

                {/* About Tab */}
                {activeTab === 'about' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* About Card */}
                        <div style={{
                            background: th(tc?.cardBg, 'var(--bg-card)'), border: `1px solid ${th(tc?.border, 'rgba(255,255,255,0.05)')}`,
                            borderRadius: '24px', padding: '24px', boxShadow: th(tc?.cardShadow, '0 10px 30px rgba(0,0,0,0.15)'),
                            position: 'relative', overflow: 'hidden'
                        }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: th(tc?.accent, 'linear-gradient(to bottom, #8b5cf6, #ec4899)') }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                                <h3 style={{ fontSize: '1.3rem', fontWeight: '900', margin: 0, color: th(tc?.badgeText, 'white'), display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                                    color: th(tc?.badgeText, 'var(--text-secondary)'), lineHeight: '1.8', fontSize: '1rem', margin: 0,
                                    opacity: 0.9, whiteSpace: 'pre-wrap'
                                }}>
                                    {businessInfo.description}
                                </p>
                            ) : (
                                <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>No description available</p>
                                </div>
                            )}
                        </div>


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
                        isPaid={isPaid}
                        theme={{ colors: tc }}
                    />
                )}

                {/* Services Tab */}
                {activeTab === 'services' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* Draft Banner - Free Plan */}
                        {showServiceDraftBanner && (
                            <div style={{
                                padding: '14px 18px', borderRadius: '14px',
                                background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(239,68,68,0.08) 100%)',
                                border: '1px solid rgba(245,158,11,0.35)',
                                display: 'flex', alignItems: 'flex-start', gap: '12px',
                            }}>
                                <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>⚠️</span>
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: '0 0 6px', fontWeight: '700', fontSize: '0.95rem', color: '#f59e0b' }}>Saved as Draft</p>
                                    <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                        Your services were saved, but they <strong>won't appear on your public profile</strong> until you upgrade your plan.
                                    </p>
                                    <a href="/pricing" style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        padding: '6px 14px', borderRadius: '8px',
                                        background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)',
                                        color: '#f59e0b', fontSize: '0.85rem', fontWeight: '700', textDecoration: 'none',
                                    }}>🚀 Upgrade Plan</a>
                                </div>
                                <button onClick={() => setShowServiceDraftBanner(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer', flexShrink: 0 }}>✕</button>
                            </div>
                        )}

                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: th(tc?.cardBg, 'var(--bg-card)'), border: `1px solid ${th(tc?.border, 'rgba(255,255,255,0.05)')}`, borderRadius: '24px', padding: '16px 24px', boxShadow: th(tc?.cardShadow, '0 10px 30px rgba(0,0,0,0.15)') }}>
                            <h3 style={{ fontSize: '1.3rem', fontWeight: '900', margin: 0, color: th(tc?.badgeText, 'white'), display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.4rem' }}>✨</span> Business Services
                            </h3>
                            {isOwner && (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <PlanBadges />
                                    {/* ＋ Add button toggles inline form */}
                                    <button
                                        onClick={() => setShowServiceAddForm(v => !v)}
                                        title={showServiceAddForm ? 'Close form' : 'Add service'}
                                        style={{
                                            width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
                                            border: `1px solid ${showServiceAddForm ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.35)'}`,
                                            background: showServiceAddForm ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                                            color: showServiceAddForm ? '#ef4444' : '#10b981',
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
                            <div style={{
                                background: th(tc?.cardBg, 'var(--bg-card)'),
                                border: '1px solid rgba(139,92,246,0.25)',
                                borderRadius: '20px', padding: '1.5rem',
                                display: 'flex', flexDirection: 'column', gap: '14px',
                            }}>
                                <h4 style={{ margin: 0, fontWeight: '800', fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FaPlus style={{ color: '#10b981' }} /> Add Service
                                </h4>

                                {/* Pending preview */}
                                {pendingServices.length > 0 && (
                                    <div style={{
                                        padding: '0.75rem', borderRadius: '10px',
                                        background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                                    }}>
                                        <p style={{ margin: '0 0 6px', fontSize: '0.8rem', fontWeight: '700', color: '#10b981' }}>
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
                                        background: 'rgba(139,92,246,0.1)', border: '2px solid rgba(139,92,246,0.3)',
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px',
                                    }}>
                                        {serviceForm.icon}
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    value={serviceIconSearch}
                                    onChange={e => setServiceIconSearch(e.target.value)}
                                    placeholder="Search icons..."
                                    style={{
                                        width: '100%', padding: '8px 12px', boxSizing: 'border-box',
                                        background: 'var(--bg-body)', border: '1px solid var(--border-color)',
                                        borderRadius: '10px', color: 'var(--text-main)', fontSize: '0.9rem',
                                    }}
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
                                                background: serviceForm.icon === s.icon ? 'rgba(139,92,246,0.25)' : 'transparent',
                                                outline: serviceForm.icon === s.icon ? '2px solid var(--primary)' : 'none',
                                                cursor: 'pointer',
                                            }}
                                        >{s.icon}</button>
                                    ))}
                                </div>

                                {/* Name */}
                                <div>
                                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem' }}>Service Name *</label>
                                    <input
                                        type="text"
                                        value={serviceForm.name}
                                        onChange={e => setServiceForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder="e.g., Home Delivery, Live DJ..."
                                        style={{
                                            width: '100%', padding: '10px 12px', boxSizing: 'border-box',
                                            background: 'var(--bg-body)', border: '1px solid var(--border-color)',
                                            borderRadius: '10px', color: 'var(--text-main)', fontSize: '0.9rem',
                                        }}
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem' }}>Description (optional)</label>
                                    <textarea
                                        value={serviceForm.description}
                                        onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))}
                                        rows={2}
                                        placeholder="Brief info about this service..."
                                        style={{
                                            width: '100%', padding: '10px 12px', boxSizing: 'border-box',
                                            background: 'var(--bg-body)', border: '1px solid var(--border-color)',
                                            borderRadius: '10px', color: 'var(--text-main)', fontSize: '0.9rem', resize: 'vertical',
                                        }}
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
                                            border: '1px solid rgba(16,185,129,0.4)',
                                            background: pendingServices.length > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                                            color: pendingServices.length > 0 ? '#10b981' : 'var(--text-muted)',
                                            fontWeight: '700', fontSize: '0.9rem',
                                            cursor: pendingServices.length > 0 ? 'pointer' : 'not-allowed',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        }}
                                    >
                                        <FaSave size={13} /> {savingServices ? 'Saving...' : `Save (${pendingServices.length})`}
                                    </button>

                                    {/* ✕ Discard */}
                                    <button
                                        onClick={handleDiscardServices}
                                        style={{
                                            padding: '0.65rem 0.9rem', borderRadius: '10px',
                                            border: '1px solid rgba(239,68,68,0.3)',
                                            background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                                            fontWeight: '700', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}
                                        title="Discard all pending"
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
                                        <h4 style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0, color: th(tc?.badgeText, 'white') }}>{service.name}</h4>
                                        {service.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{service.description}</p>}
                                        {isOwner && (
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', opacity: 0.8 }} className="service-actions">
                                                <button onClick={() => { setEditingService(index); setShowServiceModal(true); }} style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: '700', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer' }}>Edit</button>
                                                <button onClick={() => handleDeleteService(index)} style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: '700', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '8px', color: '#f87171', cursor: 'pointer' }}>Del</button>
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
                        partnerId={partnerId}
                        businessInfo={partner.businessInfo}
                        isOwner={isOwner}
                        theme={{ colors: tc }}
                    />
                )}

                {/* Contact Tab */}
                {activeTab === 'contact' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: th(tc?.cardBg, 'var(--bg-card)'), border: `1px solid ${th(tc?.border, 'rgba(255,255,255,0.05)')}`, borderRadius: '24px', padding: '16px 24px', boxShadow: th(tc?.cardShadow, '0 10px 30px rgba(0,0,0,0.15)') }}>
                            <h3 style={{ fontSize: '1.3rem', fontWeight: '900', margin: 0, color: th(tc?.badgeText, 'white'), display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                                    <div><div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone</div><div style={{ fontWeight: '800', color: th(tc?.badgeText, 'white'), fontSize: '1.1rem' }}>{businessInfo.phone}</div></div>
                                </div>
                            )}

                            {/* Website — Pro only */}
                            {isPaid && businessInfo.website && (
                                <div onClick={() => window.open(businessInfo.website.startsWith('http') ? businessInfo.website : `https://${businessInfo.website}`, '_blank')} style={{ background: th(tc?.cardBg, 'var(--bg-card)'), border: `1px solid ${th(tc?.border, 'rgba(255,255,255,0.05)')}`, borderRadius: '20px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: th(tc?.cardShadow, '0 8px 24px rgba(0,0,0,0.1)'), transition: 'all 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: th(tc?.badgeBg, 'rgba(59,130,246,0.15)'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: th(tc?.accent, '#3b82f6'), fontSize: '1.5rem', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.1)' }}><FaGlobe /></div>
                                    <div style={{ flex: 1 }}><div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Website</div><div style={{ fontWeight: '800', color: th(tc?.badgeText, 'white'), fontSize: '1.1rem', wordBreak: 'break-all' }}>{businessInfo.website.replace(/^(https?:\/\/|\/\/)/, '')}</div></div>
                                    <FaExternalLinkAlt style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }} />
                                </div>
                            )}
                        </div>

                        {businessInfo.address && (
                            <div style={{ background: th(tc?.cardBg, 'var(--bg-card)'), border: `1px solid ${th(tc?.border, 'rgba(255,255,255,0.05)')}`, borderRadius: '24px', padding: '24px', boxShadow: th(tc?.cardShadow, '0 10px 30px rgba(0,0,0,0.15)') }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: th(tc?.badgeBg, 'rgba(239,68,68,0.15)'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: th(tc?.accent, '#ef4444'), fontSize: '1.5rem', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.1)' }}><FaMapMarkerAlt /></div>
                                    <div><div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Address</div><div style={{ fontWeight: '800', color: th(tc?.badgeText, 'white'), fontSize: '1.1rem' }}>{businessInfo.address} {businessInfo.city && `, ${businessInfo.city}`}</div></div>
                                </div>

                                <div style={{ height: '320px', borderRadius: '20px', overflow: 'hidden', border: `2px solid ${th(tc?.border, 'rgba(255,255,255,0.1)')}`, position: 'relative', boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.1)' }}>
                                    <iframe src={`https://maps.google.com/maps?q=${encodeURIComponent(businessInfo.address + (businessInfo.city ? ', ' + businessInfo.city : '') + (businessInfo.country ? ', ' + businessInfo.country : ''))}&output=embed`} style={{ width: '100%', height: '100%', border: 0 }} loading="lazy" allowFullScreen title="Business Location" />
                                    {!isPaid && (
                                        <div onClick={() => { setPaywallFeature("Interactive Maps"); setShowPaywall(true); }} style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(30,30,46,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }} title="Upgrade to interact with the map">
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
                                <h4 style={{ fontSize: '1.1rem', fontWeight: '900', margin: '0 0 20px 0', color: th(tc?.badgeText, 'white'), display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: '800', color: th(tc?.badgeText, 'var(--text-main)') }}>
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
                                        color: 'var(--text-main)',
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
                                        color: th(tc?.badgeText, 'var(--text-main)'),
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
                )
            }

            {/* Contact Modal */}
            {
                showContactModal && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                        <div style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '1.5rem', width: '90%', maxWidth: '460px', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>📞 Edit Contact</h3>
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
                                { label: '🏙️ City', key: 'city', placeholder: 'Sydney' },
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
                                { icon: <FaGlobe color="#8b5cf6" />, label: 'Website', key: 'website', placeholder: 'https://yourbusiness.com' },
                                { icon: <FaInstagram color="#E1306C" />, label: 'Instagram', key: 'instagram', placeholder: '@yourbusiness' },
                                { icon: <FaFacebook color="#1877F2" />, label: 'Facebook', key: 'facebook', placeholder: 'facebook.com/yourbusiness' },
                                { icon: <FaTwitter color="#1DA1F2" />, label: 'Twitter / X', key: 'twitter', placeholder: '@yourbusiness' },
                                { icon: <SiTiktok color="#fff" />, label: 'TikTok', key: 'tiktok', placeholder: '@yourbusiness' },
                            ].map(({ icon, label, key, placeholder }) => (
                                <div key={key} style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem' }}>{icon} {label}</label>
                                    <input type="text" value={contactForm[key] || ''} placeholder={placeholder} onChange={e => setContactForm(p => ({ ...p, [key]: e.target.value }))}
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

export default PartnerProfile;
