import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { FaArrowLeft, FaSave, FaCheck, FaPalette, FaExternalLinkAlt, FaUndo } from 'react-icons/fa';
import { BUSINESS_THEMES } from '../../utils/businessThemes';
import PremiumBadge from '../../components/PremiumBadge';
import PremiumPaywallModal from '../../components/PremiumPaywallModal';
import DraftSavedModal from '../../components/DraftSavedModal';
// ─── 12 Curated Brand Templates ─────────────────────────────────────────────
// textColor = color used for headings/badges on dark card backgrounds
const BRAND_TEMPLATES = [
    {
        id: 'golden-hour', name: 'Golden Hour', emoji: '🌟', desc: 'Bright Gold & Yellow',
        preview: ['#f59e0b', '#fde047'],
        kit: {
            primaryColor: '#f59e0b', secondaryColor: '#fde047', textColor: '#fef3c7',
            fontFamily: "system-ui, sans-serif", buttonStyle: '40px',
            tabBorderColor: '#f59e0b', tabBgColor: '#fffbeb', tabTextColor: '#f59e0b',
            joinBtnBg: '#f59e0b', joinBtnTextColor: '#ffffff',
            inviteBtnBg: '#ffffff', inviteBtnTextColor: '#f59e0b',
            starColor: '#fde047', btnTextColor: '#ffffff', btnBorderColor: '#f59e0b',
        }
    },
    {
        id: 'neon-cyber', name: 'Neon Cyber', emoji: '⚡', desc: 'Vibrant Cyan',
        preview: ['#06b6d4', '#22d3ee'],
        kit: {
            primaryColor: '#06b6d4', secondaryColor: '#22d3ee', textColor: '#cffafe',
            fontFamily: "system-ui, sans-serif", buttonStyle: '8px',
            tabBorderColor: '#06b6d4', tabBgColor: '#ecfeff', tabTextColor: '#06b6d4',
            joinBtnBg: '#06b6d4', joinBtnTextColor: '#ffffff',
            inviteBtnBg: '#ffffff', inviteBtnTextColor: '#06b6d4',
            starColor: '#22d3ee', btnTextColor: '#ffffff', btnBorderColor: '#06b6d4',
        }
    },
    {
        id: 'crimson-ruby', name: 'Crimson Ruby', emoji: '🍷', desc: 'Vibrant Red',
        preview: ['#ef4444', '#fca5a5'],
        kit: {
            primaryColor: '#ef4444', secondaryColor: '#fca5a5', textColor: '#fee2e2',
            fontFamily: "system-ui, sans-serif", buttonStyle: '12px',
            tabBorderColor: '#ef4444', tabBgColor: '#fef2f2', tabTextColor: '#ef4444',
            joinBtnBg: '#ef4444', joinBtnTextColor: '#ffffff',
            inviteBtnBg: '#ffffff', inviteBtnTextColor: '#ef4444',
            starColor: '#fca5a5', btnTextColor: '#ffffff', btnBorderColor: '#ef4444',
        }
    },
    {
        id: 'sapphire-glow', name: 'Sapphire Glow', emoji: '💎', desc: 'Bright Vivid Blue',
        preview: ['#3b82f6', '#93c5fd'],
        kit: {
            primaryColor: '#3b82f6', secondaryColor: '#93c5fd', textColor: '#eff6ff',
            fontFamily: "system-ui, sans-serif", buttonStyle: '40px',
            tabBorderColor: '#3b82f6', tabBgColor: '#eff6ff', tabTextColor: '#3b82f6',
            joinBtnBg: '#3b82f6', joinBtnTextColor: '#ffffff',
            inviteBtnBg: '#ffffff', inviteBtnTextColor: '#3b82f6',
            starColor: '#93c5fd', btnTextColor: '#ffffff', btnBorderColor: '#3b82f6',
        }
    },
    {
        id: 'emerald-mint', name: 'Emerald Mint', emoji: '🌿', desc: 'Vivid Green',
        preview: ['#10b981', '#6ee7b7'],
        kit: {
            primaryColor: '#10b981', secondaryColor: '#6ee7b7', textColor: '#ecfdf5',
            fontFamily: "system-ui, sans-serif", buttonStyle: '6px',
            tabBorderColor: '#10b981', tabBgColor: '#ecfdf5', tabTextColor: '#10b981',
            joinBtnBg: '#10b981', joinBtnTextColor: '#ffffff',
            inviteBtnBg: '#ffffff', inviteBtnTextColor: '#10b981',
            starColor: '#6ee7b7', btnTextColor: '#ffffff', btnBorderColor: '#10b981',
        }
    },
    {
        id: 'hot-pink', name: 'Hot Pink', emoji: '🥀', desc: 'Bright Pink Glow',
        preview: ['#ec4899', '#f9a8d4'],
        kit: {
            primaryColor: '#ec4899', secondaryColor: '#f9a8d4', textColor: '#fce7f3',
            fontFamily: "system-ui, sans-serif", buttonStyle: '24px',
            tabBorderColor: '#ec4899', tabBgColor: '#fdf2f8', tabTextColor: '#ec4899',
            joinBtnBg: '#ec4899', joinBtnTextColor: '#ffffff',
            inviteBtnBg: '#ffffff', inviteBtnTextColor: '#ec4899',
            starColor: '#f9a8d4', btnTextColor: '#ffffff', btnBorderColor: '#ec4899',
        }
    },
    {
        id: 'starlight-white', name: 'Starlight White', emoji: '✨', desc: 'Pure White & Silver',
        preview: ['#ffffff', '#e2e8f0'],
        kit: {
            primaryColor: '#ffffff', secondaryColor: '#e2e8f0', textColor: '#f8fafc',
            fontFamily: "system-ui, sans-serif", buttonStyle: '8px',
            tabBorderColor: '#ffffff', tabBgColor: '#f8fafc', tabTextColor: '#000000',
            joinBtnBg: '#ffffff', joinBtnTextColor: '#000000',
            inviteBtnBg: '#0f172a', inviteBtnTextColor: '#ffffff',
            starColor: '#e2e8f0', btnTextColor: '#000000', btnBorderColor: '#ffffff',
        }
    },
    {
        id: 'arcade-glow', name: 'Arcade Glow', emoji: '🕹️', desc: 'Lime Green Neon',
        preview: ['#84cc16', '#bef264'],
        kit: {
            primaryColor: '#84cc16', secondaryColor: '#bef264', textColor: '#ecfccb',
            fontFamily: "system-ui, sans-serif", buttonStyle: '6px',
            tabBorderColor: '#84cc16', tabBgColor: '#ecfccb', tabTextColor: '#84cc16',
            joinBtnBg: '#84cc16', joinBtnTextColor: '#000000',
            inviteBtnBg: '#000000', inviteBtnTextColor: '#84cc16',
            starColor: '#bef264', btnTextColor: '#000000', btnBorderColor: '#84cc16',
        }
    },
    {
        id: 'mango-tango', name: 'Mango Tango', emoji: '🥭', desc: 'Vibrant Orange',
        preview: ['#f97316', '#fdba74'],
        kit: {
            primaryColor: '#f97316', secondaryColor: '#fdba74', textColor: '#ffedd5',
            fontFamily: "system-ui, sans-serif", buttonStyle: '40px',
            tabBorderColor: '#f97316', tabBgColor: '#fff7ed', tabTextColor: '#f97316',
            joinBtnBg: '#f97316', joinBtnTextColor: '#ffffff',
            inviteBtnBg: '#ffffff', inviteBtnTextColor: '#f97316',
            starColor: '#fdba74', btnTextColor: '#ffffff', btnBorderColor: '#f97316',
        }
    },
    {
        id: 'purple-rain', name: 'Purple Rain', emoji: '🔮', desc: 'Bright Amethyst',
        preview: ['#a855f7', '#d8b4fe'],
        kit: {
            primaryColor: '#a855f7', secondaryColor: '#d8b4fe', textColor: '#faf5ff',
            fontFamily: "system-ui, sans-serif", buttonStyle: '12px',
            tabBorderColor: '#a855f7', tabBgColor: '#faf5ff', tabTextColor: '#a855f7',
            joinBtnBg: '#a855f7', joinBtnTextColor: '#ffffff',
            inviteBtnBg: '#ffffff', inviteBtnTextColor: '#a855f7',
            starColor: '#d8b4fe', btnTextColor: '#ffffff', btnBorderColor: '#a855f7',
        }
    },
    {
        id: 'coral-reef', name: 'Coral Reef', emoji: '🪸', desc: 'Bright Coral Pink',
        preview: ['#fb7185', '#fda4af'],
        kit: {
            primaryColor: '#fb7185', secondaryColor: '#fda4af', textColor: '#fff1f2',
            fontFamily: "system-ui, sans-serif", buttonStyle: '16px',
            tabBorderColor: '#fb7185', tabBgColor: '#fff1f2', tabTextColor: '#fb7185',
            joinBtnBg: '#fb7185', joinBtnTextColor: '#ffffff',
            inviteBtnBg: '#ffffff', inviteBtnTextColor: '#fb7185',
            starColor: '#fda4af', btnTextColor: '#ffffff', btnBorderColor: '#fb7185',
        }
    },
    {
        id: 'glacier-ice', name: 'Glacier Ice', emoji: '❄️', desc: 'Bright Light Blue',
        preview: ['#0ea5e9', '#7dd3fc'],
        kit: {
            primaryColor: '#0ea5e9', secondaryColor: '#7dd3fc', textColor: '#f0f9ff',
            fontFamily: "system-ui, sans-serif", buttonStyle: '40px',
            tabBorderColor: '#0ea5e9', tabBgColor: '#e0f2fe', tabTextColor: '#0ea5e9',
            joinBtnBg: '#0ea5e9', joinBtnTextColor: '#ffffff',
            inviteBtnBg: '#ffffff', inviteBtnTextColor: '#0ea5e9',
            starColor: '#7dd3fc', btnTextColor: '#ffffff', btnBorderColor: '#0ea5e9',
        }
    }
];

const PRESET_COLORS = [
    '#f5c518', '#c0392f', '#00e5a0', '#a78bfa', '#f97316',
    '#3b82f6', '#10b981', '#e91e8c', '#cd7f32', '#c0c8d8',
    '#e8a0b0', '#8cb87a', '#e2e8f0', '#ffffff',
];

const ColorSwatch = ({ color, selected, onClick }) => (
    <button
        onClick={() => onClick(color)}
        title={color}
        style={{
            width: 28, height: 28, borderRadius: '50%',
            background: color,
            border: selected ? '3px solid #a78bfa' : '2px solid rgba(255,255,255,0.15)',
            cursor: 'pointer',
            boxShadow: selected ? '0 0 0 2px rgba(167,139,250,0.4)' : 'none',
            flexShrink: 0, transition: 'transform 0.15s',
            transform: selected ? 'scale(1.15)' : 'scale(1)',
        }}
    />
);

const BrandKit = ({ onBack }) => {
    const { currentUser, userProfile } = useAuth();
    const navigate = useNavigate();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const currentTheme = BUSINESS_THEMES.find(t => t.id === userProfile?.businessInfo?.theme) || BUSINESS_THEMES[0];
    const defaultPrimary = currentTheme?.colors?.accent || '#a78bfa';
    const brandKit = userProfile?.businessInfo?.brandKit || {};

    const isPaid = (() => {
        const t = (userProfile?.subscriptionTier || 'free').toLowerCase();
        return t === 'professional' || t === 'elite';
    })();
    const [primaryColor, setPrimaryColor] = useState(brandKit.primaryColor || defaultPrimary);
    const [secondaryColor, setSecondaryColor] = useState(brandKit.secondaryColor || '#f97316');
    const [textColor, setTextColor] = useState(brandKit.textColor || '#e2e8f0');
    const [selectedTemplate, setSelectedTemplate] = useState(brandKit.templateId || null);
    const [allProps, setAllProps] = useState({ ...brandKit });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);
    const [showDraftSavedModal, setShowDraftSavedModal] = useState(false);
    const iframeRef = useRef(null);

    // Apply a template — sets every property at once
    const applyTemplate = (tpl) => {
        setSelectedTemplate(tpl.id);
        setPrimaryColor(tpl.kit.primaryColor);
        setSecondaryColor(tpl.kit.secondaryColor);
        setTextColor(tpl.kit.textColor);
        setAllProps({ ...tpl.kit, templateId: tpl.id });
    };

    // Reset to bare defaults
    const handleReset = () => {
        setSelectedTemplate(null);
        setPrimaryColor(defaultPrimary);
        setSecondaryColor('#f97316');
        setTextColor('#e2e8f0');
        setAllProps({ primaryColor: defaultPrimary, secondaryColor: '#f97316', textColor: '#e2e8f0' });
    };

    // Keep allProps in sync when manual color pickers change
    useEffect(() => {
        setAllProps(prev => ({ ...prev, primaryColor, secondaryColor, textColor }));
    }, [primaryColor, secondaryColor, textColor]);

    // Sync to localStorage for live iframe preview
    useEffect(() => {
        localStorage.setItem('bk_preview', JSON.stringify(allProps));
    }, [allProps]);

    useEffect(() => () => localStorage.removeItem('bk_preview'), []);

    const handleSave = async () => {
        if (!currentUser?.uid) return;
        setSaving(true);
        try {
            const userRef = doc(db, 'users', currentUser.uid);
            // Always save directly — brand kit is free for all businesses
            // Force sans-serif font regardless of template selection
            await updateDoc(userRef, {
                'businessInfo.brandKit': { ...allProps, fontFamily: 'system-ui, sans-serif' }
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (e) {
            console.error('Brand kit save error:', e);
        } finally {
            setSaving(false);
        }
    };


    // Color picker group component
    const ColorGroup = ({ label, hint, value, onChange }) => (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f1f5f9' }}>{label}</span>
                {hint && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>{hint}</span>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                {PRESET_COLORS.map(c => (
                    <ColorSwatch key={c} color={c} selected={value === c} onClick={onChange} />
                ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="color" value={value} onChange={e => onChange(e.target.value)}
                    style={{ width: 36, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'transparent' }} />
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: value, border: '2px solid rgba(255,255,255,0.2)' }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{value}</span>
            </div>
        </div>
    );

    return (
        <div style={{ paddingBottom: isMobile ? '160px' : '0px', position: 'relative' }}>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                <button onClick={onBack}
                    style={{ background: 'var(--hover-overlay)', border: '1px solid var(--border-color)', borderRadius: 10, color: 'var(--text-main)', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.85rem', fontWeight: 600 }}>
                    <FaArrowLeft /> Design Studio
                </button>
                <span style={{ color: 'var(--text-muted)' }}>/</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>Brand Kit</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button onClick={handleReset} title="Reset to defaults"
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#f87171', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.82rem', fontWeight: 700 }}>
                        <FaUndo size={11} /> Reset
                    </button>
                    <button onClick={() => {
                        onBack();
                        if (currentUser?.uid && window.location.pathname !== `/business/${currentUser.uid}`) {
                            navigate(`/business/${currentUser.uid}`);
                        }
                        window.scrollTo(0, 0);
                    }}
                        style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 10, color: '#10b981', padding: '6px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.82rem', fontWeight: 700 }}>
                        <FaExternalLinkAlt size={11} /> View My Profile
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 360px', gap: 24, alignItems: 'start' }}>

                {/* LEFT: Editor */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* ── 12 Templates ── */}
                    <div className="bpro-stat-card" style={{ padding: 20 }}>
                        <div style={{ marginBottom: 18 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: 4 }}>🎨 Design Templates</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Applies a complete style — colors, fonts, buttons, text & more</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 10 }}>
                            {BRAND_TEMPLATES.map(tpl => {
                                const isActive = selectedTemplate === tpl.id;
                                return (
                                    <button
                                        key={tpl.id}
                                        onClick={() => applyTemplate(tpl)}
                                        style={{
                                            padding: '12px 10px', borderRadius: 14,
                                            border: isActive ? `2px solid ${tpl.kit.primaryColor}` : '1px solid var(--border-color)',
                                            background: isActive
                                                ? `linear-gradient(135deg, ${tpl.kit.primaryColor}22, ${tpl.kit.secondaryColor}18)`
                                                : 'var(--hover-overlay)',
                                            cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 7,
                                            textAlign: 'left', transition: 'all 0.18s',
                                            boxShadow: isActive ? `0 0 18px ${tpl.kit.primaryColor}55` : 'none',
                                        }}
                                    >
                                        {/* 3-color stripe */}
                                        <div style={{ display: 'flex', height: 6, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
                                            <div style={{ flex: 1, background: tpl.kit.primaryColor }} />
                                            <div style={{ flex: 1, background: tpl.kit.secondaryColor }} />
                                            <div style={{ flex: 1, background: tpl.kit.textColor }} />
                                        </div>
                                        {/* Mini button */}
                                        <div style={{ height: 18, borderRadius: tpl.kit.buttonStyle, background: `linear-gradient(135deg, ${tpl.kit.primaryColor}, ${tpl.kit.secondaryColor})` }} />
                                        {/* Name + check */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-main)' }}>
                                                    {tpl.emoji} {tpl.name}
                                                </div>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: 2 }}>{tpl.desc}</div>
                                            </div>
                                            {isActive && (
                                                <div style={{ width: 18, height: 18, borderRadius: '50%', background: tpl.kit.primaryColor, border: '2px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.65rem', flexShrink: 0 }}>✓</div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Save Wrapper (Sticky on Mobile, above Nav Bar) */}
                    <div style={{
                        position: isMobile ? 'fixed' : 'relative',
                        bottom: isMobile ? '80px' : 'auto',  /* Account for the bottom nav bar */
                        left: isMobile ? 0 : 'auto',
                        right: isMobile ? 0 : 'auto',
                        padding: isMobile ? '16px' : '0',
                        background: isMobile ? '#0f172a' : 'transparent',
                        borderTop: isMobile ? '1px solid rgba(255,255,255,0.1)' : 'none',
                        zIndex: 99999, /* Force it above everything */
                        display: 'flex',
                        boxShadow: isMobile ? '0 -10px 30px rgba(0,0,0,0.5)' : 'none'
                    }}>
                        <button onClick={handleSave} disabled={saving} className="bpro-btn-primary"
                            style={{ flex: 1, width: '100%', justifyContent: 'center', height: 48, fontSize: '0.95rem', gap: 10 }}>
                            {saved ? <><FaCheck /> Saved!</> : saving ? 'Saving…' : <><FaSave /> {isMobile ? 'Save Changes' : 'Save Brand Kit'}</>}
                        </button>
                    </div>
                </div>

                {/* RIGHT: Live Profile Preview (Desktop Only) */}
                {!isMobile && (
                    <div style={{ position: 'sticky', top: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Live Preview</div>
                            <button onClick={() => iframeRef.current?.contentWindow.location.reload()} title="Reload preview"
                                style={{ background: 'var(--hover-overlay)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-main)', padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem' }}>
                                ↺ Reload
                            </button>
                        </div>
                        <div style={{ width: 340, margin: '0 auto', borderRadius: 36, border: '6px solid rgba(255,255,255,0.12)', overflow: 'hidden', boxShadow: `0 24px 60px rgba(0, 0, 0, 0.5), 0 0 40px ${primaryColor} 22`, background: '#0f0f0f' }}>
                            <div style={{ height: 28, background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: 80, height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.15)' }} />
                            </div>
                            {currentUser?.uid ? (
                                <iframe ref={iframeRef} src={`/business/${currentUser.uid}?preview=1`}
                                    style={{ width: '100%', height: 620, border: 'none', display: 'block' }} title="Profile Preview" />
                            ) : (
                                <div style={{ height: 620, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
                                    Sign in to preview
                                </div>
                            )}
                            <div style={{ height: 24, background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: 100, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.2)' }} />
                            </div>
                        </div>
                        <div style={{ textAlign: 'center', marginTop: 10, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Changes reflect without saving</div>
                    </div>
                )}
            </div>

        </div>
    );
};

export default BrandKit;
