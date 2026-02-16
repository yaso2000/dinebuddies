import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaShareAlt, FaEdit, FaImage, FaTrash } from 'react-icons/fa';
import ShareButtons from '../ShareButtons';

const InvitationHeader = ({ invitation, isHost, onImageUpdate, onEdit, onDelete, showShare, setShowShare }) => {
    const { t } = useTranslation();

    return (
        <div className="invitation-hero" style={{ position: 'relative', height: '350px' }}>
            <img
                src={invitation.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'}
                alt={invitation.title}
                className="invitation-image"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'; }}
            />
            <div className="overlay" style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(15, 23, 42, 1) 100%)'
            }}></div>

            {/* Action Buttons (Top Right) */}
            <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10, display: 'flex', gap: '10px' }}>
                <button
                    onClick={() => setShowShare(!showShare)}
                    style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer' }}
                >
                    <FaShareAlt />
                </button>
                {isHost && (
                    <>
                        <button
                            onClick={onImageUpdate}
                            style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer' }}
                        >
                            <FaImage />
                        </button>

                        <button
                            onClick={onDelete}
                            style={{ background: 'rgba(239, 68, 68, 0.2)', backdropFilter: 'blur(10px)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fca5a5', cursor: 'pointer' }}
                        >
                            <FaTrash />
                        </button>
                    </>
                )}
            </div>

            {/* Title & Type */}
            <div style={{ position: 'absolute', bottom: '40px', left: '20px', right: '20px', zIndex: 5 }}>
                <div style={{ display: 'inline-block', background: 'var(--luxury-gold)', color: 'black', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '800', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {t(invitation.type)}
                </div>
                <h1 style={{ fontSize: '2rem', fontWeight: '900', color: 'white', lineHeight: '1.2', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                    {invitation.title}
                </h1>
                {invitation.description && (
                    <p style={{ color: 'rgba(255,255,255,0.8)', marginTop: '10px', fontSize: '0.95rem', maxWidth: '600px', lineHeight: '1.5' }}>
                        {invitation.description}
                    </p>
                )}
            </div>

            {showShare && (
                <div
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => setShowShare(false)}
                >
                    <div
                        style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', maxWidth: '90%', width: '320px' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 style={{ textAlign: 'center', marginBottom: '16px', color: 'white' }}>{t('share_via')}</h3>
                        <ShareButtons
                            url={window.location.href}
                            title={invitation.title}
                            description={invitation.description}
                            storyData={{
                                title: invitation.title,
                                image: invitation.image,
                                description: invitation.description,
                                date: invitation.date, // Assuming formatted or string
                                time: invitation.time,
                                location: invitation.restaurantName || invitation.locationName,
                                hostName: invitation.hostName || invitation.author?.name,
                                hostImage: invitation.hostAvatar || invitation.author?.photoURL
                            }}
                        />
                        <button
                            onClick={() => setShowShare(false)}
                            style={{ width: '100%', marginTop: '16px', padding: '10px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '8px', cursor: 'pointer' }}
                        >
                            {t('close')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvitationHeader;
