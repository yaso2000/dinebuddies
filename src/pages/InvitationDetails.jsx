import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FaArrowRight, FaPaperPlane, FaCheck, FaTimes, FaUsers, FaMapMarkerAlt, FaCalendarAlt, FaClock, FaShareAlt, FaCheckCircle, FaStar, FaEdit, FaImage, FaUserFriends, FaTrash, FaComments } from 'react-icons/fa';
import VideoPlayer from '../components/Shared/VideoPlayer';

import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import ShareButtons from '../components/ShareButtons';
import CancellationModal from '../components/CancellationModal';
// Added Import
import { updateGuestCount } from '../utils/invitationEditHelpers';
import { cancelInvitation } from '../utils/invitationCancellation';
import { completeInvitation, canCompleteInvitation } from '../utils/invitationCompletion';
import { updateSocialMetaTags, generateInvitationMetaTags, resetSocialMetaTags } from '../utils/socialMetaTags';
import { db } from '../firebase/config';
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import MembersList from '../components/Invitation/MembersList';
import InvitationHeader from '../components/Invitation/InvitationHeader';
import InvitationInfoGrid from '../components/Invitation/InvitationInfoGrid';
import InvitationTimeline from '../components/Invitation/InvitationTimeline';
import { getSafeAvatar, pickSafeDisplayImageUrl } from '../utils/avatarUtils';

const INVITATION_IMAGE_FALLBACK = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800';
import { generateShareCardBlob } from '../utils/shareCardCanvas';
import InvitationShareModal from '../components/InvitationShareModal';
import { shareNativeOrFallback } from '../utils/shareNativeOrFallback';
import InternalShareModal from '../components/InternalShareModal';
import SimpleMap from '../components/SimpleMap';
import { getTemplateStyle } from '../utils/invitationTemplates';
import { goToLogin } from '../utils/goToLogin';
import { getHostedInvitationDetailsPath } from '../utils/hostedInvitationRoutes';
import { loadHostedInvitationById } from '../utils/staleInvitationNotifications';
import { AppText } from "../components/base";

const InvitationDetails = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const joinRequestsRef = useRef(null);
  const detailsScrollRef = useRef(null);

  const { invitations, currentUser, loadingInvitations, approveUser, rejectUser, updateMeetingStatus, approveNewTime, rejectNewTime, toggleFollow, submitRating, requestToJoin, cancelRequest } = useInvitations();
  const { userProfile } = useAuth(); // Get userProfile for accountType check
  const { showToast } = useToast();
  const [userLocation, setUserLocation] = useState(null);
  const [requestersData, setRequestersData] = useState({});
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [fetchedInvitation, setFetchedInvitation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [sharingCard, setSharingCard] = useState(false);
  const [cardPreviewUrl, setCardPreviewUrl] = useState(null);
  const shareCardFileRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const chatEndRef = useRef(null);
  const invitationDocSeenRef = useRef(false);

  const [showAgeModal, setShowAgeModal] = useState(false);
  const [pendingJoin, setPendingJoin] = useState(false);
  const { updateProfile } = useAuth(); // Assuming updateProfile exists, or we use direct firestore update


  // ... existing code ...

  const handleUpdateStatus = async (newStatus) => {
    if (isUpdatingStatus) return;

    // 1. Validation Rules
    if (newStatus === 'on_way') {
      if (invitation.date && invitation.time) {
        const eventDate = new Date(invitation.date);
        const [hours, mins] = invitation.time.split(':').map(Number);
        eventDate.setHours(hours || 0, mins || 0, 0, 0);

        const now = new Date();
        const diffMs = eventDate.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        // Allow only if within 1 hour before, or if the event has already started
        if (diffHours > 1) {
          showToast(t('on_way_too_early', { defaultValue: 'You can only send "I\'m on my way" up to 1 hour before the invitation time.' }), 'error');
          return;
        }
      }
    }

    if (newStatus === 'arrived') {
      // Check distance (allow up to 200m / 0.2km for GPS drift leeway)
      if (distance === null || distance > 0.2) {
        showToast(t('arrived_too_far', { defaultValue: 'You must be near the restaurant (within 100-200 meters) to send "I\'ve arrived".' }), 'error');
        return;
      }
    }

    setIsUpdatingStatus(true);
    try {
      await updateMeetingStatus(id, newStatus);

      // Check privacy collection 
      const collectionName = invitation?.privacy === 'social' ? 'social_invitations' : 'invitations';

      // Dispatch systemic chat message
      try {
        const userName = currentUser?.name || currentUser?.displayName || t('a_guest');
        const msgText = newStatus === 'on_way' ?
        t('chat_on_way', { name: userName }) :
        t('chat_arrived', { name: userName });

        await addDoc(collection(db, collectionName, id, 'messages'), {
          text: msgText,
          senderId: 'system',
          senderName: t('system'),
          isSystemMessage: true,
          createdAt: serverTimestamp(),
          type: 'status_update'
        });
      } catch (chatErr) {
        console.error("Failed to broadcast chat status:", chatErr);
      }

      // If using fetchedInvitation (not in context), update local state manually
      if (!invitations.find((inv) => inv.id === id) && fetchedInvitation) {
        setFetchedInvitation((prev) => ({
          ...prev,
          participantStatus: {
            ...(prev.participantStatus || {}),
            [currentUser?.id]: newStatus
          },
          meetingStatus: newStatus === 'completed' ? 'completed' : prev.meetingStatus,
          completedAt: newStatus === 'completed' ? new Date() : prev.completedAt
        }));
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      showToast(t('failed_update_status', { defaultValue: 'Failed to update status. Please try again.' }), 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Check eligibility based on gender and age

  // Prefer live Firestore snapshot for requests/joined; fall back to context list.
  const contextInvitation = invitations.find((inv) => inv.id === id);
  let invitation = fetchedInvitation
    ? { ...(contextInvitation || {}), ...fetchedInvitation }
    : contextInvitation;

  const templateStyles = invitation ? getTemplateStyle(
    invitation.templateType || 'classic',
    invitation.colorScheme || 'oceanBlue',
    invitation.inviteMood || invitation.occasionType,
    { cardFontFamily: invitation.cardFontFamily }
  ) : null;

  // Live sync: keep requests/joined (and host UI) fresh; redirect only after a known doc disappears.
  useEffect(() => {
    invitationDocSeenRef.current = false;
    setFetchedInvitation(null);
  }, [id]);
  useEffect(() => {
    if (!id) return undefined;
    const invRef = doc(db, 'invitations', id);
    const unsubscribe = onSnapshot(invRef, (snapshot) => {
      if (snapshot.exists()) {
        invitationDocSeenRef.current = true;
        setFetchedInvitation({ id: snapshot.id, ...snapshot.data() });
        return;
      }
      if (!snapshot.exists() && invitationDocSeenRef.current) {
        navigate('/', { replace: true, state: { message: 'This invitation has ended.' } });
      }
    }, (err) => {
      console.error('Invitation snapshot error:', err);
    });
    return () => unsubscribe();
  }, [id, navigate]);

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Location access denied:', error);
        }
      );
    }
  }, []);

  // Calculate distance and travel time
  const distance = userLocation && invitation?.lat && invitation?.lng ?
  calculateDistance(userLocation.lat, userLocation.lng, invitation.lat, invitation.lng) :
  null;
  const travelTime = distance ? Math.round(distance / 40 * 60) : null;

  // Scroll to section based on query parameter
  useEffect(() => {
    const params = new URLSearchParams(routerLocation.search);
    const section = params.get('section');

    if (section === 'join-requests' && joinRequestsRef.current) {
      setTimeout(() => {
        joinRequestsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
    } else if (section === 'chat' && chatEndRef.current) {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
  }, [routerLocation.search, invitation]);

  // First open: show top of invitation (hero), not bottom/map
  useEffect(() => {
    const params = new URLSearchParams(routerLocation.search);
    if (params.get('section')) return;
    if (!invitation?.id) return;

    const resetScroll = () => {
      const el = detailsScrollRef.current;
      if (el) el.scrollTop = 0;
      const appMain = document.querySelector('.app-main');
      if (appMain) appMain.scrollTop = 0;
      window.scrollTo(0, 0);
    };

    requestAnimationFrame(resetScroll);
    const t1 = setTimeout(resetScroll, 50);
    const t2 = setTimeout(resetScroll, 250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [id, invitation?.id, routerLocation.search]);

  // Fetch requesters data
  useEffect(() => {
    const fetchRequestersData = async () => {
      if (!invitation?.requests || invitation.requests.length === 0) {
        setRequestersData({});
        return;
      }

      const data = {};
      for (const userId of invitation.requests) {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            data[userId] = {
              name: userData.display_name || userData.name || 'User',
              avatar: getSafeAvatar(userData)
            };
          }
        } catch (error) {
          console.error('Error fetching requester data:', error);
        }
      }
      setRequestersData(data);
    };

    fetchRequestersData();
  }, [invitation?.requests]);

  // Fetch joined members data
  const [joinedMembersData, setJoinedMembersData] = useState({});

  useEffect(() => {
    const fetchJoinedMembersData = async () => {
      if (!invitation?.joined || invitation.joined.length === 0) {
        setJoinedMembersData({});
        return;
      }

      const data = {};
      for (const userId of invitation.joined) {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            data[userId] = {
              name: userData.display_name || userData.name || 'User',
              avatar: getSafeAvatar(userData)
            };
          }
        } catch (error) {
          console.error('Error fetching joined member data:', error);
        }
      }
      setJoinedMembersData(data);
    };

    fetchJoinedMembersData();
  }, [invitation?.joined]);

  // Update social meta tags when invitation loads
  useEffect(() => {
    if (invitation) {
      const metaData = generateInvitationMetaTags(invitation);
      updateSocialMetaTags(metaData);
    }

    // Reset meta tags when component unmounts
    return () => {
      resetSocialMetaTags();
    };
  }, [invitation?.id]); // use id not full object to avoid infinite effect runs

  // Hosted social/private invites live in social_invitations — redirect if this id is hosted.
  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const hosted = await loadHostedInvitationById(id);
        if (!cancelled && hosted) {
          navigate(getHostedInvitationDetailsPath(hosted), { replace: true });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  const [showCopiedToast, setShowCopiedToast] = useState(false);

  // Generate share card and show modal so the image is always visible; user can Share / Download / Copy link
  const handleShareCard = async () => {
    if (sharingCard) return;
    const shareUrl = window.location.href;
    const shareLayout = templateStyles?.layout?.cardVariant || 'photoBottom';
    const formatInviteDate = () => {
      if (!invitation?.date) return t('tbd', { defaultValue: 'TBD' });
      const d = new Date(invitation.date);
      return d.toLocaleDateString(i18n.language === 'ar' ? 'ar-u-nu-latn' : undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    };
    const formatInviteTime = () => {
      if (!invitation?.time) return '';
      const tm = invitation.time;
      return tm.includes('T') ? tm.split('T')[1].substring(0, 5) : tm;
    };
    const paymentLabel = invitation?.paymentType ?
    t(`payment_type_${String(invitation.paymentType).toLowerCase().replace(/ /g, '_')}`, { defaultValue: invitation.paymentType }) :
    t('payment_split');
    const guestsMeta = `${invitation?.guestsNeeded ?? 0} ${t('guests', { defaultValue: 'Guests' })}`;
    const distanceMeta = invitation?.distance != null && invitation?.distance !== undefined ?
    `${invitation.distance.toFixed(1)} ${t('km_away', { defaultValue: 'km away' })}` :
    null;
    const storyData = {
      title: invitation?.title,
      image:
      pickSafeDisplayImageUrl(
        invitation?.customImage,
        invitation?.restaurantImage,
        invitation?.image
      ) || INVITATION_IMAGE_FALLBACK,
      description: invitation?.description,
      date: invitation?.date,
      time: invitation?.time,
      location: invitation?.restaurantName || invitation?.locationName || invitation?.location,
      maxGuests: invitation?.guestsNeeded,
      hostName: invitation?.author?.name || invitation?.hostName,
      hostImage: getSafeAvatar(invitation?.author || {}),
      shareUrl,
      shareLayout,
      shareMeta: {
        dateLine: formatInviteDate(),
        timeLine: formatInviteTime() || '—',
        guestsLine: guestsMeta,
        paymentLine: paymentLabel,
        distanceLine: distanceMeta || ''
      }
    };
    try {
      setSharingCard(true);
      setCardPreviewUrl(null);
      shareCardFileRef.current = null;
      const blob = await generateShareCardBlob(storyData);
      if (!blob) throw new Error('No blob');
      const file = new File([blob], 'dinebuddies-invitation.png', { type: 'image/png' });
      shareCardFileRef.current = file;
      setCardPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      if (err?.name !== 'AbortError') console.error('Share error:', err);
      showToast(t('share_failed', { defaultValue: 'Could not generate share image. Try again.' }), 'error');
    } finally {
      setSharingCard(false);
    }
  };

  const closeShareModal = () => {
    if (cardPreviewUrl) URL.revokeObjectURL(cardPreviewUrl);
    setCardPreviewUrl(null);
    shareCardFileRef.current = null;
  };

  const [showInternalShare, setShowInternalShare] = useState(false);

  const handleShareNativeFromModal = async () => {
    const shareUrl = window.location.href;
    const file = shareCardFileRef.current;
    const shareTextWithLink = `${invitation?.title || 'Invitation'}${invitation?.description ? `\n\n${invitation.description}` : ''}\n\n🔗 ${shareUrl}`;
    await shareNativeOrFallback({
      file,
      title: invitation?.title,
      text: shareTextWithLink,
      url: shareUrl,
      skipExternalFallback: false
    });
  };



  const handleCancelInvitation = async (reason, customReason) => {
    try {
      const result = await cancelInvitation(id, reason, customReason, currentUser);

      if (result.success) {
        setShowCancellationModal(false);

        // Build success message with penalty information
        let message = t('invitation_cancelled_success', { count: result.notifiedUsers });

        if (result.penalty) {
          const penalty = result.penalty;
          message += '\n\n';

          if (penalty.level === 0 && result.isExempt) {
            // Exempted - no penalty
            message += `${penalty.icon} ${t('cancellation_exempt')}\n${t('no_participants_affected')}`;
          } else if (penalty.level === 1) {
            // Warning
            message += `${penalty.icon} ${t('cancellation_warning')}\n${t('cancellation_count', { count: result.cancellationCount })}`;
          } else if (penalty.level === 2) {
            // 2 weeks restriction
            message += `${penalty.icon} ${t('account_restricted')}\n${t('restriction_duration', { days: penalty.duration })}\n${t('cancellation_count', { count: result.cancellationCount })}`;
          } else if (penalty.level === 3) {
            // 1 month ban
            message += `${penalty.icon} ${t('account_banned')}\n${t('ban_duration', { days: penalty.duration })}\n${t('cancellation_count', { count: result.cancellationCount })}`;
          } else if (penalty.level >= 4) {
            // 3 months long ban
            message += `${penalty.icon} ${t('account_long_banned')}\n${t('ban_duration', { days: penalty.duration })}\n${t('cancellation_count', { count: result.cancellationCount })}`;
          }
        }

        showToast(t('invitation_cancelled_success', { count: result.notifiedUsers }), 'success');
        navigate('/');
      } else {
        showToast(result.error, 'error');
      }
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      showToast(t('something_went_wrong', { defaultValue: 'Failed to cancel invitation' }), 'error');
    }
  };

  // Handle completing invitation with location verification
  const handleCompleteInvitation = async () => {
    if (!invitation || !currentUser) return;

    // Check if can complete
    const check = canCompleteInvitation(invitation, currentUser);
    if (!check.canComplete) {
      showToast(check.reason, 'error');
      return;
    }

    if (!window.confirm(t('confirm_complete_invitation'))) {
      return;
    }

    setIsCompleting(true);
    setLocationStatus(t('verifying_location') || 'Verifying...');

    try {
      // Complete invitation (with location verification)
      const result = await completeInvitation(id, invitation, currentUser);

      if (result.success) {
        showToast(t('invitation_completed_success', { defaultValue: 'Invitation completed successfully!' }), 'success');
        setLocationStatus('');

        // Refresh page or navigate
        window.location.reload();
      } else {
        // Failed - friendly message without technical details
        let errorMessage;

        if (result.requiresLocation) {
          errorMessage = t('not_at_venue_yet');
        } else if (result.requiresPermission) {
          errorMessage = t('verify_venue_location');
        } else {
          errorMessage = t('something_went_wrong');
        }

        showToast(errorMessage, 'error');
        setLocationStatus('');
      }
    } catch (error) {
      console.error('Error completing invitation:', error);
      showToast(t('something_went_wrong'), 'error');
      setLocationStatus('');
    } finally {
      setIsCompleting(false);
    }
  };

  // Show loading while invitations are being fetched from Firebase
  if (loadingInvitations) {
    return (
      <div className="page-container" style={{
        padding: '2rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh'
      }}>
                <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid var(--border-color)',
          borderTop: '4px solid var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
                <AppText as="p" style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
                    {t('loading')}
                </AppText>
            </div>);

  }

  // After loading, if invitation is not found, show error or redirect with message
  if (!invitation) {
    return (
      <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}>
                <AppText as="h2" style={{ marginBottom: '1rem' }}>{t('invitation_not_found')}</AppText>
                <AppText as="p" style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>{t('invitation_ended_hint', { defaultValue: 'This invitation may have ended or been removed.' })}</AppText>
                <button type="button" onClick={() => navigate('/')} className="ui-btn ui-btn--primary">{t('nav_home')}</button>
            </div>);

  }

  const { author = {}, title, requests = [], joined = [], chat = [], image, location, date, time, description, guestsNeeded, meetingStatus = 'planning', genderPreference, ageRange, privacy, mediaType, customVideo, videoThumbnail, customImage, restaurantImage, restaurantName } = invitation;

  // Determine media to display (reject PhotoService.GetPhoto URLs — 403 as img src)
  const isVideo = mediaType === 'video' && customVideo;
  const safeStillImage =
  pickSafeDisplayImageUrl(customImage, restaurantImage, image) || INVITATION_IMAGE_FALLBACK;
  const mediaUrl = isVideo ? customVideo : safeStillImage;
  const thumbnailUrl = isVideo ?
  pickSafeDisplayImageUrl(videoThumbnail, customImage, restaurantImage, image) || safeStillImage :
  mediaUrl;
  const myUid = currentUser?.uid || currentUser?.id;
  const isHost = Boolean(myUid && author?.id === myUid);
  const isAccepted = Boolean(myUid && joined.includes(myUid));
  const isPending = Boolean(myUid && requests.includes(myUid));
  const spotsLeft = guestsNeeded - joined.length;



  // Determine current user's specific status for the timeline
  // If global meeting is completed, everyone sees completed.
  // Otherwise, see personal status (on_way/arrived) or default to 'planning'.
  const myStatus = invitation?.participantStatus?.[currentUser?.id] || (meetingStatus === 'completed' ? 'completed' : 'planning');

  // Save Age Category Logic
  const handleSaveAgeCategory = async (selectedCategory) => {
    if (!currentUser?.id) return;
    setIsUpdatingStatus(true);
    try {
      // Update in Firestore
      const userRef = doc(db, 'users', currentUser?.id);
      await import('firebase/firestore').then(({ updateDoc }) => {
        updateDoc(userRef, { ageCategory: selectedCategory });
      });

      // Optimistically update local state if needed (though AuthContext should catch it)
      // But for immediate UI feedback:
      currentUser.ageCategory = selectedCategory;

      // Close modal
      setShowAgeModal(false);

      // If we had a pending join action, retry it automatically
      if (pendingJoin) {
        // Re-check eligibility now that we have age
        const check = checkEligibility(selectedCategory); // Pass manually to ensure latest
        if (check.eligible) {
          await handleRequestToJoin();
        } else {
          showToast(check.reason, 'error');
        }
        setPendingJoin(false);
      }

    } catch (error) {
      console.error("Error updating age category:", error);
      showToast(t('failed_update_profile'), 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Check eligibility based on gender and age
  const checkEligibility = (manualAgeCategory) => {
    // Business accounts cannot join invitations
    if (userProfile?.isBusiness) {
      return { eligible: false, reason: t('business_cannot_join', { defaultValue: 'Business accounts cannot join invitations' }) };
    }

    // Check gender preference
    // Check gender preference (Unified)
    if (invitation.genderGroups && invitation.genderGroups.length > 0 && !invitation.genderGroups.includes('any')) {
      // New Multi-Select Logic
      // 'unspecified' in groups matches if user gender is unspecified or missing? Or strictly matches?
      // Assuming strict match for now.
      if (currentUser?.gender && !invitation.genderGroups.includes(currentUser.gender)) {
        return { eligible: false, reason: t('gender_mismatch') };
      }
    } else if (genderPreference && genderPreference !== 'any' && genderPreference !== 'custom' && currentUser?.gender !== genderPreference) {
      // Legacy Single-Select Logic
      return { eligible: false, reason: t('gender_mismatch') };
    }

    const userAgeCategory = manualAgeCategory || currentUser?.ageCategory || userProfile?.ageCategory;

    // Check NEW age groups preference (Multi-Select)
    if (invitation.ageGroups && invitation.ageGroups.length > 0 && !invitation.ageGroups.includes('any')) {
      if (!userAgeCategory) {
        // User has no age category set. We consider them "eligible" to click the button,
        // but the button click will trigger the modal.
        return { eligible: true, needsAgeSetup: true };
      }

      if (!invitation.ageGroups.includes(userAgeCategory)) {
        const allowed = invitation.ageGroups.join(', ');
        return {
          eligible: false,
          reason: t('age_groups_restricted', { allowed })
        };
      }
    }

    // Check LEGACY age range preference
    if (ageRange && ageRange !== 'any' && !invitation.ageGroups) {// Only check if new system not used
      // If we have categories, try to map/guess or just skip
      // For legacy '18-25' string matching
      if (currentUser?.age) {
        const [minAge, maxAge] = ageRange.split('-').map(Number);
        if (currentUser.age < minAge || currentUser.age > maxAge) {
          return { eligible: false, reason: `${t('age_range_preference')}: ${ageRange}` };
        }
      }
    }

    return { eligible: true };
  };
  const eligibility = checkEligibility();

  const handleRequestToJoin = async () => {
    if (currentUser?.isGuest) {
      goToLogin();
      return;
    }

    // Lazy Registration Check
    if (eligibility.needsAgeSetup) {
      setPendingJoin(true);
      setShowAgeModal(true);
      return;
    }

    if (!eligibility.eligible) return;

    if (isPending) {
      console.log('🔴 Canceling request for invitation:', id);
      await cancelRequest(id);
      showToast(t('request_cancelled', { defaultValue: 'Join request cancelled.' }), 'info');
    } else {
      console.log('🟢 Requesting to join invitation:', id);
      const ok = await requestToJoin(id);
      if (!ok) return;
      console.log('✅ Request sent successfully');
      showToast(t('request_sent_waiting', { defaultValue: 'Request sent — waiting for host approval.' }), 'success');
    }
  };


  return (
    <div className="page-container details-page" style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
            {/* Header Actions - Absolute on top of Hero */}
            <div style={{ position: 'absolute', top: '20px', ...(i18n.language === 'ar' || i18n.language?.startsWith('ar') ? { right: '20px' } : { left: '20px' }), zIndex: 50 }}>
                <button
          onClick={() => navigate('/')}
          style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer' }}>
          
                    <FaArrowRight style={{ transform: i18n.language === 'ar' ? 'rotate(0deg)' : 'rotate(180deg)' }} />
                </button>
            </div>

            <div ref={detailsScrollRef} style={{ flex: 1, overflowY: 'auto', paddingBottom: '100px' }} className="details-scroll-area">
                <InvitationHeader
          invitation={invitation}
          isHost={isHost}

          onEdit={() => navigate('/create', { state: { editingInvitation: invitation } })}
          onDelete={() => setShowCancellationModal(true)}
          onShare={handleShareCard}
          sharingCard={sharingCard} />
        



                <div style={{ padding: '1.5rem' }}>

                    {/* Host Info - Small Compact */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '12px' }}>
                        <img
              src={getSafeAvatar(author)}
              style={{ width: '40px', height: '40px', borderRadius: '50%' }}
              alt={author.name} />
            
                        <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{author.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('host')}</div>
                        </div>
                        <div style={{ marginLeft: 'auto' }}>
                            {currentUser?.id && currentUser?.id !== author.id && userProfile?.role !== 'business' &&
              <button
                onClick={() => toggleFollow(author.id)}
                style={{
                  background: currentUser?.following?.includes(author.id) ? 'var(--primary)' : 'transparent',
                  border: '1px solid var(--primary)',
                  color: currentUser?.following?.includes(author.id) ? 'white' : 'var(--primary)',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}>
                
                                    {currentUser?.following?.includes(author.id) ? t('following') : t('follow')}
                                </button>
              }
                        </div>
                    </div>

                    <InvitationInfoGrid
            invitation={invitation}
            distance={invitation.distance}
            restaurantName={restaurantName}
            t={t} />
          

                    {(isHost || isAccepted) &&
          <InvitationTimeline
            invitation={invitation}
            myStatus={myStatus}
            isAccepted={isAccepted}
            isHost={isHost}
            onUpdateStatus={handleUpdateStatus}
            onComplete={handleCompleteInvitation}
            isUpdatingStatus={isUpdatingStatus || isCompleting} />

          }

                    {/* Description */}
                    <AppText as="h4" style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '0.5rem' }}>{t('about_event')}</AppText>
                    <AppText as="p" style={{ lineHeight: '1.6', color: 'var(--text-muted)', marginBottom: '2rem' }}>
                        {description || t('no_description')}
                    </AppText>
                    {/* NEW: Time Change Approval Bar */}
                    {invitation.pendingChangeApproval && invitation.pendingChangeApproval.includes(currentUser?.id) &&
          <div style={{ background: 'var(--primary)', padding: '12px', borderRadius: '12px', marginBottom: '1rem', animation: 'pulse 2s infinite' }}>
                            <AppText as="p" style={{ fontSize: '0.8rem', fontWeight: '800', color: 'white', marginBottom: '8px' }}>{t('time_change_warning')}</AppText>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => approveNewTime(id)} style={{ flex: 1, padding: '6px', background: 'white', color: 'var(--primary)', border: 'none', borderRadius: '6px', fontWeight: '800', fontSize: '0.75rem' }}>{t('approve_time')}</button>
                                <button onClick={() => rejectNewTime(id)} style={{ flex: 1, padding: '6px', background: 'rgba(0,0,0,0.2)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', fontSize: '0.75rem' }}>{t('withdraw')}</button>
                            </div>
                        </div>
          }

                    {/* Join Button for non-hosts/strangers */}
                    {!isHost && !isAccepted && userProfile?.role !== 'business' &&
          <div style={{ marginTop: '1.5rem' }}>
                            <button
              type="button"
              className={`ui-btn ${!eligibility.eligible || isPending ? 'ui-btn--secondary' : ''}`}
              onClick={handleRequestToJoin}
              disabled={!eligibility.eligible && !currentUser?.isGuest}
              style={{
                width: '100%',
                height: '60px',
                fontSize: '1.1rem',
                background: !eligibility.eligible && !currentUser?.isGuest ?
                'var(--bg-input)' :
                !isPending ? templateStyles?.button?.background || 'var(--primary)' : undefined,
                color: !eligibility.eligible && !currentUser?.isGuest ?
                'var(--text-muted)' :
                !isPending ? 'white' : undefined,
                cursor: !eligibility.eligible && !currentUser?.isGuest ? 'not-allowed' : 'pointer',
                border: !isPending ? 'none' : undefined,
                boxShadow: !isPending && eligibility.eligible ? templateStyles?.button?.boxShadow || '0 8px 20px rgba(0,0,0,0.2)' : 'none'
              }}>
              
                                {currentUser?.isGuest ? t('login_to_join', { defaultValue: 'Login to Join' }) : !eligibility.eligible ? eligibility.reason || t('invite_unavailable') : isPending ? t('joined_btn') : t('join_btn')}
                            </button>
                            <AppText as="p" style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.8rem' }}>
                                {!eligibility.eligible ? eligibility.reason : isPending ? t('request_sent_waiting') : t('join_to_chat')}
                            </AppText>
                        </div>
          }


                    {/* PRIVATE SECTION: Management & Chat */}
                    {isHost || isAccepted ?
          <>
                            {/* Who's Coming - Social Trust Feature */}
                            <MembersList
              joined={joined}
              author={author}
              joinedMembersData={joinedMembersData}
              spotsLeft={spotsLeft} />
            


                            {/* Group Chat Access Button - Replaces Embedded Chat */}
                            {(isAccepted || isHost) &&
            <div style={{ padding: '0 1.25rem', marginBottom: '1.5rem', opacity: meetingStatus === 'completed' ? 0.6 : 1, pointerEvents: meetingStatus === 'completed' ? 'none' : 'auto' }}>
                                    <button
                type="button"
                onClick={() => navigate(`/invitation/${id}/chat`)}
                className="ui-btn ui-btn--ghost"
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  gap: '12px',
                  padding: '1rem',
                  background: 'var(--hover-overlay)',
                  textAlign: 'left'
                }}>
                
                                        <div style={{
                  width: '45px', height: '45px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(139, 92, 246, 0.3)'
                }}>
                                            <FaComments color="white" size={20} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ color: 'var(--text-main)', fontWeight: '800', fontSize: '1rem' }}>
                                                {t('group_chat_title', { defaultValue: 'Group Chat' })}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {t('check_updates_details', { defaultValue: 'Check updates & details' })}
                                            </div>
                                        </div>
                                        <FaArrowRight color="var(--text-muted)" />
                                    </button>
                                </div>
            }

                            {/* Host Management */}
                            {isHost && requests.length > 0 &&
            <div ref={joinRequestsRef} style={{ padding: '0 1.25rem', marginBottom: '2rem' }}>
                                    <AppText as="h4" style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800' }}>
                                        <FaUsers /> {t('pending_requests', { count: requests.length })}
                                    </AppText>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {requests.map((userId) => {
                  const requester = requestersData[userId] || { name: t('loading'), avatar: '' };
                  return (
                    <div key={userId} className="ui-card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <img
                          src={requester.avatar}
                          alt={requester.name}
                          style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                        
                                                        <AppText as="span" style={{ fontWeight: '700' }}>{requester.name}</AppText>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button type="button" onClick={() => approveUser(id, userId)} className="ui-btn ui-btn--primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>{t('accept')}</button>
                                                        <button type="button" onClick={() => rejectUser(id, userId)} className="ui-btn ui-btn--secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>{t('reject')}</button>
                                                    </div>
                                                </div>);

                })}
                                    </div>
                                </div>
            }

                        </> :
          userProfile?.role !== 'business' ? (
          /* Locked Chat Message for non-members */
          <div style={{ padding: '2rem 1.25rem', textAlign: 'center' }}>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-color)' }}>
                                <FaPaperPlane style={{ fontSize: '2rem', color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.2 }} />
                                <AppText as="h4" style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t('chat_closed')}</AppText>
                                <AppText as="p" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('members_only_chat')}</AppText>
                            </div>
                        </div>) :
          null}

                    {/* NEW LOCATION MAP BLOCK AT THE BOTTOM */}
                    <div style={{ marginTop: '2rem', padding: '0 1.25rem', paddingBottom: '2rem' }}>
                        <AppText as="h4" style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FaMapMarkerAlt style={{ color: 'var(--primary)' }} /> {t('location_map', { defaultValue: 'Location' })}
                        </AppText>
                        
                        <div style={{
              background: 'var(--bg-card)',
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
            }}>
                            {/* Location Text Summary */}
                            <div style={{ padding: '15px' }}>
                                <div style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: '4px' }}>
                                    {restaurantName || invitation.locationName || invitation.location || t('location_tbd')}
                                </div>
                                {(invitation.locationName || invitation.location) && restaurantName !== invitation.locationName &&
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {invitation.locationName || invitation.location}
                                    </div>
                }
                                {invitation.distance &&
                <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold', marginTop: '6px' }}>
                                        {invitation.distance.toFixed(1)} km away
                                    </div>
                }
                            </div>

                            {/* Interactive Map */}
                            {invitation.lat && invitation.lng || invitation.restaurantData?.lat && invitation.restaurantData?.lng ?
              <div style={{ height: '220px', width: '100%' }}>
                                    <SimpleMap
                  lat={invitation.lat || invitation.restaurantData?.lat}
                  lng={invitation.lng || invitation.restaurantData?.lng}
                  businessName={restaurantName}
                  address={invitation.locationName || invitation.location} />
                
                                </div> :

              <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--border-color)' }}>
                                    <AppText as="span" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>📍 Map coordinates not available</AppText>
                                </div>
              }
                        </div>
                    </div>
                </div>

                {/* Cancellation Modal */}
                <CancellationModal
          isOpen={showCancellationModal}
          onClose={() => setShowCancellationModal(false)}
          onConfirm={handleCancelInvitation}
          invitationTitle={title} />
        

                {/* Copied Toast Notification */}
                {
        showCopiedToast &&
        <div style={{
          position: 'fixed',
          bottom: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '50px',
          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.9rem',
          fontWeight: '700',
          zIndex: 10000,
          animation: 'slideUp 0.3s ease-out',
          backdropFilter: 'blur(10px)'
        }}>
                            <FaCheck style={{ fontSize: '1rem' }} />
                            <AppText as="span">{t('link_copied', { defaultValue: 'Link copied!' })}</AppText>
                        </div>

        }

                {/* Age Verification Modal (Lazy Registration) */}
                {showAgeModal &&
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', pading: '20px'
        }}>
                        <div style={{
            background: 'var(--bg-card)', padding: '24px', borderRadius: '16px',
            border: '1px solid var(--border-color)', width: '90%', maxWidth: '350px',
            textAlign: 'center'
          }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎭</div>
                            <AppText as="h3" style={{ marginBottom: '8px' }}>{t('invitation_welcome_new_member', 'Welcome, new member!')}</AppText>
                            <AppText as="p" style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem', lineHeight: '1.5' }}>
                                To ensure the best vibe for you (without asking every time), just let us know which age group you belong to! ✨
                            </AppText>

                            <div style={{ display: 'grid', gap: '8px', marginBottom: '20px' }}>
                                {['18-24', '25-34', '35-44', '45-54', '55+'].map((age) =>
              <button
                key={age}
                onClick={() => handleSaveAgeCategory(age)}
                disabled={isUpdatingStatus}
                style={{
                  padding: '12px', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-color)', borderRadius: '12px',
                  color: 'var(--text-main)', cursor: 'pointer', fontWeight: 'bold'
                }}>
                
                                        {age}
                                    </button>
              )}
                            </div>

                            <button
              onClick={() => setShowAgeModal(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer' }}>
              
                                {t('cancel')}
                            </button>
                        </div>
                    </div>
        }

                {/* Share modal: card preview + Share / Download / Copy link */}
                <InvitationShareModal
          cardPreviewUrl={cardPreviewUrl}
          shareUrl={window.location.href}
          title={invitation?.title}
          onClose={closeShareModal}
          onShareNative={handleShareNativeFromModal}
          onCopyLink={() => showToast(t('link_copied', { defaultValue: 'Link copied!' }), 'success')}
          onInternalShare={() => {
            closeShareModal();
            setShowInternalShare(true);
          }}
          t={t} />
        

                <InternalShareModal
          isOpen={showInternalShare}
          onClose={() => setShowInternalShare(false)}
          shareData={{
            type: 'invitation',
            id: invitation?.id || id,
            title: invitation?.title || 'Invitation',
            description: invitation?.description || '',
            image:
            pickSafeDisplayImageUrl(
              invitation?.customImage,
              invitation?.restaurantImage,
              invitation?.image
            ) || null,
            url: window.location.href
          }} />
        
            </div>
        </div>);

};

export default InvitationDetails;