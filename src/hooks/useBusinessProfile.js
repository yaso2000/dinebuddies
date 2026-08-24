import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, onSnapshot, addDoc, serverTimestamp, updateDoc, DocumentReference } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { subscribeBusinessLiked, toggleBusinessLike, incrementBusinessShareCount } from '../services/businessLikeService';
import { useInvitations } from '../context/InvitationContext';
import { uploadImage } from '../utils/imageUpload';
import { ImageUploadZone } from '../services/imageUploadZones';
import { notifyImageUploadError } from '../utils/imageModerationErrors';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { updateSocialMetaTags, generateBusinessMetaTags, resetSocialMetaTags } from '../utils/socialMetaTags';
import { useTranslation } from 'react-i18next';
import { getSafeAvatar, getShareableCoverImage, pickSafeDisplayImageUrl } from '../utils/avatarUtils';
import {
  DEFAULT_BUSINESS_COVER,
  mergeBusinessInfoDrafts,
  resolveBusinessCoverImageUrl } from
'../utils/businessCoverImage';
import { geocodeAddress } from '../utils/locationUtils';
import { getUserDocLatLng } from '../utils/userDocCoords';
import {
  normalizeDeliveryLinks,
  deliveryLinksReadyToSave } from
'../utils/deliveryLinkMeta';
import { buildHostInvitationNavigationState } from '../utils/hostInvitationFromBusiness';
import { generateShareCardBlob } from '../utils/shareCardCanvas';
import { shareNativeOrFallback } from '../utils/shareNativeOrFallback';
import { isBusinessUser } from '../utils/accountRole';
import { getBusinessSubscriptionAccess } from '../utils/businessSubscription';
import { normalizeUserProfile } from '../utils/userProfileNormalize';
import {
  getTheme,
  getBusinessProfileUiColors,
  resolveBusinessProfileThemeId } from
'../utils/businessThemes';
import { useToast } from '../context/ToastContext';
import { useBusinessRank } from './useBusinessRank';
import { goToLogin } from '../utils/goToLogin';
import {
  isJoinedToBusinessCommunity,
  resolveBusinessCommunityId,
  resolveBusinessLiveStage,
} from '../utils/businessCommunityJoin';
import {
  normalizeRestaurantToBusinessProfile,
  isBusinessProfileOwner,
  businessShowsClaimCta,
  isVirtualGoogleImportProfile } from
'../utils/normalizeRestaurantBusinessProfile';
import { googlePlaceTypesToCategoryBadges } from '../utils/googlePlacesBusiness';
import { useConfirm } from '../context/ConfirmContext';

export const BUSINESS_TYPES = [
'Restaurant', 'Cafe', 'Bar', 'Night Club', 'Food Truck', 'Fast Food'];


/** When Firestore denies users/{id} (guest / unauthenticated listener), load read-only projection (rules: public_profiles get allowed for all). */
async function loadBusinessFromPublicProfileProjection(profileId) {
  try {
    const snap = await getDoc(doc(db, 'public_profiles', profileId));
    if (!snap.exists()) return null;
    const p = snap.data();
    if (p.profileType !== 'business' || !p.businessPublic) return null;
    const bp = p.businessPublic;
    const lat = typeof bp.lat === 'number' ? bp.lat : null;
    const lng = typeof bp.lng === 'number' ? bp.lng : null;
    const coordinates =
    lat != null && lng != null ? { lat, lng } : { lat: null, lng: null };

    return {
      uid: profileId,
      display_name: p.displayName || 'Business',
      name: p.displayName || 'Business',
      photo_url: p.avatarUrl || null,
      phone: bp.phone || '',
      website: bp.website || '',
      address: bp.address || '',
      coordinates,
      openingHours: bp.openingHours || null,
      openNow: typeof bp.openNow === 'boolean' ? bp.openNow : null,
      role: 'business',
      accountType: 'business',
      isVirtual: p.isVirtual === true,
      isClaimed: p.isClaimed === true,
      emailVerified: true,
      _fromPublicProfileProjection: true,
      createdBy: p.createdBy || 'admin',
      _sourceCollection: p.sourceCollection || 'restaurants',
      liveStageId: bp.liveStageId || null,
      liveStageExpiresAt: bp.liveStageExpiresAt || null,
      coverImageStoragePath: bp.coverImageStoragePath || p.coverImageStoragePath || null,
      businessInfo: {
        businessName: p.displayName || 'Business',
        businessType: bp.businessType || 'Restaurant',
        city: bp.city || '',
        country: bp.country || '',
        address: bp.address || '',
        phone: bp.phone || '',
        website: bp.website || '',
        categories: Array.isArray(bp.categories) ? bp.categories : [],
        description: bp.description || '',
        coverImage: bp.coverImage || p.avatarUrl || '',
        coverImageStoragePath: bp.coverImageStoragePath || p.coverImageStoragePath || null,
        lat,
        lng,
        hours: bp.hours || null,
        openingHours: bp.openingHours || null,
        brandKit: bp.brandKit || null,
        theme: bp.theme || '',
        isPublished: bp.isPublished === true,
        profileLikes: Number(p.profileLikes ?? 0),
        profileShares: Number(p.profileShares ?? 0)
      },
      communityMembers: [],
      averageRating: typeof p.averageRating === 'number' ? p.averageRating : undefined,
      reviewCount: typeof p.reviewCount === 'number' ? p.reviewCount : undefined
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

/** Map DineBuddies business types to official Schema.org types. */
function getSchemaType(type) {
  switch (type) {
    case 'Cafe':return 'CafeOrCoffeeShop';
    case 'Bar':return 'BarOrPub';
    case 'Night Club':return 'NightClub';
    case 'Food Truck':return 'FoodEstablishment';
    case 'Fast Food':return 'FastFoodRestaurant';
    case 'Restaurant':return 'Restaurant';
    default:return 'LocalBusiness';
  }
}

// Owns all state/effects/handlers for the business profile page (route /business/:businessId,
// legacy /partner/:id redirects to /business/); mirrors useStageChatRoom's shape — a thin
// orchestrator page + presentational children consume the single returned object.
export function useBusinessProfile(profileId) {
  const navigate = useNavigate();
  const location = useLocation();
  const profileSetupToastRef = useRef(false);
  const businessSignupVerifyToastRef = useRef(false);
  const { currentUser, userProfile, isGuest, loading: authLoading } = useAuth();
  const { setBrandColor } = useTheme();
  const { joinCommunity, currentUser: inviteCurrentUser } = useInvitations();
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { showToast } = useToast();

  // Ref to prevent snapshot from overwriting optimistic join/leave state
  const joiningRef = useRef(false);
  /** Last applied users/{profileId} payload signature — avoids setState when Firestore re-delivers the same doc. */
  const lastBizSnapshotSigRef = useRef('');

  const [business, setBusiness] = useState(null);
  const tierAccess = useMemo(
    () => getBusinessSubscriptionAccess(business?.subscriptionTier),
    [business?.subscriptionTier]
  );
  const isPaid = tierAccess.isPaid;
  const [loading, setLoading] = useState(true);
  /** Visitors only: hidden until business email is verified on the account. Owner always sees/edits — not gated by email. */
  const [publicProfileHidden, setPublicProfileHidden] = useState(false);
  /** Latest users/{profileId} payload when we defer visibility until auth finishes restoring */
  const pendingBizDocRef = useRef(null);
  const authLoadingRef = useRef(authLoading);
  const isGuestRef = useRef(isGuest);
  const currentUserRef = useRef(currentUser);
  useEffect(() => {authLoadingRef.current = authLoading;}, [authLoading]);
  useEffect(() => {isGuestRef.current = isGuest;}, [isGuest]);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser?.uid, currentUser?.email, currentUser?.displayName, currentUser?.photoURL]);
  const [activeTab, setActiveTab] = useState('about');
  const [menuTabListingType, setMenuTabListingType] = useState('menu');

  const [activeInvitationsCount, setActiveInvitationsCount] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(0);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);

  // Gallery states
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
  const joinedCommunities = inviteCurrentUser?.joinedCommunities || [];
  const profileCommunityId = resolveBusinessCommunityId(joinedCommunities, {
    ownerId: business?.ownerId || profileId,
    businessId: profileId,
    isVirtual: isVirtualGoogleImportProfile(business),
  });
  // Favorite ⟺ community member: a favorited business counts as joined even if
  // the joinedCommunities array hasn't caught up (or was favorited long ago).
  const favoritePlaces = inviteCurrentUser?.favoritePlaces || userProfile?.favoritePlaces || [];
  const isFavoritePlaceMember =
    Array.isArray(favoritePlaces) &&
    favoritePlaces.some((p) => {
      const id = p?.businessId || p?.id;
      return id && (id === profileCommunityId || id === profileId);
    });
  const effectiveIsMember =
    isJoinedToBusinessCommunity(joinedCommunities, profileCommunityId) || isMember || isFavoritePlaceMember;

  // The business advertises its currently-open Stage on its profile; a member's
  // button enters that Stage and is disabled when none is open.
  const { liveStageId: businessLiveStageId, stageOpen: businessStageOpen } =
    resolveBusinessLiveStage(business);

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


  const [showColorRail, setShowColorRail] = useState(false);

  const [coverUploading, setCoverUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  /** Pending crop for the logo/cover picker: { src, kind: 'logo' | 'cover' }. */
  const [imageCropRequest, setImageCropRequest] = useState(null);
  const cropObjectUrlRef = useRef(null);


  const applySnapshotBusinessData = useCallback((data, docSnap) => {
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
      const activeInvitations = snapshot.docs.filter((doc) => {
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
      [...snapPartner.docs, ...snapProfile.docs, ...snapRestaurant.docs].forEach((doc) => byId.set(doc.id, { id: doc.id, ...doc.data() }));
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
    const isOwnerView = isBusinessProfileOwner(sessionUid, profileId, data);
    const emailVerifiedPublic =
    data.emailVerified === true ||
    data._sourceCollection === 'restaurants' && data.isClaimed !== true;
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

  const applyBusinessSnapshotGate = useCallback(
    (data, docSnap) => {
      if (!data || !isBusinessUser(data)) return false;

      const sessionUid = auth.currentUser?.uid ?? currentUserRef.current?.uid ?? null;
      const isOwnerView = isBusinessProfileOwner(sessionUid, profileId, data);
      const emailVerifiedPublic =
      data.emailVerified === true ||
      data._sourceCollection === 'restaurants' && data.isClaimed !== true;

      if (isOwnerView) {
        pendingBizDocRef.current = null;
        applySnapshotBusinessData(data, docSnap);
        return true;
      }

      if (authLoadingRef.current) {
        pendingBizDocRef.current = { data, docSnap };
        setLoading(true);
        return true;
      }

      if (!emailVerifiedPublic) {
        pendingBizDocRef.current = null;
        setBusiness(null);
        setLoading(false);
        setPublicProfileHidden(true);
        return true;
      }

      setPublicProfileHidden(false);
      pendingBizDocRef.current = null;
      applySnapshotBusinessData(data, docSnap);
      return true;
    },
    [profileId, applySnapshotBusinessData]
  );

  /** Firestore: `restaurants/{id}` (admin imports) then `users/{id}` (registered businesses). */
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
    let unsubUsers = null;
    let usersListenerStarted = false;

    const startUsersListener = () => {
      if (usersListenerStarted) return;
      usersListenerStarted = true;
      const userRef = doc(db, 'users', profileId);
      unsubUsers = onSnapshot(
        userRef,
        (docSnap) => {
          const raw = docSnap.exists() ? docSnap.data() : null;
          const profileForGate = raw ?
          normalizeUserProfile({ id: docSnap.id, uid: docSnap.id, ...raw }) :
          null;
          if (docSnap.exists() && profileForGate && isBusinessUser(profileForGate)) {
            applyBusinessSnapshotGate(profileForGate, docSnap);
            return;
          }
          void (async () => {
            const fb = await loadBusinessFromPublicProfileProjection(profileId);
            if (fb) {
              setBusiness(fb);
              setPublicProfileHidden(false);
            } else {
              setBusiness(null);
              setPublicProfileHidden(false);
            }
            setLoading(false);
          })();
        },
        async (error) => {
          const fb = await loadBusinessFromPublicProfileProjection(profileId);
          if (fb) {
            setBusiness(fb);
            setPublicProfileHidden(false);
            setLoading(false);
            return;
          }
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
          }
          if (!resolved) {
            console.error('Business profile listener error:', error);
            setBusiness(null);
            setPublicProfileHidden(false);
            setLoading(false);
          }
        }
      );
    };

    const restaurantRef = doc(db, 'restaurants', profileId);
    const unsubRestaurant = onSnapshot(
      restaurantRef,
      (docSnap) => {
        if (docSnap.exists()) {
          if (unsubUsers) {
            unsubUsers();
            unsubUsers = null;
            usersListenerStarted = false;
          }
          const data = normalizeRestaurantToBusinessProfile(docSnap.id, docSnap.data());
          if (data && isBusinessUser(data)) {
            applyBusinessSnapshotGate(data, docSnap);
            return;
          }
        }
        startUsersListener();
      },
      () => startUsersListener()
    );

    return () => {
      unsubRestaurant();
      if (unsubUsers) unsubUsers();
    };
  }, [profileId, applySnapshotBusinessData, applyBusinessSnapshotGate, currentUser?.uid, authLoading]);

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
        activeOffers = offersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        // If no premium active offers, try standard special_offers
        if (activeOffers.length === 0) {
          const legacyQuery = query(collection(db, 'special_offers'), where('restaurantId', '==', profileId), where('status', 'in', ['active', 'published']), limit(1));
          const legacySnap = await getDocs(legacyQuery);
          activeOffers = legacySnap.docs.map((doc) => {
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
        activePosts = postsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
        fetchReviews()]
        );
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
  const menuListingTypeKey = business?.businessInfo?.menuListingType === 'services' ? 'services' : 'menu';
  useEffect(() => {
    setMenuTabListingType(menuListingTypeKey);
  }, [menuListingTypeKey]);
  // Load services when partner data changes
  useEffect(() => {
    if (business?.businessInfo?.services) {
      setServices(business.businessInfo.services);
    }
  }, [servicesKey]);

  // Keep activeTab valid when visible tabs change (visitor: some tabs hidden when empty)
  const isOwnerProfile = isBusinessProfileOwner(currentUser?.uid, profileId, business);
  useEffect(() => {
    const info = business?.businessInfo;
    if (!info) return;
    const hasContactInfo = !!(info.phone || info.email || info.address || info.website);
    const visibleIds = ['about'];
    if (isOwnerProfile || info.menu?.length > 0) visibleIds.push('menu');
    // Services tab hidden until feature is re-enabled
    if (isOwnerProfile || info.hours) visibleIds.push('hours');
    if (isOwnerProfile || hasContactInfo) visibleIds.push('contact');
    // Functional update: do not list activeTab in deps — that pattern re-ran the effect on every tab change.
    setActiveTab((tab) => !visibleIds.includes(tab) ? visibleIds[0] || 'about' : tab);
  }, [isOwnerProfile, business?.businessInfo?.menu?.length, business?.businessInfo?.hours, business?.businessInfo?.phone, business?.businessInfo?.email, business?.businessInfo?.address, business?.businessInfo?.website]);

  useEffect(() => {
    const memberIds = business?.communityMembers || [];
    if (memberIds.length === 0) {setMemberAvatars([]);return;}
    const last5 = memberIds.slice(-5).reverse(); // last 5, newest first
    Promise.all(
      last5.map((uid) =>
      getDoc(doc(db, 'users', uid)).
      then((snap) => snap.exists() ? getSafeAvatar(snap.data()) : null).
      catch(() => null)
      )
    ).then((photos) => setMemberAvatars(photos.filter(Boolean)));
  }, [business?.communityMembers?.length]);

  const viewTracked = useRef(false);
  useEffect(() => {
    const trackProfileView = async () => {
      if (viewTracked.current || currentUser?.uid === profileId || !business) return;

      const viewKey = `profile_view_${profileId}`;
      const lastView = localStorage.getItem(viewKey);
      const now = Date.now();

      if (lastView && now - parseInt(lastView) < 24 * 60 * 60 * 1000) return;

      try {
        const collectionName =
        business._sourceCollection === 'restaurants' ? 'restaurants' : 'users';
        const businessRef = doc(db, collectionName, profileId);
        const currentViews = business?.businessInfo?.profileViews || 0;
        await updateDoc(businessRef, { 'businessInfo.profileViews': currentViews + 1 });
        localStorage.setItem(viewKey, now.toString());
        viewTracked.current = true;
      } catch (error) {
        // Projection-only / permission-denied — non-fatal for profile display
        if (import.meta.env?.DEV) {
          console.warn('Profile view tracking skipped:', error);
        }
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
  business?.name]
  );

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
    const existingReview = reviews.find((r) => r.userId === currentUser.uid);
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
      getDocs(query(reviewsRef, where('profileId', '==', profileId), where('userId', '==', currentUser.uid)))]
      );
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
      await new Promise((resolve) => setTimeout(resolve, 500));

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

  const handleJoinCommunity = () => {
    if (userProfile?.isBusiness) {
      showToast(t('business_cannot_join_community'), 'error');
      return;
    }
    if (joiningCommunity) return;

    const authUser = currentUser || inviteCurrentUser;
    const uid = authUser?.uid || authUser?.id;
    if (!uid || authUser?.isGuest) {
      goToLogin({ returnPath: location.pathname });
      return;
    }

    const cid = profileCommunityId || profileId;
    if (!cid) return;

    // Membership is permanent (a form of following). A member's tap enters the
    // Stage when one is open; when none is open the member stays a member and
    // just gets told there is nothing to enter yet — the button is never dead.
    if (effectiveIsMember) {
      if (businessStageOpen && businessLiveStageId) {
        navigate(`/stage/${businessLiveStageId}`);
      } else {
        showToast(
          t('business_member_no_stage', 'You are a member. The Stage will open here when the business starts one.'),
          'info'
        );
      }
      return;
    }

    joiningRef.current = true;
    setJoiningCommunity(true);
    void joinCommunity(cid, {
      name: business?.display_name || '',
      image: getSafeAvatar(business),
      address: business?.businessInfo?.address || '',
      city: business?.businessInfo?.city || '',
    })
      .catch((error) => {
        console.error('Error joining community:', error);
      })
      .finally(() => {
        setJoiningCommunity(false);
        setTimeout(() => { joiningRef.current = false; }, 800);
      });
  };



  const handleCreateInvitation = () => {
    if (!currentUser) {
      goToLogin();
      return;
    }

    const businessInfoForInvite = business.businessInfo || {};
    const state = buildHostInvitationNavigationState({
      id: profileId,
      name: business.display_name,
      image: businessInfoForInvite.coverImage,
      address: businessInfoForInvite.address,
      city: businessInfoForInvite.city,
      lat: businessInfoForInvite.lat,
      lng: businessInfoForInvite.lng,
      countryCode: businessInfoForInvite.countryCode,
      type: businessInfoForInvite.businessType || 'Restaurant',
    });
    if (!state) return;
    setSelectorState(state);
    setIsSelectorOpen(true);
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
    const wasLiked = userLikedBusiness;
    const prevCount = Math.max(0, Number(business?.businessInfo?.profileLikes ?? 0));

    setLikeInProgress(true);
    setUserLikedBusiness(!wasLiked);
    setBusiness((prev) => {
      if (!prev) return prev;
      const nextCount = Math.max(0, prevCount + (wasLiked ? -1 : 1));
      return {
        ...prev,
        businessInfo: { ...(prev.businessInfo || {}), profileLikes: nextCount }
      };
    });

    try {
      const businessInfoForFavorite = !wasLiked && business ? {
        businessId: profileId,
        name: business.display_name || '',
        image: getSafeAvatar(business),
        address: business.businessInfo?.address || '',
        city: business.businessInfo?.city || ''
      } : undefined;
      void toggleBusinessLike(businessId, userId, wasLiked, businessInfoForFavorite).catch((err) => {
        setUserLikedBusiness(wasLiked);
        setBusiness((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            businessInfo: { ...(prev.businessInfo || {}), profileLikes: prevCount }
          };
        });
        console.warn('[like] profile toggle failed', { businessId, userId, err });
        showToast(t('like_failed', 'Could not update like. Try again.'), 'error');
      });
    } finally {
      setLikeInProgress(false);
    }
  };

  const handleShare = async () => {
    if (!business) return;
    const shareTitle = business.display_name || 'DineBuddies Business';
    const shareUrl = window.location.href;
    const coverForShare = getShareableCoverImage(business.businessInfo?.coverImage) ||
    getSafeAvatar(business);
    const storyData = {
      title: shareTitle,
      image: coverForShare,
      description: business.businessInfo?.description,
      location: business.businessInfo?.address || business.businessInfo?.city,
      hostName: shareTitle,
      hostImage: getSafeAvatar(business),
      shareUrl,
      averageRating,
      reviewCount: reviews.length
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
      skipExternalFallback: false
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
  const handleAddService = async (serviceData) => {
    if (editingService === null) return;
    const previous = services;
    const updated = services.map((s, i) => i === editingService ? serviceData : s);
    setServices(updated);
    setShowServiceModal(false);
    setEditingService(null);
    try {
      await updateDoc(doc(db, 'users', profileId), { 'businessInfo.services': updated });
    } catch (err) {
      // Put the old list back — leaving the edit on screen would tell the owner
      // it saved when it did not.
      console.error('Error saving service:', err);
      setServices(previous);
      showToast(t('save_failed', 'Could not save. Please try again.'), 'error');
    }
  };

  // handleAddServiceLocal: for inline add form — adds to pending, keeps form open
  const handleAddServiceLocal = () => {
    if (!serviceForm.name.trim()) return;
    setPendingServices((prev) => [...prev, {
      ...serviceForm,
      id: Date.now().toString()
    }]);
    setServiceForm({ name: '', description: '', icon: '⚙️' });
    setServiceIconSearch('');
  };

  const handleSaveAllServices = async () => {
    if (pendingServices.length === 0) return;
    setSavingServices(true);
    const updated = [...services, ...pendingServices];
    try {
      await updateDoc(doc(db, 'users', profileId), { 'businessInfo.services': updated });
      // Only adopt the new list once the write lands — showing it first made a
      // failed save look successful until the next reload.
      setServices(updated);
      setPendingServices([]);
      setShowServiceAddForm(false);
      setServiceForm({ name: '', description: '', icon: '⚙️' });
      if (!isPaid) {
        setShowServiceDraftBanner(true);
        setTimeout(() => setShowServiceDraftBanner(false), 30000);
      }
    } catch (err) {
      console.error('Error saving services:', err);
      showToast(t('save_failed', 'Could not save. Please try again.'), 'error');
    } finally {
      setSavingServices(false);
    }
  };

  const handleDiscardServices = () => {
    setPendingServices([]);
    setShowServiceAddForm(false);
    setServiceForm({ name: '', description: '', icon: '⚙️' });
    setServiceIconSearch('');
  };

  const handleDeleteService = async (index) => {
    if (!(await confirm({ message: t('delete_service_confirm'), tone: 'danger' }))) return;
    const previous = services;
    const updated = services.filter((_, i) => i !== index);
    setServices(updated);
    try {
      await updateDoc(doc(db, 'users', profileId), { 'businessInfo.services': updated });
    } catch (err) {
      // The row was already gone from the list; put it back rather than let it
      // silently reappear on the next load.
      console.error('Error deleting service:', err);
      setServices(previous);
      showToast(t('save_failed', 'Could not save. Please try again.'), 'error');
    }
  };

  /* Logo and cover both go through the same crop step the personal profile
     uses, so the owner frames their brand rather than leaving it to object-fit.
     Note uploadImage ignores its `path` argument once a moderationZone and
     userId are given — the managed uploader picks the storage path. */
  const clearImageCropRequest = useCallback(() => {
    if (cropObjectUrlRef.current) {
      URL.revokeObjectURL(cropObjectUrlRef.current);
      cropObjectUrlRef.current = null;
    }
    setImageCropRequest(null);
  }, []);

  const openImageCrop = (e, kind) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    clearImageCropRequest();
    const src = URL.createObjectURL(file);
    cropObjectUrlRef.current = src;
    setImageCropRequest({ src, kind });
  };

  const handleCoverUpload = (e) => openImageCrop(e, 'cover');
  const handleLogoUpload = (e) => openImageCrop(e, 'logo');

  const handleCroppedImageSave = async (croppedFile) => {
    const kind = imageCropRequest?.kind;
    clearImageCropRequest();
    if (!kind) return;

    const isLogo = kind === 'logo';
    const setBusy = isLogo ? setLogoUploading : setCoverUploading;
    try {
      setBusy(true);
      const url = await uploadImage(
        croppedFile,
        null,
        null,
        isLogo ? { maxSizeMB: 0.5, maxWidthOrHeight: 400 } : { maxSizeMB: 1, maxWidthOrHeight: 1600 },
        {
          moderationZone: isLogo ? ImageUploadZone.LOGO : ImageUploadZone.COVER,
          userId: profileId,
        }
      );
      await updateDoc(
        doc(db, 'users', profileId),
        isLogo ? { photo_url: url } : { 'businessInfo.coverImage': url }
      );
    } catch (err) {
      notifyImageUploadError(showToast, err, t, isLogo ? 'logo_upload_failed' : 'cover_upload_failed');
    } finally {
      setBusy(false);
    }
  };

  const removeBusinessImage = async (kind) => {
    const isLogo = kind === 'logo';
    const setBusy = isLogo ? setLogoUploading : setCoverUploading;
    try {
      setBusy(true);
      await updateDoc(
        doc(db, 'users', profileId),
        isLogo ? { photo_url: '' } : { 'businessInfo.coverImage': '' }
      );
    } catch (err) {
      console.error('Business image remove failed:', err);
      showToast(t('save_failed', 'Could not save. Please try again.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveLogo = () => removeBusinessImage('logo');
  const handleRemoveCover = () => removeBusinessImage('cover');

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
        'businessInfo.description': basicInfoForm.description
      };
      if (business?.businessProfileSetupPending) {
        payload.businessProfileSetupPending = false;
      }
      await updateDoc(doc(db, 'users', profileId), payload);
      setShowBasicInfoModal(false);
    } catch (err) {showToast(t('save_failed'), 'error');} finally {setSavingInfo(false);}
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
      tiktok: businessInfo.tiktok || ''
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
        'businessInfo.tiktok': contactForm.tiktok
      };
      if (business?.businessProfileSetupPending) {
        payload.businessProfileSetupPending = false;
      }
      const addressLine = [contactForm.address, contactForm.city, businessInfo.country].
      filter(Boolean).
      join(', ').
      trim();
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
        { key: 'tiktok', label: '🎵 TikTok' }];

        const filled = proFieldLabels.filter((f) => contactForm[f.key]?.trim());
        if (filled.length > 0) setProFieldsNotice(filled.map((f) => f.label));
      }
    } catch (err) {showToast(t('save_failed'), 'error');} finally {setSavingInfo(false);}
  };

  const isOwner = isBusinessProfileOwner(currentUser?.uid, profileId, business);
  const showClaimCta = businessShowsClaimCta(business) && !isOwner;

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

  const rawBusinessInfo = business?.businessInfo || {};

  // Merge drafts dynamically if viewing as owner
  const businessInfo = isOwner && rawBusinessInfo.drafts ?
  mergeBusinessInfoDrafts(rawBusinessInfo, rawBusinessInfo.drafts) :
  rawBusinessInfo;

  const profileMapCoords = business ? getUserDocLatLng(business) : null;
  const profileCoverUrl = business ? (
  resolveBusinessCoverImageUrl(business, { preferProxy: true }) ||
  pickSafeDisplayImageUrl(
    businessInfo.coverImage,
    business.photo_url,
    business.avatarUrl
  ) ||
  null) : null;
  const heroCoverSrc = profileCoverUrl || DEFAULT_BUSINESS_COVER;
  const profileLogoUrl = business ? getSafeAvatar(business) : null;
  const isVirtualGoogleImport = business ? isVirtualGoogleImportProfile(business) : false;
  const categoryBadges = googlePlaceTypesToCategoryBadges(businessInfo.categories);
  const hasMapCoords =
  profileMapCoords?.lat != null && profileMapCoords?.lng != null ||
  businessInfo.lat != null && businessInfo.lng != null;
  /** Paid plan: Maps + delivery only. Website/social stay display-only (anti-spam). */
  const canOpenBusinessMapsAndDelivery = isPaid;
  const canClickExternalLinks = false;
  const showImportedContactExtras = isVirtualGoogleImport;
  const showGoogleImportedExtras = showImportedContactExtras;
  const hasSocialLinks =
  businessInfo.instagram ||
  businessInfo.twitter ||
  businessInfo.facebook ||
  businessInfo.tiktok;


  // ── Theme & Brand Kit Engine ──
  const brandKit = businessInfo?.brandKit || {};
  const _p = brandKit.primaryColor || null;
  const uiThemeId = resolveBusinessProfileThemeId(
    businessInfo?.theme || brandKit.templateId
  );
  const theme = getTheme(uiThemeId);
  const tc = getBusinessProfileUiColors(_p, theme?.colors);
  const _s = brandKit.secondaryColor || theme?.colors?.badgeText || tc?.accent;
  const _br = brandKit.buttonStyle || tc?.btnBorderRadius || '14px';
  const _ff = 'system-ui, sans-serif';

  // IMPORTANT FIX: checks if themed is undefined, otherwise falls back
  const th = (val, f) => tc && val !== undefined && val !== null ? val : f;

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

  // Generate Structured Data (JSON-LD) for SEO
  const jsonLd = business ? {
    "@context": "https://schema.org",
    "@type": getSchemaType(businessInfo?.businessType),
    "name": business.display_name || 'DineBuddies Business',
    "image": [profileCoverUrl, getSafeAvatar(business)].filter(Boolean),
    "url": `https://www.dinebuddies.com/business/${profileId}`,
    "telephone": businessInfo?.phone || '',
    "address": {
      "@type": "PostalAddress",
      "streetAddress": businessInfo?.address || '',
      "addressLocality": businessInfo?.city || '',
      "addressCountry": businessInfo?.countryCode || businessInfo?.country || ''
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

  return {
    navigate,
    profileId,
    loading,
    publicProfileHidden,
    business,
    businessInfo,
    isOwner,
    isPaid,
    profileCoverUrl,
    heroCoverSrc,
    profileLogoUrl,
    profileMapCoords,
    categoryBadges,
    hasMapCoords,
    hasSocialLinks,
    canOpenBusinessMapsAndDelivery,
    canClickExternalLinks,
    showGoogleImportedExtras,
    showClaimCta,
    tc,
    theme,
    _s,
    _br,
    _ff,
    th,
    jsonLd,
    rankingPosition,
    rankLoading,
    activeTab,
    setActiveTab,
    menuTabListingType,
    setMenuTabListingType,
    isGuest,
    currentUser,
    userProfile,
    effectiveIsMember,
    isMember,
    businessStageOpen,
    joiningCommunity,
    memberCount,
    memberAvatars,
    activeInvitationsCount,
    averageRating,
    reviews,
    deliveryLinks,
    tempDeliveryLinks,
    setTempDeliveryLinks,
    editingDeliveryLinks,
    setEditingDeliveryLinks,
    handleSaveDeliveryLinks,
    handleCancelDeliveryLinks,
    userLikedBusiness,
    likeInProgress,
    isSharing,
    logoUploading,
    coverUploading,
    handleToggleLike,
    handleShare,
    handleLogoUpload,
    handleCoverUpload,
    handleRemoveLogo,
    handleRemoveCover,
    imageCropRequest,
    clearImageCropRequest,
    handleCroppedImageSave,
    headerCardPreviewUrl,
    closeHeaderPreview,
    handleShareFromOverlay,
    handleJoinCommunity,
    handleCreateInvitation,
    showColorRail,
    setShowColorRail,
    showFeedbackModal,
    setShowFeedbackModal,
    showReviewModal,
    setShowReviewModal,
    newReview,
    setNewReview,
    submittingReview,
    handleSubmitReview,
    highlights,
    openBasicInfoModal,
    showBasicInfoModal,
    setShowBasicInfoModal,
    basicInfoForm,
    setBasicInfoForm,
    savingInfo,
    saveBasicInfo,
    openContactModal,
    showContactModal,
    setShowContactModal,
    contactForm,
    setContactForm,
    saveContact,
    proFieldsNotice,
    setProFieldsNotice,
    showServiceDraftBanner,
    showServiceAddForm,
    setShowServiceAddForm,
    pendingServices,
    serviceForm,
    setServiceForm,
    serviceIconSearch,
    setServiceIconSearch,
    savingServices,
    services,
    showServiceModal,
    setShowServiceModal,
    editingService,
    setEditingService,
    handleAddServiceLocal,
    handleAddService,
    handleSaveAllServices,
    handleDiscardServices,
    handleDeleteService,
    showShareModal,
    setShowShareModal,
    lightboxOpen,
    setLightboxOpen,
    lightboxIndex,
    setLightboxIndex,
    isSelectorOpen,
    setIsSelectorOpen,
    selectorState,
  };
}
