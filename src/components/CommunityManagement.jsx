import React, { useState, useEffect } from 'react';
import { FaUsers, FaTrash, FaEnvelope, FaUserShield, FaBan, FaCheck } from 'react-icons/fa';
import { getSafeAvatar } from '../utils/avatarUtils';
import { useTranslation } from 'react-i18next';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { createNotification } from '../utils/notificationHelpers';
import { useToast } from '../context/ToastContext';
import { useInvitations } from '../context/InvitationContext';
import { useChat } from '../context/ChatContext';

/**
 * {t('community_management', 'Community Management')} Panel for Business Partners
 * Allows business accounts to manage their community members
 */
const CommunityManagement = ({ businessId, businessName, currentUserId }) => {
    const profileId = businessId;
    const { showToast } = useToast();
    const { t } = useTranslation();
    const { getCommunityMembers } = useInvitations();
    const { getOrCreateConversation, sendMessage: sendDirectMessage } = useChat();
    const [members, setMembers] = useState([]);
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    // Load community members
    useEffect(() => {
        loadMembers();
    }, [profileId]);

    const loadMembers = async () => {
        setLoading(true);
        try {
            const result = await getCommunityMembers(profileId, { includeMembers: true, limit: 200 });
            const membersList = (result?.members || []).map((member) => ({
                id: member.id,
                uid: member.uid || member.id,
                profileType: member.profileType || 'user',
                displayName: member.displayName || 'Member',
                name: member.displayName || 'Member',
                city: member.city || '',
                country: member.country || '',
                email: '',
                avatar: getSafeAvatar({ photo_url: member.avatarUrl })
            }));

            setMembers(membersList);
        } catch (error) {
            console.error('❌ Error loading members:', error);
        } finally {
            setLoading(false);
        }
    };

    // Toggle member selection
    const toggleMemberSelection = (memberId) => {
        setSelectedMembers(prev =>
            prev.includes(memberId)
                ? prev.filter(id => id !== memberId)
                : [...prev, memberId]
        );
    };

    // Select all members
    const selectAll = () => {
        setSelectedMembers(members.map(m => m.id));
    };

    // Deselect all
    const deselectAll = () => {
        setSelectedMembers([]);
    };

    // Remove member from community
    const removeMember = async (memberId) => {
        if (!confirm(t('remove_member_confirm', 'Are you sure you want to remove this member from your community?'))) {
            return;
        }

        try {
            const functions = getFunctions();
            const setCommunityMembership = httpsCallable(functions, 'setCommunityMembership');
            await setCommunityMembership({ partnerId: profileId, action: 'removeMember', memberId });

            // Send notification
            await createNotification({
                userId: memberId,
                type: 'community_removed',
                title: 'Removed from Community',
                message: `You have been removed from ${businessName || 'this business'}'s community`,
                actionUrl: `/business/${profileId}`,
                metadata: { partnerId: profileId }
            });

            // Reload members
            loadMembers();
            showToast(t('member_removed_success', 'Member removed successfully'), 'success');
        } catch (error) {
            console.error('Error removing member:', error);
            showToast(t('member_removed_error', 'Failed to remove member'), 'error');
        }
    };

    // Send message to selected members
    const sendMessageToMembers = async () => {
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
            // Send direct message to each selected member (automatically creates chat & push notification)
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
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <p>{t('loading_members', 'Loading members...')}</p>
            </div>
        );
    }

    return (
        <div style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '1.5rem',
            marginTop: '1rem'
        }}>
            {/* Header */}
            <div style={{ marginBottom: '1.5rem' }}>
                {/* 1. Title */}
                <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaUserShield />
                    {t('community_management', 'Community Management')}
                </h3>

                {/* 2. Action Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    {selectedMembers.length > 0 ? (
                        <>
                            <button
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
                                }}
                            >
                                <FaEnvelope />
                                {t('message_selected', 'Message Selected')}
                            </button>
                            <button
                                onClick={deselectAll}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: 'var(--bg-body)',
                                    color: 'white',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: '500'
                                }}
                            >
                                {t('deselect_all', 'Deselect All')}
                            </button>
                        </>
                    ) : (
                        members.length > 0 && (
                            <button
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
                                }}
                            >
                                {t('select_all_broadcast', 'Select All (Group Message)')}
                            </button>
                        )
                    )}
                </div>

                {/* 3. Stats */}
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    {members.length} {t('members_count', 'member')}  • <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>{selectedMembers.length} {t('selected_count', 'selected')}</span>
                </p>
            </div>

            {/* Members List */}
            {members.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    <FaUsers size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <p>{t('no_community_members_yet', 'No community members yet')}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {members.map(member => (
                        <div
                            key={member.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                padding: '1rem',
                                background: selectedMembers.includes(member.id) ? 'rgba(138, 43, 226, 0.1)' : 'var(--bg-body)',
                                borderRadius: '12px',
                                border: selectedMembers.includes(member.id) ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onClick={() => toggleMemberSelection(member.id)}
                        >
                            {/* Checkbox */}
                            <div style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '6px',
                                border: '2px solid var(--primary-color)',
                                background: selectedMembers.includes(member.id) ? 'var(--primary-color)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                {selectedMembers.includes(member.id) && <FaCheck size={14} color="white" />}
                            </div>

                            {/* Avatar */}
                            <img
                                src={getSafeAvatar(member)}
                                alt={member.name}
                                style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    flexShrink: 0
                                }}
                                onError={(e) => { e.target.src = getSafeAvatar(null); }}
                            />

                            {/* Member Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h4 style={{
                                    margin: 0,
                                    fontSize: '1rem',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {member.name}
                                </h4>
                                <p style={{
                                    margin: '0.25rem 0 0 0',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-muted)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {member.email}
                                </p>
                            </div>

                            {/* Remove Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeMember(member.id);
                                }}
                                style={{
                                    padding: '0.5rem',
                                    background: 'rgba(255, 0, 0, 0.1)',
                                    color: '#ff4444',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    flexShrink: 0
                                }}
                                title={t('remove_member', 'Remove member')}
                            >
                                <FaTrash />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Message Modal */}
            {showMessageModal && (
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
                        <h3 style={{ margin: '0 0 1rem 0' }}>
                            {t('send_message_to_members', 'Send Message to')} {selectedMembers.length} {t('members_count', 'Members')}
                        </h3>

                        <textarea
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
                                resize: 'vertical'
                            }}
                        />

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                            <button
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
                                }}
                            >
                                {t('btn_cancel', 'Cancel')}
                            </button>
                            <button
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
                                }}
                            >
                                {sending ? t('sending_message', 'Sending...') : t('send_message', 'Send Message')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CommunityManagement;
