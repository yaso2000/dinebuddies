import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FaArrowRight, FaPaperPlane, FaCheck, FaTimes, FaUsers, FaMapMarkerAlt, FaCalendarAlt, FaClock, FaShareAlt, FaCheckCircle, FaStar, FaEdit, FaImage, FaUserFriends, FaTrash } from 'react-icons/fa';
import VideoPlayer from '../components/Shared/VideoPlayer';

import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import ShareButtons from '../components/ShareButtons';
import CancellationModal from '../components/CancellationModal';
import GroupChat from '../components/GroupChat'; // Added Import
import { updateGuestCount, updateInvitationImage } from '../utils/invitationEditHelpers';
import { cancelInvitation } from '../utils/invitationCancellation';
import { completeInvitation, canCompleteInvitation } from '../utils/invitationCompletion';
import { updateSocialMetaTags, generateInvitationMetaTags, resetSocialMetaTags } from '../utils/socialMetaTags';
import { db } from '../firebase/config';
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import MembersList from '../components/Invitation/MembersList';

const InvitationDetails = () => {
    const { t, i18n } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();
    const routerLocation = useLocation();
    const joinRequestsRef = useRef(null);

    const { invitations, currentUser, loadingInvitations, approveUser, rejectUser, updateMeetingStatus, approveNewTime, rejectNewTime, toggleFollow, submitRating, requestToJoin, cancelRequest } = useInvitations();
    const { userProfile } = useAuth(); // Get userProfile for accountType check
    const [userLocation, setUserLocation] = useState(null);
    const [requestersData, setRequestersData] = useState({});
    const [showCancellationModal, setShowCancellationModal] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [fetchedInvitation, setFetchedInvitation] = useState(null);
    const [locationStatus, setLocationStatus] = useState('');
    const chatEndRef = useRef(null);

    // ... existing code ...

    const handleUpdateStatus = async (newStatus) => {
        if (isUpdatingStatus) return;
        setIsUpdatingStatus(true);
        try {
            await updateMeetingStatus(id, newStatus);
            // If using fetchedInvitation (not in context), update local state manually
            if (!invitations.find(inv => inv.id === id) && fetchedInvitation) {
                setFetchedInvitation(prev => ({
                    ...prev,
                    participantStatus: {
                        ...(prev.participantStatus || {}),
                        [currentUser.id]: newStatus
                    },
                    meetingStatus: newStatus === 'completed' ? 'completed' : prev.meetingStatus,
                    completedAt: newStatus === 'completed' ? new Date() : prev.completedAt
                }));
            }
        } catch (error) {
            console.error("Failed to update status:", error);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    // Check eligibility based on gender and age

    // Try to find invitation in context first, fallback to fetched
    let invitation = invitations.find(inv => inv.id === id);
    if (!invitation && fetchedInvitation) {
        invitation = fetchedInvitation;
    }

    // Fetch invitation from Firestore if not in context (for private invitations)
    useEffect(() => {
        const fetchInvitation = async () => {
            if (!invitation && id && !loadingInvitations) {
                try {
                    const invDoc = await getDoc(doc(db, 'invitations', id));
                    if (invDoc.exists()) {
                        setFetchedInvitation({ id: invDoc.id, ...invDoc.data() });
                    }
                } catch (error) {
                    console.error('Error fetching invitation:', error);
                }
            }
        };
        fetchInvitation();
    }, [id, invitation, loadingInvitations]);

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
    const distance = userLocation && invitation?.lat && invitation?.lng
        ? calculateDistance(userLocation.lat, userLocation.lng, invitation.lat, invitation.lng)
        : null;
    const travelTime = distance ? Math.round((distance / 40) * 60) : null;

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
                            avatar: userData.photo_url || userData.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + userId
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
                            avatar: userData.photo_url || userData.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + userId
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
    }, [invitation]);

    const [showCopiedToast, setShowCopiedToast] = useState(false);

    const handleShare = async () => {
        const shareUrl = window.location.href;
        const shareTitle = invitation?.title || 'DineBuddies Invitation';
        const shareText = invitation?.description || 'Join me for a meal!';

        // Try native share API first (mobile)
        if (navigator.share) {
            try {
                await navigator.share({
                    title: shareTitle,
                    text: shareText,
                    url: shareUrl,
                });
                return;
            } catch (error) {
                // User cancelled or error - fall through to clipboard
                if (error.name !== 'AbortError') {
                    console.error('Share failed:', error);
                }
            }
        }

        // Fallback: Copy to clipboard
        try {
            await navigator.clipboard.writeText(shareUrl);
            setShowCopiedToast(true);
            setTimeout(() => setShowCopiedToast(false), 3000);
        } catch (error) {
            console.error('Copy failed:', error);
            // Final fallback: select and copy
            const textArea = document.createElement('textarea');
            textArea.value = shareUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setShowCopiedToast(true);
            setTimeout(() => setShowCopiedToast(false), 3000);
        }
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

                alert(message);
                navigate('/');
            } else {
                alert(result.error);
            }
        } catch (error) {
            console.error('Error cancelling invitation:', error);
            alert('Failed to cancel invitation');
        }
    };

    // Handle completing invitation with location verification
    const handleCompleteInvitation = async () => {
        if (!invitation || !currentUser) return;

        // Check if can complete
        const check = canCompleteInvitation(invitation, currentUser);
        if (!check.canComplete) {
            const friendlyMessage = i18n.language === 'ar'
                ? check.reason === 'Only the host can complete the invitation'
                    ? 'فقط صاحب الدعوة يمكنه إتمامها'
                    : check.reason === 'No one has joined yet'
                        ? 'لا يوجد مشاركين بعد'
                        : check.reason === 'Already completed'
                            ? 'تم إتمام هذه الدعوة مسبقاً'
                            : check.reason
                : check.reason;

            alert(friendlyMessage);
            return;
        }

        // Confirm with user - simple and friendly
        const confirmMessage = i18n.language === 'ar'
            ? 'هل أنت متأكد من إتمام الدعوة؟'
            : 'Are you sure you want to complete this invitation?';

        if (!window.confirm(confirmMessage)) {
            return;
        }

        setIsCompleting(true);
        setLocationStatus(t('verifying_location') || 'Verifying...');

        try {
            // Complete invitation (with location verification)
            const result = await completeInvitation(id, invitation, currentUser);

            if (result.success) {
                // Success - simple and friendly
                const successMessage = i18n.language === 'ar'
                    ? '🎉 تم إتمام الدعوة بنجاح!\n\nشكراً لك، نتمنى أن تكون قد استمتعت بوقتك!'
                    : '🎉 Invitation completed successfully!\n\nThank you! Hope you had a great time!';

                alert(successMessage);
                setLocationStatus('');

                // Refresh page or navigate
                window.location.reload();
            } else {
                // Failed - friendly message without technical details
                let errorMessage;

                if (result.requiresLocation) {
                    // Location verification failed - simple message
                    errorMessage = i18n.language === 'ar'
                        ? '😊 يبدو أنك لست في مكان الدعوة حالياً\n\nيمكنك إتمام الدعوة عندما تصل إلى المطعم'
                        : '😊 It looks like you\'re not at the venue yet\n\nYou can complete the invitation once you arrive at the restaurant';
                } else if (result.requiresPermission) {
                    // Permission denied - friendly request
                    errorMessage = i18n.language === 'ar'
                        ? '📍 نحتاج إلى معرفة موقعك للتأكد من وصولك\n\nيرجى السماح بالوصول إلى الموقع في إعدادات المتصفح'
                        : '📍 We need to verify you\'re at the venue\n\nPlease allow location access in your browser settings';
                } else {
                    // Generic error
                    errorMessage = i18n.language === 'ar'
                        ? 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى'
                        : 'Sorry, something went wrong. Please try again';
                }

                alert(errorMessage);
                setLocationStatus('');
            }
        } catch (error) {
            console.error('Error completing invitation:', error);
            const errorMsg = i18n.language === 'ar'
                ? 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى'
                : 'Sorry, something went wrong. Please try again';
            alert(errorMsg);
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
                <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
                    {t('loading')}
                </p>
            </div>
        );
    }

    // After loading, if invitation is not found, show error
    if (!invitation) {
        return (
            <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}>
                <h2 style={{ marginBottom: '1rem' }}>{t('invitation_not_found')}</h2>
                <button onClick={() => navigate('/')} className="btn btn-primary">{t('nav_home')}</button>
            </div>
        );
    }

    const { author = {}, title, requests = [], joined = [], chat = [], image, location, date, time, description, guestsNeeded, meetingStatus = 'planning', genderPreference, ageRange, privacy, invitedUserIds = [], mediaType, customVideo, videoThumbnail, customImage, restaurantImage } = invitation;

    // Determine media to display
    const isVideo = mediaType === 'video' && customVideo;
    const mediaUrl = isVideo
        ? customVideo
        : customImage || restaurantImage || image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800';
    const thumbnailUrl = isVideo ? videoThumbnail : mediaUrl;
    const isHost = author?.id === currentUser?.id;
    const isAccepted = joined.includes(currentUser.id);
    const isPending = requests.includes(currentUser.id);
    const spotsLeft = guestsNeeded - joined.length;

    // Check if user is invited to private invitation
    const isInvited = privacy === 'private' && invitedUserIds.includes(currentUser?.id);

    // Determine current user's specific status for the timeline
    // If global meeting is completed, everyone sees completed.
    // Otherwise, see personal status (on_way/arrived) or default to 'planning'.
    const myStatus = invitation?.participantStatus?.[currentUser?.id] || (meetingStatus === 'completed' ? 'completed' : 'planning');

    // Check eligibility based on gender and age
    const checkEligibility = () => {
        // Business accounts cannot join invitations
        if (userProfile?.accountType === 'business') {
            return { eligible: false, reason: t('business_cannot_join', { defaultValue: 'Business accounts cannot join invitations' }) };
        }

        // Check gender preference
        if (genderPreference && genderPreference !== 'any' && currentUser.gender !== genderPreference) {
            return { eligible: false, reason: t('gender_mismatch') };
        }

        // Check age range preference
        if (ageRange && currentUser.age) {
            const [minAge, maxAge] = ageRange.split('-').map(Number);
            const userAge = currentUser.age;
            if (userAge < minAge || userAge > maxAge) {
                return { eligible: false, reason: `${t('age_range_preference')}: ${ageRange}` };
            }
        }

        return { eligible: true };
    };
    const eligibility = checkEligibility();


    return (
        <div className="page-container details-page" style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
            {/* Elegant Header */}
            <header className="app-header sticky-header-glass" style={{ position: 'sticky', top: 0, zIndex: 100, padding: '0 1rem', flexShrink: 0 }}>
                <button className="back-btn" onClick={() => navigate('/')} aria-label="Go back">
                    <FaArrowRight style={i18n.language === 'ar' ? {} : { transform: 'rotate(180deg)' }} />
                </button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px', margin: '0 auto' }}>{title}</h3>
                    <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '700' }}>
                        {isHost ? t('manage_invitation') : (isAccepted ? t('comments_title') : t('invitation_details'))}
                    </span>
                </div>
                <button className="back-btn" onClick={handleShare} aria-label="Share" style={{ background: 'transparent', border: 'none' }}>
                    <FaShareAlt style={{ color: 'var(--text-white)', opacity: 0.8 }} />
                </button>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '100px' }} className="details-scroll-area">
                {/* Invitation Summary Section - PUBLIC */}
                <div style={{ padding: '1.25rem' }}>
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                        border: '1px solid var(--border-color)',
                        boxShadow: 'var(--shadow-premium)'
                    }}>
                        <div style={{ height: '180px', position: 'relative' }}>
                            {isVideo ? (
                                <VideoPlayer
                                    videoUrl={mediaUrl}
                                    thumbnail={thumbnailUrl}
                                    autoPlay={false}
                                    style={{ width: '100%', height: '100%', borderRadius: '0' }}
                                />
                            ) : (
                                <img src={mediaUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )}
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, var(--bg-card))', pointerEvents: 'none' }}></div>

                            {/* Edit Image Icon - Host Only */}
                            {isHost && meetingStatus !== 'completed' && (
                                <>
                                    <input
                                        type="file"
                                        id="imageUpload"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={async (e) => {
                                            const file = e.target.files[0];
                                            if (!file) return;

                                            // Create a temporary URL for preview
                                            const reader = new FileReader();
                                            reader.onload = async (event) => {
                                                const imageUrl = event.target.result;

                                                // For now, we'll use the data URL directly
                                                // In production, you'd upload to Firebase Storage
                                                const result = await updateInvitationImage(id, imageUrl);

                                                if (result.success) {
                                                    alert(t('image_updated'));
                                                    window.location.reload();
                                                } else {
                                                    alert(result.error);
                                                }
                                            };
                                            reader.readAsDataURL(file);
                                        }}
                                    />
                                    <button
                                        onClick={() => document.getElementById('imageUpload').click()}
                                        style={{
                                            position: 'absolute',
                                            top: '10px',
                                            right: '10px',
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            background: 'rgba(0, 0, 0, 0.7)',
                                            border: '2px solid white',
                                            color: 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            fontSize: '1.1rem',
                                            transition: 'all 0.3s',
                                            backdropFilter: 'blur(10px)',
                                            zIndex: 10
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.9)';
                                            e.currentTarget.style.transform = 'scale(1.1)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.7)';
                                            e.currentTarget.style.transform = 'scale(1)';
                                        }}
                                    >
                                        <FaImage />
                                    </button>
                                </>
                            )}
                        </div>
                        <div style={{ padding: '1.25rem', marginTop: '-50px', position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: '900' }}>{title}</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                    <div style={{ background: 'var(--primary)', color: 'white', padding: '4px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.7rem', fontWeight: '800' }}>
                                        {t(`type_${invitation.type?.toLowerCase().replace(/ /g, '_')}`, { defaultValue: invitation.type || 'Other' })}
                                    </div>
                                    {!isHost && (
                                        <button
                                            style={{
                                                background: currentUser.following.includes(author.id)
                                                    ? 'rgba(139, 92, 246, 0.15)'
                                                    : 'rgba(255,255,255,0.1)',
                                                border: `2px solid ${currentUser.following.includes(author.id) ? 'var(--primary)' : 'rgba(255,255,255,0.3)'}`,
                                                color: currentUser.following.includes(author.id)
                                                    ? 'var(--primary)'
                                                    : 'white',
                                                padding: '6px 12px',
                                                borderRadius: '8px',
                                                fontSize: '0.7rem',
                                                fontWeight: '900',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                textShadow: currentUser.following.includes(author.id)
                                                    ? 'none'
                                                    : '0 1px 2px rgba(0,0,0,0.5)'
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (currentUser?.isGuest) {
                                                    navigate('/login');
                                                } else {
                                                    toggleFollow(author.id);
                                                }
                                            }}
                                        >
                                            {currentUser.following.includes(author.id)
                                                ? t('following_user')
                                                : t('follow_user')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Meeting Journey Timeline */}
                            {(isHost || isAccepted || (invitation.pendingChangeApproval && invitation.pendingChangeApproval.includes(currentUser.id))) && (
                                <div style={{
                                    background: 'rgba(30, 41, 59, 0.4)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '1rem',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    marginBottom: '1.5rem',
                                    position: 'relative'
                                }}>
                                    {/* NEW: Time Change Approval Bar */}
                                    {invitation.pendingChangeApproval && invitation.pendingChangeApproval.includes(currentUser.id) && (
                                        <div style={{ background: 'var(--primary)', padding: '12px', borderRadius: '12px', marginBottom: '1rem', animation: 'pulse 2s infinite' }}>
                                            <p style={{ fontSize: '0.8rem', fontWeight: '800', color: 'white', marginBottom: '8px' }}>{t('time_change_warning')}</p>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={() => approveNewTime(id)} style={{ flex: 1, padding: '6px', background: 'white', color: 'var(--primary)', border: 'none', borderRadius: '6px', fontWeight: '800', fontSize: '0.75rem' }}>{t('approve_time')}</button>
                                                <button onClick={() => rejectNewTime(id)} style={{ flex: 1, padding: '6px', background: 'rgba(0,0,0,0.2)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', fontSize: '0.75rem' }}>{t('withdraw')}</button>
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', paddingBottom: '5px' }}>
                                        {/* Horizontal Background Line */}
                                        <div style={{ position: 'absolute', top: '15px', left: '10%', right: '10%', height: '2px', background: 'rgba(255,255,255,0.1)', zIndex: 1 }}></div>
                                        {/* Active Progress Line */}
                                        <div style={{
                                            position: 'absolute', top: '15px', left: '10%',
                                            width: myStatus === 'planning' ? '0%' : (myStatus === 'on_way' ? '40%' : '80%'),
                                            height: '2px', background: 'var(--primary)', boxShadow: '0 0 8px var(--primary)', zIndex: 2, transition: 'width 0.8s ease'
                                        }}></div>

                                        <div style={{ textAlign: 'center', zIndex: 5, flex: 1 }}>
                                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', margin: '0 auto 5px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🖊️</div>
                                            <span style={{ fontSize: '0.6rem', fontWeight: '800', color: 'white' }}>{t('status_planning')}</span>
                                        </div>
                                        <div style={{ textAlign: 'center', zIndex: 5, flex: 1 }}>
                                            <div style={{
                                                width: '28px', height: '28px', borderRadius: '50%', margin: '0 auto 5px',
                                                background: myStatus === 'on_way' || myStatus === 'arrived' || myStatus === 'completed' ? 'var(--primary)' : 'var(--bg-card)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', fontSize: '1rem'
                                            }}>🚗</div>
                                            <span style={{ fontSize: '0.6rem', fontWeight: '800', color: myStatus === 'on_way' ? 'var(--primary)' : 'var(--text-muted)' }}>{t('status_on_way')}</span>
                                        </div>
                                        <div style={{ textAlign: 'center', zIndex: 5, flex: 1 }}>
                                            <div style={{
                                                width: '28px', height: '28px', borderRadius: '50%', margin: '0 auto 5px',
                                                background: myStatus === 'arrived' || myStatus === 'completed' ? 'var(--primary)' : 'var(--bg-card)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', fontSize: '1rem'
                                            }}>📍</div>
                                            <span style={{ fontSize: '0.6rem', fontWeight: '800', color: myStatus === 'arrived' ? 'var(--primary)' : 'var(--text-muted)' }}>{t('status_arrived')}</span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '1rem', flexWrap: 'wrap' }}>
                                        {((isAccepted || isHost) && myStatus === 'planning') && (
                                            <button
                                                onClick={() => handleUpdateStatus('on_way')}
                                                disabled={isUpdatingStatus}
                                                className="btn btn-primary"
                                                style={{ flex: 1, padding: '8px', fontSize: '0.75rem', borderRadius: '8px', opacity: isUpdatingStatus ? 0.7 : 1, cursor: isUpdatingStatus ? 'not-allowed' : 'pointer' }}
                                            >
                                                {isUpdatingStatus ? '...' : t('im_on_way')}
                                            </button>
                                        )}
                                        {((isAccepted || isHost) && myStatus === 'on_way') && (
                                            <button
                                                onClick={() => handleUpdateStatus('arrived')}
                                                disabled={isUpdatingStatus}
                                                className="btn btn-secondary"
                                                style={{ flex: 1, padding: '8px', fontSize: '0.75rem', borderRadius: '8px', opacity: isUpdatingStatus ? 0.7 : 1, cursor: isUpdatingStatus ? 'not-allowed' : 'pointer' }}
                                            >
                                                {isUpdatingStatus ? '...' : t('ive_arrived')}
                                            </button>
                                        )}
                                        {isHost && (
                                            <>
                                                {/* Complete Meeting Button with Location Verification */}
                                                {myStatus !== 'completed' && (
                                                    <button
                                                        onClick={handleCompleteInvitation}
                                                        disabled={isCompleting}
                                                        className="btn btn-primary"
                                                        style={{
                                                            flex: 1,
                                                            padding: '8px',
                                                            fontSize: '0.75rem',
                                                            borderRadius: '8px',
                                                            background: isCompleting ? 'var(--bg-secondary)' : 'var(--luxury-gold)',
                                                            border: 'none',
                                                            color: 'black',
                                                            opacity: isCompleting ? 0.6 : 1,
                                                            cursor: isCompleting ? 'not-allowed' : 'pointer'
                                                        }}
                                                    >
                                                        <FaCheckCircle /> {isCompleting ? locationStatus : t('complete_meeting')}
                                                    </button>
                                                )}

                                                {/* Cancel Invitation Button */}
                                                {myStatus !== 'completed' && (
                                                    <button
                                                        onClick={() => setShowCancellationModal(true)}
                                                        className="btn btn-danger"
                                                        style={{
                                                            flex: 1,
                                                            padding: '8px',
                                                            fontSize: '0.7rem',
                                                            borderRadius: '8px',
                                                            background: '#7f1d1d',
                                                            border: '1px solid #ef4444',
                                                            color: 'white',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '4px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <FaTrash /> {t('cancel_invitation')}
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        {myStatus === 'completed' && !invitation.rating && (
                                            <div style={{
                                                width: '100%',
                                                background: 'rgba(255,255,255,0.03)',
                                                padding: '1.5rem',
                                                borderRadius: '15px',
                                                border: '1px solid var(--luxury-gold)',
                                                marginTop: '1rem'
                                            }}>
                                                <h4 style={{ color: 'var(--luxury-gold)', fontSize: '0.9rem', marginBottom: '1rem', textAlign: 'center' }}>
                                                    {t('rate_experience')}
                                                </h4>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                                                    {[1, 2, 3, 4, 5].map(star => (
                                                        <button
                                                            key={star}
                                                            onClick={() => submitRating(id, { stars: star })}
                                                            style={{ background: 'transparent', border: 'none', fontSize: '1.8rem', cursor: 'pointer', color: 'rgba(255,255,255,0.2)' }}
                                                            onMouseEnter={(e) => e.target.style.color = 'var(--luxury-gold)'}
                                                            onMouseLeave={(e) => e.target.style.color = 'rgba(255,255,255,0.2)'}
                                                        >
                                                            <FaStar />
                                                        </button>
                                                    ))}
                                                </div>
                                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                                    {t('earn_rep_points')}
                                                </p>
                                            </div>
                                        )}

                                        {myStatus === 'completed' && invitation.rating && (
                                            <div style={{ flex: 1, textAlign: 'center', color: 'var(--luxury-gold)', fontWeight: '800', fontSize: '0.8rem', padding: '15px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '12px', width: '100%' }}>
                                                {t('meeting_completed')}
                                            </div>
                                        )}
                                        {myStatus === 'completed' && !invitation.rating && isHost && (
                                            <div style={{ flex: 1, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '10px' }}>
                                                {t('waiting_ratings')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                                {description || t('no_description')}
                            </p>


                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                    <FaMapMarkerAlt style={{ color: 'var(--luxury-gold)' }} />
                                    <span>{location}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                    <FaCalendarAlt style={{ color: 'var(--primary)' }} />
                                    <span>{date ? new Date(date).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US') : t('soon')}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                    <FaClock style={{ color: 'var(--accent)' }} />
                                    <span>{time || '20:30'}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                    <FaUsers style={{ color: 'var(--secondary)' }} />
                                    <span>{t('guests_needed', { count: guestsNeeded })}</span>

                                    {/* Edit Guest Count Button - Inline */}
                                    {isHost && meetingStatus !== 'completed' && (
                                        <button
                                            onClick={async () => {
                                                const minGuests = joined.length;
                                                const currentGuests = guestsNeeded;

                                                const newCount = prompt(
                                                    t('enter_new_guest_count', { min: minGuests }),
                                                    currentGuests
                                                );

                                                if (!newCount) return;

                                                const newGuestCount = parseInt(newCount);

                                                if (isNaN(newGuestCount) || newGuestCount < minGuests) {
                                                    alert(t('invalid_guest_count', { min: minGuests }));
                                                    return;
                                                }

                                                const result = await updateGuestCount(id, newGuestCount, minGuests, currentUser);

                                                if (result.success) {
                                                    if (result.isFull) {
                                                        alert(t('guest_count_updated_full', { count: result.notifiedUsers }));
                                                    } else {
                                                        alert(t('guest_count_updated'));
                                                    }
                                                    window.location.reload();
                                                } else {
                                                    alert(result.error);
                                                }
                                            }}
                                            style={{
                                                background: 'rgba(59, 130, 246, 0.2)',
                                                border: '1px solid var(--primary)',
                                                borderRadius: '50%',
                                                width: '24px',
                                                height: '24px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                color: 'var(--primary)',
                                                fontSize: '0.7rem',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'var(--primary)';
                                                e.currentTarget.style.color = 'white';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                                                e.currentTarget.style.color = 'var(--primary)';
                                            }}
                                        >
                                            <FaEdit />
                                        </button>
                                    )}
                                </div>
                                {distance !== null && (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#10b981' }}>
                                            <span>📏</span>
                                            <span style={{ fontWeight: '700' }}>{distance.toFixed(1)} km</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#10b981' }}>
                                            <span>⏱️</span>
                                            <span style={{ fontWeight: '700' }}>~{travelTime} {t('minutes')}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Share Buttons - at bottom of card */}
                    <ShareButtons
                        title={title}
                        description={description}
                        url={window.location.href}
                        type="invitation"
                    />

                    {/* Join Button if NOT member */}
                    {!isHost && !isAccepted && (
                        <div style={{ marginTop: '1.5rem' }}>
                            <button
                                className={`btn btn-block ${!eligibility.eligible ? 'btn-disabled' : (isPending ? 'btn-outline' : 'btn-primary')}`}
                                onClick={async () => {
                                    if (currentUser?.isGuest) {
                                        navigate('/login');
                                        return;
                                    }
                                    if (!eligibility.eligible) return;
                                    if (isPending) {
                                        console.log('🔴 Canceling request for invitation:', id);
                                        cancelRequest(id);
                                    } else {
                                        console.log('🟢 Requesting to join invitation:', id);
                                        console.log('Current user:', currentUser);
                                        await requestToJoin(id);
                                        console.log('✅ Request sent successfully');
                                        alert(t('join_request_sent'));
                                        // Force a full page reload to ensure the home page renders correctly
                                        window.location.href = '/';
                                    }
                                }}
                                disabled={!eligibility.eligible && !currentUser?.isGuest}
                                style={{
                                    height: '60px',
                                    fontSize: '1.1rem',
                                    background: !eligibility.eligible && !currentUser?.isGuest ? 'rgba(55, 65, 81, 0.8)' : undefined,
                                    color: !eligibility.eligible && !currentUser?.isGuest ? '#d1d5db' : undefined,
                                    cursor: !eligibility.eligible && !currentUser?.isGuest ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {currentUser?.isGuest ? t('login_to_join', { defaultValue: 'Login to Join' }) : (!eligibility.eligible ? (eligibility.reason || t('invite_unavailable')) : (isPending ? t('joined_btn') : t('join_btn')))}
                            </button>
                            <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.8rem' }}>
                                {!eligibility.eligible ? eligibility.reason : (isPending ? t('request_sent_waiting') : t('join_to_chat'))}
                            </p>
                        </div>
                    )}
                </div>

                {/* PRIVATE SECTION: Management & Chat */}
                {(isHost || isAccepted) ? (
                    <>
                        {/* Who's Coming - Social Trust Feature */}
                        <MembersList
                            joined={joined}
                            author={author}
                            joinedMembersData={joinedMembersData}
                            spotsLeft={spotsLeft}
                        />


                        {/* Embedded Group Chat */}
                        {(isAccepted || isHost) && (
                            <div style={{
                                padding: '0 1.25rem',
                                marginBottom: '1.5rem',
                                opacity: meetingStatus === 'completed' ? 0.6 : 1,
                                pointerEvents: meetingStatus === 'completed' ? 'none' : 'auto'
                            }}>
                                <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-white)', fontWeight: '800' }}>
                                    {t('group_chat_title', { defaultValue: 'Group Chat' })}
                                </h4>
                                <GroupChat collectionPath={`invitations/${id}/messages`} />
                            </div>
                        )}

                        {/* Host Management */}
                        {isHost && requests.length > 0 && (
                            <div ref={joinRequestsRef} style={{ padding: '0 1.25rem', marginBottom: '2rem' }}>
                                <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800' }}>
                                    <FaUsers /> {t('pending_requests', { count: requests.length })}
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {requests.map(userId => {
                                        const requester = requestersData[userId] || { name: t('loading'), avatar: '' };
                                        return (
                                            <div key={userId} style={{ padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <img
                                                        src={requester.avatar}
                                                        alt={requester.name}
                                                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                                                    />
                                                    <span style={{ fontWeight: '700' }}>{requester.name}</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button onClick={() => approveUser(id, userId)} className="btn btn-primary btn-sm">{t('accept')}</button>
                                                    <button onClick={() => rejectUser(id, userId)} className="btn btn-outline btn-sm">{t('reject')}</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                    </>
                ) : (
                    /* Locked Chat Message for non-members */
                    <div style={{ padding: '2rem 1.25rem', textAlign: 'center' }}>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-color)' }}>
                            <FaPaperPlane style={{ fontSize: '2rem', color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.2 }} />
                            <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t('chat_closed')}</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('members_only_chat')}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Cancellation Modal */}
            <CancellationModal
                isOpen={showCancellationModal}
                onClose={() => setShowCancellationModal(false)}
                onConfirm={handleCancelInvitation}
                invitationTitle={title}
            />

            {/* Copied Toast Notification */}
            {showCopiedToast && (
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
                    <span>{t('link_copied', { defaultValue: 'Link copied!' })}</span>
                </div>
            )}
        </div>
    );
};

export default InvitationDetails;
