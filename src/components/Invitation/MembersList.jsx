import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const MembersList = ({ joined, author, joinedMembersData, spotsLeft }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    // Ensure joinedMembersData is an object to prevent errors
    const safeMembersData = joinedMembersData || {};

    return (
        <div style={{ padding: '0 1.25rem', marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-white)', fontWeight: '800' }}>
                {t('members_list_title', 'Who\'s Coming')} ({joined.length + 1})
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {/* Host First */}
                <div style={{ textAlign: 'center', position: 'relative' }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        border: '2px solid var(--luxury-gold)',
                        padding: '2px',
                        position: 'relative',
                        boxShadow: '0 0 10px rgba(251, 191, 36, 0.3)'
                    }}>
                        <img
                            src={author?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${author?.id || 'host'}`}
                            alt={author?.name}
                            title={`${author?.name} (Host)`}
                            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                            onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${author?.id || 'host'}` }}
                        />
                        <div style={{
                            position: 'absolute',
                            bottom: '-6px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'var(--luxury-gold)',
                            color: 'black',
                            fontSize: '0.6rem',
                            fontWeight: '900',
                            padding: '2px 6px',
                            borderRadius: '6px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}>HOST</div>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-white)', display: 'block', marginTop: '8px', maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{author?.name || 'Host'}</span>
                </div>

                {/* Joined Members */}
                {joined.map(userId => {
                    const member = safeMembersData[userId] || { name: 'Member', avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}` };
                    return (
                        <div key={userId} style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate(`/profile/${userId}`)}>
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '50%',
                                border: '2px solid var(--primary)',
                                padding: '2px',
                                transition: 'transform 0.2s'
                            }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <img
                                    src={member.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`}
                                    alt={member.name}
                                    title={member.name}
                                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                                    onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}` }}
                                />
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '8px', maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</span>
                        </div>
                    );
                })}

                {/* Empty Spots */}
                {[...Array(Math.max(0, spotsLeft))].map((_, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            border: '2px dashed var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted)',
                            fontSize: '1.2rem',
                            opacity: 0.3,
                            background: 'rgba(255,255,255,0.02)'
                        }}>
                            +
                        </div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '8px', opacity: 0.5 }}>{t('open')}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MembersList;
