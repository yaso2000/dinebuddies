import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { FaComments, FaUsers } from 'react-icons/fa';

const AdminChatCommunity = () => {
    const [section, setSection] = useState('chat');
    const [conversations, setConversations] = useState([]);
    const [communities, setCommunities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        try {
            setLoading(true);
            const convSnap = await getDocs(query(collection(db, 'conversations'), orderBy('lastMessageTime', 'desc'), firestoreLimit(30)));
            setConversations(convSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            const profilesSnap = await getDocs(collection(db, 'public_profiles'));
            const business = profilesSnap.docs.filter((d) => d.data()?.profileType === 'business').map((d) => ({ id: d.id, ...d.data() }));
            setCommunities(business);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="admin-loading">
                <div className="admin-spinner" />
                <p style={{ color: 'var(--admin-text-secondary)', marginTop: '1rem' }}>Loading…</p>
            </div>
        );
    }

    return (
        <div>
            <div className="admin-page-header">
                <h1 className="admin-page-title">Chat & Community Management</h1>
                <p className="admin-page-subtitle">Global chat monitor and communities.</p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <button type="button" className={`admin-btn ${section === 'chat' ? 'admin-btn-primary' : 'admin-btn-secondary'}`} onClick={() => setSection('chat')}>
                    <FaComments /> Global Chat Monitor
                </button>
                <button type="button" className={`admin-btn ${section === 'communities' ? 'admin-btn-primary' : 'admin-btn-secondary'}`} onClick={() => setSection('communities')}>
                    <FaUsers /> Communities
                </button>
            </div>

            {section === 'chat' && (
                <div className="admin-card">
                    <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>Recent conversations</h2>
                    <p style={{ color: 'var(--admin-text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>Recent messages, flagged content, delete message, mute user — connect to conversation/message APIs when ready.</p>
                    {conversations.length === 0 ? (
                        <p style={{ color: 'var(--admin-text-muted)' }}>No conversations found.</p>
                    ) : (
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                            {conversations.slice(0, 15).map((c) => (
                                <li key={c.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--admin-border)' }}>
                                    <span style={{ fontWeight: '600' }}>{c.id}</span>
                                    <span style={{ color: 'var(--admin-text-muted)', marginLeft: '0.5rem' }}>Participants: {Array.isArray(c.participants) ? c.participants.length : 0}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {section === 'communities' && (
                <div className="admin-card">
                    <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>Communities (businesses)</h2>
                    <p style={{ color: 'var(--admin-text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>List communities, owner, members, message count. Tools: remove member, lock community, delete community.</p>
                    {communities.length === 0 ? (
                        <p style={{ color: 'var(--admin-text-muted)' }}>No communities found.</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Business / Owner</th>
                                        <th>ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {communities.slice(0, 30).map((c) => (
                                        <tr key={c.id}>
                                            <td>{c.businessPublic?.businessName || c.id}</td>
                                            <td><code style={{ fontSize: '0.8rem' }}>{c.id}</code></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminChatCommunity;
