import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import NewReportModal from '../components/NewReportModal';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  FaArrowRight,
  FaFlag,
  FaChevronRight,
  FaBan,
  FaVolumeMute } from
'react-icons/fa';
import { getSafeAvatar } from '../utils/avatarUtils';
import { getMutualFollowers } from '../utils/followHelpers';
import {
  canViewerSeeProfileFriends,
  canViewerSeeProfileInvitationHistory,
} from '../utils/profileSectionVisibility';
import UserAvatar from '../components/UserAvatar';
import { goToLogin } from '../utils/goToLogin';
import { getHostedInvitationDetailsPath } from '../utils/hostedInvitationRoutes';
import { resolveInviteCategory } from '../utils/inviteCategory';
import { getInvitationListThumbSrc } from '../utils/privateInvitationCoverImage';
import { isHiddenFromConsumerApp } from '../utils/consumerSearchExclusions';
import { isConsumerDirectoryMember } from '../utils/consumerDirectory';
import { mapPublicProfileDocToUserShape } from '../utils/publicProfileMap';
import { isAdminIdentity } from '../utils/adminAccess';
import { asUidArray, toggleUserBlock, toggleUserMute } from '../utils/userSocialLists';
import { checkCanMessage } from '../utils/chatHelpers';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { isUserAvailableForPrivateInvite, getPrivateInviteeDisplayName } from '../utils/privateInviteAvailability';
import { normalizeDiningPersona, normalizeFirstDatePlaceHint, normalizeJoinReasons, getJoinReasonLabel } from '../constants/privateProfileOptions';
import { resolveProfileCoverUrl, normalizeProfileGallery } from '../utils/profileGallery';
import ProfileGalleryEditor from '../components/profile/ProfileGalleryEditor';
import { useInvitationArchives } from '../hooks/useInvitationArchives';
import { sortInvitationsByDateDesc, formatArchiveDateRange } from '../utils/invitationExpiry';
import './UserProfile.tailwind.css';
import { AppText } from "../components/base";

const PROFILE_SECTION_PREVIEW_MAX = 3;

const DEFAULT_COVER =
'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&h=600&fit=crop';

/**
 * Expected Firestore `users` document shape (schema reference + demo defaults).
 * `gender` and `invitePreference` are used for backend invitation filtering only — never shown in UI.
 */
const MOCK_USER_PROFILE = {
  uid: 'demo-user-1',
  displayName: 'Samer',
  ageRange: '25-30',
  avatarUrl:
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop',
  coverPhotoUrl: DEFAULT_COVER,
  diningPersona: ['☕ Coffee', '🚶 Walking', '🍿 Cinema', '🍣 Sushi', '🎨 Art'],
  joinReasons: ['new_friends', 'fun_hangouts'],
  shortBio: 'Always down for a spontaneous bite. Coffee first, then we pick the spot together.',
  gender: 'female',
  invitePreference: 'female_only'
};

function ProfilePersonaSkeleton() {
  return (
    <div className="animate-pulse pb-24">
      <div className="user-profile-persona-cover user-profile-skeleton-block" />
      <div className="-mt-12 flex justify-center">
        <div className="h-24 w-24 rounded-full border-4 border-[var(--bg-body)] user-profile-skeleton-block" />
      </div>
      <div className="mx-auto mt-14 h-7 w-48 rounded-lg user-profile-skeleton-block" />
      <div className="mx-auto mt-5 flex justify-center gap-10 px-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-16 rounded-lg user-profile-skeleton-block" />
        ))}
      </div>
      <div className="mx-4 mt-6 flex gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 flex-1 rounded-2xl user-profile-skeleton-block" />
        ))}
      </div>
    </div>
  );
}

function ProfileHero({
  profile,
  isOnline,
  t,
  i18n,
  onBack,
  menuOpen,
  onToggleMenu,
  menuPanel,
  showMenu
}) {
  const { displayName, ageRange, avatarUrl, coverPhotoUrl } = profile;
  const headline = ageRange ? `${displayName}, ${ageRange}` : displayName;

  return (
    <>
      <div className="user-profile-hero relative">
        <div className="user-profile-persona-cover overflow-hidden">
          <img
            src={coverPhotoUrl}
            alt=""
            className="user-profile-persona-cover__img"
            onError={(e) => {
              e.currentTarget.src = DEFAULT_COVER;
            }} />
          <div className="user-profile-cover-gradient pointer-events-none absolute inset-0" aria-hidden />
        </div>

        <div className="user-profile-cover-toolbar absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
          {showMenu ?
          <div className="relative">
            <button
              type="button"
              className="user-profile-float-btn"
              onClick={onToggleMenu}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label={t('more_options', 'More options')}>
              ⋮
            </button>
            {menuOpen ? menuPanel : null}
          </div> :
          <span className="w-10" aria-hidden />}

          <button
            type="button"
            className="user-profile-float-btn"
            onClick={onBack}
            aria-label={t('go_back', 'Go back')}>
            <FaArrowRight style={i18n.language === 'ar' ? {} : { transform: 'rotate(180deg)' }} />
          </button>
        </div>

        <div className="user-profile-avatar-wrap absolute -bottom-12 left-0 right-0 flex justify-center">
          <div className="relative">
            <img
              src={avatarUrl}
              alt={displayName}
              className="user-profile-persona-avatar"
              onError={(e) => {
                e.currentTarget.src = getSafeAvatar(null);
              }} />
            {isOnline ?
            <AppText as="span"
              className="user-profile-online-dot"
              title="Online" /> :
            null}
          </div>
        </div>
      </div>

      <div className="mt-14 px-4 text-center">
        <AppText as="h2" className="user-profile-headline" dir="ltr">
          {headline}
        </AppText>
      </div>
    </>
  );
}

/**
 * Maps a Firestore user doc to the profile view model.
 * Hidden fields are retained on the object for server-side / invite filtering logic.
 */
function mapUserDocToProfileModel(firestoreUser) {
  if (!firestoreUser) return { ...MOCK_USER_PROFILE, acceptsPrivateInvite: true };

  const acceptsPrivateInvite = isUserAvailableForPrivateInvite(firestoreUser);
  const diningPersona = normalizeDiningPersona(
    firestoreUser.diningPersona ||
    firestoreUser.foodVibes ||
    firestoreUser.tasteTags
  );

  return {
    uid: firestoreUser.id,
    displayName:
    firestoreUser.display_name ||
    firestoreUser.displayName ||
    firestoreUser.name ||
    MOCK_USER_PROFILE.displayName,
    ageRange:
    firestoreUser.ageRange ||
    firestoreUser.ageCategory ||
    formatAgeRange(firestoreUser.age) ||
    '',
    avatarUrl: getSafeAvatar(firestoreUser),
    coverPhotoUrl:
    resolveProfileCoverUrl(firestoreUser) || DEFAULT_COVER,
    profileGallery: normalizeProfileGallery(firestoreUser.profileGallery),
    directoryCoverIndex: firestoreUser.directoryCoverIndex ?? 0,
    diningPersona,
    joinReasons: normalizeJoinReasons(firestoreUser.joinReasons),
    firstDatePlaceHint: normalizeFirstDatePlaceHint(firestoreUser.firstDatePlaceHint),
    shortBio: String(firestoreUser.bio || firestoreUser.shortBio || '').slice(0, 150),
    acceptsPrivateInvite,
    gender: firestoreUser.gender ?? null,
    invitePreference:
    firestoreUser.invitePreference ??
    firestoreUser.privateInvitationPreference ??
    'any'
  };
}

function formatAgeRange(age) {
  const n = Number(age);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 25) return '18-24';
  if (n < 30) return '25-29';
  if (n < 35) return '30-34';
  if (n < 45) return '35-44';
  return '45+';
}

function ProfileDetailsSection({ profile, galleryTheme }) {
  const { t } = useTranslation();
  const {
    uid,
    diningPersona,
    joinReasons = [],
    firstDatePlaceHint,
    shortBio,
    acceptsPrivateInvite,
    profileGallery,
    directoryCoverIndex
  } = profile;

  const showJoinReasons = joinReasons.length > 0;
  const showTasteSection = diningPersona.length > 0;

  return (
    <div className="user-profile-details mt-8 space-y-8 px-5">
      {showJoinReasons ?
      <div className="user-profile-section">
        <AppText as="h3" className="user-profile-section__title">
          {t('join_reason_title', 'What are you looking for here?')}
        </AppText>
        <div className="flex flex-col gap-3">
          {joinReasons.map((id) =>
          <AppText as="div"
            key={id}
            className="user-profile-reason-card">
            {getJoinReasonLabel(id, t)}
          </AppText>
          )}
        </div>
      </div> :
      null}

      {showTasteSection ?
      <div className="user-profile-section">
        <AppText as="h3" className="user-profile-section__title">
          {t('private_profile_taste_title', 'Vibe & Interests')}
        </AppText>
        <div className="flex flex-wrap gap-2" dir="ltr">
          {diningPersona.map((tag, index) =>
          <AppText as="span"
            key={`${tag}-${index}`}
            className={`user-profile-taste-pill ${index === 0 ? 'user-profile-taste-pill--highlight' : ''}`}>
            {tag}
          </AppText>
          )}
        </div>
      </div> :
      null}

      {firstDatePlaceHint ?
      <AppText as="p" className="user-profile-meetup-hint">
        <AppText as="span" className="user-profile-meetup-hint__label">
          {t('private_meetup_spot_title', 'Ideal meetup spot')}:{' '}
        </AppText>
        {firstDatePlaceHint}
      </AppText> :
      null}

      {acceptsPrivateInvite && uid ?
      <div className="user-profile-section user-profile-gallery">
        <ProfileGalleryEditor
          userId={uid}
          slots={profileGallery}
          directoryCoverIndex={directoryCoverIndex}
          editable={false}
          theme={galleryTheme} />
      </div> :
      null}

      {shortBio ?
      <AppText as="p" className="user-profile-bio">
        {shortBio}
      </AppText> :
      null}
    </div>
  );
}

const InvitationListItem = ({ inv, navigate, t, showToast }) => {
  const isArchived = Boolean(inv.isArchived);
  const isGuestArchive = isArchived && inv.role === 'guest';
  const handleOpen = () => {
    if (isArchived) {
      if (showToast) {
        const dates = formatArchiveDateRange(inv, t);
        const roleLabel = isGuestArchive
          ? t('invitation_archive_guest_badge', 'Joined as guest')
          : t('invitation_archive_host_badge', 'Hosted');
        showToast(`${inv.title || t('invitation', 'Invitation')}\n${dates}\n${roleLabel}`, 'info');
      }
      return;
    }
    navigate(
      inv.privacy === 'private' ? getHostedInvitationDetailsPath(inv) : `/invitation/${inv.id}`
    );
  };

  return (
    <div
      className={`profile-invitation-item profile-invitation-item--lg${isArchived ? ' profile-invitation-item--archived' : ''}`}
      onClick={handleOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpen();
        }
      }}>
      
        <img
        className="profile-invitation-item__thumb"
        src={getInvitationListThumbSrc(inv)}
        onError={(e) => {
          e.target.src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400';
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
          inv.privacy === 'private' ?
          <AppText as="span" className="profile-invitation-item__badge profile-invitation-item__badge--private">
                        {t(resolveInviteCategory(inv) === 'private' ? 'type_private' : 'type_social')}
                    </AppText> :

          <AppText as="span" className="profile-invitation-item__badge profile-invitation-item__badge--public">
                        {t('type_public', 'Public')}
                    </AppText>
          }
            </div>
            <AppText as="span" className="profile-invitation-item__date">
                {isArchived ? formatArchiveDateRange(inv, t) : inv.date ? inv.date.split('T')[0] : t('soon')}
            </AppText>
        </div>
        {!isArchived && <FaChevronRight style={{ opacity: 0.3, flexShrink: 0 }} />}
    </div>);

};

const UserProfile = () => {
  const { t, i18n } = useTranslation();
  const { userId } = useParams();
  const navigate = useNavigate();
  const { invitations, currentUser, toggleFollow, submitReport } = useInvitations();
  const { userProfile, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { isDark } = useTheme();
  const galleryTheme = isDark ? 'dark' : 'light';

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [socialBusy, setSocialBusy] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('public');
  const [invitationsExpanded, setInvitationsExpanded] = useState(false);
  const [networkUsers, setNetworkUsers] = useState([]);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [mutualFriendsCount, setMutualFriendsCount] = useState(0);
  const [stayOnProfileAfterBlock, setStayOnProfileAfterBlock] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [canChat, setCanChat] = useState(false);
  const [canChatLoading, setCanChatLoading] = useState(true);

  const profileModel = useMemo(() => mapUserDocToProfileModel(user), [user]);
  const isAdminViewer = isAdminIdentity(currentUser, userProfile);

  useEffect(() => {
    setStayOnProfileAfterBlock(false);
    setLoading(true);
    setUser(null);
    setActiveTab('public');
    setInvitationsExpanded(false);
  }, [userId]);

  useEffect(() => {
    setInvitationsExpanded(false);
  }, [activeTab]);

  useEffect(() => {
    if (authLoading || !userId) return;

    const myUid = currentUser?.uid || currentUser?.id;
    if (myUid && userId === myUid) {
      navigate('/profile', { replace: true });
      return;
    }

    let cancelled = false;

    const fetchUser = async () => {
      try {
        const publicSnap = await getDoc(doc(db, 'public_profiles', userId));
        const publicDoc = publicSnap.exists() ?
        { id: publicSnap.id, ...publicSnap.data() } :
        null;

        if (publicDoc && !isConsumerDirectoryMember(publicDoc, null) && !isAdminViewer) {
          if (!cancelled) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        let userData = publicDoc ?
        { id: userId, ...mapPublicProfileDocToUserShape(publicDoc), ...publicDoc } :
        null;

        if (currentUser && !currentUser.isGuest) {
          try {
            const userSnap = await getDoc(doc(db, 'users', userId));
            if (userSnap.exists()) {
              const fullUser = { id: userSnap.id, ...userSnap.data() };
              if (isHiddenFromConsumerApp(fullUser) && !isAdminViewer) {
                if (!cancelled) {
                  setUser(null);
                  setLoading(false);
                }
                return;
              }
              userData = { ...(userData || { id: userId }), ...fullUser };
            }
          } catch (usersErr) {
            console.warn('UserProfile: users doc unavailable, using public projection', usersErr);
          }
        }

        if (!cancelled) {
          setUser(userData);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchUser();
    return () => {
      cancelled = true;
    };
  }, [userId, currentUser, authLoading, navigate, isAdminViewer]);

  useEffect(() => {
    const myUid = currentUser?.uid || currentUser?.id;
    if (!userId || !user || authLoading) {
      setCanChat(false);
      setCanChatLoading(false);
      return;
    }
    if (currentUser?.isGuest || !myUid || user.role === 'business') {
      setCanChat(false);
      setCanChatLoading(false);
      return;
    }

    let cancelled = false;
    setCanChatLoading(true);

    checkCanMessage(
      myUid,
      userId,
      currentUser?.following || [],
      user?.following || []
    ).
    then((allowed) => {
      if (!cancelled) {
        setCanChat(allowed);
        setCanChatLoading(false);
      }
    }).
    catch(() => {
      if (!cancelled) {
        setCanChat(false);
        setCanChatLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userId, user, currentUser?.following, currentUser?.uid, currentUser?.id, currentUser?.isGuest, authLoading]);

  useEffect(() => {
    if (!userId || !user) return;
    const myUid = currentUser?.uid || currentUser?.id;
    if (!canViewerSeeProfileFriends(user, myUid)) {
      setNetworkUsers([]);
      setMutualFriendsCount(0);
      setNetworkLoading(false);
      return;
    }

    const fetchNetwork = async () => {
      setNetworkLoading(true);
      try {
        const followingIds = user.following || [];
        const mutual = await getMutualFollowers(userId, followingIds);
        const myFollowingIds = currentUser?.following || [];
        setMutualFriendsCount(mutual.length);
        setNetworkUsers(
          mutual.map((u) => ({
            ...u,
            isFollowedByMe: myFollowingIds.includes(u.id),
          }))
        );
      } catch (e) {
        /* ignore */
      }
      setNetworkLoading(false);
    };
    fetchNetwork();
  }, [userId, user, currentUser]);

  const handleToggleFollow = (targetUserId, e) => {
    e.stopPropagation();
    if (currentUser?.isGuest || !currentUser) {
      goToLogin();
      return;
    }
    setNetworkUsers((prev) =>
    prev.map((u) =>
    u.id === targetUserId ? { ...u, isFollowedByMe: !u.isFollowedByMe } : u
    )
    );
    toggleFollow(targetUserId);
  };

  const { hostArchives, guestArchives } = useInvitationArchives(userId);

  const publicInvitations = useMemo(() => {
    const active = invitations.filter(
      (inv) => inv.author?.id === userId && inv.privacy !== 'private'
    );
    const activeIds = new Set(active.map((inv) => inv.id));
    const archived = hostArchives.filter(
      (inv) => !activeIds.has(inv.id) && (inv.kind === 'public' || inv.privacy === 'public')
    );
    return [...active, ...archived].sort(sortInvitationsByDateDesc);
  }, [invitations, userId, hostArchives]);

  const joinedInvitations = useMemo(() => {
    const active = invitations.filter(
      (inv) =>
      inv.joined?.includes(userId) && (
      inv.privacy !== 'private' ||
      inv.invitedFriends?.includes(currentUser?.id || currentUser?.uid))
    );
    const activeIds = new Set(active.map((inv) => inv.id));
    const archivedGuest = guestArchives.filter(
      (inv) => !activeIds.has(inv.id) && (inv.kind === 'public' || inv.privacy === 'public')
    );
    return [...active, ...archivedGuest].sort(sortInvitationsByDateDesc);
  }, [invitations, userId, guestArchives, currentUser?.id, currentUser?.uid]);

  if (loading) {
    return (
      <div
        id="user-profile-root"
        className="user-profile-page relative mx-auto min-h-dvh max-w-md pb-[calc(var(--nav-height,70px)+env(safe-area-inset-bottom,0px))]">
        <ProfilePersonaSkeleton />
      </div>);
  }

  if (!user) {
    return (
      <div className="page-container px-6 py-16 text-center">
                <AppText as="h2" className="mb-4 text-xl font-bold">{t('user_not_found')}</AppText>
                <button type="button" onClick={() => navigate('/')} className="btn btn-primary">
                    {t('nav_home')}
                </button>
            </div>);

  }

  const myUid = currentUser?.uid || currentUser?.id;
  const showInvitationHistory = canViewerSeeProfileInvitationHistory(user, myUid);
  const showFriendsList = canViewerSeeProfileFriends(user, myUid);
  const blockedIds = asUidArray(userProfile?.blockedUserIds);
  const mutedIds = asUidArray(userProfile?.mutedUserIds);
  const theirBlockedIds = asUidArray(user?.blockedUserIds);
  const theyBlockedMe = Boolean(myUid && theirBlockedIds.includes(myUid));
  const iBlockedThem = Boolean(myUid && blockedIds.includes(userId));
  const iMutedThem = Boolean(myUid && mutedIds.includes(userId));
  const isFollowing = currentUser?.following?.includes(userId);
  const canBeFollowed = user.privacySettings?.allowFollowing !== false;
  const canPrivateInvite = profileModel.acceptsPrivateInvite && userProfile?.role !== 'business';
  const displayName = getPrivateInviteeDisplayName(user) || profileModel.displayName;
  const activeList = activeTab === 'joined' ? joinedInvitations : publicInvitations;
  const displayedInvitations = invitationsExpanded ?
  activeList :
  activeList.slice(0, PROFILE_SECTION_PREVIEW_MAX);

  const handlePrivateInvite = () => {
    if (!canPrivateInvite) {
      showToast(
        t(
          'private_invite_social_only_toast',
          'This member only accepts social/public invites — private invites are turned off.'
        ),
        'info'
      );
      return;
    }
    if (currentUser?.isGuest || !currentUser) {
      goToLogin({ returnPath: `/profile/${userId}` });
      return;
    }
    const confirmed = window.confirm(
      t('private_send_invite_confirm', {
        name: displayName,
        defaultValue: `Send a Private Invite invitation to ${displayName}?`
      })
    );
    if (!confirmed) return;
    navigate('/create-private', {
      state: {
        preselectedInvitee: {
          id: user.id,
          display_name: displayName,
          name: displayName,
          photo_url: user.photo_url || user.photoURL || user.avatar || '',
          photoURL: user.photoURL || user.photo_url || user.avatar || '',
          avatar: user.avatar || user.photo_url || user.photoURL || '',
          gender: user.gender || null,
          availableForPrivateInvite: user.availableForPrivateInvite
        }
      }
    });
  };

  const profileMenuPanel = myUid && !currentUser?.isGuest ?
  <div className="user-profile-menu-panel" role="menu">
    <button
      type="button"
      role="menuitem"
      className="user-profile-menu-item"
      onClick={() => {
        setMenuOpen(false);
        setIsReportModalOpen(true);
      }}>
      <FaFlag aria-hidden />
      {t('profile_action_report', 'Report')}
    </button>
    <button
      type="button"
      role="menuitem"
      className="user-profile-menu-item"
      disabled={socialBusy}
      onClick={() => {
        setMenuOpen(false);
        handleToggleMute();
      }}>
      <FaVolumeMute aria-hidden />
      {iMutedThem ? t('unmute_user', 'Unmute') : t('mute_user', 'Mute')}
    </button>
    <button
      type="button"
      role="menuitem"
      className="user-profile-menu-item user-profile-menu-item--danger"
      disabled={socialBusy}
      onClick={() => {
        setMenuOpen(false);
        handleToggleBlock();
      }}>
      <FaBan aria-hidden />
      {iBlockedThem ? t('unblock_user', 'Unblock') : t('block_user', 'Block')}
    </button>
  </div> :
  null;

  const handleToggleMute = async () => {
    if (currentUser?.isGuest || !myUid) {
      goToLogin();
      return;
    }
    if (socialBusy) return;
    setSocialBusy(true);
    try {
      await toggleUserMute(myUid, userId, !iMutedThem);
      showToast(
        iMutedThem ? t('user_unmuted_toast', 'User unmuted.') : t('user_muted_toast', 'User muted for invitations and messages.'),
        'success'
      );
    } catch (e) {
      showToast(t('error_update_settings', 'Something went wrong.'), 'error');
    } finally {
      setSocialBusy(false);
    }
  };

  const handleToggleBlock = async () => {
    if (currentUser?.isGuest || !myUid) {
      goToLogin();
      return;
    }
    if (socialBusy) return;
    if (iBlockedThem) {
      setSocialBusy(true);
      try {
        await toggleUserBlock(myUid, userId, false);
        setStayOnProfileAfterBlock(false);
        showToast(t('user_unblocked_toast', 'User unblocked.'), 'success');
      } catch (e) {
        showToast(t('error_update_settings', 'Something went wrong.'), 'error');
      } finally {
        setSocialBusy(false);
      }
      return;
    }
    if (
    !window.confirm(
      t('block_user_confirm', 'Block this user? You will no longer see their profile, posts, or invitations.')
    ))
    {
      return;
    }
    setSocialBusy(true);
    try {
      await toggleUserBlock(myUid, userId, true);
      setStayOnProfileAfterBlock(true);
      showToast(
        t('user_blocked_stay_on_page_toast', 'User blocked. You can keep viewing this page until you leave.'),
        'success'
      );
    } catch (e) {
      showToast(t('error_update_settings', 'Something went wrong.'), 'error');
    } finally {
      setSocialBusy(false);
    }
  };

  const blockedShell = (message, action = null) =>
  <div
    id="user-profile-root"
    className="user-profile-page relative mx-auto min-h-dvh max-w-md px-5 pb-[calc(var(--nav-height,70px)+env(safe-area-inset-bottom,0px))] pt-8">
    <button
      type="button"
      className="user-profile-float-btn mb-8"
      onClick={() => navigate(-1)}
      aria-label={t('go_back', 'Go back')}>
      <FaArrowRight style={i18n.language === 'ar' ? {} : { transform: 'rotate(180deg)' }} />
    </button>
    <div className="py-12 text-center">
      <AppText as="p" className="mb-4 user-profile-empty-text">{message}</AppText>
      {action}
    </div>
  </div>;


  if (myUid && !currentUser?.isGuest && theyBlockedMe) {
    return blockedShell(
      t('profile_unavailable_blocked_you', 'This profile is unavailable.'),
      <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
                {t('nav_home')}
            </button>
    );
  }

  if (myUid && !currentUser?.isGuest && iBlockedThem && !stayOnProfileAfterBlock) {
    return blockedShell(
      t('you_blocked_this_user', 'You blocked this user.'),
      <button
        type="button"
        className="btn btn-primary"
        disabled={socialBusy}
        onClick={handleToggleBlock}>
        
                {t('unblock_user', 'Unblock')}
            </button>
    );
  }

  return (
    <div
      id="user-profile-root"
      className="user-profile-page relative mx-auto min-h-dvh max-w-md pb-[calc(var(--nav-height,70px)+env(safe-area-inset-bottom,0px))]"
      onClick={() => menuOpen && setMenuOpen(false)}>
      <ProfileHero
        profile={profileModel}
        isOnline={Boolean(user.isOnline)}
        t={t}
        i18n={i18n}
        onBack={() => navigate(-1)}
        menuOpen={menuOpen}
        onToggleMenu={(e) => {
          e.stopPropagation();
          setMenuOpen((open) => !open);
        }}
        menuPanel={profileMenuPanel}
        showMenu={Boolean(myUid && !currentUser?.isGuest)} />

      <div className="user-profile-stats mt-5 flex justify-center gap-10 px-4 text-sm">
        <div className="flex flex-col items-center text-center">
          <AppText as="span" className="user-profile-stat-value user-profile-stat-value--reputation">
            {user.reputation || 0} ⭐
          </AppText>
          <AppText as="span" className="user-profile-stats__label">{t('reputation_points')}</AppText>
        </div>
        {showInvitationHistory ? (
          <>
            <div className="flex flex-col items-center text-center">
              <AppText as="span" className="user-profile-stat-value">
                {publicInvitations.length} 💌
              </AppText>
              <AppText as="span" className="user-profile-stats__label">{t('invitations')}</AppText>
            </div>
            <div className="flex flex-col items-center text-center">
              <AppText as="span" className="user-profile-stat-value">
                {joinedInvitations.length} 🤝
              </AppText>
              <AppText as="span" className="user-profile-stats__label">{t('joined')}</AppText>
            </div>
          </>
        ) : null}
        {showFriendsList ? (
          <div className="flex flex-col items-center text-center">
            <AppText as="span" className="user-profile-stat-value">
              {mutualFriendsCount} 👥
            </AppText>
            <AppText as="span" className="user-profile-stats__label">{t('friends', 'Friends')}</AppText>
          </div>
        ) : null}
      </div>

      <div className="user-profile-actions mt-6 flex px-4" onClick={(e) => e.stopPropagation()}>
        {userProfile?.role !== 'business' && canBeFollowed ?
        <button
          type="button"
          onClick={() => {
            if (currentUser?.isGuest || !currentUser) {
              goToLogin();
              return;
            }
            toggleFollow(userId);
          }}
          className={`user-profile-action user-profile-action--follow ${isFollowing ? 'is-following' : ''}`}>
          {isFollowing ? `✔️ ${t('following')}` : t('follow')}
        </button> :
        null}
        {currentUser?.isGuest ?
        <button
          type="button"
          onClick={() => goToLogin({ returnPath: `/profile/${userId}` })}
          className="user-profile-action user-profile-action--message">
          💬 {t('message')}
        </button> :
        canChat && !canChatLoading && user?.role !== 'business' ?
        <button
          type="button"
          onClick={() => navigate(`/chat/${userId}`)}
          className="user-profile-action user-profile-action--message">
          💬 {t('message')}
        </button> :
        null}
        {canPrivateInvite ?
        <button
          type="button"
          onClick={handlePrivateInvite}
          className="user-profile-action user-profile-action--invite">
          💌 {t('user_directory_send_dating_invite', 'Private invite')}
        </button> :
        null}
      </div>

      <ProfileDetailsSection profile={profileModel} galleryTheme={galleryTheme} />

      <div className="space-y-5 px-5 pb-24" onClick={(e) => e.stopPropagation()}>
        {stayOnProfileAfterBlock && iBlockedThem &&
        <AppText as="p" className="user-profile-block-banner">
          {t(
            'block_grace_banner',
            'This person is blocked. You can keep viewing this page; the simplified blocked view will show when you open their profile again.'
          )}
        </AppText>
        }

        {isReportModalOpen &&
        <NewReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          reportType="user"
          targetId={user.id}
          targetName={user.name}
          onSubmit={submitReport} />
        }

        {showInvitationHistory ? (
        <div className="user-profile-extra-section">
          <AppText as="h3" className="user-profile-section__heading">
            📋 {t('invitation_history', 'Invitation History')}
          </AppText>
          <div className="user-profile-tabs mb-4">
            <button
              type="button"
              onClick={() => setActiveTab('public')}
              className={`user-profile-tab ${activeTab === 'public' ? 'is-active' : ''}`}>
              {t('stats_public')} ({publicInvitations.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('joined')}
              className={`user-profile-tab ${activeTab === 'joined' ? 'is-active' : ''}`}>
              {t('stats_joined')} ({joinedInvitations.length})
            </button>
          </div>
          <div
            className="user-profile-invitation-list"
            role="region"
            aria-label={t('invitation_history', 'Invitation History')}>
            {displayedInvitations.map((inv) =>
            <InvitationListItem key={inv.id} inv={inv} navigate={navigate} t={t} showToast={showToast} />
            )}
            {activeList.length === 0 &&
            <AppText as="p" className="py-8 text-center user-profile-empty-text">{t('nothing_to_show')}</AppText>
            }
          </div>
          {activeList.length > PROFILE_SECTION_PREVIEW_MAX && !invitationsExpanded &&
          <button
            type="button"
            onClick={() => setInvitationsExpanded(true)}
            className="user-profile-more-btn mt-3">
            {t('view_more', 'View More')} (+{activeList.length - PROFILE_SECTION_PREVIEW_MAX})
          </button>
          }
        </div>
        ) : null}

        {showFriendsList ? (
        <div className="user-profile-extra-section">
          <AppText as="h3" className="user-profile-section__heading">👥 {t('friends', 'Friends')}</AppText>
          {networkLoading ?
          <div className="flex justify-center py-6">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-neutral-600 border-t-violet-400" />
          </div> :
          networkUsers.length === 0 ?
          <AppText as="p" className="py-4 text-center text-sm user-profile-empty-text">
            {t('no_friends_yet', 'No friends yet')}
          </AppText> :
          <>
            <div className="flex flex-col gap-2.5">
              {networkUsers.slice(0, PROFILE_SECTION_PREVIEW_MAX).map((netUser) =>
              <div
                key={netUser.id}
                className="flex cursor-pointer items-center gap-3 py-1"
                onClick={() => navigate(`/profile/${netUser.id}`)}>
                <div
                  className="relative shrink-0"
                  onClick={
                  userProfile?.role !== 'business' &&
                  netUser.id !== (currentUser?.id || currentUser?.uid) ?
                  (e) => handleToggleFollow(netUser.id, e) :
                  undefined
                  }>
                  <UserAvatar
                    user={netUser}
                    alt={netUser.name}
                    style={{ width: 44, height: 44, minWidth: 44, minHeight: 44 }} />
                </div>
                <AppText as="div" className="user-profile-network-name">
                  {netUser.name}
                </AppText>
              </div>
              )}
            </div>
            {networkUsers.length > PROFILE_SECTION_PREVIEW_MAX &&
            <button
              type="button"
              onClick={() => navigate(`/followers/${userId}`, { state: { activeTab: 'mutual' } })}
              className="user-profile-more-btn mt-4">
              {t('view_all', 'View All')} ({networkUsers.length})
            </button>
            }
          </>
          }
        </div>
        ) : null}
      </div>
    </div>);

};

export default UserProfile;