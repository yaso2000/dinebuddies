import React, { useState, useEffect } from 'react';
import { FaUsers, FaBan, FaEnvelope, FaUserShield, FaCrown, FaVolumeMute, FaVolumeUp, FaUnlock } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { getSafeAvatar } from '../utils/avatarUtils';
import UserAvatar from './UserAvatar';
import { useTranslation } from 'react-i18next';
import app from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { createNotification } from '../utils/notificationHelpers';
import { useToast } from '../context/ToastContext';
import { useInvitations } from '../context/InvitationContext';
import { useChat } from '../context/ChatContext';
import { getCallableErrorReason } from '../utils/callableErrorDetails';
import './CommunityManagement.css';
import { AppText, AppTextInput } from "./base";

const FUNCTIONS_REGION = 'us-central1';

const CommunityManagement = ({ businessId, businessName, canUseMemberNotifications = false, compact = false }) => {
  const profileId = businessId;
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { getCommunityMembers } = useInvitations();
  const { getOrCreateConversation, sendMessage: sendDirectMessage } = useChat();
  const [members, setMembers] = useState([]);
  const [blockedMembers, setBlockedMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
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

  const toggleMemberSelection = (memberId) => {
    setSelectedMembers((prev) =>
    prev.includes(memberId) ?
    prev.filter((id) => id !== memberId) :
    [...prev, memberId]
    );
  };

  const selectAll = () => setSelectedMembers(members.map((m) => m.id));
  const deselectAll = () => setSelectedMembers([]);

  const blockMember = async (memberId) => {
    if (!confirm(t('block_member_confirm', 'Block this member? They will be removed and cannot rejoin until unblocked.'))) {
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
      setSelectedMembers((prev) => prev.filter((id) => id !== memberId));
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
    if (!confirm(t(confirmKey, member.isMuted ?
    'Allow this member to write in the group chat again?' :
    'Mute this member? They can read the chat but cannot write or react.'))) {
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

  const promptUpgradeForMessaging = () => {
    showToast(t('member_notifications_locked', 'Member messaging is included in the paid business plan.'), 'info');
    navigate('/settings/subscription');
  };

  const sendMessageToMembers = async () => {
    if (!canUseMemberNotifications) {
      promptUpgradeForMessaging();
      return;
    }
    if (!message.trim()) {
      showToast(t('please_enter_message', 'Please enter a message'), 'error');
      return;
    }
    if (selectedMembers.length === 0) {
      showToast(t('please_select_member', 'Please select at least one member'), 'error');
      return;
    }

    setSending(true);
    try {
      for (const memberId of selectedMembers) {
        try {
          const conversationId = await getOrCreateConversation(memberId);
          if (conversationId) {
            await sendDirectMessage(conversationId, {
              text: message.trim(),
              type: 'text'
            });
          }
        } catch (err) {
          console.error('Failed to send message to', memberId, err);
        }
      }
      showToast(`${t('message_sent', 'Message sent to')} ${selectedMembers.length} ${t('members_count', 'members')}`, 'success');
      setMessage('');
      setShowMessageModal(false);
      deselectAll();
    } catch (error) {
      console.error('Error sending messages:', error);
      showToast(t('message_sent_error', 'Failed to send messages'), 'error');
    } finally {
      setSending(false);
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

                {!canUseMemberNotifications &&
        <div
          style={{
            marginBottom: '1rem',
            padding: '12px 14px',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>

                        <FaCrown style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                        <div>
                            <div style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
                                {t('group_messaging', 'Group messaging')}
                            </div>
                            {t('member_notifications_locked', 'Member messaging is included in the paid business plan.')}
                            <button
              type="button"
              onClick={() => navigate('/settings/subscription')}
              style={{
                display: 'block',
                marginTop: '8px',
                padding: 0,
                border: 'none',
                background: 'none',
                color: 'var(--primary)',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}>

                                {t('upgrade_now', 'Upgrade Now')} →
                            </button>
                        </div>
                    </div>
        }

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    {canUseMemberNotifications && selectedMembers.length > 0 ?
          <>
                            <button
              type="button"
              onClick={() => setShowMessageModal(true)}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--primary-color)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flex: '1',
                justifyContent: 'center',
                fontWeight: '600'
              }}>

                                <FaEnvelope />
                                {t('message_selected', 'Message Selected')}
                            </button>
                            <button
              type="button"
              onClick={deselectAll}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--bg-body)',
                color: 'white',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '500'
              }}>

                                {t('deselect_all', 'Deselect All')}
                            </button>
                        </> :
          canUseMemberNotifications && members.length > 0 ?
          <button
            type="button"
            onClick={selectAll}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--bg-body)',
              color: 'white',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              cursor: 'pointer',
              width: '100%',
              fontWeight: '500'
            }}>

                            {t('select_all_broadcast', 'Select All (Group Message)')}
                        </button> :
          null}
                </div>

                <AppText as="p" style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    {members.length} {t('members_count', 'members')} • <AppText as="span" style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>{selectedMembers.length} {t('selected_count', 'selected')}</AppText>
                </AppText>
            </div>

            {members.length === 0 ?
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    <FaUsers size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <AppText as="p">{t('no_community_members_yet', 'No community members yet')}</AppText>
                </div> :

      <div className="cm-member-list">
                    {members.map((member) =>
        <div
          key={member.id}
          role="button"
          tabIndex={0}
          onClick={() => toggleMemberSelection(member.id)}
          onKeyDown={(e) => e.key === 'Enter' && toggleMemberSelection(member.id)}
          className={`cm-member-card${selectedMembers.includes(member.id) ? ' cm-member-card--selected' : ''}`}>

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
              onClick={(e) => {e.stopPropagation();toggleMute(member);}}
              className={`cm-action-btn cm-action-btn--icon ${member.isMuted ? 'cm-action-btn--unmute' : 'cm-action-btn--mute'}`}
              aria-label={member.isMuted ? t('unmute_member', 'Unmute') : t('mute_member', 'Mute in chat')}
              title={member.isMuted ? t('unmute_member', 'Unmute') : t('mute_member', 'Mute in chat')}>

                                    {member.isMuted ? <FaVolumeUp /> : <FaVolumeMute />}
                                </button>
                                <button
              type="button"
              disabled={moderatingId === member.id}
              onClick={(e) => {e.stopPropagation();blockMember(member.id);}}
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

            {showMessageModal &&
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3000,
        padding: '1rem'
      }}>
                    <div style={{
          background: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '1.5rem',
          width: '100%',
          maxWidth: '500px'
        }}>
                        <AppText as="h3" style={{ margin: '0 0 1rem 0' }}>
                            {t('send_message_to_members', 'Send Message to')} {selectedMembers.length} {t('members_count', 'Members')}
                        </AppText>

                        <AppTextInput as="textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('type_message_placeholder', 'Type your message here...')}
          rows={6}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: 'var(--bg-body)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: 'white',
            fontSize: '1rem',
            resize: 'vertical',
            boxSizing: 'border-box'
          }} />


                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                            <button
              type="button"
              onClick={() => setShowMessageModal(false)}
              disabled={sending}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: 'var(--bg-body)',
                color: 'white',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                cursor: 'pointer'
              }}>

                                {t('btn_cancel', 'Cancel')}
                            </button>
                            <button
              type="button"
              onClick={sendMessageToMembers}
              disabled={sending || !message.trim()}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: 'var(--primary-color)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: sending ? 'not-allowed' : 'pointer',
                opacity: sending || !message.trim() ? 0.5 : 1
              }}>

                                {sending ? t('sending_message', 'Sending...') : t('send_message', 'Send Message')}
                            </button>
                        </div>
                    </div>
                </div>
      }
        </div>);

};

export default CommunityManagement;