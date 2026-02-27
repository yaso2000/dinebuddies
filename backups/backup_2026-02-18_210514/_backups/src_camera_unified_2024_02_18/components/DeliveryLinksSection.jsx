import React from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { MdDeliveryDining } from 'react-icons/md';
import { FaEdit, FaSave } from 'react-icons/fa';

const DeliveryLinksSection = ({
    partner,
    isOwner,
    deliveryLinks,
    tempDeliveryLinks,
    setTempDeliveryLinks,
    editingDeliveryLinks,
    setEditingDeliveryLinks,
    onSave,
    onCancel
}) => {
    const isPremium = partner?.subscriptionTier === 'premium';

    // Don't show if not premium and no links
    const hasAnyLink = deliveryLinks.uberEats || deliveryLinks.menulog ||
        deliveryLinks.doorDash || deliveryLinks.deliveroo;

    // Hide from public/guests if no links are added
    // Owners always see it so they can add links (or see premium upsell)
    if (!hasAnyLink && !isOwner) {
        return null;
    }

    const deliveryPlatforms = [
        {
            name: 'Uber Eats',
            key: 'uberEats',
            color: '#06C167',
            gradient: 'linear-gradient(135deg, #06C167, #039855)',
            logo: 'https://d3i4yxtzktqr9n.cloudfront.net/web-eats-v2/97c43f8974e6c876.svg',
            placeholder: 'https://www.ubereats.com/au/store/...'
        },
        {
            name: 'Menulog',
            key: 'menulog',
            color: '#FF6600',
            gradient: 'linear-gradient(135deg, #FF6600, #CC5200)',
            logo: '/images/menulog-logo.png.png',
            placeholder: 'https://www.menulog.com.au/restaurants/...'
        },
        {
            name: 'DoorDash',
            key: 'doorDash',
            color: '#FF3008',
            gradient: 'linear-gradient(135deg, #FF3008, #CC2606)',
            logo: 'https://cdn.brandfetch.io/doordash.com/w/800/h/113/logo?c=1dxbfHSJFAPEGdCLU4o5B',
            placeholder: 'https://www.doordash.com/store/...'
        },
        {
            name: 'Deliveroo',
            key: 'deliveroo',
            color: '#00CCBC',
            gradient: 'linear-gradient(135deg, #00CCBC, #00A396)',
            logo: 'https://cdn.brandfetch.io/deliveroo.com/w/400/h/400/logo?c=1dxbfHSJFAPEGdCLU4o5B',
            placeholder: 'https://deliveroo.com.au/menu/...'
        }
    ];

    return (
        <div style={{
            background: 'var(--bg-card)',
            borderRadius: '20px',
            padding: '1.5rem',
            margin: '0',
            marginTop: '1.5rem',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem'
            }}>
                <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <MdDeliveryDining style={{ fontSize: '1.5rem', color: '#8b5cf6' }} />
                    Order Online
                </h3>

                {isOwner && isPremium && !editingDeliveryLinks && (
                    <button
                        onClick={() => setEditingDeliveryLinks(true)}
                        style={{
                            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '8px 16px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <FaEdit style={{ fontSize: '1rem' }} />
                        Edit Links
                    </button>
                )}
            </div>

            {/* Editing Mode */}
            {editingDeliveryLinks && isOwner && (
                <div>
                    <div style={{
                        display: 'grid',
                        gap: '1rem',
                        marginBottom: '1rem'
                    }}>
                        {deliveryPlatforms.map(platform => (
                            <div key={platform.key}>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    marginBottom: '0.5rem',
                                    fontWeight: '600',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.9rem'
                                }}>
                                    <img
                                        src={platform.logo}
                                        alt={platform.name}
                                        style={{
                                            height: '24px',
                                            width: 'auto',
                                            objectFit: 'contain',
                                            transform: platform.key === 'menulog' ? 'scale(1.4)' :
                                                platform.key === 'deliveroo' ? 'scale(1.5)' :
                                                    'scale(1)'
                                        }}
                                    />
                                    {platform.name}
                                </label>
                                <input
                                    type="url"
                                    value={tempDeliveryLinks[platform.key]}
                                    onChange={(e) => setTempDeliveryLinks({
                                        ...tempDeliveryLinks,
                                        [platform.key]: e.target.value
                                    })}
                                    placeholder={platform.placeholder}
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '10px',
                                        border: '2px solid var(--border-color)',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.9rem',
                                        fontFamily: 'inherit'
                                    }}
                                />
                            </div>
                        ))}
                    </div>

                    <div style={{
                        display: 'flex',
                        gap: '10px',
                        justifyContent: 'flex-end'
                    }}>
                        <button
                            onClick={onCancel}
                            style={{
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '10px',
                                padding: '10px 20px',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onSave}
                            style={{
                                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                padding: '10px 20px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <FaSave style={{ fontSize: '1rem' }} />
                            Save Links
                        </button>
                    </div>
                </div>
            )}

            {/* Display Mode */}
            {!editingDeliveryLinks && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px'
                }}>
                    {deliveryPlatforms.map(platform => {
                        const link = deliveryLinks[platform.key];
                        if (!link) return null;

                        return (
                            <a
                                key={platform.key}
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    background: platform.gradient,
                                    color: 'white',
                                    padding: '16px 20px',
                                    borderRadius: '12px',
                                    textDecoration: 'none',
                                    fontWeight: '600',
                                    fontSize: '0.95rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '12px',
                                    boxShadow: `0 4px 12px ${platform.color}40`,
                                    transition: 'all 0.3s ease',
                                    textAlign: 'center',
                                    minHeight: '60px'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = `0 6px 20px ${platform.color}60`;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = `0 4px 12px ${platform.color}40`;
                                }}
                            >
                                <img
                                    src={platform.logo}
                                    alt={platform.name}
                                    style={{
                                        height: '30px',
                                        width: 'auto',
                                        objectFit: 'contain',
                                        filter: 'brightness(0) invert(1)', // Makes logos white
                                        transform: platform.key === 'menulog' ? 'scale(1.4)' :
                                            platform.key === 'deliveroo' ? 'scale(1.5)' :
                                                'scale(1)'
                                    }}
                                />
                                {platform.key === 'deliveroo' && (
                                    <span style={{
                                        fontWeight: '700',
                                        fontSize: '1.5rem',
                                        marginLeft: '10px',
                                        letterSpacing: '0.02em'
                                    }}>
                                        {platform.name}
                                    </span>
                                )}
                            </a>
                        );
                    })}
                </div>
            )}

            {/* Premium Upgrade Prompt */}
            {!isPremium && isOwner && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))',
                    border: '2px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '12px',
                    padding: '1rem',
                    textAlign: 'center',
                    marginTop: '1rem'
                }}>
                    <p style={{
                        margin: 0,
                        color: 'var(--text-primary)',
                        fontWeight: '600',
                        marginBottom: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}>
                        <MdDeliveryDining style={{ fontSize: '1.3rem' }} />
                        Unlock Delivery Links with Premium
                    </p>
                    <button
                        onClick={() => window.location.href = '/pricing'}
                        style={{
                            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '10px 24px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        Upgrade to Premium
                    </button>
                </div>
            )}
        </div>
    );
};

export default DeliveryLinksSection;
