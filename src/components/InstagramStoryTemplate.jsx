import React, { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';

const InstagramStoryTemplate = forwardRef(({ data, type = 'invitation' }, ref) => {
    const { t } = useTranslation();
    const isPartner = type === 'partner';

    return (
        <div
            ref={ref}
            style={{
                position: 'fixed',
                top: '-9999px',
                left: '-9999px',
                width: '1080px',
                height: '1920px',
                backgroundColor: '#0f172a',
                fontFamily: "'Outfit', sans-serif",
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                color: 'white',
                zIndex: -1
            }}
            id="instagram-story-template"
        >
            {/* Background Image */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundImage: `url(${data.image || '/icon-light.png'})`,

                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: isPartner ? 0.5 : 0.6
            }} />

            {/* Gradient Overlay */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: isPartner
                    ? 'linear-gradient(to bottom, rgba(15,23,42,0.4) 0%, rgba(120,53,15,0.6) 50%, rgba(15,23,42,0.97) 100%)'
                    : 'linear-gradient(to bottom, rgba(15,23,42,0.3) 0%, rgba(15,23,42,0.9) 100%)'
            }} />

            {/* Content */}
            <div style={{
                position: 'relative',
                zIndex: 10,
                padding: '80px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                textAlign: 'center'
            }}>
                {/* Header Badge */}
                <div style={{ paddingTop: '100px' }}>
                    <div style={{
                        display: 'inline-block',
                        padding: '12px 32px',
                        background: isPartner
                            ? 'linear-gradient(135deg, rgba(249,115,22,0.35), rgba(234,179,8,0.35))'
                            : 'rgba(255,255,255,0.2)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '50px',
                        textTransform: 'uppercase',
                        letterSpacing: '2px',
                        fontWeight: '700',
                        fontSize: '24px',
                        border: isPartner
                            ? '2px solid rgba(249,115,22,0.5)'
                            : '2px solid rgba(255,255,255,0.3)'
                    }}>
                        {isPartner ? '🍽️ Partner Restaurant' : (t('invitation_card_title') || 'DineBuddies')}
                    </div>
                </div>

                {/* Main Content */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px' }}>
                    <h1 style={{
                        fontSize: '90px',
                        fontWeight: '900',
                        lineHeight: '1.1',
                        margin: 0,
                        textShadow: '0 4px 20px rgba(0,0,0,0.5)'
                    }}>
                        {data.title}
                    </h1>

                    {data.location && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            fontSize: '36px',
                            fontWeight: '700',
                            color: isPartner ? '#fdba74' : 'rgba(255,255,255,0.9)',
                            background: isPartner ? 'rgba(251,146,60,0.15)' : 'rgba(255,255,255,0.08)',
                            padding: '14px 40px',
                            borderRadius: '50px',
                            border: isPartner ? '1.5px solid rgba(251,146,60,0.35)' : '1.5px solid rgba(255,255,255,0.15)',
                        }}>
                            <span>📍 {data.location}</span>
                        </div>
                    )}

                    {!isPartner && data.date && (
                        <div style={{
                            fontSize: '40px',
                            fontWeight: '600',
                            color: '#fbbf24'
                        }}>
                            📅 {data.date} • {data.time}
                        </div>
                    )}

                    {data.description && (
                        <p style={{
                            fontSize: '30px',
                            lineHeight: '1.5',
                            maxWidth: '850px',
                            opacity: 0.8,
                            marginTop: '10px'
                        }}>
                            {data.description.length > 160 ? data.description.substring(0, 160) + '...' : data.description}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div style={{ paddingBottom: '100px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px' }}>
                    {data.hostName && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            {data.hostImage && (
                                <img
                                    src={data.hostImage}
                                    alt={data.hostName}
                                    style={{
                                        width: '100px',
                                        height: '100px',
                                        borderRadius: '50%',
                                        border: isPartner ? '4px solid #f97316' : '4px solid white',
                                        objectFit: 'cover'
                                    }}
                                />
                            )}
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '24px', opacity: 0.7 }}>
                                    {isPartner ? 'Restaurant' : t('hosted_by')}
                                </div>
                                <div style={{ fontSize: '36px', fontWeight: 'bold' }}>{data.hostName}</div>
                            </div>
                        </div>
                    )}

                    <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.15)', margin: '10px 0' }} />

                    {/* DineBuddies branding + CTA */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <img src="/db-logo-white.svg" alt="DineBuddies" style={{ width: '80px', height: '80px', filter: 'brightness(0) invert(1)' }} />
                            <div style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '1px' }}>DineBuddies</div>
                        </div>
                        {isPartner && (
                            <div style={{
                                padding: '20px 56px',
                                background: 'linear-gradient(135deg, #f97316, #eab308)',
                                borderRadius: '50px',
                                fontSize: '30px',
                                fontWeight: '800',
                                color: 'white',
                                letterSpacing: '0.5px',
                                boxShadow: '0 8px 32px rgba(249,115,22,0.45)',
                            }}>
                                Visit Us on DineBuddies 🍽️
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default InstagramStoryTemplate;


