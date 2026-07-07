import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { FaChevronRight, FaTimes, FaUser, FaStore, FaChartLine, FaGifts, FaEdit, FaSave, FaStar, FaCheckCircle, FaSignOutAlt, FaBirthdayCake, FaQuestionCircle } from 'react-icons/fa';
import { uploadProfilePicture } from '../utils/imageUpload';
import { getMutualFollowers } from '../utils/followHelpers';
import ImageUpload from '../components/ImageUpload';
// Profile Enhancements
import { StatisticsCards, CoverPhoto } from '../components/ProfileEnhancements';
import GiftShieldSection from '../components/gifts/GiftShieldSection';
import { FavoritePlaces } from '../components/ProfileEnhancementsExtended';
import { useTheme } from '../context/ThemeContext';
import { FaSun, FaMoon } from 'react-icons/fa';
import { getSafeAvatar, getGenderBorderColor } from '../utils/avatarUtils';
import { goToLogin } from '../utils/goToLogin';
import { normalizeBusinessTier } from '../utils/businessSubscription';
import { isPrivateInvitationDraft } from '../utils/socialInvitationDraft';
import { getHostedInvitationDetailsPath } from '../utils/hostedInvitationRoutes';
import { resolveInviteCategory } from '../utils/inviteCategory';
import { asUidArray } from '../utils/userSocialLists';
import { getInvitationListThumbSrc } from '../utils/privateInvitationCoverImage';
import PrivateProfileFields from '../components/profile/PrivateProfileFields';
import ProfileGalleryEditor from '../components/profile/ProfileGalleryEditor';
import {
  normalizeProfileGallery,
  normalizeDirectoryCoverIndex,
  buildProfileGallerySavePayload,
  buildProfileViewFromSave,
  mergeProfileSnapshot,
  readProfileMedia,
  mergeProfileMedia,
  resolveProfileCoverUrl } from
'../utils/profileGallery';
import {
  normalizeDiningPersona,
  normalizeInvitePreference,
  normalizeFirstDatePlaceHint,
  normalizeJoinReasons,
  getJoinReasonLabel,
  readInvitePreferenceForForm,
  validatePrivateInviteProfileFields,
} from
'../constants/privateProfileOptions';
import { normalizeLookingFor } from '../constants/personalInviteCategories';
import {
  isUserOpenToDating,
  normalizeOpenToDating,
  syncLookingForWithOpenToDating,
} from '../utils/openToDating';
import { buildDefaultProfileMediaPatch } from '../constants/defaultProfileMedia';
import { getPurchaseCredits, getSavedCredits } from '../utils/walletCredits';
import LookingForChips from '../components/profile/LookingForChips';
import { readFavoritePlaces, mergeProfilePreserveFavoritePlaces, pickFavoritePlaces } from '../utils/favoritePlacesUtils';
import { useInvitationArchives } from '../hooks/useInvitationArchives';
import { sortInvitationsByDateDesc, formatArchiveDateRange, isPublicInvitationExpiredForArchive } from '../utils/invitationExpiry';
import '../pages/SettingsPages.css';
import { AppText, AppTextInput } from "../components/base";

const InvitationListItem = ({ inv, navigate, t, showToast }) => {
  const isArchived = Boolean(inv.isArchived);
  const isGuestArchive = isArchived && inv.role === 'guest';
  const targetPath =
  inv.privacy === 'private' ? getHostedInvitationDetailsPath(inv) : `/invitation/${inv.id}`;

  const handleArchivedClick = () => {
    if (!showToast) return;
    const dates = formatArchiveDateRange(inv, t);
    const roleLabel = isGuestArchive
      ? t('invitation_archive_guest_badge', 'Joined as guest')
      : t('invitation_archive_host_badge', 'Hosted');
    showToast(
      `${inv.title || t('invitation', 'Invitation')}\n${dates}\n${roleLabel}`,
      'info'
    );
  };

  return (
    <div
      className={`profile-invitation-item${isArchived ? ' profile-invitation-item--archived' : ''}`}
      onClick={() => {
        if (isArchived) handleArchivedClick();
        else navigate(targetPath);
      }}
      role={isArchived ? 'button' : 'button'}
      tabIndex={0}>
      
        <img
        className="profile-invitation-item__thumb"
        src={getInvitationListThumbSrc(inv)}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src =
          'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400';
        }}
        alt={inv.title} />
      
        <div className="profile-invitation-item__content">
            <div className="profile-invitation-item__title-row">
                <AppText as="h4" className="profile-invitation-item__title">{inv.title}</AppText>
                {isArchived ?
          <>
                    <AppText as="span" className="profile-invitation-item__badge profile-invitation-item__badge--archived">
                        {t('invitation_archived_badge', 'Archived')}
                    </AppText>
                    {isGuestArchive ?
            <AppText as="span" className="profile-invitation-item__badge profile-invitation-item__badge--private">
                        {t('invitation_archive_guest_badge', 'Guest')}
                    </AppText> :
            null}
                  </> :
          isPrivateInvitationDraft(inv) ?
          <AppText as="span" className="profile-invitation-item__badge profile-invitation-item__badge--draft">
                        {t('invitation_draft_badge', { defaultValue: 'Draft' })}
                    </AppText> :
          inv.privacy === 'private' ?
          <AppText as="span" className="profile-invitation-item__badge profile-invitation-item__badge--private">
                        {t(resolveInviteCategory(inv) === 'private' ? 'type_private' : 'type_social')}
                    </AppText> :

          <AppText as="span" className="profile-invitation-item__badge profile-invitation-item__badge--public">{t('type_public', 'Public')}</AppText>
          }
            </div>
            <AppText as="span" className="profile-invitation-item__date">
              {isArchived ? formatArchiveDateRange(inv, t) : inv.date ? inv.date.split('T')[0] : 'Today'}
            </AppText>
        </div>
        {!isArchived && <FaChevronRight style={{ opacity: 0.3, flexShrink: 0 }} />}
    </div>);

};

const Profile = () => {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { currentUser, updateProfile, invitations, privateInvitations, restaurants, updateRestaurant, toggleFollow, deleteInvitation } = useInvitations();
  const { signOut, userProfile, loading } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  /** UI authority for cover + gallery — not overwritten by Firestore cache races. */
  const [profileMedia, setProfileMedia] = useState(() =>
  readProfileMedia(userProfile || currentUser)
  );
  const profileMediaRef = useRef(profileMedia);
  profileMediaRef.current = profileMedia;

  const [activeTab, setActiveTab] = useState('public');
  const [isSaving, setIsSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mutualFriendsCount, setMutualFriendsCount] = useState(0);
  const [visibilitySaving, setVisibilitySaving] = useState('');
  const isOwnProfile = true;

  // Redirect guests to login - DISABLED this redirect because we want to show a guest-specific profile view
  // useEffect(() => {
  //     if (userProfile?.accountType === 'guest' || userProfile?.role === 'guest') {
  //         goToLogin();
  //     }
  // }, [userProfile, navigate]);

  // Redirect business accounts to business profile (wait for uid; replace to avoid history junk)
  useEffect(() => {
    if (!userProfile?.isBusiness || !currentUser?.uid) return;
    navigate(`/business/${currentUser.uid}`, { replace: true });
  }, [userProfile?.isBusiness, currentUser?.uid, navigate]);

  // Real-time listener for user profile updates (stats, etc.)
  const [realtimeUser, setRealtimeUser] = useState(userProfile || currentUser);

  useEffect(() => {
    if (!currentUser?.uid || !userProfile || isEditing) return;
    setRealtimeUser((prev) =>
    mergeProfilePreserveFavoritePlaces(prev, mergeProfileSnapshot(prev, userProfile))
    );
    setProfileMedia((prev) => mergeProfileMedia(prev, userProfile));
  }, [currentUser?.uid, userProfile, isEditing]);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const currentData = userProfile || currentUser;

    if (!isEditing) {
      const media = mergeProfileMedia(profileMediaRef.current, currentData);
      setFormData({
        name: currentData.display_name || currentData.displayName || currentData.name || '',
        bio: currentData.bio || '',
        avatar: getSafeAvatar(currentData),
        interests: currentData.interests || [],
        gender: currentData.gender || 'male',
        age: currentData.age || 25,
        ageCategory: currentData.ageCategory || '',
        phone: currentData.phone || '',
        diningPersona: normalizeDiningPersona(currentData.diningPersona),
        invitePreference: readInvitePreferenceForForm(currentData),
        firstDatePlaceHint: normalizeFirstDatePlaceHint(currentData.firstDatePlaceHint),
        joinReasons: normalizeJoinReasons(currentData.joinReasons),
        lookingFor: normalizeLookingFor(currentData.lookingFor, {
          includeDating: true
        }),
        openToDating: isUserOpenToDating(currentData),
        profileGallery: media.profileGallery,
        directoryCoverIndex: media.directoryCoverIndex,
        cover_photo: media.cover_photo || ''
      });
    }
  }, [currentUser?.uid, isEditing, userProfile]);

  // Mutual friends count (both users follow each other).
  useEffect(() => {
    if (!currentUser?.uid) return;

    const followingIds =
      realtimeUser?.following ||
      userProfile?.following ||
      currentUser?.following ||
      [];

    let cancelled = false;
    getMutualFollowers(currentUser.uid, followingIds).then((mutual) => {
      if (!cancelled) {
        setMutualFriendsCount(mutual.length);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid, currentUser?.following, userProfile?.following, realtimeUser?.following]);

  // Logout handler
  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };



  const [formData, setFormData] = useState({
    name: userProfile?.display_name || userProfile?.displayName || currentUser?.name || currentUser?.displayName || '',
    bio: userProfile?.bio || '',
    avatar: getSafeAvatar(userProfile || currentUser),
    interests: userProfile?.interests || [],
    gender: userProfile?.gender || 'male',
    age: userProfile?.age || 18,
    ageCategory: userProfile?.ageCategory || '',
    diningPersona: normalizeDiningPersona(userProfile?.diningPersona),
    invitePreference: readInvitePreferenceForForm(userProfile),
    firstDatePlaceHint: normalizeFirstDatePlaceHint(userProfile?.firstDatePlaceHint),
    joinReasons: normalizeJoinReasons(userProfile?.joinReasons),
    lookingFor: normalizeLookingFor(userProfile?.lookingFor, {
      includeDating: true
    }),
    openToDating: isUserOpenToDating(userProfile),
    profileGallery: normalizeProfileGallery(userProfile?.profileGallery),
    directoryCoverIndex: normalizeDirectoryCoverIndex(userProfile?.directoryCoverIndex),
    cover_photo: userProfile?.cover_photo || ''
  });

  const profileUid = useMemo(
    () => currentUser?.uid || currentUser?.id || userProfile?.uid || userProfile?.id || null,
    [currentUser?.uid, currentUser?.id, userProfile?.uid, userProfile?.id]
  );

  const headerCoverUrl = useMemo(
    () =>
      profileMedia.cover_photo ||
      resolveProfileCoverUrl(realtimeUser) ||
      resolveProfileCoverUrl(userProfile) ||
      resolveProfileCoverUrl(currentUser),
    [
      profileMedia.cover_photo,
      realtimeUser?.cover_photo,
      userProfile?.cover_photo,
      currentUser?.cover_photo
    ]
  );

  const syncedFavoritePlaces = useMemo(
    () => pickFavoritePlaces(realtimeUser, userProfile),
    [
    realtimeUser?.favoritePlaces,
    realtimeUser?.favorite_places,
    userProfile?.favoritePlaces,
    userProfile?.favorite_places]

  );

  const myPostedInvitations = invitations.filter((inv) => inv.author?.id === profileUid);
  const { hostArchives, guestArchives } = useInvitationArchives(profileUid);

  const mergeWithHostArchives = (active, kindFilter) => {
    const activeIds = new Set(active.map((inv) => inv.id));
    const archived = hostArchives.filter(
      (inv) => !activeIds.has(inv.id) && kindFilter(inv)
    );
    return [...active, ...archived].sort(sortInvitationsByDateDesc);
  };

  const publicPosted = useMemo(() => {
    const active = myPostedInvitations.filter((inv) => inv.privacy !== 'private');
    return mergeWithHostArchives(active, (inv) => inv.kind === 'public' || inv.privacy === 'public');
  }, [myPostedInvitations, hostArchives]);

  /** Legacy rows stored in `invitations` with privacy === private */
  const privatePostedLegacy = myPostedInvitations.filter((inv) => inv.privacy === 'private');
  /** Hosted private invites live in `private_invitations`; merge without duplicate ids */
  const hostedFromPrivateColl = (privateInvitations || []).
  filter((inv) => (inv.authorId || inv.author?.id) === profileUid).
  map((inv) => ({ ...inv, privacy: 'private' }));
  const legacyPrivateIds = new Set(privatePostedLegacy.map((i) => i.id));
  const privatePostedActive = [
  ...privatePostedLegacy,
  ...hostedFromPrivateColl.filter((inv) => !legacyPrivateIds.has(inv.id))];

  const privatePosted = useMemo(
    () => mergeWithHostArchives(
      privatePostedActive,
      (inv) => inv.kind === 'private' || inv.kind === 'social' || inv.privacy === 'private'
    ),
    [privatePostedActive, hostArchives]
  );


  const receivedPrivateActive = (privateInvitations || []).
  filter((inv) => {
    const invited = Array.isArray(inv.invitedFriends) ? inv.invitedFriends : [];
    const isInvitee = invited.some((f) => String(f ?? '') === String(profileUid ?? ''));
    const hostId = String(inv.authorId || inv.author?.id || '');
    return (
      isInvitee &&
      hostId !== profileUid && (
      inv.publishedAt || inv.status === 'published'));

  }).
  map((inv) => ({ ...inv, privacy: 'private' }));

  const receivedPrivate = useMemo(() => {
    const activeIds = new Set(receivedPrivateActive.map((inv) => inv.id));
    const archivedGuest = guestArchives.filter(
      (inv) =>
      !activeIds.has(inv.id) &&
      (inv.kind === 'private' || inv.kind === 'social' || inv.privacy === 'private')
    );
    return [...receivedPrivateActive, ...archivedGuest].sort(sortInvitationsByDateDesc);
  }, [receivedPrivateActive, guestArchives]);

  const myJoinedInvitations = useMemo(() => {
    const active = invitations.filter((inv) => inv.joined?.includes(profileUid));
    const activeIds = new Set(active.map((inv) => inv.id));
    const archivedGuest = guestArchives.filter(
      (inv) => !activeIds.has(inv.id) && (inv.kind === 'public' || inv.privacy === 'public')
    );
    return [...active, ...archivedGuest].sort(sortInvitationsByDateDesc);
  }, [invitations, profileUid, guestArchives]);

  // Loading State
  if (loading || !userProfile || !realtimeUser) {
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
                <AppText as="p" style={{ marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {t('loading_profile', 'Loading Profile...')}
                </AppText>
            </div>);

  }

  const currentProfileView = realtimeUser || userProfile;

  // Validate for external links
  const containsExternalLinks = (text) => {
    const urlPattern = /(https?:\/\/|www\.|@[a-zA-Z0-9_]+|instagram\.com|facebook\.com|twitter\.com|tiktok\.com|snapchat\.com)/gi;
    return urlPattern.test(text);
  };



  const getActiveList = () => {
    switch (activeTab) {
      case 'public':return publicPosted;
      case 'private':return [...privatePosted, ...receivedPrivate];
      case 'joined':return myJoinedInvitations;
      default:return [];
    }
  };

  const activeList = getActiveList();

  const canEditProfileVisibility =
    !userProfile?.isGuest &&
    !userProfile?.isDemo &&
    userProfile?.role !== 'business' &&
    !userProfile?.isBusiness;

  const showInvitationHistoryPublic =
    (realtimeUser?.privacySettings || userProfile?.privacySettings)?.showInvitationHistory !== false;
  const showFriendsPublic =
    (realtimeUser?.privacySettings || userProfile?.privacySettings)?.showFriends !== false;

  const handleProfileVisibilityToggle = async (key) => {
    if (!canEditProfileVisibility || visibilitySaving) return;
    const current = realtimeUser?.privacySettings || userProfile?.privacySettings || {};
    const currentlyVisible = current[key] !== false;
    const nextSettings = {
      ...current,
      [key]: !currentlyVisible,
    };
    setVisibilitySaving(key);
    try {
      await updateProfile({ privacySettings: nextSettings });
      setRealtimeUser((prev) =>
        mergeProfilePreserveFavoritePlaces(prev, {
          ...(prev || {}),
          privacySettings: nextSettings,
        })
      );
      showToast(t('profile_visibility_saved', 'Profile visibility updated.'), 'success');
    } catch (err) {
      console.error('Profile visibility update failed:', err);
      showToast(t('admin_failed', 'Failed.'), 'error');
    } finally {
      setVisibilitySaving('');
    }
  };

  const beginProfileEdit = () => {
    const source = realtimeUser || userProfile || currentUser || {};
    const media = readProfileMedia({ ...source, ...profileMedia });
    setFormData((prev) => ({
      ...prev,
      name: source.display_name || source.displayName || source.name || prev.name || '',
      bio: source.bio ?? prev.bio ?? '',
      avatar: getSafeAvatar(source),
      gender: source.gender || prev.gender || 'male',
      age: source.age || prev.age || 25,
      ageCategory: source.ageCategory || prev.ageCategory || '',
      phone: source.phone || prev.phone || '',
      diningPersona: normalizeDiningPersona(source.diningPersona ?? prev.diningPersona),
      invitePreference: readInvitePreferenceForForm(source),
      firstDatePlaceHint: normalizeFirstDatePlaceHint(source.firstDatePlaceHint ?? prev.firstDatePlaceHint),
      joinReasons: normalizeJoinReasons(source.joinReasons ?? prev.joinReasons),
      lookingFor: normalizeLookingFor(source.lookingFor ?? prev.lookingFor, {
        includeDating: true
      }),
      openToDating: isUserOpenToDating(source),
      profileGallery: media.profileGallery,
      directoryCoverIndex: media.directoryCoverIndex,
      cover_photo: media.cover_photo || ''
    }));
    setIsEditing(true);
  };

  const handleSave = async () => {
    const trimmedName = (formData.name || '').trim();
    if (!trimmedName) {
      showToast(i18n.language === 'ar' ?
      t('please_enter_name', { defaultValue: 'Please enter your name' }) :
      'Please enter your name', 'error');
      return;
    }

    if (containsExternalLinks(formData.bio)) {
      showToast(i18n.language === 'ar' ?
      t('no_external_links') :
      '⚠️ External links and social media accounts are not allowed in profile', 'error');
      return;
    }

    const privateInviteCheck = validatePrivateInviteProfileFields({
      invitePreference: formData.invitePreference,
      lookingFor: formData.lookingFor,
    });
    if (!privateInviteCheck.ok) {
      if (privateInviteCheck.code === 'invite_preference_required') {
        showToast(
          t(
            'profile_private_invite_gender_pref_required',
            'Choose who can send you private invites (gender preference).'
          ),
          'error'
        );
      } else {
        showToast(
          t(
            'profile_private_invite_looking_for_required',
            'Select at least one option under Looking for.'
          ),
          'error'
        );
      }
      return;
    }

    setIsSaving(true);
    setUploadProgress(0);

    try {
      let finalAvatar = formData.avatar;
      if (avatarFile && currentUser?.uid) {
        finalAvatar = await uploadProfilePicture(
          avatarFile,
          currentUser.uid,
          (progress) => setUploadProgress(progress)
        );
      }

      const payload = {
        name: trimmedName,
        bio: formData.bio,
        availableForPrivateInvite: true,
        avatar: finalAvatar,
        diningPersona: normalizeDiningPersona(formData.diningPersona),
        firstDatePlaceHint: normalizeFirstDatePlaceHint(formData.firstDatePlaceHint),
        joinReasons: normalizeJoinReasons(formData.joinReasons, {
          includePrivateOnly: true,
        }),
        lookingFor: syncLookingForWithOpenToDating(
          formData.lookingFor,
          normalizeOpenToDating(formData.openToDating)
        ),
        openToDating: normalizeOpenToDating(formData.openToDating),
        invitePreference: normalizeInvitePreference(formData.invitePreference),
      };

      const gallerySave = buildProfileGallerySavePayload(
        formData.profileGallery,
        formData.directoryCoverIndex ?? profileMedia.directoryCoverIndex ?? 0
      );
      payload.profileGallery = gallerySave.profileGallery;
      payload.directoryCoverIndex = gallerySave.directoryCoverIndex;

      const mediaPatch = buildDefaultProfileMediaPatch({
        uid: currentUser?.uid,
        gender: formData.gender || userProfile?.gender,
        openToDating: payload.openToDating,
        lookingFor: payload.lookingFor,
        email: currentUser?.email,
        photo_url: finalAvatar,
        cover_photo: String(formData.cover_photo || profileMedia.cover_photo || '').trim(),
      });
      if (mediaPatch.photo_url) {
        finalAvatar = mediaPatch.photo_url;
        payload.avatar = finalAvatar;
      }
      payload.cover_photo = String(
        mediaPatch.cover_photo ||
          formData.cover_photo ||
          profileMedia.cover_photo ||
          ''
      ).trim();

      await updateProfile(payload);

      const savedView = buildProfileViewFromSave(realtimeUser || userProfile, payload, {
        display_name: trimmedName,
        displayName: trimmedName,
        name: trimmedName,
        avatar: finalAvatar,
        photo_url: finalAvatar
      });
      const nextMedia = readProfileMedia(savedView);
      setProfileMedia(nextMedia);
      setRealtimeUser((prev) =>
      mergeProfilePreserveFavoritePlaces(prev, mergeProfileSnapshot(prev, savedView))
      );
      setFormData((prev) => ({
        ...prev,
        name: trimmedName,
        bio: payload.bio ?? prev.bio,
        avatar: finalAvatar,
        diningPersona: payload.diningPersona ?? prev.diningPersona,
        firstDatePlaceHint: payload.firstDatePlaceHint ?? prev.firstDatePlaceHint,
        joinReasons: payload.joinReasons ?? prev.joinReasons,
        lookingFor: payload.lookingFor ?? prev.lookingFor,
        openToDating: payload.openToDating ?? prev.openToDating,
        invitePreference: payload.invitePreference ?? prev.invitePreference,
        profileGallery: nextMedia.profileGallery,
        directoryCoverIndex: nextMedia.directoryCoverIndex,
        cover_photo: nextMedia.cover_photo || ''
      }));

      setIsEditing(false);
      setAvatarFile(null);
      setUploadProgress(0);

      showToast(
        i18n.language === 'ar' ?
        t('profile_saved', { defaultValue: 'Profile saved' }) :
        'Profile saved',
        'success'
      );
    } catch (e) {
      setIsEditing(true);
      console.error(e);
      showToast(i18n.language === 'ar' ?
      t('failed_save_profile') :
      'Failed to save profile', 'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="profile-shell profile-page">

            <div className="profile-content">

                <div className="personal-view">
                    <div className="profile-header profile-header--consumer">
                        {currentUser?.uid ?
            <CoverPhoto
              userId={currentUser.uid}
              coverPhoto={headerCoverUrl}
              onUpdate={(url) => {
              const nextCover = url || '';
              setProfileMedia((prev) => ({ ...prev, cover_photo: nextCover }));
              setRealtimeUser((prev) => ({ ...(prev || {}), cover_photo: nextCover }));
              setFormData((prev) => ({ ...prev, cover_photo: nextCover }));
              }}
              editable={isEditing} /> :

            null}
                        <div className="profile-header-actions">
                        {/* Help & Support Button */}
                        {isOwnProfile &&
              <button
                className="profile-top-btn"
                onClick={() => navigate('/support')}
                title={t('faq.title', 'Help & Support')}
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                
                                <FaQuestionCircle size={18} />
                            </button>
              }

                        <button onClick={toggleTheme} className="profile-theme-toggle" style={{ color: isDark ? 'var(--luxury-gold)' : 'var(--primary)' }}>
                            {isDark ? <FaSun size={18} /> : <FaMoon size={18} />}
                        </button>
                        </div>

                    <div className="profile-identity" style={{ marginBottom: 'var(--profile-stack-gap)' }}>
                        <div
                className="profile-avatar-edit-row profile-avatar-over-cover"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1rem',
                  flexWrap: 'wrap',
                  marginBottom: '0.5rem'
                }}>
                
                        <div style={{ display: 'inline-block', position: 'relative' }}>
                            {isEditing ?
                  <>
                                    <ImageUpload
                      currentImage={getSafeAvatar(formData)}
                      onImageSelect={setAvatarFile}
                      onImageRemove={() => setAvatarFile(null)}
                      shape="circle"
                      size="large"
                      label={t('change_photo')} />
                    
                                    {uploadProgress > 0 && uploadProgress < 100 &&
                    <div style={{
                      marginTop: '10px',
                      background: 'var(--card-bg)',
                      borderRadius: '10px',
                      padding: '8px 12px',
                      fontSize: '0.85rem'
                    }}>
                                            <div style={{ marginBottom: '5px', color: 'var(--text-secondary)' }}>
                                                {t('uploading_progress')} {Math.round(uploadProgress)}%
                                            </div>
                                            <div style={{
                        height: '4px',
                        background: 'var(--border-color)',
                        borderRadius: '2px',
                        overflow: 'hidden'
                      }}>
                                                <div style={{
                          height: '100%',
                          background: 'var(--primary)',
                          width: `${uploadProgress}%`,
                          transition: 'width 0.3s'
                        }} />
                                            </div>
                                        </div>
                    }
                                </> :

                  <div
                    className="host-avatar-container"
                    style={{
                      width: '100px',
                      height: '100px',
                      margin: '0 auto',
                      border: `3px solid ${getGenderBorderColor(realtimeUser || userProfile)}`,
                      position: 'relative',
                      background: 'var(--hover-overlay)'
                    }}>
                    
                                    <img
                      src={getSafeAvatar(realtimeUser)}
                      alt={formData.name}
                      className="host-avatar"
                      onError={(e) => {
                        if (!e.target.src.includes('ui-avatars.com')) {
                          e.target.src = getSafeAvatar(null);
                        }
                      }} />
                    
                                </div>
                  }
                        </div>

                        {!isEditing && !userProfile?.isGuest &&
                <button
                  type="button"
                  className="ui-btn ui-btn--secondary profile-edit-beside-avatar"
                  onClick={beginProfileEdit}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 700,
                    padding: '10px 16px',
                    borderRadius: '12px',
                    flexShrink: 0
                  }}>
                  
                                <FaEdit size={16} aria-hidden />
                                {t('edit_profile') || 'Edit Profile'}
                            </button>
                }
                        </div>

                        {isEditing ?
              <div className="profile-edit-form">
                                <div className="form-group" style={{ minWidth: 0, width: '100%' }}>
                                    <label className="ui-form-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px', textAlign: 'center', display: 'block' }}>{t('profile_name')}</label>
                                    <AppTextInput type="text" className="ui-form-field" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} style={{ textAlign: 'center', fontSize: '1rem', fontWeight: 800 }} />
                                </div>

                                <div className="form-group" style={{ minWidth: 0, width: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', marginBottom: '5px', gap: '8px' }}>
                                        <label className="ui-form-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>{t('profile_bio')}</label>
                                        <AppText as="span" style={{ fontSize: '0.7rem', color: formData.bio?.length >= 150 ? 'var(--secondary)' : 'var(--text-muted)', flexShrink: 0 }}>{formData.bio?.length || 0} / 150</AppText>
                                    </div>
                                    <AppTextInput as="textarea" className="ui-form-field" value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} placeholder={t('profile_bio_placeholder')} maxLength={150} style={{ textAlign: 'center', fontSize: '0.88rem', minHeight: '72px', resize: 'vertical' }} />
                                </div>

                                <PrivateProfileFields
                  diningPersona={formData.diningPersona}
                  invitePreference={formData.invitePreference}
                  firstDatePlaceHint={formData.firstDatePlaceHint}
                  joinReasons={formData.joinReasons}
                  lookingFor={formData.lookingFor}
                  openToDating={formData.openToDating}
                  showInvitePreference
                  requireInviteFields
                  onChange={({
                    diningPersona,
                    invitePreference,
                    firstDatePlaceHint,
                    joinReasons,
                    lookingFor,
                    openToDating
                  }) =>
                  setFormData((prev) => ({
                    ...prev,
                    diningPersona,
                    invitePreference,
                    firstDatePlaceHint,
                    joinReasons,
                    lookingFor,
                    openToDating
                  }))
                  } />
                
                                {currentUser?.uid ?
                <ProfileGalleryEditor
                  userId={currentUser.uid}
                  slots={formData.profileGallery}
                  directoryCoverIndex={formData.directoryCoverIndex}
                  editable
                  onChange={({ profileGallery, directoryCoverIndex }) => {
                  setFormData((prev) => ({
                    ...prev,
                    profileGallery,
                    directoryCoverIndex
                  }));
                  setProfileMedia((prev) => ({
                    ...prev,
                    profileGallery,
                    directoryCoverIndex
                  }));
                  }} /> :

                null}
                            </div> :

              <>
                                <AppText as="h1" style={{ fontSize: '1.6rem', fontWeight: '900', marginTop: '0.75rem', marginBottom: '0.15rem', color: 'var(--text-main)' }}>{realtimeUser.name}</AppText>
                                <AppText as="p" style={{ color: 'var(--text-muted)', marginBottom: '0.4rem', fontSize: '0.85rem' }}>{realtimeUser.bio || t('active_member')}</AppText>
                                {Array.isArray(realtimeUser.lookingFor) &&
                realtimeUser.lookingFor.length > 0 &&
                <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                            {t('profile_looking_for_title', 'Looking for')}
                                        </div>
                                        <LookingForChips
                    ids={realtimeUser.lookingFor}
                    includeDating
                    className="profile-looking-for-chips"
                    chipClassName="profile-looking-for-chip" />
                                    </div>
                }
                                {Array.isArray(realtimeUser.joinReasons) &&
                realtimeUser.joinReasons.length > 0 &&
                <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                            {t('join_reason_title', 'Reason for Joining')}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                                            {realtimeUser.joinReasons.map((id) =>
                    <AppText as="span"
                    key={id}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '999px',
                      background: 'rgba(139, 92, 246, 0.12)',
                      border: '1px solid rgba(139, 92, 246, 0.28)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: 'var(--text-main)'
                    }}>
                      
                                                    {getJoinReasonLabel(id, t)}
                                                </AppText>
                    )}
                                        </div>
                                    </div>
                }
                                {Array.isArray(realtimeUser.diningPersona) &&
                realtimeUser.diningPersona.length > 0 &&
                <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                            {t('private_profile_taste_title', 'Vibe & Interests')}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                                            {realtimeUser.diningPersona.map((tag) =>
                    <AppText as="span"
                    key={tag}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '999px',
                      background: 'rgba(236, 72, 153, 0.12)',
                      border: '1px solid rgba(236, 72, 153, 0.28)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: 'var(--text-main)'
                    }}>
                      
                                                    {tag}
                                                </AppText>
                    )}
                                        </div>
                                    </div>
                }
                                {realtimeUser.firstDatePlaceHint ?
                <AppText as="p" style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.85rem', textAlign: 'center' }}>
                                        <AppText as="span" style={{ fontWeight: 700 }}>
                                            {t('private_meetup_spot_title', 'Ideal meetup spot')}:{' '}
                                        </AppText>
                                        {realtimeUser.firstDatePlaceHint}
                                    </AppText> :
                null}
                                {profileUid ?
                <ProfileGalleryEditor
                  userId={profileUid}
                  slots={profileMedia.profileGallery}
                  directoryCoverIndex={profileMedia.directoryCoverIndex}
                  editable={false} /> :

                null}
                                {/* Display Gender and Age */}
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '1rem' }}>
                                    <div style={{
                    background: 'color-mix(in srgb, var(--primary) 12%, var(--bg-card))',
                    padding: '6px 12px',
                    borderRadius: '12px',
                    border: '1px solid color-mix(in srgb, var(--primary) 28%, var(--border-color))',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    color: 'var(--text-main)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                                        <AppText as="span">{realtimeUser.gender === 'male' ? '👨' : realtimeUser.gender === 'female' ? '👩' : '👤'}</AppText>
                                        <AppText as="span">{
                      realtimeUser.gender === 'male' ? t('male') :
                      realtimeUser.gender === 'female' ? t('female') :
                      t('non_binary', { defaultValue: 'Other' })
                      }</AppText>
                                    </div>
                                    <div style={{
                    background: 'color-mix(in srgb, var(--stat-reviews) 14%, var(--bg-card))',
                    padding: '6px 12px',
                    borderRadius: '12px',
                    border: '1px solid color-mix(in srgb, var(--stat-reviews) 35%, var(--border-color))',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    color: 'var(--text-main)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                                        <AppText as="span">🎂</AppText>
                                        <AppText as="span">{realtimeUser.ageCategory || (realtimeUser.age ? `${realtimeUser.age} ${t('years')}` : '')}</AppText>
                                    </div>
                                </div>
                            </>
              }

                        {!isEditing &&
              <>
                        <div className="profile-stats" style={{ justifyContent: 'center', gap: '1.25rem', marginTop: '0.5rem' }}>
                            <div
                              className="profile-stat-item"
                              style={{ flex: 'none', cursor: 'pointer' }}
                              onClick={() => navigate('/followers', { state: { activeTab: 'mutual' } })}
                            >
                                <div className="profile-stat-value">{mutualFriendsCount}</div>
                                <div className="profile-stat-label">{t('friends', 'Friends')}</div>
                            </div>
                        </div>

                        {!isEditing && canEditProfileVisibility ? (
                          <div
                            className="ui-card"
                            style={{ marginTop: '1rem', padding: '1rem', textAlign: 'start' }}
                          >
                            <AppText as="h3" className="db-h3" style={{ marginTop: 0, marginBottom: '0.35rem' }}>
                              {t('profile_visibility_section', 'Profile visibility')}
                            </AppText>
                            <AppText as="p" className="db-muted" style={{ fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                              {t(
                                'profile_visibility_section_desc',
                                'Choose what other members see on your public profile.'
                              )}
                            </AppText>
                            <div style={{ display: 'grid', gap: '0.65rem' }}>
                              <div
                                className="notification-item"
                                style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}
                              >
                                <div className="notification-info">
                                  <AppText as="h3" style={{ fontSize: '0.9rem', margin: 0 }}>
                                    {t('show_invitation_history', 'Show invitation history')}
                                  </AppText>
                                  <AppText as="p" style={{ fontSize: '0.78rem', margin: '0.2rem 0 0' }}>
                                    {t(
                                      'show_invitation_history_desc',
                                      'When on, others can see your public invitation history on your profile.'
                                    )}
                                  </AppText>
                                </div>
                                <label className="toggle-switch">
                                  <input
                                    type="checkbox"
                                    checked={showInvitationHistoryPublic}
                                    disabled={visibilitySaving === 'showInvitationHistory'}
                                    onChange={() => handleProfileVisibilityToggle('showInvitationHistory')}
                                  />
                                  <AppText as="span" className="toggle-slider" />
                                </label>
                              </div>
                              <div className="notification-item" style={{ padding: '0.5rem 0' }}>
                                <div className="notification-info">
                                  <AppText as="h3" style={{ fontSize: '0.9rem', margin: 0 }}>
                                    {t('show_friends_list', 'Show friends')}
                                  </AppText>
                                  <AppText as="p" style={{ fontSize: '0.78rem', margin: '0.2rem 0 0' }}>
                                    {t(
                                      'show_friends_list_desc',
                                      'When on, others can see your friends (mutual follows) on your profile.'
                                    )}
                                  </AppText>
                                </div>
                                <label className="toggle-switch">
                                  <input
                                    type="checkbox"
                                    checked={showFriendsPublic}
                                    disabled={visibilitySaving === 'showFriends'}
                                    onChange={() => handleProfileVisibilityToggle('showFriends')}
                                  />
                                  <AppText as="span" className="toggle-slider" />
                                </label>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {/* Subscription & Credits Section */}
                        {!userProfile?.isGuest &&
                <div className="profile-subscription-card" style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div style={{
                      background: 'var(--primary)',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: '800'
                    }}>
                                        {userProfile?.role === 'admin' ?
                      'ADMIN' :
                      userProfile?.role === 'business' ?
                      normalizeBusinessTier(userProfile?.subscriptionTier) === 'paid' ?
                      t('biz_plan_paid_name', 'Paid Business') :
                      t('biz_plan_free_name', 'Free Business') :
                      t('profile_standard_account', 'Standard')}
                                    </div>
                                    <AppText as="span" style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>
                                        {userProfile?.role === 'business' ?
                      t('subscription_plan_label', 'Subscription plan') :
                      t('credits_wallet_heading', 'Credits')}
                                    </AppText>
                                </div>

                                {!userProfile?.isBusiness &&
                  <div className="profile-subscription-quota-card" style={{ width: '100%' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                            {t('purchase_wallet_title', 'Purchase wallet')}
                                        </div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--primary)' }}>
                                            {getPurchaseCredits(userProfile)}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px', marginBottom: '4px' }}>
                                            {t('savings_wallet_title', 'Savings wallet')}
                                        </div>
                                        <div style={{ fontSize: '1rem', fontWeight: '800', color: '#f472b6' }}>
                                            {getSavedCredits(userProfile)}
                                        </div>
                                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.35 }}>
                                            {t(
                        'dine_credits_use_hint',
                        'Purchase wallet: invites, AI, gifts. Savings wallet: gifts received (50% value).'
                      )}
                                        </div>
                                        <button
                      type="button"
                      className="ui-btn ui-btn--ghost"
                      onClick={() => navigate('/settings/credits')}
                      style={{ marginTop: '8px', fontSize: '0.65rem', padding: '2px 8px' }}>
                      
                                            {t('open_dine_credits_wallet', 'Wallet')}
                                        </button>
                                    </div>
                  }

                                {userProfile?.trialExpiry && new Date(userProfile.trialExpiry.seconds * 1000) > new Date() &&
                  <div className="profile-subscription-trial-banner">
                                        {t('trial_ends_label', '✨ Trial Pro Plan Active - Ends:')} {new Date(userProfile.trialExpiry.seconds * 1000).toLocaleDateString(i18n.language, { month: 'long', day: 'numeric', year: 'numeric' })}
                                    </div>
                  }

                                {userProfile?.role === 'business' &&
                  (userProfile?.subscriptionTier || 'free') === 'free' &&
                  <button onClick={() => navigate('/settings/subscription')} className="profile-subscription-upgrade-btn">
                                            {t('upgrade_plan_btn', 'Upgrade plan')}
                                        </button>
                  }
                            </div>
                }

                        {/* Guest Mode Login Prompt */}
                        {userProfile?.isGuest &&
                <div className="ui-prompt">
                                <AppText as="h3" className="ui-prompt__title">{t('guest_welcome_title', { defaultValue: 'Join DineBuddies' })}</AppText>
                                <AppText as="p" className="ui-prompt__desc">{t('guest_profile_desc', { defaultValue: 'Create an account to customize your profile and join events.' })}</AppText>
                                <button type="button" className="ui-btn ui-btn--primary" onClick={() => goToLogin()} style={{ width: '100%', padding: '12px' }}>
                                    {t('login_signup')}
                                </button>
                            </div>
                }
                        </>
              }
                    </div>
                    </div>


                    {/* Plan & Subscription Card - Only show if user has active subscription */}
                    {!isEditing && userProfile?.subscription?.status === 'active' &&
          <div className="premium-plan-card" style={{ padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: 'var(--profile-stack-gap)', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '60px', height: '60px', background: 'var(--luxury-gold)', borderRadius: '50%', filter: 'blur(30px)', opacity: 0.2 }}></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <AppText as="h3" style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <AppText as="span">💳</AppText> {t('my_plan')}
                                </AppText>
                                <AppText as="span" style={{ background: 'color-mix(in srgb, var(--stat-reviews) 18%, var(--bg-card))', color: 'var(--text-main)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '900', border: '1px solid color-mix(in srgb, var(--stat-reviews) 35%, var(--border-color))' }}>
                                    {userProfile?.subscription?.planName || 'PREMIUM'}
                                </AppText>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {userProfile?.subscription?.features?.map((feature, index) =>
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                                        <FaCheckCircle style={{ color: 'var(--primary)' }} />
                                        <AppText as="span">{feature}</AppText>
                                    </div>
              )}
                            </div>
                            <button
              type="button"
              className="ui-btn ui-btn--secondary"
              onClick={() => navigate('/plans')}
              style={{ width: '100%', marginTop: '1rem', padding: '12px', fontSize: '0.85rem' }}>
              
                                {t('manage_subscription')}
                            </button>
                        </div>
          }

                    <div hidden={isEditing}>
                    {/* 📊 STATISTICS CARDS */}
                    <StatisticsCards userId={profileUid} />

                    {/* 🛡️ GIFT SHIELDS */}
                    <GiftShieldSection
                        userId={profileUid}
                        totalSavedCreditsEarned={userProfile?.totalSavedCreditsEarned ?? realtimeUser?.totalSavedCreditsEarned}
                    />
                    </div>

                    <FavoritePlaces
            userId={profileUid}
            readOnly={!isEditing}
            syncedPlaces={syncedFavoritePlaces} />
          

                    {isEditing &&
          <div style={{ display: 'flex', gap: '10px', marginTop: '0.85rem' }}>
                            <button type="button" className="ui-btn ui-btn--primary" onClick={handleSave} disabled={isSaving} style={{ flex: 1 }}>
                                {isSaving ? t('saving') : t('save_btn')}
                            </button>
                            <button
              type="button"
              className="ui-btn ui-btn--ghost"
              onClick={() => {
                setAvatarFile(null);
                setUploadProgress(0);
                setIsEditing(false);
              }}
              disabled={isSaving}
              style={{ flex: 1 }}>
              
                                {t('cancel_btn')}
                            </button>
                        </div>
          }

                    {!isEditing &&
          <>
                    <div className="ui-card">
                        <div className="ui-card-header ui-tabs hide-scrollbar">
                            <button
                  type="button"
                  onClick={() => setActiveTab('public')}
                  className={`ui-tab ${activeTab === 'public' ? 'ui-tab--active' : ''}`}>
                  
                                <AppText as="span">{t('stats_public')}</AppText>
                                <AppText as="span" className="profile-stat-label" style={{ opacity: 0.8 }}>({publicPosted.length})</AppText>
                            </button>
                            <button
                  type="button"
                  onClick={() => setActiveTab('private')}
                  className={`ui-tab ${activeTab === 'private' ? 'ui-tab--active' : ''}`}>
                  
                                <AppText as="span">{t('stats_social')}</AppText>
                                <AppText as="span" className="profile-stat-label" style={{ opacity: 0.8 }}>({privatePosted.length + receivedPrivate.length})</AppText>
                            </button>
                            <button
                  type="button"
                  onClick={() => setActiveTab('joined')}
                  className={`ui-tab ${activeTab === 'joined' ? 'ui-tab--active' : ''}`}>
                  
                                <AppText as="span">{t('stats_joined')}</AppText>
                                <AppText as="span" className="profile-stat-label" style={{ opacity: 0.8 }}>({myJoinedInvitations.length})</AppText>
                            </button>
                        </div>

                        <div className="profile-section-body">
                            {activeTab === 'private' &&
                <>
                                    {/* My Private Posts */}
                                    {privatePosted.length > 0 &&
                  <div style={{ marginBottom: 'var(--profile-stack-gap)' }}>
                                            <div className="profile-meta-row profile-meta-row--sm" style={{ padding: '0 5px' }}>
                                                <AppText as="h4" className="profile-stat-label" style={{ margin: 0 }}>
                                                    {t('my_private_posts', 'My Private Posts')}
                                                </AppText>
                                                <button
                        type="button"
                        className="ui-btn ui-btn--danger-outline"
                        onClick={async () => {
                          if (window.confirm(t('confirm_delete_all_private', 'Are you sure you want to delete all your private invitations?'))) {
                            for (const inv of privatePosted) {
                              const inPrivateColl = (privateInvitations || []).some((p) => p.id === inv.id);
                              await deleteInvitation(inv.id, inPrivateColl);
                            }
                          }
                        }}>
                        
                                                    {t('clear_all', 'Clear All')}
                                                </button>
                                            </div>
                                            {privatePosted.map((inv) =>
                    <InvitationListItem key={inv.id} inv={inv} navigate={navigate} t={t} showToast={showToast} />
                    )}
                                        </div>
                  }

                                    {/* Received Private Invitations */}
                                    {receivedPrivate.length > 0 &&
                  <div style={{ marginBottom: '1rem' }}>
                                            <AppText as="h4" className="profile-stat-label" style={{ marginBottom: '10px', marginLeft: '5px' }}>
                                                {t('received_invitations')}
                                            </AppText>
                                            {receivedPrivate.map((inv) =>
                    <InvitationListItem key={inv.id} inv={inv} navigate={navigate} t={t} showToast={showToast} />
                    )}
                                        </div>
                  }

                                    {privatePosted.length === 0 && receivedPrivate.length === 0 &&
                  <AppText as="p" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            {t('nothing_to_show')}
                                        </AppText>
                  }
                                </>
                }

                            {activeTab !== 'private' &&
                <>
                                    {activeList.map((inv) =>
                  <InvitationListItem key={inv.id} inv={inv} navigate={navigate} t={t} showToast={showToast} />
                  )}

                                    {activeList.length === 0 &&
                  <AppText as="p" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            {t('nothing_to_show')}
                                        </AppText>
                  }
                                </>
                }
                        </div>
                    </div>
                    </>
          }
                </div>
            </div>

        </div>);

};

export default Profile;