import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUtensils, FaUserTie, FaImage, FaPlay, FaYoutube, FaTiktok, FaInstagram } from 'react-icons/fa';

const SharedContentBubble = ({ data }) => {
    const navigate = useNavigate();

    if (!data) return null;

    const handleClick = () => {
        if (data.url) {
            try {
                // Determine if it's an absolute URL
                if (data.url.startsWith('http')) {
                    const parsedUrl = new URL(data.url);
                    // Use pathname for internal routing if it matches our domain, else open new tab
                    if (parsedUrl.hostname === window.location.hostname) {
                        navigate(parsedUrl.pathname + parsedUrl.search);
                    } else {
                        window.open(data.url, '_blank');
                    }
                } else {
                    navigate(data.url);
                }
            } catch (e) {
                navigate(data.url);
            }
        } else {
            // fallback routing based on type
            if (data.type === 'post') navigate(`/`);
            if (data.type === 'invitation') navigate(`/invitation/${data.id}`);
            if (data.type === 'business') navigate(`/business/${data.id}`);
        }
    };

    return (
        <div 
            onClick={handleClick}
            style={{
                background: 'var(--bg-card)', 
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                overflow: 'hidden',
                width: '100%',
                maxWidth: '280px',
                minWidth: '220px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                marginTop: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}
        >
            {/* Context Header for Posts/Stories */}
            {data.authorAvatar && (
                <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-elevated)' }}>
                    <img src={data.authorAvatar} alt="" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>{data.authorName || 'User'}</span>
                </div>
            )}

            {/* Media Block */}
            {data.image ? (
                <div style={{ width: '100%', height: '160px', background: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {data.mediaType === 'video' ? (
                        <>
                            <video src={data.image} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                            <FaPlay size={30} color="white" style={{ position: 'absolute' }} />
                        </>
                    ) : data.mediaType === 'youtube' ? (
                        <>
                            <img src={`https://img.youtube.com/vi/${data.image}/hqdefault.jpg`} alt="YouTube" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                            <FaYoutube size={40} color="#ff0000" style={{ position: 'absolute' }} />
                        </>
                    ) : data.mediaType === 'tiktok' ? (
                        <>
                            <div style={{ width: '100%', height: '100%', background: '#000', opacity: 0.8 }}></div>
                            <FaTiktok size={36} color="white" style={{ position: 'absolute' }} />
                        </>
                    ) : data.mediaType === 'instagram' ? (
                        <>
                            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', opacity: 0.8 }}></div>
                            <FaInstagram size={40} color="white" style={{ position: 'absolute' }} />
                        </>
                    ) : (
                        <img src={data.image} alt={data.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    
                    {!data.authorAvatar && (
                        <div style={{
                            position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: 'white',
                            padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase'
                        }}>
                            {data.type}
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ width: '100%', height: (data.type === 'post' && !data.description) ? '0' : '80px', background: 'var(--primary)', position: 'relative', display: (data.type === 'post' && !data.description) ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    {data.type === 'invitation' ? <FaUtensils size={32} /> : data.type === 'business' ? <FaUserTie size={32} /> : <FaImage size={32} />}
                    {!data.authorAvatar && (
                        <div style={{
                            position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.3)', color: 'white',
                            padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase'
                        }}>
                            {data.type}
                        </div>
                    )}
                </div>
            )}

            <div style={{ padding: '10px 12px', background: 'var(--bg-card)' }}>
                {data.title && (
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', color: 'var(--text-main)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {data.title}
                    </h4>
                )}
                {data.description && (
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {data.description}
                    </p>
                )}
                <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>
                    View {data.type === 'post' ? 'Post' : data.type === 'invitation' ? 'Invitation' : data.type === 'business' ? 'Profile' : 'Content'} →
                </div>
            </div>
        </div>
    );
};

export default SharedContentBubble;
