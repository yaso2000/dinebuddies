import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import ProOfferTemplates from './ProOfferTemplates';
import BrandKit from './BrandKit';
import ExportAssets from './ExportAssets';
import SocialCreator from '../../features/social-creator/index.jsx';
import { FaImage, FaMagic, FaPalette, FaDownload, FaFont, FaArrowLeft, FaPhotoVideo } from 'react-icons/fa';

// ─── Tool definitions ────────────────────────────────────────────────────────

const tools = [
    {
        key: 'offer-editor',
        icon: <FaMagic />,
        name: 'Premium Offer Editor',
        desc: 'Design and publish stunning exclusive offers with live preview',
        color: 'orange',
        comingSoon: false,
        isNew: true
    },
    {
        key: 'banner',
        icon: <FaImage />,
        name: 'Banner Creator',
        desc: 'Design event banners and community covers',
        color: 'purple',
        comingSoon: true
    },
    {
        key: 'text',
        icon: <FaFont />,
        name: 'Text Styles',
        desc: 'Headings, body, and display text presets',
        color: 'blue',
        comingSoon: true
    },
    {
        key: 'export',
        icon: <FaDownload />,
        name: 'Export Assets',
        desc: 'Download your profile card and badge as PNG',
        color: 'purple',
        comingSoon: false,
        isNew: true
    },
    {
        key: 'social-creator',
        icon: <FaPhotoVideo />,
        name: 'Social Creator',
        desc: 'Design animated posts & stories for Instagram, TikTok & more',
        color: 'orange',
        comingSoon: false,
        isNew: true,
        eliteOnly: true
    },
];

// ─── Main Component ──────────────────────────────────────────────────────────

const ProDesignStudio = ({ editOffer = null }) => {
    const { currentUser, userProfile } = useAuth();
    // Auto-open offer editor if we arrived here via Edit button in ProOffers
    const [activeTool, setActiveTool] = useState(editOffer ? 'offer-editor' : null);
    const [currentEditOffer, setCurrentEditOffer] = useState(editOffer);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (activeTool === 'offer-editor') {
        return (
            <div>
                {/* Breadcrumb */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <button
                        type="button"
                        className="ui-btn ui-btn--secondary"
                        onClick={() => { setActiveTool(null); setCurrentEditOffer(null); }}
                        style={{ padding: '6px 12px', gap: 7, fontSize: '0.85rem' }}
                    >
                        <FaArrowLeft /> Design Studio
                    </button>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9' }}>
                        {currentEditOffer ? `Editing: ${currentEditOffer.title}` : 'Premium Offer Editor'}
                    </span>
                </div>

                <ProOfferTemplates
                    onBack={() => { setActiveTool(null); setCurrentEditOffer(null); }}
                    editOffer={currentEditOffer}
                />
            </div>
        );
    }

    if (activeTool === 'export') {
        return <ExportAssets onBack={() => setActiveTool(null)} />;
    }

    if (activeTool === 'social-creator') {
        return (
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <button
                        type="button"
                        className="ui-btn ui-btn--secondary"
                        onClick={() => setActiveTool(null)}
                        style={{ padding: '6px 12px', gap: 7, fontSize: '0.85rem' }}
                    >
                        <FaArrowLeft /> Design Studio
                    </button>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9' }}>Social Creator</span>
                </div>
                <SocialCreator />
            </div>
        );
    }

    // ── Tools grid view ──────────────────────────────────────────────────────
    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9' }}>Design Studio</div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                    Create stunning visuals for your invitations and community
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {tools.filter(t => !(isMobile && t.key === 'brand')).map(tool => (
                    <div
                        key={tool.key}
                        className="bpro-stat-card"
                        onClick={() => !tool.comingSoon && setActiveTool(tool.key)}
                        style={{ cursor: tool.comingSoon ? 'not-allowed' : 'pointer', opacity: tool.comingSoon ? 0.6 : 1, position: 'relative', transition: 'transform 0.15s, box-shadow 0.15s' }}
                        onMouseEnter={e => { if (!tool.comingSoon) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(124,58,237,0.2)'; } }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                    >
                        {/* Coming Soon / New badges */}
                        {tool.comingSoon && (
                            <span style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(249,115,22,0.15)', color: '#f97316', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(249,115,22,0.3)' }}>
                                Coming Soon
                            </span>
                        )}
                        {tool.isNew && (
                            <span style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(16,185,129,0.3)' }}>
                                ✓ Active
                            </span>
                        )}

                        <div className={`bpro-stat-icon ${tool.color}`} style={{ fontSize: '1.3rem' }}>{tool.icon}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9' }}>{tool.name}</div>
                        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{tool.desc}</div>

                        {!tool.comingSoon && (
                            <button
                                type="button"
                                className="ui-btn ui-btn--secondary"
                                style={{ marginTop: 4, width: '100%', justifyContent: 'center' }}
                                onClick={e => { e.stopPropagation(); setActiveTool(tool.key); }}
                            >
                                Open Tool
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProDesignStudio;
