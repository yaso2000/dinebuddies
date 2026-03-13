import React from 'react';
import { MdDeliveryDining } from 'react-icons/md';
import { FaEdit, FaSave } from 'react-icons/fa';
import PremiumBadge from './PremiumBadge';
import { getPlatformsForCountry } from '../config/deliveryPlatforms';


const DeliveryLinksSection = ({
    business,
    isOwner,
    deliveryLinks,
    tempDeliveryLinks,
    setTempDeliveryLinks,
    editingDeliveryLinks,
    setEditingDeliveryLinks,
    onSave,
    onCancel
}) => {
    // Business is "paid" only if on professional or elite plan
    const isPaid = business?.subscriptionTier === 'professional' || business?.subscriptionTier === 'elite';

    // Get the right platforms for this business's country
    const businessCountry = business?.businessInfo?.country || '';
    const deliveryPlatforms = getPlatformsForCountry(businessCountry);

    // Has any link saved for any known platform?
    const hasAnyLink = deliveryPlatforms.some(p => deliveryLinks[p.key]);

    // Hide from public/guests if:
    // - No links saved, OR
    // - Not paid (draft mode — paid fields not published)
    if (!isOwner && (!hasAnyLink || !isPaid)) return null;

    // Owner sees it always (to edit), but show a draft notice if not paid

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
                    fontWeight: '800',
                    color: 'var(--text-main)',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <MdDeliveryDining style={{ fontSize: '1.5rem', color: '#8b5cf6' }} />
                    Order Online
                </h3>

                {isOwner && !editingDeliveryLinks && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {/* Plan badges — ⚡Pro + 👑Elite */}
                        <div style={{ display: 'flex', gap: 4 }}>
                            <span title="Professional Plan" style={{
                                fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px',
                                borderRadius: 20, border: '1px solid #8b5cf6',
                                color: '#a78bfa', background: 'rgba(139,92,246,0.12)',
                                display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap'
                            }}>⚡ Pro</span>
                            <span title="Elite Plan" style={{
                                fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px',
                                borderRadius: 20, border: '1px solid #f59e0b',
                                color: '#fbbf24', background: 'rgba(245,158,11,0.12)',
                                display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap'
                            }}>👑 Elite</span>
                        </div>
                        <button
                            onClick={() => setEditingDeliveryLinks(true)}
                            title="Edit Delivery Links"
                            style={{
                                width: '40px', height: '40px', borderRadius: '50%',
                                background: 'rgba(139, 92, 246, 0.1)', cursor: 'pointer',
                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                color: '#8b5cf6',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                transition: 'all 0.2s'
                            }}
                        >
                            <FaEdit size={16} />
                        </button>
                    </div>
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
                                    color: 'var(--text-main)',
                                    fontSize: '0.9rem'
                                }}>
                                    <div style={{
                                        background: platform.color,
                                        borderRadius: '8px',
                                        padding: '4px 8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        minWidth: '72px',
                                        height: '32px',
                                    }}>
                                        <img
                                            src={platform.logo}
                                            alt={platform.name}
                                            style={{
                                                maxHeight: '20px',
                                                maxWidth: '64px',
                                                objectFit: 'contain',
                                                filter: 'brightness(0) invert(1)',
                                            }}
                                        />
                                    </div>
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
                                        color: 'var(--text-main)',
                                        fontSize: '0.9rem',
                                        fontFamily: 'inherit',
                                        boxSizing: 'border-box',
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
                                color: 'var(--text-main)',
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

                        const content = (
                            <>
                                <div style={{
                                    background: platform.color,
                                    borderRadius: '10px',
                                    padding: '5px 10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: '90px',
                                    height: '38px',
                                }}>
                                    <img
                                        src={platform.logo}
                                        alt={platform.name}
                                        style={{
                                            maxHeight: '26px',
                                            maxWidth: '80px',
                                            objectFit: 'contain',
                                            filter: 'brightness(0) invert(1)',
                                        }}
                                    />
                                </div>
                                {!isPaid && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '4px',
                                        right: '8px',
                                        fontSize: '0.7rem',
                                        background: 'rgba(0,0,0,0.3)',
                                        padding: '2px 6px',
                                        borderRadius: '6px',
                                        backdropFilter: 'blur(4px)'
                                    }}>
                                        🔒 Locked
                                    </div>
                                )}
                            </>
                        );

                        const commonStyles = {
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
                            minHeight: '60px',
                            position: 'relative',
                            cursor: isPaid ? 'pointer' : 'not-allowed',
                            opacity: isPaid ? 1 : 0.6
                        };

                        if (isPaid) {
                            return (
                                <a
                                    key={platform.key}
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={commonStyles}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = `0 6px 20px ${platform.color}60`;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = `0 4px 12px ${platform.color}40`;
                                    }}
                                >
                                    {content}
                                </a>
                            );
                        } else {
                            return (
                                <div
                                    key={platform.key}
                                    title="Upgrade to Pro to unlock Delivery Links"
                                    style={commonStyles}
                                >
                                    {content}
                                </div>
                            );
                        }
                    })}
                </div>
            )}
        </div>
    );
};

export default DeliveryLinksSection;
