import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheckCircle, FaSearch, FaUserFriends } from 'react-icons/fa';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../context/AuthContext';
import { useInvitations } from '../../../context/InvitationContext';
import { getFollowing } from '../../../utils/followHelpers';
import { isExcludedFromUserDocSearch } from '../../../utils/consumerSearchExclusions';
import { searchAccounts } from '../../../services/accountSearch';
import UserAvatar from '../../UserAvatar';
import LookingForChips from '../../profile/LookingForChips';
import {
  fetchPrivateInviteEligibilityByUserIds,
  isUserAvailableForPrivateInvite,
  mergePrivateInviteEligibility,
  senderFollowsInvitee } from
'../../../utils/privateInviteAvailability';
import { useToast } from '../../../context/ToastContext';
import { AppText, AppTextInput } from "../../base";

const SOCIAL_MAX_GUESTS = 30;
const PRIVATE_MAX_GUESTS = 1;

/**
 * Pick in-app invitees on the preview step (not on the create form).
 */
export default function SocialInvitationInviteePanel({
  invitationId,
  mode = 'private',
  invitedFriendIds = [],
  readOnly = false,
  /** `'create'` on the editor form; `'preview'` on the send step (default). */
  step = 'preview',
  onInvitedFriendsChange,
  className = ''
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { currentUser: authUser, userProfile } = useAuth();
  const { currentUser } = useInvitations();

  const maxGuests = mode === 'dating' ? PRIVATE_MAX_GUESTS : SOCIAL_MAX_GUESTS;
  const selectedIds = Array.isArray(invitedFriendIds) ? invitedFriendIds : [];

  const [mutualFriends, setMutualFriends] = useState([]);
  const [followingIds, setFollowingIds] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [friendSearchResults, setFriendSearchResults] = useState([]);
  const [selectedProfiles, setSelectedProfiles] = useState([]);

  const uid = authUser?.uid || currentUser?.uid || currentUser?.id;

  useEffect(() => {
    let cancelled = false;
    const loadFriends = async () => {
      if (!uid || uid === 'guest') {
        setFriendsLoading(false);
        return;
      }
      setFriendsLoading(true);
      try {
        let followingIds = userProfile?.following || [];
        if (followingIds.length === 0) {
          const userDoc = await getDoc(doc(db, 'users', uid));
          followingIds = userDoc.data()?.following || [];
        }
        setFollowingIds(followingIds);
        const friends = await getFollowing(uid, followingIds);
        let list = friends;
        if (mode === 'dating') {
          const fieldsMap = await fetchPrivateInviteEligibilityByUserIds(friends.map((f) => f.id));
          list = friends.
          map((f) => mergePrivateInviteEligibility(f, fieldsMap)).
          filter((f) => isUserAvailableForPrivateInvite(f));
        }
        if (!cancelled) setMutualFriends(list);
      } catch (e) {
        console.error('InviteePanel friends:', e);
      } finally {
        if (!cancelled) setFriendsLoading(false);
      }
    };
    loadFriends();
    return () => {
      cancelled = true;
    };
  }, [uid, userProfile?.following, mode]);

  useEffect(() => {
    let cancelled = false;
    const ids = selectedIds.filter(Boolean);
    if (!ids.length) {
      setSelectedProfiles([]);
      return undefined;
    }

    (async () => {
      const profiles = [];
      for (const friendId of ids) {
        const fromMutual = mutualFriends.find((f) => f.id === friendId);
        if (fromMutual) {
          profiles.push(fromMutual);
          continue;
        }
        try {
          const snap = await getDoc(doc(db, 'users', friendId));
          if (snap.exists()) {
            profiles.push({
              id: friendId,
              display_name:
              snap.data().display_name ||
              snap.data().displayName ||
              snap.data().name ||
              'User',
              ...snap.data()
            });
          } else {
            profiles.push({ id: friendId, display_name: t('user', 'User') });
          }
        } catch {
          profiles.push({ id: friendId, display_name: t('user', 'User') });
        }
      }
      if (!cancelled) setSelectedProfiles(profiles);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedIds, mutualFriends, t]);

  useEffect(() => {
    const rawQ = friendSearchQuery.trim();
    const searchQ = rawQ.toLowerCase();
    if (!rawQ || rawQ.length < 2 || !uid) {
      setFriendSearchResults([]);
      setFriendSearchLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setFriendSearchLoading(true);
      try {
        const localMatches = mutualFriends.filter((friend) => {
          const name = `${friend.display_name || ''} ${friend.name || ''}`.trim().toLowerCase();
          return name.includes(searchQ);
        });

        const merged = new Map();
        const addCandidate = (id, data) => {
          if (!id || id === uid) return;
          if (mode === 'dating' && !senderFollowsInvitee(followingIds, id)) return;
          if (isExcludedFromUserDocSearch(data)) return;
          if (mode === 'dating') {
            if (!isUserAvailableForPrivateInvite(data)) return;
          } else {
            const role = (data?.role || '').toLowerCase();
            if (role === 'business' || role === 'guest' || data?.isBusiness === true) return;
          }
          const display = data?.display_name || data?.displayName || data?.name || '';
          if (!display) return;
          merged.set(id, {
            id,
            display_name: display,
            name: display,
            photo_url: data?.photo_url || data?.photoURL || data?.avatar || '',
            photoURL: data?.photoURL || data?.photo_url || data?.avatar || '',
            avatar: data?.avatar || data?.photo_url || data?.photoURL || '',
            gender: data?.gender || null,
            availableForPrivateInvite: data?.availableForPrivateInvite,
            role: data?.role,
            isBusiness: data?.isBusiness
          });
        };

        localMatches.forEach((f) => addCandidate(f.id, f));
        const { users } = await searchAccounts(rawQ);
        users.forEach((u) => {
          if (mode === 'dating' && u._type === 'business') return;
          addCandidate(u.id, {
            profileType: u._type === 'business' ? 'business' : u.profileType || 'user',
            role: u.role,
            isBusiness: u.isBusiness,
            availableForPrivateInvite: u.availableForPrivateInvite,
            display_name: u.display_name || u.displayName,
            displayName: u.displayName || u.display_name,
            photoURL: u.photoURL || u.photo_url,
            photo_url: u.photo_url || u.photoURL,
            avatar: u.avatar || u.photoURL || u.photo_url,
            gender: u.gender
          });
        });

        let results = Array.from(merged.values());
        if (mode === 'dating' && results.length) {
          const fieldsMap = await fetchPrivateInviteEligibilityByUserIds(results.map((r) => r.id));
          results = results.
          map((r) => mergePrivateInviteEligibility(r, fieldsMap)).
          filter((r) => isUserAvailableForPrivateInvite(r));
        }

        if (!cancelled) setFriendSearchResults(results);
      } catch (e) {
        console.error('Invitee search failed:', e);
        if (!cancelled) setFriendSearchResults([]);
      } finally {
        if (!cancelled) setFriendSearchLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [friendSearchQuery, uid, mutualFriends, mode, followingIds]);

  const searchQ = friendSearchQuery.trim().toLowerCase();
  const filteredFriends = searchQ ? friendSearchResults : mutualFriends;
  const isAtLimit = selectedIds.length >= maxGuests;

  const datingListEmptyMessage = useMemo(() => {
    if (mode !== 'dating') {
      return mutualFriends.length === 0 ?
      t('follow_people_first', 'Follow people first to invite them') :
      t('no_friends_found');
    }
    if (searchQ) return t('no_friends_found');
    return t('private_no_available_invitees', {
      defaultValue:
      'No one you follow is open to private invites. Follow members who accept Private Invite.'
    });
  }, [mode, mutualFriends.length, searchQ, t]);

  const persistInvitees = useCallback(
    async (nextIds) => {
      onInvitedFriendsChange?.(nextIds);
      if (!invitationId || readOnly) return;
      const rsvps = {};
      nextIds.forEach((id) => {
        rsvps[id] = 'pending';
      });
      try {
        await updateDoc(doc(db, 'social_invitations', invitationId), {
          invitedFriends: nextIds,
          rsvps,
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.error('Failed to save invitees:', e);
      }
    },
    [invitationId, onInvitedFriendsChange, readOnly]
  );

  const toggleFriend = (friendId) => {
    if (readOnly) return;
    if (mode === 'dating' && !senderFollowsInvitee(followingIds, friendId)) {
      showToast(
        t(
          'private_invite_follow_required',
          'Follow this member first to send a private invite.'
        ),
        'info'
      );
      return;
    }
    const current = [...selectedIds];
    if (current.includes(friendId)) {
      persistInvitees(current.filter((id) => id !== friendId));
      return;
    }
    if (mode === 'dating') {
      persistInvitees([friendId]);
      return;
    }
    if (current.length >= maxGuests) return;
    persistInvitees([...current, friendId]);
  };

  const title =
  mode === 'dating' ?
  step === 'create' ?
  t('private_pick_date_create', { defaultValue: 'Who are you inviting?' }) :
  t('select_your_date', 'Select your date') :
  t('invite_friends_on_app', { defaultValue: 'Friends on the app (optional)' });

  const emptyHint =
  mode === 'dating' ?
  step === 'create' ?
  t('private_pick_date_create_hint', {
    defaultValue:
    'Only members who accept private invites appear here (consumer accounts only).'
  }) :
  t('private_pick_date_preview', 'Choose who you are inviting below (optional for external link).') :
  t('social_no_in_app_invitees', 'No in-app guests yet — you can still share externally after sending.');

  return (
    <section className={`social-invitee-panel ${className}`.trim()}>
            <div className="social-invitee-panel__head">
                <AppText as="h3" className="social-invitee-panel__title">
                    <FaUserFriends aria-hidden />
                    {title}
                </AppText>
                {!readOnly ?
        <AppText as="span" className="social-invitee-panel__count">
                        {selectedIds.length}/{maxGuests}
                    </AppText> :
        null}
            </div>

            {selectedProfiles.length > 0 ?
      <ul className="social-invitee-panel__selected" aria-label={t('invited_friends', 'Invited friends')}>
                    {selectedProfiles.map((friend) =>
        <li key={friend.id} className="social-invitee-panel__selected-item">
                            <UserAvatar user={friend} alt="" style={{ width: 40, height: 40 }} />
                            <div className="social-invitee-panel__selected-meta">
                                <AppText as="span" className="social-invitee-panel__selected-name">
                                    {friend.display_name || friend.name || t('user', 'User')}
                                </AppText>
                                <LookingForChips
                  ids={friend.lookingFor}
                  className="social-invitee-panel__looking-for"
                  chipClassName="social-invitee-panel__looking-chip" />
                            </div>
                            {!readOnly ?
          <button
            type="button"
            className="social-invitee-panel__remove"
            onClick={() => toggleFriend(friend.id)}
            aria-label={t('remove', 'Remove')}>
            
                                    ×
                                </button> :
          null}
                        </li>
        )}
                </ul> :

      <AppText as="p" className="social-invitee-panel__empty">{emptyHint}</AppText>
      }

            {!readOnly ?
      <>
                    <div className="social-invitee-panel__search-wrap">
                        <AppTextInput
            type="search"
            className="social-invitee-panel__search"
            placeholder={t('search_friends')}
            value={friendSearchQuery}
            onChange={(e) => setFriendSearchQuery(e.target.value)}
            autoComplete="off" />
          
                        <FaSearch className="social-invitee-panel__search-icon" aria-hidden />
                    </div>

                    {friendsLoading || friendSearchLoading ?
        <AppText as="p" className="social-invitee-panel__loading">{t('loading')}</AppText> :
        filteredFriends.length > 0 ?
        <div className="social-invitee-panel__grid">
                            {filteredFriends.map((friend) => {
            const isSelected = selectedIds.includes(friend.id);
            const isDisabled = !isSelected && isAtLimit;
            return (
              <button
                key={friend.id}
                type="button"
                className={`private-friend-chip${isSelected ? ' private-friend-chip--selected' : ''}${isDisabled ? ' private-friend-chip--disabled' : ''}`}
                onClick={() => !isDisabled && toggleFriend(friend.id)}
                disabled={isDisabled}>
                
                                        {isSelected ?
                <FaCheckCircle
                  className="private-friend-chip__check-icon"
                  aria-hidden /> :

                null}
                                        <UserAvatar
                  user={friend}
                  alt={friend.display_name}
                  style={{ width: 48, height: 48 }} />
                
                                        <AppText as="span" className="private-friend-chip__name">
                                            {friend.display_name?.split(' ')[0]}
                                        </AppText>
                                    </button>);

          })}
                        </div> :

        <AppText as="p" className="social-invitee-panel__empty">{datingListEmptyMessage}</AppText>
        }
                </> :
      null}
        </section>);

}