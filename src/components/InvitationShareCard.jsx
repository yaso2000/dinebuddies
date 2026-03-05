/**
 * InvitationShareCard — rendered off-screen, captured by html2canvas, then shared.
 * Dimensions: 1080 × 1080 (square — best for WhatsApp, Instagram posts, etc.)
 *
 * The hero image is preloaded as a blob URL so html2canvas can capture it
 * without CORS restrictions (Firebase Storage / Unsplash cross-origin images).
 *
 * data: { title, image, date, time, location, city, maxGuests, hostName, hostImage, description }
 */
import React, { forwardRef, useState, useEffect } from 'react';

/** Fetch an image URL and return a local blob URL, bypassing CORS for html2canvas */
const useBlobUrl = (src) => {
    const [blobUrl, setBlobUrl] = useState(null);
    useEffect(() => {
        if (!src) return;
        let revoked = false;
        fetch(src)
            .then(r => r.blob())
            .then(blob => {
                if (!revoked) setBlobUrl(URL.createObjectURL(blob));
            })
            .catch(() => {
                if (!revoked) setBlobUrl(src); // fallback: use original URL
            });
        return () => {
            revoked = true;
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src]);
    return blobUrl || src;
};


const CARD_SIZE = 1080;

const InvitationShareCard = forwardRef(({ data }, ref) => {
    const {
        title = 'DineBuddies Event',
        image,
        date,
        time,
        location,
        city,
        maxGuests,
        hostName,
        hostImage,
        description,
    } = data || {};

    // Preload images as blob URLs → html2canvas can read them without CORS restrictions
    const heroBlobUrl = useBlobUrl(image);
    const hostBlobUrl = useBlobUrl(hostImage);

    const displayLocation = location || city || '';

    return (
        <div
            ref={ref}
            id="invitation-share-card"
            style={{
                position: 'fixed',
                top: '-9999px',
                left: '-9999px',
                zIndex: -1,
                width: `${CARD_SIZE}px`,
                height: `${CARD_SIZE}px`,
                background: '#0d1117',
                fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                color: 'white',
                borderRadius: 0,
            }}
        >
            {/* ── Hero Image (top 55%) ── */}
            <div style={{ position: 'relative', width: '100%', height: '595px', flexShrink: 0, overflow: 'hidden' }}>
                {heroBlobUrl ? (
                    <img
                        src={heroBlobUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                ) : (
                    <div style={{
                        width: '100%', height: '100%',
                        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '140px',
                    }}>🍽️</div>
                )}

                {/* Gradient fade at bottom of hero */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: '220px',
                    background: 'linear-gradient(to bottom, transparent, #0d1117)',
                }} />

                {/* Top branding bar */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0,
                    padding: '32px 44px',
                    display: 'flex', alignItems: 'center', gap: '18px',
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
                }}>
                    <div style={{
                        width: 68, height: 68, borderRadius: 16,
                        background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '36px', flexShrink: 0, fontWeight: 900,
                    }}>🍽️</div>
                    <div>
                        <div style={{ fontSize: '34px', fontWeight: 900, letterSpacing: '0.5px', color: 'white' }}>DineBuddies</div>
                        <div style={{ fontSize: '20px', color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>You're Invited!</div>
                    </div>
                </div>
            </div>


            {/* ── Info Panel (bottom 45%) ── */}
            <div style={{
                flex: 1, padding: '44px 56px 36px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                background: '#0d1117',
            }}>
                {/* Title */}
                <div>
                    <h1 style={{
                        fontSize: title.length > 30 ? '52px' : '64px',
                        fontWeight: 900, margin: 0, lineHeight: 1.1,
                        color: 'white',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        marginBottom: '28px',
                    }}>
                        {title}
                    </h1>

                    {/* Info pills row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                        {date && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                background: 'rgba(139,92,246,0.18)', border: '1.5px solid rgba(139,92,246,0.35)',
                                borderRadius: '40px', padding: '12px 28px',
                                fontSize: '28px', fontWeight: 700, color: '#c4b5fd',
                            }}>
                                📅 {date}{time ? ` · ${time}` : ''}
                            </div>
                        )}
                        {displayLocation && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                background: 'rgba(236,72,153,0.15)', border: '1.5px solid rgba(236,72,153,0.3)',
                                borderRadius: '40px', padding: '12px 28px',
                                fontSize: '28px', fontWeight: 700, color: '#f9a8d4',
                            }}>
                                📍 {displayLocation}
                            </div>
                        )}
                        {maxGuests && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                background: 'rgba(16,185,129,0.15)', border: '1.5px solid rgba(16,185,129,0.3)',
                                borderRadius: '40px', padding: '12px 28px',
                                fontSize: '28px', fontWeight: 700, color: '#6ee7b7',
                            }}>
                                👥 Max {maxGuests} guests
                            </div>
                        )}
                    </div>
                </div>

                {/* Divider + Footer */}
                <div>
                    <div style={{ height: '2px', background: 'rgba(255,255,255,0.08)', marginBottom: '28px' }} />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {/* Host */}
                        {hostName && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                {hostImage && (
                                    <img
                                        src={hostBlobUrl || hostImage}
                                        alt={hostName}
                                        style={{ width: '56px', height: '56px', borderRadius: '50%', border: '3px solid rgba(139,92,246,0.5)', objectFit: 'cover' }}
                                    />
                                )}
                                <div>
                                    <div style={{ fontSize: '20px', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>Hosted by</div>
                                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'white' }}>{hostName}</div>
                                </div>
                            </div>
                        )}

                        {/* CTA badge */}
                        <div style={{
                            padding: '18px 36px',
                            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                            borderRadius: '50px',
                            fontSize: '28px', fontWeight: 800,
                            color: 'white',
                            letterSpacing: '0.3px',
                            boxShadow: '0 8px 24px rgba(139,92,246,0.4)',
                        }}>
                            Join on DineBuddies ✨
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

InvitationShareCard.displayName = 'InvitationShareCard';
export default InvitationShareCard;
