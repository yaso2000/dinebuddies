import React, { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';

const InstagramStoryTemplate = forwardRef(({ data, type = 'invitation' }, ref) => {
    const { t } = useTranslation();
    // data expected: title, image, date, time, location, hostName, hostImage, logo

    const isInvitation = type === 'invitation';

    return (
        <div
            ref={ref}
            style={{
                position: 'fixed',
                top: '-9999px', // Hide it off-screen but keep it rendered
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
                backgroundImage: `url(${data.image || '/logo.png'})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.6
            }} />

            {/* Gradient Overlay */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.3) 0%, rgba(15, 23, 42, 0.9) 100%)'
            }} />

            {/* Content Container */}
            <div style={{
                position: 'relative',
                zIndex: 10,
                padding: '80px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                textAlign: 'center' // Center align everything for Instagram style
            }}>
                {/* Header */}
                <div style={{ paddingTop: '100px' }}>
                    <div style={{
                        display: 'inline-block',
                        padding: '12px 32px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '50px',
                        textTransform: 'uppercase',
                        letterSpacing: '2px',
                        fontWeight: '700',
                        fontSize: '24px',
                        border: '2px solid rgba(255, 255, 255, 0.3)'
                    }}>
                        {isInvitation ? t('invitation_card_title') : 'DineBuddies'}
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
                            fontSize: '32px',
                            opacity: 0.9
                        }}>
                            <span>📍 {data.location}</span>
                        </div>
                    )}

                    {data.date && (
                        <div style={{
                            fontSize: '40px',
                            fontWeight: '600',
                            color: '#fbbf24' // Gold/Amber
                        }}>
                            📅 {data.date} • {data.time}
                        </div>
                    )}

                    {data.description && (
                        <p style={{
                            fontSize: '28px',
                            lineHeight: '1.5',
                            maxWidth: '800px',
                            opacity: 0.8,
                            marginTop: '20px'
                        }}>
                            {data.description.length > 150 ? data.description.substring(0, 150) + '...' : data.description}
                        </p>
                    )}
                </div>

                {/* Footer / Host Info */}
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
                                        border: '4px solid white',
                                        objectFit: 'cover'
                                    }}
                                />
                            )}
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '24px', opacity: 0.8 }}>{t('hosted_by')}</div>
                                <div style={{ fontSize: '36px', fontWeight: 'bold' }}>{data.hostName}</div>
                            </div>
                        </div>
                    )}

                    <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.2)', margin: '20px 0' }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <img src="/logo.png" alt="DineBuddies" style={{ width: '80px', height: '80px' }} />
                        <div style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '1px' }}>DineBuddies</div>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default InstagramStoryTemplate;
