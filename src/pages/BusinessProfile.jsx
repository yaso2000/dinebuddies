import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, onSnapshot, addDoc, serverTimestamp, updateDoc, increment, DocumentReference } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { subscribeBusinessLiked, toggleBusinessLike, incrementBusinessShareCount } from '../services/businessLikeService';
import { useInvitations } from '../context/InvitationContext';
import { uploadImage, deleteImage } from '../utils/imageUpload';
import { ImageUploadZone } from '../services/imageUploadZones';
import { notifyImageUploadError } from '../utils/imageModerationErrors';
import { FaArrowLeft, FaPhone, FaMapMarkerAlt, FaClock, FaGlobe, FaShareAlt, FaUserPlus, FaUsers, FaEdit, FaInstagram, FaTwitter, FaFacebook, FaExternalLinkAlt, FaShare, FaStar, FaImages, FaTimes, FaPlus, FaHeart, FaRegHeart, FaSave, FaEnvelope, FaCrown } from 'react-icons/fa';

import { HiBuildingStorefront } from 'react-icons/hi2';
import { SiTiktok } from 'react-icons/si';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { updateSocialMetaTags, generateBusinessMetaTags, resetSocialMetaTags } from '../utils/socialMetaTags';
import { useTranslation } from 'react-i18next';
import { getSafeAvatar, getSafeCoverImage, getShareableCoverImage } from '../utils/avatarUtils';
import UserAvatar from '../components/UserAvatar';
import DeliveryLinksSection from '../components/DeliveryLinksSection';
import BusinessLocationMap from '../components/BusinessLocationMap';
import { geocodeAddress } from '../utils/locationUtils';
import { getUserDocLatLng } from '../utils/userDocCoords';
import {
    normalizeDeliveryLinks,
    deliveryLinksReadyToSave,
} from '../utils/deliveryLinkMeta';
import BusinessHours from '../components/BusinessHours';
import EnhancedGallery from '../components/EnhancedGallery';
import EnhancedReviews from '../components/EnhancedReviews';
import FeedbackSubmissionModal from '../components/FeedbackSubmissionModal';
import MenuShowcase from '../components/MenuShowcase';
import GroupChat from '../components/GroupChat';
import ShareButtons from '../components/ShareButtons';
import CreateInvitationSelector from '../components/CreateInvitationSelector';
import { generateShareCardBlob } from '../utils/shareCardCanvas';
import { shareNativeOrFallback } from '../utils/shareNativeOrFallback';
import ServiceModal, { SERVICE_ICONS } from '../components/ServiceModal';
import { getContrastText } from '../utils/colorUtils';
import { isBusinessUser } from '../utils/accountRole';
import { getBusinessSubscriptionAccess } from '../utils/businessSubscription';
import { normalizeUserProfile } from '../utils/userProfileNormalize';
import PremiumBadge from '../components/PremiumBadge';
import PremiumPaywallModal from '../components/PremiumPaywallModal';
import {
    getTheme,
    getBusinessProfileUiColors,
    resolveBusinessProfileThemeId,
} from '../utils/businessThemes';
import DraftSavedModal from '../components/DraftSavedModal';
import BrandKit from './business-pro/BrandKit';
import PlanBadge from '../components/PlanBadge';
import FeaturedPostSlideCard from '../components/FeaturedPostSlideCard';
import PremiumOfferCard from '../components/PremiumOfferCard';
import PostCard from '../components/PostCard';
import { premiumOfferService } from '../services/premiumOfferService';
import { useToast } from '../context/ToastContext';
import { useBusinessRank } from '../hooks/useBusinessRank';
import { goToLogin } from '../utils/goToLogin';

const BUSINESS_TYPES = [
    'Restaurant', 'Cafe', 'Bar', 'Night Club', 'Food Truck', 'Fast Food'
];

/** When Firestore denies users/{id} (guest / unauthenticated listener), load read-only projection (rules: public_profiles get allowed for all). */
async function loadBusinessFromPublicProfileProjection(profileId) {
    try {
        const snap = await getDoc(doc(db, 'public_profiles', profileId));
        if (!snap.exists()) return null;
        const p = snap.data();
        if (p.profileType !== 'business' || !p.businessPublic) return null;
        const bp = p.businessPublic;
        return {
            uid: profileId,
            display_name: p.displayName || 'Business',
            photo_url: p.avatarUrl || null,
            role: 'business',
            _fromPublicProfileProjection: true,
            businessInfo: {
                businessType: bp.businessType || 'Restaurant',
                city: bp.city || '',
                country: bp.country || '',
                address: bp.address || '',
                description: bp.description || '',
                coverImage: bp.coverImage || '',
                lat: bp.lat ?? null,
                lng: bp.lng ?? null,
                brandKit: bp.brandKit || null,
                theme: bp.theme || '',
                isPublished: bp.isPublished === true,
                profileLikes: Number(p.profileLikes ?? 0),
                profileShares: Number(p.profileShares ?? 0),
            },
            emailVerified: false,
            communityMembers: [],
            averageRating: typeof p.averageRating === 'number' ? p.averageRating : undefined,
            reviewCount: typeof p.reviewCount === 'number' ? p.reviewCount : undefined,
        };
    } catch (e) {
        console.warn('public_profiles fallback:', e);
        return null;
    }
}

/**
 * Root fields updated by AuthContext / presence (lastSeen, etc.) change on every meta write but are not
 * what the business profile UI edits — excluding them fixes failed dedup → endless setBusiness loops.
 */
function stripVolatileProfileFieldsForDedup(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const out = { ...obj };
    delete out.lastSeen;
    delete out.last_active_time;
    delete out.lastLocationUpdate;
    delete out.locationSource;
    return out;
}

/** Deterministic deep sort + Firestore types — stable signature for snapshot equality. */
function sortKeysDeep(val) {
    if (val === null || val === undefined) return val;
    if (typeof val !== 'object') return val;
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (typeof val.toDate === 'function') return val.toDate().getTime();
    if (val instanceof DocumentReference) return val.path;
    if (typeof val.seconds === 'number' && typeof val.nanoseconds === 'number') {
        return val.seconds * 1000 + val.nanoseconds / 1e6;
    }
    if (typeof val.latitude === 'number' && typeof val.longitude === 'number') {
        return `${val.latitude},${val.longitude}`;
    }
    if (Array.isArray(val)) return val.map(sortKeysDeep);
    const sorted = {};
    for (const k of Object.keys(val).sort()) {
        sorted[k] = sortKeysDeep(val[k]);
    }
    return sorted;
}

function stableFirestoreDocSig(obj) {
    try {
        return JSON.stringify(sortKeysDeep(obj));
    } catch {
        return '';
    }
}

// Business profile page; route /business/:businessId (legacy /partner/:id redirects to /business/)
const BusinessProfile = () => {
    const { businessId, partnerId } = useParams();
    const profileId = businessId ?? partnerId;
    const navigate = useNavigate();
    const location = useLocation();
    const profileSetupToastRef = useRef(false);
    const businessSignupVerifyToastRef = useRef(false);
    const { currentUser, userProfile, updateUserProfile, isGuest, loading: authLoading } = useAuth();
    const { setBrandColor } = useTheme();
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
    /** Last applied users/{profileId} payload signature — avoids setState when Firestore re-delivers the same doc. */
    const lastBizSnapshotSigRef = useRef('');

    const [business, setBusiness] = useState(null);
    const tierAccess = useMemo(
        () => getBusinessSubscriptionAccess(business?.subscriptionTier),
        [business?.subscriptionTier]
    );
    const isPaid = tierAccess.isPaid;
    const isElite = tierAccess.isPaid;
    const isPremium = tierAccess.isPaid;
    const [loading, setLoading] = useState(true);
    /** Visitors only: hidden until business email is verified on the account. Owner always sees/edits — not gated by email. */
    const [publicProfileHidden, setPublicProfileHidden] = useState(false);
    /** Latest users/{profileId} payload when we defer visibility until auth finishes restoring */
    const pendingBizDocRef = useRef(null);
    const authLoadingRef = useRef(authLoading);
    const isGuestRef = useRef(isGuest);
    const currentUserRef = useRef(currentUser);
    useEffect(() => { authLoadingRef.current = authLoading; }, [authLoading]);
    useEffect(() => { isGuestRef.current = isGuest; }, [isGuest]);
    useEffect(() => {
        currentUserRef.current = currentUser;
    }, [currentUser?.uid, currentUser?.email, currentUser?.displayName, currentUser?.photoURL]);
    const [activeTab, setActiveTab] = useState('about');

    const [activeInvitationsCount, setActiveInvitationsCount] = useState(0);
    const [reviews, setReviews] = useState([]);
    const [averageRating, setAverageRating] = useState(0);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
    const [submittingReview, setSubmittingReview] = useState(false);

    const [featuredPosts, setFeaturedPosts] = useState([]);

    // Gallery states
    const [uploadingImage, setUploadingImage] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    // Delivery Links states (Premium feature) — array of { id, url, name, icon, ... }
    const [deliveryLinks, setDeliveryLinks] = useState([]);
    const [editingDeliveryLinks, setEditingDeliveryLinks] = useState(false);

    // Highlights state
    const [highlights, setHighlights] = useState({
        offers: [],
        posts: [],
        events: [],
        loading: true
    });
    const [isMobileView, setIsMobileView] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobileView(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const [tempDeliveryLinks, setTempDeliveryLinks] = useState([]);

    // Like/share counts: single source of truth = Firestore (onSnapshot). No local override state.
    // Optimistic share count so number doesn’t flash back to zero
    const [userLikedBusiness, setUserLikedBusiness] = useState(false);
    const [likeInProgress, setLikeInProgress] = useState(false);

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





    const applySnapshotBusinessData = React.useCallback((data, docSnap) => {
        const snapLikes = Number(data.businessInfo?.profileLikes ?? 0);
        const snapShares = Number(data.businessInfo?.profileShares ?? 0);
        const normalized = {
            uid: docSnap.id,
            ...data,
            businessInfo: { ...(data.businessInfo || {}), profileLikes: snapLikes, profileShares: snapShares }
        };
        const sig = stableFirestoreDocSig(stripVolatileProfileFieldsForDedup(normalized));
        if (sig && sig === lastBizSnapshotSigRef.current) {
            setLoading(false);
            return;
        }
        lastBizSnapshotSigRef.current = sig;
        setPublicProfileHidden(false);
        setBusiness(normalized);
        const memberIds = data.communityMembers || [];
        setMemberCount(memberIds.length);
        const cu = currentUserRef.current;
        if (cu?.uid && !joiningRef.current) {
            setIsMember(memberIds.includes(cu.uid) || memberIds.includes(cu.id));
        }
        setLoading(false);
    }, [profileId]);

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
            const qPartner = query(reviewsRef, where('partnerId', '==', profileId));
            const qProfile = query(reviewsRef, where('profileId', '==', profileId));
            const qRestaurant = query(reviewsRef, where('restaurantId', '==', profileId));
            const [snapPartner, snapProfile, snapRestaurant] = await Promise.all([getDocs(qPartner), getDocs(qProfile), getDocs(qRestaurant)]);
            const byId = new Map();
            [...snapPartner.docs, ...snapProfile.docs, ...snapRestaurant.docs].forEach(doc => byId.set(doc.id, { id: doc.id, ...doc.data() }));
            const reviewsData = Array.from(byId.values());

            reviewsData.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateB - dateA;
            });

            setReviews(reviewsData);

            if (reviewsData.length > 0) {
                const totalRating = reviewsData.reduce((sum, review) => sum + (review.rating || 0), 0);
                setAverageRating(totalRating / reviewsData.length);
            } else {
                setAverageRating(0);
            }
        } catch (error) {
            console.error('❌ Error fetching reviews:', error);
        }
    };

    const fetchFeaturedPosts = async () => {
        if (!profileId) return;
        try {
            const q = query(
                collection(db, 'featured_posts'),
                where('partnerId', '==', profileId),
                orderBy('createdAt', 'desc'),
                limit(12)
            );
            const snap = await getDocs(q);
            setFeaturedPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            setFeaturedPosts([]);
        }
    };

    useEffect(() => {
        if (authLoading) return;
        const pending = pendingBizDocRef.current;
        if (!pending?.data || !pending?.docSnap) return;
        const data = pending.data;
        if (!isBusinessUser(data)) {
            pendingBizDocRef.current = null;
            return;
        }
        const sessionUid = auth.currentUser?.uid ?? currentUserRef.current?.uid ?? null;
        const isOwnerView = sessionUid === profileId;
        const emailVerifiedPublic = data.emailVerified === true;
        if (isOwnerView) {
            applySnapshotBusinessData(data, pending.docSnap);
            pendingBizDocRef.current = null;
            return;
        }
        if (!emailVerifiedPublic) {
            setBusiness(null);
            setPublicProfileHidden(true);
            setLoading(false);
        } else {
            applySnapshotBusinessData(data, pending.docSnap);
        }
        pendingBizDocRef.current = null;
    }, [authLoading, currentUser?.uid, profileId, applySnapshotBusinessData]);

    /** Firestore subscription — re-binds if currentUser changes to ensure owner permissions are correctly applied. */
    useEffect(() => {
        if (authLoading) return undefined;
        
        lastBizSnapshotSigRef.current = '';
        pendingBizDocRef.current = null;
        setPublicProfileHidden(false);

        if (!profileId) {
            setBusiness(null);
            setLoading(false);
            return undefined;
        }

        setLoading(true);
        const docRef = doc(db, 'users', profileId);

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            const raw = docSnap.exists() ? docSnap.data() : null;
            // Must match AuthContext: raw Firestore can miss computed isBusiness / pending flags.
            const profileForGate = raw
                ? normalizeUserProfile({ id: docSnap.id, uid: docSnap.id, ...raw })
                : null;
            if (docSnap.exists() && profileForGate && isBusinessUser(profileForGate)) {
                const data = profileForGate;
                const sessionUid = auth.currentUser?.uid ?? currentUserRef.current?.uid ?? null;
                const isOwnerView = sessionUid === profileId;
                const emailVerifiedPublic = data.emailVerified === true;

                // 1. If it's the owner, they should always see the profile even if unverified.
                if (isOwnerView) {
                    pendingBizDocRef.current = null;
                    applySnapshotBusinessData(data, docSnap);
                    return;
                }

                // 2. If auth is still loading, defer the decision to avoid "flickering" or loops.
                if (authLoadingRef.current) {
                    pendingBizDocRef.current = { data, docSnap };
                    // Keep loading true to avoid showing "Not Public" message prematurely.
                    setLoading(true);
                    return;
                }

                // 3. If visitor and email is not verified, hide it.
                if (!emailVerifiedPublic) {
                    pendingBizDocRef.current = null;
                    // Never call setBusiness/setLoading inside another setState updater — breaks React 18 batching
                    // and has been linked to blank screens after leaving the route.
                    setBusiness(null);
                    setLoading(false);
                    setPublicProfileHidden(true);
                    return;
                }

                // 4. Otherwise, it's a verified public profile.
                setPublicProfileHidden(false);
                pendingBizDocRef.current = null;
                applySnapshotBusinessData(data, docSnap);
            } else {
                void (async () => {
                    const fb = await loadBusinessFromPublicProfileProjection(profileId);
                    if (fb) {
                        setBusiness(fb);
                        setPublicProfileHidden(false);
                    } else {
                        console.error('Business not found or not a business account');
                        setBusiness(null);
                        setPublicProfileHidden(false);
                    }
                    setLoading(false);
                })();
            }
        }, async (error) => {
            // Permission denied usually means the profile is not public yet or user is unverified.
            // Try public_profiles projection first.
            const fb = await loadBusinessFromPublicProfileProjection(profileId);
            if (fb) {
                setBusiness(fb);
                setPublicProfileHidden(false);
                setLoading(false);
            } else {
                const sessionUid = auth.currentUser?.uid ?? currentUserRef.current?.uid ?? null;
                let resolved = false;
                if (sessionUid === profileId) {
                    try {
                        const snap = await getDoc(doc(db, 'users', profileId));
                        if (snap.exists()) {
                            const pf = normalizeUserProfile({ id: snap.id, uid: snap.id, ...snap.data() });
                            if (isBusinessUser(pf)) {
                                applySnapshotBusinessData(pf, snap);
                                setPublicProfileHidden(false);
                                setLoading(false);
                                resolved = true;
                            }
                        }
                    } catch (e) {
                        console.error('Owner getDoc fallback failed:', e);
                    }
                    if (!resolved) console.error('Owner permission error on profile:', error);
                }
                if (!resolved) {
                    setBusiness(null);
                    setPublicProfileHidden(false);
                    setLoading(false);
                }
            }
        });

        return () => unsubscribe();
    }, [profileId, applySnapshotBusinessData, currentUser?.uid, authLoading]);

    // Fetch Highlights (Offers, Posts, Events)
    useEffect(() => {
        const fetchHighlights = async () => {
            if (!profileId) return;
            
            let activeOffers = [];
            let activePosts = [];
            let activeEvents = [];

            // 1. Fetch Premium Offers (from public active_offers collection)
            try {
                const offersQuery = query(collection(db, 'active_offers'), where('partnerId', '==', profileId), limit(1));
                const offersSnap = await getDocs(offersQuery);
                activeOffers = offersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // If no premium active offers, try standard special_offers
                if (activeOffers.length === 0) {
                    const legacyQuery = query(collection(db, 'special_offers'), where('restaurantId', '==', profileId), where('status', 'in', ['active', 'published']), limit(1));
                    const legacySnap = await getDocs(legacyQuery);
                    activeOffers = legacySnap.docs.map(doc => {
                        const data = doc.data();
                        return { id: doc.id, ...data, imageUrl: data.mediaUrl || data.imageUrl };
                    });
                }
            } catch (err) {
                console.error("Error fetching offers highlights:", err);
            }

            // 2. Fetch Featured Posts (max 3)
            try {
                const postsQuery = query(
                    collection(db, 'featured_posts'),
                    where('partnerId', '==', profileId),
                    orderBy('createdAt', 'desc'),
                    limit(3)
                );
                const postsSnap = await getDocs(postsQuery);
                activePosts = postsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (err) {
                console.error("Error fetching posts highlights:", err);
            }

            // 3. Fetch Events (max 1) - DISABLED until index is created to prevent errors
            /*
            try {
                const eventsQuery = query(
                    collection(db, 'communityPosts'),
                    where('authorId', '==', profileId),
                    where('type', '==', 'event'),
                    orderBy('createdAt', 'desc'),
                    limit(1)
                );
                const eventsSnap = await getDocs(eventsQuery);
                activeEvents = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (err) {
                console.error("Error fetching events highlights:", err);
            }
            */

            setHighlights({
                offers: activeOffers,
                posts: activePosts,
                events: activeEvents,
                loading: false
            });
        };
        fetchHighlights();
    }, [profileId]);

    useEffect(() => {
        const loadAllData = async () => {
            if (profileId) {
                await Promise.all([
                    fetchActiveInvitations(),
                    fetchReviews()
                ]);
                if (getBusinessSubscriptionAccess(business?.subscriptionTier).isPaid) {
                    fetchFeaturedPosts();
                }
            }
        };
        loadAllData();
        // Auth exposes a new currentUser object every Provider render; depend on uid only to avoid fetch loops
    }, [currentUser?.uid, profileId, business?.uid, business?.subscriptionTier]);

    const deliveryLinksKey = JSON.stringify(business?.businessInfo?.deliveryLinks ?? null);
    // Load delivery links when partner data changes
    useEffect(() => {
        if (business?.businessInfo?.deliveryLinks) {
            const normalized = normalizeDeliveryLinks(business.businessInfo.deliveryLinks);
            setDeliveryLinks(normalized);
            setTempDeliveryLinks(normalized.map((l) => ({ ...l })));
        }
    }, [deliveryLinksKey]);

    const servicesKey = JSON.stringify(business?.businessInfo?.services ?? null);
    // Load services when partner data changes
    useEffect(() => {
        if (business?.businessInfo?.services) {
            setServices(business.businessInfo.services);
        }
    }, [servicesKey]);

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
        // Functional update: do not list activeTab in deps — that pattern re-ran the effect on every tab change.
        setActiveTab((tab) => (!visibleIds.includes(tab) ? (visibleIds[0] || 'about') : tab));
    }, [isOwnerProfile, business?.businessInfo?.menu?.length, business?.businessInfo?.hours, business?.businessInfo?.phone, business?.businessInfo?.email, business?.businessInfo?.address, services?.length]);

    useEffect(() => {
        const memberIds = business?.communityMembers || [];
        if (memberIds.length === 0) { setMemberAvatars([]); return; }
        const last5 = memberIds.slice(-5).reverse(); // last 5, newest first
        Promise.all(
            last5.map(uid =>
                getDoc(doc(db, 'users', uid))
                    .then(snap => snap.exists() ? getSafeAvatar(snap.data()) : null)
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

    useEffect(() => {
        if (!profileId || !currentUser?.uid) return;
        const unsubscribe = subscribeBusinessLiked(profileId, currentUser.uid, setUserLikedBusiness);
        return unsubscribe;
    }, [profileId, currentUser?.uid]);

    const { rank: rankingPosition, loading: rankLoading } = useBusinessRank(profileId);

    // Update social meta tags (avoid [business] — new object every Firestore snapshot retriggers endlessly)
    useEffect(() => {
        if (business) {
            const metaData = generateBusinessMetaTags(business);
            updateSocialMetaTags(metaData);
        }
        return () => resetSocialMetaTags();
    }, [
        business?.uid,
        business?.businessInfo?.businessName,
        business?.businessInfo?.description,
        business?.businessInfo?.location,
        business?.display_name,
        business?.photo_url,
        business?.name,
    ]);

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

            // Check in database if user already reviewed (partnerId or profileId)
            const reviewsRef = collection(db, 'reviews');
            const [existingPartner, existingProfile] = await Promise.all([
                getDocs(query(reviewsRef, where('partnerId', '==', profileId), where('userId', '==', currentUser.uid))),
                getDocs(query(reviewsRef, where('profileId', '==', profileId), where('userId', '==', currentUser.uid)))
            ]);
            if (!existingPartner.empty || !existingProfile.empty) {
                showToast(t('already_reviewed'), 'error');
                setSubmittingReview(false);
                setShowReviewModal(false);
                return;
            }

            await addDoc(reviewsRef, {
                partnerId: profileId,
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
            goToLogin();
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

            const downloadURL = await uploadImage(file, path, null, options, {
                moderationZone: ImageUploadZone.GALLERY,
                userId: profileId,
            });

            // Update Firestore
            const updatedGallery = [...currentGallery, downloadURL];
            const businessRef = doc(db, 'users', profileId);
            await updateDoc(businessRef, {
                'businessInfo.gallery': updatedGallery
            });

        } catch (error) {
            console.error('❌ Error uploading image:', error);
            notifyImageUploadError(showToast, error, t, 'upload_image_failed');
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
            goToLogin();
            return;
        }

        const businessInfo = business.businessInfo || {};

        // Open selector with strictly formatted restaurantData, allowing CreateInvitation to link Dashboard metrics
        setSelectorState({
            restaurantData: {
                id: profileId,
                name: business.display_name,
                image: businessInfo.coverImage,
                address: businessInfo.address,
                city: businessInfo.city,
                lat: businessInfo.lat,
                lng: businessInfo.lng,
                type: businessInfo.businessType || 'Restaurant'
            },
            fromRestaurant: true
        });
        setIsSelectorOpen(true);
    };

    const handleBookInvitation = () => {
        if (!currentUser) {
            goToLogin();
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


    // Like: write to Firestore then update favoritePlaces so snapshot has new value before context re-renders; keep optimistic override so count doesn’t disappear on stale snapshot
    const handleToggleLike = async () => {
        if (!currentUser?.uid) {
            goToLogin();
            return;
        }
        if (likeInProgress) return;
        const businessId = profileId;
        const userId = currentUser.uid;
        setLikeInProgress(true);
        try {
            const businessInfoForFavorite = !userLikedBusiness && business ? {
                businessId: profileId,
                name: business.display_name || '',
                image: getSafeAvatar(business),
                address: business.businessInfo?.address || '',
                city: business.businessInfo?.city || ''
            } : undefined;
            await toggleBusinessLike(businessId, userId, userLikedBusiness, businessInfoForFavorite);
        } catch (err) {
            console.warn('[like] profile toggle failed', { businessId, userId, err });
            showToast(t('like_failed', 'Could not update like. Try again.'), 'error');
        } finally {
            setLikeInProgress(false);
        }
    };



    const handleShare = async () => {
        if (!business) return;
        const shareTitle = business.display_name || 'DineBuddies Business';
        const shareUrl = window.location.href;
        const coverForShare = getShareableCoverImage(business.businessInfo?.coverImage)
            || getSafeAvatar(business);
        const storyData = {
            title: shareTitle,
            image: coverForShare,
            description: business.businessInfo?.description,
            location: business.businessInfo?.address || business.businessInfo?.city,
            hostName: shareTitle,
            hostImage: getSafeAvatar(business),
            shareUrl,
            averageRating,
            reviewCount: reviews.length,
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
        const result = await shareNativeOrFallback({
            file: headerCardFile,
            title: shareTitle,
            text: shareText,
            url: shareUrl,
            skipExternalFallback: false,
        });
        if (result === 'aborted') return;
        try {
            await incrementBusinessShareCount(profileId);
        } catch (err) {
            console.warn('Profile shares count update failed:', err);
        }
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
            const toSave = deliveryLinksReadyToSave(tempDeliveryLinks);
            const userRef = doc(db, 'users', profileId);
            await updateDoc(userRef, {
                'businessInfo.deliveryLinks': toSave
            });
            setDeliveryLinks(toSave);
            setTempDeliveryLinks(toSave.map((l) => ({ ...l })));
            setEditingDeliveryLinks(false);
        } catch (error) {
            console.error('❌ Error saving delivery links:', error);
            showToast(t('save_delivery_links_failed'), 'error');
        }
    };

    const handleCancelDeliveryLinks = () => {
        setTempDeliveryLinks(deliveryLinks.map((l) => ({ ...l })));
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
            const url = await uploadImage(file, `covers/${profileId}/cover.jpg`, null, { maxSizeMB: 1, maxWidthOrHeight: 1600 }, {
                moderationZone: ImageUploadZone.COVER,
                userId: profileId,
            });
            await updateDoc(doc(db, 'users', profileId), { 'businessInfo.coverImage': url });
        } catch (err) { notifyImageUploadError(showToast, err, t, 'cover_upload_failed'); } finally { setCoverUploading(false); }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            setLogoUploading(true);
            const url = await uploadImage(file, `logos/${profileId}/logo.jpg`, null, { maxSizeMB: 0.5, maxWidthOrHeight: 400 }, {
                moderationZone: ImageUploadZone.LOGO,
                userId: profileId,
            });
            await updateDoc(doc(db, 'users', profileId), { photo_url: url });
        } catch (err) { notifyImageUploadError(showToast, err, t, 'logo_upload_failed'); } finally { setLogoUploading(false); }
    };

    const openBasicInfoModal = () => {
        setBasicInfoForm({
            businessName: business.display_name || '',
            tagline: businessInfo.tagline || '',
            businessType: BUSINESS_TYPES.includes(businessInfo.businessType) ? businessInfo.businessType : 'Restaurant',
            cuisineType: businessInfo.cuisineType || '',
            description: businessInfo.description || ''
        });
        setShowBasicInfoModal(true);
    };

    const saveBasicInfo = async () => {
        setSavingInfo(true);
        try {
            const payload = {
                display_name: basicInfoForm.businessName,
                'businessInfo.businessName': basicInfoForm.businessName,
                'businessInfo.tagline': basicInfoForm.tagline,
                'businessInfo.businessType': basicInfoForm.businessType,
                'businessInfo.cuisineType': basicInfoForm.businessType === 'Restaurant' ? basicInfoForm.cuisineType : '',
                'businessInfo.description': basicInfoForm.description,
            };
            if (business?.businessProfileSetupPending) {
                payload.businessProfileSetupPending = false;
            }
            await updateDoc(doc(db, 'users', profileId), payload);
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
            const payload = {
                'businessInfo.phone': contactForm.phone,
                'businessInfo.email': contactForm.email,
                'businessInfo.website': contactForm.website,
                'businessInfo.address': contactForm.address,
                'businessInfo.city': contactForm.city,
                'businessInfo.instagram': contactForm.instagram,
                'businessInfo.facebook': contactForm.facebook,
                'businessInfo.twitter': contactForm.twitter,
                'businessInfo.tiktok': contactForm.tiktok,
            };
            if (business?.businessProfileSetupPending) {
                payload.businessProfileSetupPending = false;
            }
            const addressLine = [contactForm.address, contactForm.city, businessInfo.country]
                .filter(Boolean)
                .join(', ')
                .trim();
            if (addressLine) {
                const geo = await geocodeAddress(addressLine);
                if (geo.success && geo.results?.[0]) {
                    payload['businessInfo.lat'] = geo.results[0].lat;
                    payload['businessInfo.lng'] = geo.results[0].lng;
                }
            } else {
                payload['businessInfo.lat'] = null;
                payload['businessInfo.lng'] = null;
            }
            await updateDoc(doc(db, 'users', profileId), payload);
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

    const isOwner = !isPreviewMode && currentUser?.uid === profileId;

    useEffect(() => {
        if (!isOwner || profileSetupToastRef.current) return;
        if (!location.state?.businessProfileSetupReminder) return;
        profileSetupToastRef.current = true;
        const pathNorm = (location.pathname || '/').replace(/\/$/, '') || '/';
        showToast(
            t(
                'business_profile_setup_toast',
                'Complete your business details below so customers can find you.'
            ),
            'info'
        );
        navigate({ pathname: pathNorm, search: location.search || '' }, { replace: true, state: {} });
    }, [isOwner, location.state, location.pathname, location.search, navigate, showToast, t]);

    useEffect(() => {
        if (!isOwner || businessSignupVerifyToastRef.current) return;
        if (!location.state?.businessSignupNeedsVerify) return;
        const pathNorm = (location.pathname || '/').replace(/\/$/, '') || '/';
        const clearNav = () =>
            navigate({ pathname: pathNorm, search: location.search || '' }, { replace: true, state: {} });
        if (!currentUser || currentUser.emailVerified) {
            clearNav();
            return;
        }
        businessSignupVerifyToastRef.current = true;
        showToast(
            t(
                'business_signup_verify_toast',
                'We sent an activation link to your email. Check your inbox to verify your business account.'
            ),
            'info'
        );
        clearNav();
    }, [isOwner, location.state, location.pathname, location.search, navigate, showToast, t, currentUser]);

    useEffect(() => {
        if (loading || !business || !isOwner) return;
        if (business.pendingBusinessRegistration === true) {
            navigate('/business/onboarding', { replace: true });
        }
    }, [loading, business, isOwner, navigate]);

    if (loading) {
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
                <p style={{ marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600, textAlign: 'center', maxWidth: '300px', lineHeight: 1.45 }}>
                    {t('loading_business', 'Loading this profile…')}
                </p>
                <p style={{ marginTop: '10px', color: 'var(--text-muted)', fontSize: '0.8rem', opacity: 0.85, textAlign: 'center', maxWidth: '320px', lineHeight: 1.5 }}>
                    {t('loading_business_hint', 'This usually takes a moment.')}
                </p>
            </div>
        );
    }

    // OWNER BYPASS: Owners never see the "Hidden" screen.
    if (publicProfileHidden && !isOwner) {
        return (
            <div className="page-container" style={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
                background: 'var(--bg-body)',
                padding: '2rem',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                maxWidth: '420px',
                margin: '0 auto'
            }}>
                <HiBuildingStorefront style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: '1rem' }} />
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                    {t('business_profile_not_public_yet_title', 'Profile not available')}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.55, marginBottom: '1.5rem' }}>
                    {t(
                        'business_profile_not_public_until_email',
                        'This page is not shown to the public until the business verifies their email. The owner can still open and edit their profile from the business dashboard.'
                    )}
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" className="ui-btn ui-btn--secondary" onClick={() => navigate('/')}>
                        {t('back_to_home', 'Back to Home')}
                    </button>
                    <button type="button" className="ui-btn ui-btn--primary" onClick={() => window.location.reload()}>
                        {t('retry', 'Retry')}
                    </button>
                </div>
            </div>
        );
    }

    if (!business) {
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
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {t('business_not_found', 'Business not found')}
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

    // Merge drafts dynamically if viewing as owner
    const businessInfo = isOwner && rawBusinessInfo.drafts
        ? { ...rawBusinessInfo, ...rawBusinessInfo.drafts }
        : rawBusinessInfo;

    const profileMapCoords = getUserDocLatLng(business);

    const hasDrafts = isOwner && rawBusinessInfo.drafts && Object.keys(rawBusinessInfo.drafts).length > 0;

    // ── Theme & Brand Kit Engine ──
    const brandKit = (isPreviewMode && previewBrandKit) ? previewBrandKit : (businessInfo?.brandKit || {});
    const _p = brandKit.primaryColor || null;
    const uiThemeId = resolveBusinessProfileThemeId(
        businessInfo?.theme || brandKit.templateId
    );
    const theme = getTheme(uiThemeId);
    const tc = getBusinessProfileUiColors(_p, theme?.colors);
    const _s = brandKit.secondaryColor || theme?.colors?.badgeText || tc?.accent;
    const _br = brandKit.buttonStyle || tc?.btnBorderRadius || '14px';
    const _ff = 'system-ui, sans-serif';

    // Standardized floating Edit Button for all sections
    const EditActionBtn = ({ onClick, icon = <FaEdit size={16} /> }) => (
        <button
            onClick={onClick}
            title={t('edit_section')}
            style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: 'color-mix(in srgb, var(--brand-primary) 15%, transparent)',
                cursor: 'pointer',
                border: `1.5px solid var(--brand-primary)`,
                color: 'var(--brand-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: tc?.accent ? `0 4px 14px ${tc.accent}44` : '0 2px 8px rgba(0,0,0,0.08)',
                transition: 'all 0.2s'
            }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.12)';
                e.currentTarget.style.background = 'color-mix(in srgb, var(--brand-primary) 25%, transparent)';
                e.currentTarget.style.borderColor = 'var(--brand-primary)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = 'color-mix(in srgb, var(--brand-primary) 15%, transparent)';
                e.currentTarget.style.borderColor = 'var(--brand-primary)';
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
    const th = (t, f) => (tc && t !== undefined && t !== null) ? t : f;

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

    // Helper: Map DineBuddies business types to official Schema.org types
    const getSchemaType = (type) => {
        switch (type) {
            case 'Cafe': return 'CafeOrCoffeeShop';
            case 'Bar': return 'BarOrPub';
            case 'Night Club': return 'NightClub';
            case 'Food Truck': return 'FoodEstablishment';
            case 'Fast Food': return 'FastFoodRestaurant';
            case 'Restaurant': return 'Restaurant';
            default: return 'LocalBusiness';
        }
    };

    // Generate Structured Data (JSON-LD) for SEO
    const jsonLd = business ? {
        "@context": "https://schema.org",
        "@type": getSchemaType(businessInfo?.businessType),
        "name": business.display_name || 'DineBuddies Business',
        "image": [
            getSafeCoverImage(businessInfo?.coverImage),
            getSafeAvatar(business)
        ].filter(Boolean),
        "url": typeof window !== "undefined" ? window.location.href : '',
        "telephone": businessInfo?.phone || '',
        "address": {
            "@type": "PostalAddress",
            "streetAddress": businessInfo?.address || '',
            "addressLocality": businessInfo?.city || '',
            "addressCountry": "AU"
        },
        "description": businessInfo?.description || businessInfo?.tagline || `Discover ${business.display_name} on DineBuddies.`,
        "servesCuisine": businessInfo?.cuisineType || '',
        ...(averageRating > 0 ? {
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": averageRating.toFixed(1),
                "reviewCount": reviews.length
            }
        } : {})
    } : null;

    return (
        <div
            className="profile-shell page-container"
            style={{
                ...(tc?.accent
                    ? {
                          '--primary': tc.accent,
                          '--brand-primary': tc.accent,
                          '--primary-hover': _s || tc.accent,
                      }
                    : {}),
                ...(_s ? { '--primary-dark': _s, '--brand-secondary': _s } : {}),
                '--brand-radius': _br,
                '--brand-font': _ff,
                paddingTop: '0',
                background: th(tc?.cardBg, undefined),
                fontFamily: 'var(--brand-font), sans-serif',
            }}
        >
            
            {/* Dynamic SEO Meta Tags & JSON-LD */ }
            {business && (
                <Helmet>
                    <title>{business.display_name} {businessInfo?.city ? `in ${businessInfo.city}` : ''} - {businessInfo?.businessType || 'Venue'} | DineBuddies</title>
                    <meta name="description" content={businessInfo?.description || businessInfo?.tagline || `Explore the details, reviews, and exclusive photos of ${business.display_name} on DineBuddies.`} />
                    <link rel="canonical" href={`https://www.dinebuddies.com/business/${profileId}`} />
                    <meta property="og:url" content={`https://www.dinebuddies.com/business/${profileId}`} />
                    <meta property="og:title" content={`${business.display_name} - DineBuddies`} />
                    <meta property="og:description" content={businessInfo?.description || businessInfo?.tagline || `Checkout ${business.display_name} on DineBuddies!`} />
                    <meta property="og:image" content={getSafeCoverImage(businessInfo?.coverImage) || getSafeAvatar(business)} />
                    <meta property="twitter:card" content="summary_large_image" />
                    {jsonLd && (
                        <script type="application/ld+json">
                            {JSON.stringify(jsonLd)}
                        </script>
                    )}
                </Helmet>
            )}

            {isOwner && business?.businessProfileSetupPending === true && (
                <div
                    className="ui-banner--warning"
                    style={{
                        margin: '12px 16px 0',
                        alignItems: 'flex-start',
                        gap: '12px',
                    }}
                >
                    <span style={{ fontSize: '1.35rem', flexShrink: 0 }}>📋</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="ui-banner--warning__title">
                            {t('business_profile_setup_banner_title', 'Finish your business profile')}
                        </p>
                        <p style={{ margin: '6px 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                            {t(
                                'business_profile_setup_banner_desc',
                                'Add your name, contact, address, and photos so customers can discover you.'
                            )}
                        </p>
                    </div>
                </div>
            )}

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
                    background: (getSafeCoverImage(businessInfo.coverImage) ? `url(${getSafeCoverImage(businessInfo.coverImage)})` : null) || 'linear-gradient(135deg, #1e1e2e, #2d2b42)',
                    backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                    borderBottomLeftRadius: '32px', borderBottomRightRadius: '32px',
                    boxShadow: '0 10px 40px color-mix(in srgb, var(--brand-primary) 30%, transparent)',
                    position: 'relative', overflow: 'hidden'
                }}>
                    {/* Overlay gradient */}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.72) 100%)', borderRadius: 'inherit' }} />

                    {/* Top bar: back + status badges + actions */}
                    <div style={{ position: 'absolute', top: '1.2rem', left: '1.2rem', right: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
                        {/* Left Side: Status Badges and Short Rank */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                            {(() => {
                                const today = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
                                const isOpen = businessInfo.workingHours?.[today]?.isOpen;
                                const badgePill = (color, dot, label) => (
                                    <span
                                        style={{
                                            padding: '5px 10px',
                                            borderRadius: '20px',
                                            fontSize: '0.72rem',
                                            fontWeight: '800',
                                            background: 'rgba(11, 10, 18, 0.92)',
                                            border: `1px solid rgba(${color}, 0.55)`,
                                            color: `rgb(${color})`,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
                                            backdropFilter: 'blur(12px)',
                                            WebkitBackdropFilter: 'blur(12px)',
                                            textShadow: '0 1px 2px rgba(0, 0, 0, 0.85)',
                                        }}
                                    >
                                        <span
                                            style={{
                                                width: 6,
                                                height: 6,
                                                borderRadius: '50%',
                                                background: `rgb(${dot})`,
                                                boxShadow: `0 0 6px rgb(${dot})`,
                                                display: 'inline-block',
                                                flexShrink: 0,
                                            }}
                                        />
                                        {label}
                                    </span>
                                );
                                return (
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        {business.isOnline && badgePill('16,185,129', '16,185,129', t('online'))}
                                        {badgePill(isOpen ? '74,222,128' : '248,113,113', isOpen ? '74,222,128' : '248,113,113', isOpen ? t('open', 'OPEN') : t('closed', 'CLOSED'))}
                                    </div>
                                );
                            })()}

                            {/* Ranking (among Elite) — Clickable Short Badge */}
                            {!rankLoading && rankingPosition != null && rankingPosition >= 1 && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); navigate('/rankings'); }} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,215,0,0.4)', borderRadius: '20px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', backdropFilter: 'blur(8px)', transition: 'transform 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                                    <FaCrown style={{ color: 'var(--luxury-gold)', fontSize: '0.9rem' }} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: '900', color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                                        #{rankingPosition}
                                    </span>
                                </button>
                            )}
                        </div>

                        {/* Right Side: Favourite + Share with counts BELOW */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                <button type="button" aria-label={userLikedBusiness ? t('unlike', 'Unlike') : t('like', 'Like')} disabled={likeInProgress} onClick={handleToggleLike} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.2)', color: userLikedBusiness ? '#ef4444' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: likeInProgress ? 'wait' : 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                                    {likeInProgress ? <span style={{ fontSize: '0.9rem' }}>⋯</span> : (userLikedBusiness ? <FaHeart fontSize="1rem" /> : <FaRegHeart fontSize="1rem" />)}
                                </button>
                                <span style={{ fontSize: '0.8rem', fontWeight: '900', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>
                                    {Math.max(0, Number(business?.businessInfo?.profileLikes ?? 0))}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                <button onClick={handleShare} disabled={isSharing} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                                    {isSharing ? '⏳' : <FaShare fontSize="1rem" />}
                                </button>
                                <span style={{ fontSize: '0.8rem', fontWeight: '900', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>
                                    {Math.max(0, Number(business?.businessInfo?.profileShares ?? 0))}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Bottom-left: Logo + Business name + Category */}
                    <div style={{ position: 'absolute', bottom: '1.2rem', left: '1.2rem', display: 'flex', alignItems: 'flex-end', gap: '14px', zIndex: 10 }}>
                        {/* Logo */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <div style={{
                                width: '90px', height: '90px', borderRadius: '22px',
                                ...(business.photo_url
                                    ? { backgroundColor: 'rgba(0,0,0,0.25)', backgroundImage: `url(${getSafeAvatar(business)})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
                                    : { background: 'var(--brand-primary)' }
                                ),
                                overflow: 'hidden',
                                border: `4px solid rgba(255,255,255,0.25)`,
                                boxShadow: '0 8px 24px color-mix(in srgb, var(--brand-primary) 40%, transparent)',
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
                                <div style={{ position: 'absolute', top: '-6px', left: '-6px', background: '#000000', border: `2px solid ${isElite ? '#f59e0b' : '#8b5cf6'}`, borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 8px ${isElite ? 'rgba(245,158,11,0.5)' : 'rgba(139,92,246,0.5)'}`, fontSize: '0.85rem' }} title={isElite ? t('elite_business', 'Elite Business') : t('professional_business', 'Professional Business')}>{isElite ? '👑' : '⚡'}</div>
                            )}
                        </div>

                        {/* Name + Category */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '4px' }}>
                            <h1 style={{ margin: 0, padding: 0, color: 'white', fontWeight: '900', fontSize: '1.15rem', textShadow: '0 2px 8px rgba(0,0,0,0.9)', letterSpacing: '0.3px', lineHeight: 1.2 }}>
                                {business.display_name || business.displayName || t('business')}
                            </h1>
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
                                    {businessInfo.businessType ? t(businessInfo.businessType, businessInfo.businessType) : ''}{businessInfo.cuisineType ? ` • ${t(businessInfo.cuisineType, businessInfo.cuisineType)}` : ''}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Cover Update button — owner only */}
                    {isOwner && (
                        <label style={{ position: 'absolute', bottom: '1.2rem', right: '1.2rem', zIndex: 10, cursor: 'pointer', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '12px', padding: '7px 14px', color: 'white', fontSize: '0.78rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {coverUploading ? `⏳ ${t('uploading', 'Uploading...')}` : `📷 ${t('edit_cover', 'Edit Cover')}`}
                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverUpload} disabled={coverUploading} />
                        </label>
                    )}
                </div>


                {/* Glass Stats Box - uses BrandKit when available */}
                <div className="profile-stats" style={{
                    background: 'color-mix(in srgb, var(--brand-primary) 15%, transparent)',
                    border: `1px solid var(--border-color)`,
                    borderRadius: '24px', padding: '18px 16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    backdropFilter: 'blur(12px)',
                    marginTop: 'var(--profile-stack-gap)'
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
                        <div className="profile-stat-label" style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginTop: '6px' }}>{t('members', 'Members')}</div>
                    </div>
                    <div className="profile-stats-divider" style={{ background: 'var(--border-color)', opacity: 0.5 }} />
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
                            <FaStar style={{ fontSize: '1.1rem', color: 'var(--luxury-gold)' }} /> {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}
                        </div>
                        <div className="profile-stat-label" style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginTop: '6px' }}>{reviews.length} {t('reviews', 'Reviews')}</div>
                    </div>
                    <div className="profile-stats-divider" style={{ background: 'var(--border-color)', opacity: 0.5 }} />
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
                            <FaEnvelope style={{ fontSize: '1.1rem', color: 'inherit' }} /> {activeInvitationsCount}
                        </div>
                        <div className="profile-stat-label" style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginTop: '6px' }}>{t('invites', 'Invites')}</div>
                    </div>
                </div>

                {businessInfo.tagline && (
                    <h2 style={{ fontSize: '1rem', margin: '0 0 var(--profile-stack-gap) 0', padding: 0, color: 'var(--text-secondary)', fontStyle: 'italic', fontWeight: '500', textAlign: 'center', maxWidth: '90%' }}>"{businessInfo.tagline}"</h2>
                )}

                {/* Actions Row */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--profile-actions-gap)', width: '100%', marginBottom: 'var(--profile-stack-gap)' }}>
                    {currentUser?.uid !== profileId && !userProfile?.isBusiness && (
                        <button onClick={() => { if (isGuest) { goToLogin(); return; } handleJoinCommunity(); }} disabled={joiningCommunity} style={{ width: '100%', padding: '14px 16px', borderRadius: '16px', background: isMember ? 'var(--hover-overlay)' : 'var(--brand-primary)', border: isMember ? `1px solid var(--border-color)` : 'none', color: isMember ? 'var(--text-main)' : 'var(--text-on-brand)', fontWeight: '900', fontSize: '1.05rem', cursor: joiningCommunity ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.3s', boxShadow: isMember ? 'none' : '0 8px 24px color-mix(in srgb, var(--brand-primary) 30%, transparent)', opacity: joiningCommunity ? 0.7 : 1 }}>
                            {joiningCommunity ? '...' : (
                                <>
                                    {/* Overlapping member avatars — always visible */}
                                    {memberCount > 0 && memberAvatars.length > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                {memberAvatars.slice(0, 5).map((url, i) => (
                                                    <img
                                                        key={i}
                                                        src={url}
                                                        alt=""
                                                        style={{
                                                            width: 26, height: 26, borderRadius: '50%',
                                                            objectFit: 'cover',
                                                            border: '2px solid rgba(255,255,255,0.4)',
                                                            marginInlineStart: i > 0 ? '-8px' : 0,
                                                            zIndex: 5 - i,
                                                            position: 'relative',
                                                            background: '#333',
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, marginInlineStart: '4px', opacity: 0.9 }}>
                                                {memberCount} {t('members')}
                                            </span>
                                        </div>
                                    )}
                                    {isMember ? `✓ ${t('community_member', 'Community Member')}` : `+ ${t('join_community', 'Join Community')}`}
                                </>
                            )}
                        </button>
                    )}
                    {currentUser?.uid !== profileId && !userProfile?.isBusiness && !currentUser?.isGuest && (
                        <button onClick={handleCreateInvitation} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--bg-primary)', border: `1px solid ${'var(--border-color)'}`, color: 'var(--text-primary)', fontWeight: '800', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                            <FaUserPlus style={{ fontSize: '1.2rem' }} /> {t('create_invitation', 'Create Invitation')}
                        </button>
                    )}
                </div>
            </div>

            {/* Delivery + tabs: unified vertical rhythm (same gap as profile sections) */}
            <div
                className="business-profile-nav-stack"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--profile-stack-gap)',
                    marginTop: 'var(--profile-stack-gap)',
                    marginBottom: 'var(--profile-stack-gap)',
                }}
            >
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

                {/* Tabs Navigation — scrollable on mobile */}
                {(() => {
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
                                position: 'sticky',
                                top: '10px',
                                zIndex: 50,
                                background: 'color-mix(in srgb, var(--bg-card) 90%, transparent)',
                                border: tc?.accent
                                    ? `1px solid color-mix(in srgb, ${tc.accent} 28%, var(--border-color))`
                                    : '1px solid var(--border-color)',
                                borderRadius: 'var(--profile-card-radius, 20px)',
                                boxShadow: tc?.btnShadow || '0 4px 20px rgba(0,0,0,0.08)',
                                overflow: 'hidden',
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
                                        color: locked ? 'var(--text-muted)' : undefined,
                                        opacity: locked ? 0.75 : 1,
                                        ...(activeTab === id && !locked && tc?.accent
                                            ? {
                                                  background: tc.footerBg,
                                                  color: tc.accentText || '#fff',
                                                  boxShadow: tc.btnShadow,
                                              }
                                            : {}),
                                    }}
                                >
                                    {label}
                                    {locked && <PlanBadge tier="pro" />}
                                </button>
                            ))}
                        </div>
                    );
                })()}
            </div>

            {/* Content Area */}
            <div className="profile-content" style={{ padding: 'var(--profile-content-padding)' }}>

                {/* About Tab */}
                {activeTab === 'about' && (
                    <div className="profile-section-content">

                        {/* About Card */}
                        <div className="ui-card ui-card--lg" style={{
                            background: 'var(--bg-card)', border: `1px solid var(--border-color)`,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                            position: 'relative', overflow: 'hidden'
                        }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--brand-primary)' }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                                <h3 className="profile-section-header" style={{ fontSize: '1.3rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '1.5rem' }}>📄</span> {t('about_us', 'About Us')}
                                </h3>
                                {isOwner && (
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem', fontWeight: '500' }}>{t('no_description_available', 'No description available')}</p>
                                    {isOwner && <p style={{ color: 'var(--text-muted)', margin: '8px 0 0', fontSize: '0.85rem', opacity: 0.9 }}>{t('click_edit_to_add', 'Click Edit to add one')}</p>}
                                </div>
                            )}
                        </div>



                        {/* Enhanced Gallery Section */}
                        <EnhancedGallery
                            profileId={profileId}
                            business={business}
                            isOwner={isOwner}
                            theme={{ colors: tc || {} }}
                        />



                        {/* Enhanced Reviews Section */}
                        <div style={{ marginTop: 'var(--profile-stack-gap)', marginBottom: '8px', background: 'var(--bg-card)', borderRadius: '16px', padding: '16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                            <div>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>{t('feedback_box', 'Feedback & Complaints')}</h3>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('feedback_desc', 'Have a complaint or suggestion? Contact the management directly and privately.')}</p>
                            </div>
                            <button onClick={() => setShowFeedbackModal(true)} style={{ background: 'var(--brand-primary)', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                {t('send_feedback_btn', 'Send Feedback')}
                            </button>
                        </div>
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

                        {/* Highlights Section */}
                        {!highlights.loading && (highlights.offers.length > 0 || highlights.posts.length > 0 || highlights.events.length > 0) && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--profile-stack-gap)', marginTop: 'var(--profile-stack-gap)' }}>
                                
                                {/* Offers */}
                                {highlights.offers.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: 'var(--text-main)' }}>{typeof t('offers', 'Offers') === 'string' ? t('offers', 'Offers') : 'Offers'}</h3>
                                        {highlights.offers.map(offer => (
                                            <div key={offer.id || Math.random().toString()} style={{ width: '100%' }}
                                            >
                                                <PremiumOfferCard offer={offer} isOwnerView={false} compactHeight={true} />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Posts (Square Thumbnails Grid) */}
                                {highlights.posts.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: 'var(--text-main)' }}>{typeof t('featured_posts', 'Featured Posts') === 'string' ? t('featured_posts', 'Featured Posts') : 'Featured Posts'}</h3>
                                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                            {highlights.posts.map(post => {
                                                let bgImage = post.imageUrl || post.mediaUrl || (post.mediaUrls && post.mediaUrls[0]) || post.backgroundUrl || '';
                                                let bgStyle = { background: 'var(--brand-primary)' };
                                                
                                                if (post.background) {
                                                    const { type, value, gradientStart, gradientEnd } = post.background;
                                                    if (type === 'image' && value) bgImage = value;
                                                    else if (type === 'gradient') bgStyle = { background: `linear-gradient(135deg, ${gradientStart || '#1e1e2e'}, ${gradientEnd || '#2d2b42'})` };
                                                    else if (type === 'color' && value) bgStyle = { background: value };
                                                    else if (value && type !== 'image') bgStyle = { background: value };
                                                }

                                                if (bgImage) {
                                                    bgStyle = { background: `url(${bgImage}) top center/cover no-repeat var(--bg-card)` };
                                                }

                                                const safeTitle = typeof post.title === 'string' ? post.title : (post.title?.text || 'Post');
                                                
                                                return (
                                                    <div key={post.id || Math.random().toString()} 
                                                        onClick={() => {
                                                            navigate(`/post/featured/${post.id}`);
                                                        }}
                                                        style={{ 
                                                            cursor: 'pointer',
                                                            flex: 1, 
                                                            aspectRatio: '1 / 1', 
                                                            borderRadius: '12px',
                                                            border: '1px solid var(--border-color)',
                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                                            position: 'relative',
                                                            overflow: 'hidden',
                                                            ...bgStyle
                                                        }}
                                                    >
                                                        {(!bgImage) && (
                                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem', fontWeight: '800', textAlign: 'center', padding: '8px' }}>
                                                                {safeTitle}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Events */}
                                {highlights.events.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: 'var(--text-main)' }}>{typeof t('events', 'Events') === 'string' ? t('events', 'Events') : 'Events'}</h3>
                                        {highlights.events.map(event => {
                                            const isEpoch = typeof event.startDate === 'number';
                                            const isDateString = typeof event.startDate === 'string';
                                            const isTimestamp = event.startDate?.toDate;
                                            
                                            let evtDate = new Date();
                                            if (isTimestamp) evtDate = event.startDate.toDate();
                                            else if (isEpoch || isDateString) evtDate = new Date(event.startDate);
                                            else if (event.createdAt?.toDate) evtDate = event.createdAt.toDate();
                                            
                                            const shortMonth = Number.isNaN(evtDate.getTime()) ? 'EVT' : evtDate.toLocaleString('default', { month: 'short' });
                                            const dayDate = Number.isNaN(evtDate.getTime()) ? '*' : evtDate.getDate();

                                            const safeEventTitle = typeof event.title === 'string' ? event.title : 'Upcoming Event';
                                            const safeEventDesc = typeof event.content === 'string' ? event.content : (typeof event.description === 'string' ? event.description : 'Join us for this special event!');

                                            return (
                                                <div key={event.id || Math.random().toString()}
                                                    onClick={() => {
                                                        navigate(`/post/${event.id}`);
                                                    }}
                                                    style={{ cursor: 'pointer', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '12px', display: 'flex', gap: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', width: '100%' }}
                                                >
                                                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'var(--brand-primary)', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <span style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{shortMonth}</span>
                                                        <span style={{ fontSize: '1.2rem', fontWeight: '900', lineHeight: '1' }}>{dayDate}</span>
                                                    </div>
                                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                                        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                                            {safeEventTitle}
                                                        </h4>
                                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                            {safeEventDesc}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--profile-stack-gap)' }}>

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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', border: `1px solid var(--border-color)`, borderRadius: '24px', padding: '16px 24px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)'}}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.2rem' }}>✨</span> {t('business_services', 'Business Services')}
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
                            <div className="ui-form-surface" style={{ background: 'var(--bg-card)' }}>
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
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <label className="ui-form-label" style={{ margin: 0 }}>Description (optional)</label>
                                        <span style={{ fontSize: '0.75rem', color: (serviceForm.description?.length || 0) >= 150 ? 'var(--secondary)' : 'var(--text-muted)' }}>
                                            {serviceForm.description?.length || 0}/150
                                        </span>
                                    </div>
                                    <textarea
                                        className="ui-form-field"
                                        value={serviceForm.description}
                                        onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))}
                                        maxLength={150}
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
                                        background: 'var(--bg-card)', border: `1px solid var(--border-color)`,
                                        borderRadius: '20px', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                                        gap: '12px', position: 'relative', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 8px 24px color-mix(in srgb, var(--brand-primary) 30%, transparent)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'; }}>
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
                            <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--bg-card)', borderRadius: '24px', border: `1px dashed var(--border-color)` }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🔧</div>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '1rem' }}>No services listed yet.</p>
                                {isOwner && (
                                    <button onClick={() => setShowServiceAddForm(true)} style={{ padding: '12px 24px', fontSize: '0.9rem', fontWeight: '800', background: 'var(--brand-primary)', border: 'none', borderRadius: '16px', color: 'white', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                                        ➕ Add Your First Service
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Hours Tab — same vertical rhythm as other tabs (no extra outer margin on component) */}
                {activeTab === 'hours' && (
                    <div className="profile-section-content">
                        <BusinessHours
                            businessId={profileId}
                            businessInfo={business.businessInfo}
                            isOwner={isOwner}
                            theme={{ colors: tc }}
                        />
                    </div>
                )}

                {/* Contact Tab */}
                {activeTab === 'contact' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--profile-stack-gap)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', border: `1px solid var(--border-color)`, borderRadius: '24px', padding: '16px 24px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)'}}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.2rem' }}>📞</span> {t('contact_information', 'Contact Information')}
                            </h3>
                            {isOwner && (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <PlanBadges />
                                    <EditActionBtn onClick={openContactModal} />
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--profile-stack-gap)' }}>
                            {businessInfo.phone && (
                                <div style={{ background: 'var(--bg-card)', border: `1px solid var(--border-color)`, borderRadius: '20px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'} onClick={() => window.location.href = `tel:${businessInfo.phone}`}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'color-mix(in srgb, var(--brand-primary) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)', fontSize: '1.5rem', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.1)' }}><FaPhone /></div>
                                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('phone', 'Phone')}</div><div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{businessInfo.phone}</div></div>
                                </div>
                            )}

                            {businessInfo.email && (
                                <div style={{ background: 'var(--bg-card)', border: `1px solid var(--border-color)`, borderRadius: '20px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'} onClick={() => window.location.href = `mailto:${businessInfo.email}`}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'color-mix(in srgb, var(--brand-primary) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)', fontSize: '1.5rem', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.1)' }}><FaEnvelope /></div>
                                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('email', 'Email')}</div><div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{businessInfo.email}</div></div>
                                </div>
                            )}

                            {/* Website — Pro only */}
                            {isPaid && businessInfo.website && (
                                <div onClick={() => window.open(businessInfo.website.startsWith('http') ? businessInfo.website : `https://${businessInfo.website}`, '_blank')} style={{ background: 'var(--bg-card)', border: `1px solid var(--border-color)`, borderRadius: '20px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', transition: 'all 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'color-mix(in srgb, var(--brand-primary) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)', fontSize: '1.5rem', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.1)' }}><FaGlobe /></div>
                                    <div style={{ flex: 1 }}><div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('btn_website', 'Website')}</div><div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '1.1rem', wordBreak: 'break-all' }}>{businessInfo.website.replace(/^(https?:\/\/|\/\/)/, '')}</div></div>
                                    <FaExternalLinkAlt style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }} />
                                </div>
                            )}
                        </div>

                        {businessInfo.address && (
                            <div style={{ background: 'var(--bg-card)', border: `1px solid var(--border-color)`, borderRadius: '24px', padding: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)'}}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'color-mix(in srgb, var(--brand-primary) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)', fontSize: '1.5rem', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.1)' }}><FaMapMarkerAlt /></div>
                                    <div><div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('address', 'Address')}</div><div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '1.1rem' }}>{businessInfo.address} {businessInfo.city && `, ${businessInfo.city}`}</div></div>
                                </div>

                                <div style={{ position: 'relative' }}>
                                    <BusinessLocationMap
                                        lat={businessInfo.lat ?? profileMapCoords?.lat}
                                        lng={businessInfo.lng ?? profileMapCoords?.lng}
                                        businessName={businessInfo.name || businessInfo.businessName}
                                        address={businessInfo.address}
                                        city={businessInfo.city}
                                        country={businessInfo.country}
                                    />
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
                                    <button onClick={() => { const addr = encodeURIComponent(businessInfo.address + (businessInfo.city ? ', ' + businessInfo.city : '') + (businessInfo.country ? ', ' + businessInfo.country : '')); window.open(`https://www.google.com/maps/search/?api=1&query=${addr}`, '_blank'); }} style={{ width: '100%', padding: '16px', background: 'var(--brand-primary)', border: 'none', borderRadius: '16px', color: 'white', fontWeight: '800', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '20px', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px color-mix(in srgb, var(--brand-primary) 30%, transparent)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                                        <FaMapMarkerAlt style={{ fontSize: '1.2rem' }} />
                                        Open in Google Maps
                                        <FaExternalLinkAlt style={{ fontSize: '0.9rem' }} />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Social Media — Pro only */}
                        {isPaid && (businessInfo.instagram || businessInfo.twitter || businessInfo.facebook) && (
                            <div style={{ background: 'var(--bg-card)', border: `1px solid var(--border-color)`, borderRadius: '24px', padding: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)'}}>
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
                            background: 'var(--bg-card)',
                            border: `1px solid var(--border-color)`,
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
                            }}>{t('write_review', 'Write a Review')}</h2>

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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <label style={{ display: 'block', fontWeight: '700', margin: 0 }}>
                                        Comment
                                    </label>
                                    <span style={{ fontSize: '0.75rem', color: (newReview.comment?.length || 0) >= 300 ? 'var(--secondary)' : 'var(--text-muted)' }}>
                                        {newReview.comment?.length || 0}/300
                                    </span>
                                </div>
                                <textarea
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
                                >{t('cancel', 'Cancel')}</button>

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
                                    image: getShareableCoverImage(business.businessInfo?.coverImage) || getSafeAvatar(business),
                                    description: business.businessInfo?.description,
                                    location: business.businessInfo?.address,
                                    hostName: business.display_name,
                                    hostImage: getSafeAvatar(business),
                                    shareUrl: window.location.href
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
            {/* Modals */}
            <FeedbackSubmissionModal 
                isOpen={showFeedbackModal} 
                onClose={() => setShowFeedbackModal(false)} 
                businessId={profileId} 
            />
            {showServiceModal && (
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
                            {/* Cuisine Type — restaurants only */}
                            {basicInfoForm.businessType === 'Restaurant' && (
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-main)' }}>🍽️ Cuisine Type</label>
                                    <select
                                        value={basicInfoForm.cuisineType || ''}
                                        onChange={e => setBasicInfoForm(p => ({ ...p, cuisineType: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '10px', color: basicInfoForm.cuisineType ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '0.9rem', appearance: 'none' }}
                                    >
                                        <option value="">Select Cuisine Type...</option>
                                        {['Italian','Asian','Chinese','Japanese','Indian','Lebanese','Mexican','Greek','Thai','Vietnamese','Korean','Turkish','French','Spanish','American','Australian','Middle Eastern','Mediterranean','Seafood','Steakhouse','Vegetarian','Vegan','Other'].map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div style={{ marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <label style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-main)', margin: 0 }}>Description</label>
                                    <span style={{ fontSize: '0.75rem', color: (basicInfoForm.description?.length || 0) >= 300 ? 'var(--secondary)' : 'var(--text-muted)' }}>
                                        {basicInfoForm.description?.length || 0}/300
                                    </span>
                                </div>
                                <textarea rows={4} value={basicInfoForm.description} onChange={e => setBasicInfoForm(p => ({ ...p, description: e.target.value }))}
                                    maxLength={300}
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
                    <div className="brand-kit-overlay">
                        <BrandKit inAppColumn onBack={() => setShowBrandKitModal(false)} />
                    </div>
                )
            }



        </div >


    );
};

export default BusinessProfile;
