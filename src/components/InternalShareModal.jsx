import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs, addDoc, serverTimestamp, getDoc, doc, setDoc, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useToast } from '../context/ToastContext';
import { FaTimes, FaSearch, FaCheck, FaPaperPlane, FaUsers, FaUser } from 'react-icons/fa';
import { getSafeAvatar } from '../utils/avatarUtils';
import UserAvatar from './UserAvatar';

const InternalShareModal = ({ isOpen, onClose, shareData }) => {
    const { t } = useTranslation();
    const { currentUser, userProfile } = useAuth();
    const { conversations, getOrCreateConversation, sendMessage } = useChat();
    const { showToast } = useToast();

    const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'communities'
    const [searchQuery, setSearchQuery] = useState('');
    const [communities, setCommunities] = useState([]);
    const [loadingCommunities, setLoadingCommunities] = useState(false);
    
    // Store sent statuses to show visual feedback
    const [sentStatus, setSentStatus] = useState({}); // { [id]: 'sending' | 'sent' | 'error' }

    // Fetch user's communities manually
    useEffect(() => {
        if (!isOpen || !currentUser) return;
        
        const fetchCommunities = async () => {
            setLoadingCommunities(true);
            try {
                // If user is businessey own communities, but normal users join them.
                // Normally community membership is tracked in userProfile.joinedCommunities or by querying `communities` where members array-contains uid
                // We'll just fetch where members array-contains currentUser.uid
                const cQuery = query(collection(db, 'communities'), where('members', 'array-contains', currentUser.uid));
                const snap = await getDocs(cQuery);
                const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                
                // Also add their own community if they are a business
                if (userProfile?.role === 'business') {
                    const myComm = await getDoc(doc(db, 'communities', currentUser.uid));
                    if (myComm.exists() && !results.find(r => r.id === currentUser.uid)) {
                        results.push({ id: myComm.id, ...myComm.data() });
                    }
                }
                
                setCommunities(results);
            } catch (err) {
                console.error('Failed to fetch communities', err);
            } finally {
                setLoadingCommunities(false);
            }
        };

        fetchCommunities();
    }, [isOpen, currentUser]);

    // Cleanup on close
    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setSentStatus({});
                setSearchQuery('');
                setActiveTab('chats');
            }, 300);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const filteredChats = conversations.filter(convo => {
        if (!searchQuery) return true;
        return convo.otherUser?.displayName?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const filteredCommunities = communities.filter(comm => {
        if (!searchQuery) return true;
        // Search by community business name or display name
        const name = comm.businessName || comm.display_name || 'Community';
        return name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const checkAndRecordShare = async (recipientId) => {
        if (!shareData) return false;
        
        // shareData could be an invitation (id), post (id), or business profile (uid / profileId)
        const itemId = shareData.id || shareData.uid || shareData.profileId || 'unknown_item';
        const today = new Date().toISOString().split('T')[0];
        const limitDocRef = doc(db, 'daily_shares', `${currentUser.uid}_${itemId}_${today}`);

        try {
            const snap = await getDoc(limitDocRef);
            if (snap.exists()) {
                const data = snap.data();
                if (data.count >= 3) {
                    showToast(t('share_limit_total', 'لقد وصلت للحد الأقصى (3 مرات) لمشاركة هذا العنصر اليوم.'), 'error');
                    return false;
                }
                if (data.sharedWith && data.sharedWith.includes(recipientId)) {
                    showToast(t('share_limit_recipient', 'لقد قمت بمشاركة هذا العنصر مع نفس الجهة مسبقاً اليوم.'), 'error');
                    return false;
                }
            }

            // Record the share action
            await setDoc(limitDocRef, {
                count: increment(1),
                sharedWith: arrayUnion(recipientId),
                userId: currentUser.uid,
                itemId: itemId,
                date: today,
                updatedAt: serverTimestamp()
            }, { merge: true });

            return true;
        } catch (e) {
            console.error("Error checking share limits:", e);
            // On error allow the share
            return true;
        }
    };

    const handleSendDirect = async (otherUserId) => {
        if (sentStatus[otherUserId]) return; // Already sending/sent
        setSentStatus(prev => ({ ...prev, [otherUserId]: 'sending' }));

        const canShare = await checkAndRecordShare(otherUserId);
        if (!canShare) {
            setSentStatus(prev => ({ ...prev, [otherUserId]: null })); // Reset status if blocked
            return;
        }

        try {
            const convoId = await getOrCreateConversation(otherUserId);
            if (!convoId) throw new Error("Could not create conversation");

            await sendMessage(convoId, {
                type: 'shared_content',
                text: '', // optional text
                sharedContent: shareData
            });

            setSentStatus(prev => ({ ...prev, [otherUserId]: 'sent' }));
        } catch (error) {
            console.error(error);
            setSentStatus(prev => ({ ...prev, [otherUserId]: 'error' }));
            showToast(t('failed_to_send', 'Failed to send.'), 'error');
        }
    };

    const handleSendCommunity = async (communityId) => {
        if (sentStatus[communityId]) return;
        setSentStatus(prev => ({ ...prev, [communityId]: 'sending' }));

        const canShare = await checkAndRecordShare(communityId);
        if (!canShare) {
            setSentStatus(prev => ({ ...prev, [communityId]: null })); // Reset status if blocked
            return;
        }

        try {
            await addDoc(collection(db, 'communities', communityId, 'messages'), {
                text: '',
                senderId: currentUser.uid,
                senderName: userProfile?.display_name || currentUser.displayName || 'User',
                senderAvatar: getSafeAvatar(userProfile || currentUser),
                createdAt: serverTimestamp(),
                type: 'shared_content',
                sharedContent: shareData
            });
            setSentStatus(prev => ({ ...prev, [communityId]: 'sent' }));
        } catch (error) {
            console.error(error);
            setSentStatus(prev => ({ ...prev, [communityId]: 'error' }));
            showToast(t('failed_to_send', 'Failed to send.'), 'error');
        }
    };

    return (
        <div className="share-modal-overlay" onClick={onClose} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
        }}>
            <div className="share-modal-container" onClick={e => e.stopPropagation()} style={{
                background: 'var(--bg-card)', width: '100%', maxWidth: '400px',
                borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                maxHeight: '85vh', boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
            }}>
                
                {/* Header */}
                <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FaPaperPlane color="var(--primary)" /> {t('send_in_chat', 'Send in Chat')}
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>
                        <FaTimes />
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-darker)' }}>
                    <button 
                        onClick={() => setActiveTab('chats')}
                        style={{
                            flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer',
                            fontWeight: 600, fontSize: '0.9rem', color: activeTab === 'chats' ? 'var(--primary)' : 'var(--text-muted)',
                            borderBottom: activeTab === 'chats' ? '2px solid var(--primary)' : '2px solid transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                    >
                        <FaUser /> {t('chats', 'Chats')}
                    </button>
                    <button 
                        onClick={() => setActiveTab('communities')}
                        style={{
                            flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer',
                            fontWeight: 600, fontSize: '0.9rem', color: activeTab === 'communities' ? 'var(--primary)' : 'var(--text-muted)',
                            borderBottom: activeTab === 'communities' ? '2px solid var(--primary)' : '2px solid transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                    >
                        <FaUsers /> {t('communities', 'Communities')}
                    </button>
                </div>

                {/* Search */}
                <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', background: 'var(--input-bg)',
                        borderRadius: '8px', padding: '8px 12px', border: '1px solid var(--border-color)'
                    }}>
                        <FaSearch color="var(--text-muted)" style={{ marginInlineEnd: '8px', flexShrink: 0 }} />
                        <input 
                            type="text" 
                            placeholder={t('search', 'Search...')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text-main)', outline: 'none' }}
                        />
                    </div>
                </div>

                {/* List Container */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                    {activeTab === 'chats' ? (
                        <>
                            {filteredChats.length === 0 ? (
                                <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>{t('no_chats_found', 'No recent chats found.')}</p>
                            ) : (
                                filteredChats.map(convo => {
                                    const otherUser = convo.otherUser;
                                    const status = sentStatus[otherUser.uid];
                                    return (
                                        <div key={convo.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 12px', borderRadius: '8px', marginBottom: '4px', background: 'rgba(255,255,255,0.02)' }}>
                                            <UserAvatar user={otherUser} alt="" style={{ width: 44, height: 44, flexShrink: 0 }} />
                                            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                                <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{otherUser.displayName}</h4>
                                            </div>
                                            <button 
                                                onClick={() => handleSendDirect(otherUser.uid)}
                                                disabled={!!status}
                                                style={{
                                                    background: status === 'sent' ? 'rgba(74, 222, 128, 0.2)' : status === 'sending' ? 'var(--bg-darker)' : 'var(--primary)',
                                                    color: status === 'sent' ? '#4ade80' : 'white',
                                                    border: 'none', borderRadius: '20px', padding: '6px 16px', fontSize: '0.85rem', fontWeight: 600,
                                                    cursor: status ? 'default' : 'pointer', transition: 'all 0.2s ease', minWidth: '70px'
                                                }}
                                            >
                                                {status === 'sending' ? '...' : status === 'sent' ? <FaCheck /> : t('send', 'Send')}
                                            </button>
                                        </div>
                                    )
                                })
                            )}
                        </>
                    ) : (
                        <>
                            {loadingCommunities ? (
                                <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>{t('loading', 'Loading...')}</p>
                            ) : filteredCommunities.length === 0 ? (
                                <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>{t('no_communities_found', 'No communities found.')}</p>
                            ) : (
                                filteredCommunities.map(comm => {
                                    const status = sentStatus[comm.id];
                                    return (
                                        <div key={comm.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 12px', borderRadius: '8px', marginBottom: '4px', background: 'rgba(255,255,255,0.02)' }}>
                                            <UserAvatar user={{ ...comm, role: 'business' }} alt="" style={{ width: 44, height: 44, flexShrink: 0 }} />
                                            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                                <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{comm.businessName || comm.display_name}</h4>
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Community</p>
                                            </div>
                                            <button 
                                                onClick={() => handleSendCommunity(comm.id)}
                                                disabled={!!status}
                                                style={{
                                                    background: status === 'sent' ? 'rgba(74, 222, 128, 0.2)' : status === 'sending' ? 'var(--bg-darker)' : 'var(--primary)',
                                                    color: status === 'sent' ? '#4ade80' : 'white',
                                                    border: 'none', borderRadius: '20px', padding: '6px 16px', fontSize: '0.85rem', fontWeight: 600,
                                                    cursor: status ? 'default' : 'pointer', transition: 'all 0.2s ease', minWidth: '70px'
                                                }}
                                            >
                                                {status === 'sending' ? '...' : status === 'sent' ? <FaCheck /> : t('send', 'Send')}
                                            </button>
                                        </div>
                                    )
                                })
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InternalShareModal;
