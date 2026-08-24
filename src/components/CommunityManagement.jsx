import React, { useState, useEffect } from 'react';
import { FaUsers, FaBan, FaUserShield, FaVolumeMute, FaVolumeUp, FaUnlock } from 'react-icons/fa';
import { getSafeAvatar } from '../utils/avatarUtils';
import UserAvatar from './UserAvatar';
import { useTranslation } from 'react-i18next';
import app from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { createNotification } from '../utils/notificationHelpers';
import { useToast } from '../context/ToastContext';
import { useInvitations } from '../context/InvitationContext';
import { getCallableErrorReason } from '../utils/callableErrorDetails';
import './CommunityManagement.css';
import { AppText } from './base';
import { useConfirm } from '../context/ConfirmContext';

const FUNCTIONS_REGION = 'us-central1';

/**
 * Community moderation only — member list with mute / block / unblock.
 * Business→member messaging was retired: business↔user communication happens
 * solely through the Business Inbox (offers/announcements/support) and Stage
 * rooms, keeping personal chat user↔user.
 */
const CommunityManagement = ({ businessId, businessName, compact = false }) => {
  const profileId = businessId;
  const { showToast } = useToast();
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { getCommunityMembers } = useInvitations();
  const [members, setMembers] = useState([]);
  const [blockedMembers, setBlockedMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moderatingId, setModeratingId] = useState(null);

  useEffect(() => {
    loadMembers();
  }, [profileId]);

  const mapMemberRow = (member) => ({
    id: member.id,
    uid: member.uid || member.id,
    profileType: member.profileType || 'user',
    displayName: member.displayName || 'Member',
    name: member.displayName || 'Member',
    city: member.city || '',
    country: member.country || '',
    email: '',
    avatar: getSafeAvatar({ photo_url: member.avatarUrl }),
    isMuted: member.isMuted === true
  });

  const mapBlockedRow = (member) => ({
    id: member.id,
    uid: member.uid || member.id,
    displayName: member.displayName || 'Member',
    name: member.displayName || 'Member',
    avatar: getSafeAvatar({ photo_url: member.avatarUrl })
  });

  const loadMembers = async () => {
    setLoading(true);
    try {
      const result = await getCommunityMembers(profileId, { includeMembers: true, limit: 200 });
      const membersList = (result?.members || []).
      filter((member) => member.profileHidden !== true).
      map(mapMemberRow);
      const blockedList = (result?.blockedMembers || []).map(mapBlockedRow);

      setMembers(membersList);
      setBlockedMembers(blockedList);
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoading(false);
    }
  };

  const callMembership = async (action, memberId) => {
    const functions = getFunctions(app, FUNCTIONS_REGION);
    const setCommunityMembership = httpsCallable(functions, 'setCommunityMembership');
    return setCommunityMembership({ partnerId: profileId, action, memberId });
  };

  const blockMember = async (memberId) => {
    if (!(await confirm({ message: t('block_member_confirm', 'Block this member? They will be removed and cannot rejoin until unblocked.'), tone: 'danger' }))) {
      return;
    }
    setModeratingId(memberId);
    try {
      const snapshot = members.find((m) => m.id === memberId);
      await callMembership('blockMember', memberId);
      await createNotification({
        userId: memberId,
        type: 'community_blocked',
        title: t('community_blocked_title', 'Removed from community'),
        message: t('community_blocked_message', 'You have been blocked from {{name}}\'s community', { name: businessName || t('this_business', 'this business') }),
        actionUrl: `/business/${profileId}`,
        metadata: { partnerId: profileId }
      });
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      if (snapshot) {
        setBlockedMembers((prev) =>
        prev.some((x) => x.id === memberId) ? prev : [...prev, { ...snapshot, isMuted: false }]
        );
      }
      await loadMembers();
      showToast(t('member_blocked_success', 'Member blocked successfully'), 'success');
    } catch (error) {
      console.error('Error blocking member:', error);
      const reason = getCallableErrorReason(error);
      showToast(reason || t('member_blocked_error', 'Failed to block member'), 'error');
    } finally {
      setModeratingId(null);
    }
  };

  const unblockMember = async (memberId) => {
    setModeratingId(memberId);
    try {
      await callMembership('unblockMember', memberId);
      await loadMembers();
      showToast(t('member_unblocked_success', 'Member unblocked — they can join again'), 'success');
    } catch (error) {
      console.error('Error unblocking member:', error);
      const reason = getCallableErrorReason(error);
      showToast(reason || t('member_unblocked_error', 'Failed to unblock member'), 'error');
    } finally {
      setModeratingId(null);
    }
  };

  const toggleMute = async (member) => {
    const action = member.isMuted ? 'unmuteMember' : 'muteMember';
    const confirmKey = member.isMuted ? 'unmute_member_confirm' : 'mute_member_confirm';
    if (!(await confirm({ message: t(confirmKey, member.isMuted ?
    'Allow this member to write in the group chat again?' :
    'Mute this member? They can read the chat but cannot write or react.'), tone: 'danger' }))) {
      return;
    }
    setModeratingId(member.id);
    try {
      await callMembership(action, member.id);
      await loadMembers();
      showToast(
        member.isMuted ?
        t('member_unmuted_success', 'Member unmuted') :
        t('member_muted_success', 'Member muted in group chat'),
        'success'
      );
    } catch (error) {
      console.error('Error toggling mute:', error);
      const reason = getCallableErrorReason(error);
      showToast(reason || t('member_mute_error', 'Failed to update mute status'), 'error');
    } finally {
      setModeratingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: compact ? '1rem' : '2rem', textAlign: 'center' }}>
                <AppText as="p">{t('loading_members', 'Loading members...')}</AppText>
            </div>);

  }

  return (
    <div className={compact ? 'cm-panel cm-panel--compact' : 'cm-panel'}>
            <div style={{ marginBottom: '1.5rem' }}>
                <AppText as="h3" style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaUserShield />
                    {t('community_management', 'Community Management')}
                </AppText>

                <AppText as="p" style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    {members.length} {t('members_count', 'members')}
                </AppText>
            </div>

            {members.length === 0 ?
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    <FaUsers size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <AppText as="p">{t('no_community_members_yet', 'No community members yet')}</AppText>
                </div> :

      <div className="cm-member-list">
                    {members.map((member) =>
        <div key={member.id} className="cm-member-card">
                            <div className="cm-member-avatar-wrap">
                                <UserAvatar
              user={member}
              alt={member.name}
              style={{ width: 32, height: 32 }} />

                            </div>

                            <div className="cm-member-info">
                                <AppText as="h4" className="cm-member-name">{member.name}</AppText>
                                {member.isMuted &&
            <FaVolumeMute className="cm-member-muted-icon" title={t('member_muted_badge', 'Muted in chat')} />
            }
                            </div>

                            <div className="cm-member-actions">
                                <button
              type="button"
              disabled={moderatingId === member.id}
              onClick={() => toggleMute(member)}
              className={`cm-action-btn cm-action-btn--icon ${member.isMuted ? 'cm-action-btn--unmute' : 'cm-action-btn--mute'}`}
              aria-label={member.isMuted ? t('unmute_member', 'Unmute') : t('mute_member', 'Mute in chat')}
              title={member.isMuted ? t('unmute_member', 'Unmute') : t('mute_member', 'Mute in chat')}>

                                    {member.isMuted ? <FaVolumeUp /> : <FaVolumeMute />}
                                </button>
                                <button
              type="button"
              disabled={moderatingId === member.id}
              onClick={() => blockMember(member.id)}
              className="cm-action-btn cm-action-btn--icon cm-action-btn--block"
              aria-label={t('block_member', 'Block member')}
              title={t('block_member', 'Block member')}>

                                    <FaBan />
                                </button>
                            </div>
                        </div>
        )}
                </div>
      }

            <div className="cm-blocked-section">
                <AppText as="h4" className="cm-blocked-title">
                    {t('blocked_members', 'Blocked members')} ({blockedMembers.length})
                </AppText>
                {blockedMembers.length === 0 ?
        <AppText as="p" className="cm-blocked-empty">
                        {t('no_blocked_members', 'No blocked members yet.')}
                    </AppText> :

        <div className="cm-member-list">
                        {blockedMembers.map((member) =>
          <div key={member.id} className="cm-blocked-card">
                                <div className="cm-member-avatar-wrap">
                                    <UserAvatar user={member} alt={member.name} style={{ width: 32, height: 32 }} />
                                </div>
                                <div className="cm-blocked-name">{member.name}</div>
                                <button
              type="button"
              disabled={moderatingId === member.id}
              onClick={() => unblockMember(member.id)}
              className="cm-action-btn cm-action-btn--icon cm-action-btn--unblock"
              aria-label={t('unblock_member', 'Unblock')}
              title={t('unblock_member', 'Unblock')}>

                                    <FaUnlock />
                                </button>
                            </div>
          )}
                    </div>
        }
            </div>
        </div>);

};

export default CommunityManagement;
