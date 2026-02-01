import React, { useState, useEffect } from 'react';
import { FaUsers, FaTrash, FaEnvelope, FaUserShield, FaBan, FaCheck } from 'react-icons/fa';
import { collection, query, where, getDocs, doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase/config';
import { createNotification } from '../utils/notificationHelpers';

/**
 * Community Management Panel for Business Partners
 * Allows partners to manage their community members
 */
const CommunityManagement = ({ partnerId, partnerName, currentUserId }) => {
    const [members, setMembers] = useState([]);
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    // Load community members
    useEffect(() => {
        loadMembers();
    }, [partnerId]);

    const loadMembers = async () => {
        setLoading(true);
        try {
            console.log('🔍 Loading members for partnerId:', partnerId);

            const usersRef = collection(db, 'users');
            const q = query(
                usersRef,
                where('joinedCommunities', 'array-contains', partnerId)
            );

            const snapshot = await getDocs(q);
            console.log('📊 Query returned', snapshot.docs.length, 'documents');

            const membersList = snapshot.docs.map(doc => {
                const data = doc.data();
                console.log('👤 Member:', {
                    id: doc.id,
                    name: data.name,
                    email: data.email,
                    joinedCommunities: data.joinedCommunities
                });
                return {
                    id: doc.id,
                    ...data
                };
            });

            console.log('✅ Total members loaded:', membersList.length);
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
        if (!confirm('Are you sure you want to remove this member from your community?')) {
            return;
        }

        try {
            const userRef = doc(db, 'users', memberId);
            await updateDoc(userRef, {
                joinedCommunities: arrayRemove(partnerId)
            });

            // Send notification
            await createNotification({
                userId: memberId,
                type: 'community_removed',
                title: 'Removed from Community',
                message: `You have been removed from ${partnerName}'s community`,
                actionUrl: `/partner/${partnerId}`,
                fromUserId: currentUserId,
                fromUserName: partnerName,
                fromUserAvatar: null
            });

            // Reload members
            loadMembers();
            alert('Member removed successfully');
        } catch (error) {
            console.error('Error removing member:', error);
            alert('Failed to remove member');
        }
    };

    // Send message to selected members
    const sendMessageToMembers = async () => {
        if (!message.trim()) {
            alert('Please enter a message');
            return;
        }

        if (selectedMembers.length === 0) {
            alert('Please select at least one member');
            return;
        }

        setSending(true);
        try {
            // Send notification to each selected member
            for (const memberId of selectedMembers) {
                await createNotification({
                    userId: memberId,
                    type: 'community_message',
                    title: `Message from ${partnerName}`,
                    message: message.substring(0, 100),
                    actionUrl: `/partner/${partnerId}`,
                    fromUserId: currentUserId,
                    fromUserName: partnerName,
                    fromUserAvatar: null,
                    metadata: { fullMessage: message }
                });
            }

            alert(`Message sent to ${selectedMembers.length} member(s)`);
            setMessage('');
            setShowMessageModal(false);
            deselectAll();
        } catch (error) {
            console.error('Error sending messages:', error);
            alert('Failed to send messages');
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <p>Loading members...</p>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FaUserShield />
                        Community Management
                    </h3>
                    <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {members.length} member(s) • {selectedMembers.length} selected
                    </p>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {selectedMembers.length > 0 && (
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
                                    gap: '0.5rem'
                                }}
                            >
                                <FaEnvelope />
                                Message Selected
                            </button>
                            <button
                                onClick={deselectAll}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: 'var(--bg-body)',
                                    color: 'white',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                Deselect All
                            </button>
                        </>
                    )}
                    {selectedMembers.length === 0 && members.length > 0 && (
                        <button
                            onClick={selectAll}
                            style={{
                                padding: '0.5rem 1rem',
                                background: 'var(--bg-body)',
                                color: 'white',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            Select All
                        </button>
                    )}
                </div>
            </div>

            {/* Members List */}
            {members.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    <FaUsers size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <p>No community members yet</p>
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
                                src={member.avatar || 'https://via.placeholder.com/150'}
                                alt={member.name}
                                style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    flexShrink: 0
                                }}
                            />

                            {/* Member Info */}
                            <div style={{ flex: 1 }}>
                                <h4 style={{ margin: 0, fontSize: '1rem' }}>{member.name}</h4>
                                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
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
                                title="Remove member"
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
                            Send Message to {selectedMembers.length} Member(s)
                        </h3>

                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Type your message here..."
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
                                Cancel
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
                                {sending ? 'Sending...' : 'Send Message'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CommunityManagement;
