import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useInvitations } from '../../context/InvitationContext';
import { FaSearch } from 'react-icons/fa';

const ProMembers = () => {
    const { currentUser } = useAuth();
    const { getCommunityMembers } = useInvitations();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!currentUser?.uid) return;
        const fetch = async () => {
            try {
                const result = await getCommunityMembers(currentUser.uid, { includeMembers: true, limit: 200 });
                setMembers((result?.members || []).map((m) => ({
                    id: m.id,
                    display_name: m.displayName || 'User',
                    profileType: m.profileType || 'user',
                    city: m.city || '',
                    country: m.country || '',
                    avatar_url: m.avatarUrl || ''
                })));
            } catch (e) {
                console.error('ProMembers error:', e);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [currentUser?.uid]);

    const filtered = members.filter(m => {
        const name = (m.display_name || m.name || '').toLowerCase();
        return name.includes(search.toLowerCase());
    });

    return (
        <div>
            <div className="bpro-card-header" style={{ marginBottom: 20 }}>
                <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9' }}>Community Members</div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{members.length} members joined your community</div>
                </div>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 20 }}>
                <FaSearch style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }} />
                <input
                    type="text"
                    className="ui-form-field"
                    placeholder="Search members..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ paddingLeft: 38 }}
                />
            </div>

            {loading ? (
                <div className="bpro-spinner" />
            ) : filtered.length === 0 ? (
                <div className="ui-card" style={{ marginBottom: 20 }}>
                    <div className="bpro-empty">
                        <div className="bpro-empty-icon">👥</div>
                        <h3>{search ? 'No results found' : 'No members yet'}</h3>
                        <p>{search ? 'Try a different search' : 'Share your profile to attract members'}</p>
                    </div>
                </div>
            ) : (
                <div className="ui-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
                    <table className="bpro-table">
                        <thead>
                            <tr>
                                <th>Member</th>
                                <th>Account Type</th>
                                <th>Location</th>
                                <th>Joined Communities</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(m => (
                                <tr key={m.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <img
                                                src={m.avatar_url || m.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.display_name || 'U')}&background=7c3aed&color=fff`}
                                                alt=""
                                                style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(167,139,250,0.3)' }}
                                            />
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.875rem' }}>{m.display_name || m.name || 'User'}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>@{m.id?.slice(0, 8) || 'user'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{
                                            background: m.profileType === 'business' ? 'rgba(249,115,22,0.15)' : 'rgba(167,139,250,0.1)',
                                            color: m.profileType === 'business' ? '#f97316' : '#a78bfa',
                                            borderRadius: 6, padding: '3px 8px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize'
                                        }}>
                                            {m.profileType || 'user'}
                                        </span>
                                    </td>
                                    <td>{m.city || m.country || '—'}</td>
                                    <td>—</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ProMembers;
