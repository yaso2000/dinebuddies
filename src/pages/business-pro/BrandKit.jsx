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
        id: 'golden_elegance', name: 'Golden Elegance', emoji: '✨', desc: 'Luxurious gold & amber',
        preview: ['#d4af37', '#997a00'],
        kit: {
            primaryColor: '#d4af37', secondaryColor: '#997a00', textColor: '#ffffff',
            fontFamily: "system-ui, sans-serif", buttonStyle: '24px',
            tabBorderColor: '#d4af37', tabBgColor: 'rgba(212,175,55,0.1)', tabTextColor: '#d4af37',
            joinBtnBg: '#d4af37', joinBtnTextColor: '#ffffff',
            inviteBtnBg: 'transparent', inviteBtnTextColor: '#d4af37',
            starColor: '#d4af37', btnTextColor: '#ffffff', btnBorderColor: '#d4af37',
        }
    },
    {
        id: 'ruby_velvet', name: 'Ruby Velvet', emoji: '🍷', desc: 'Rich burgundy crimson',
        preview: ['#e11d48', '#be123c'],
        kit: {
            primaryColor: '#e11d48', secondaryColor: '#be123c', textColor: '#ffffff',
            fontFamily: "system-ui, sans-serif", buttonStyle: '16px',
            tabBorderColor: '#e11d48', tabBgColor: 'rgba(225,29,72,0.1)', tabTextColor: '#e11d48',
            joinBtnBg: '#e11d48', joinBtnTextColor: '#ffffff',
            inviteBtnBg: 'transparent', inviteBtnTextColor: '#e11d48',
            starColor: '#e11d48', btnTextColor: '#ffffff', btnBorderColor: '#e11d48',
        }
    },
    {
        id: 'royal_sapphire', name: 'Royal Sapphire', emoji: '💎', desc: 'Deep blue and azure',
        preview: ['#3b82f6', '#1d4ed8'],
        kit: {
            primaryColor: '#3b82f6', secondaryColor: '#1d4ed8', textColor: '#ffffff',
            fontFamily: "system-ui, sans-serif", buttonStyle: '16px',
            tabBorderColor: '#3b82f6', tabBgColor: 'rgba(59,130,246,0.1)', tabTextColor: '#3b82f6',
            joinBtnBg: '#3b82f6', joinBtnTextColor: '#ffffff',
            inviteBtnBg: 'transparent', inviteBtnTextColor: '#3b82f6',
            starColor: '#3b82f6', btnTextColor: '#ffffff', btnBorderColor: '#3b82f6',
        }
    },
    {
        id: 'emerald_prestige', name: 'Emerald Prestige', emoji: '🌿', desc: 'Vibrant forest green',
        preview: ['#10b981', '#047857'],
        kit: {
            primaryColor: '#10b981', secondaryColor: '#047857', textColor: '#ffffff',
            fontFamily: "system-ui, sans-serif", buttonStyle: '16px',
            tabBorderColor: '#10b981', tabBgColor: 'rgba(16,185,129,0.1)', tabTextColor: '#10b981',
            joinBtnBg: '#10b981', joinBtnTextColor: '#ffffff',
            inviteBtnBg: 'transparent', inviteBtnTextColor: '#10b981',
            starColor: '#10b981', btnTextColor: '#ffffff', btnBorderColor: '#10b981',
        }
    },
    {
        id: 'amethyst_glow', name: 'Amethyst Glow', emoji: '🔮', desc: 'Sleek modern purple',
        preview: ['#8b5cf6', '#6d28d9'],
        kit: {
            primaryColor: '#8b5cf6', secondaryColor: '#6d28d9', textColor: '#ffffff',
            fontFamily: "system-ui, sans-serif", buttonStyle: '12px',
            tabBorderColor: '#8b5cf6', tabBgColor: 'rgba(139,92,246,0.1)', tabTextColor: '#8b5cf6',
            joinBtnBg: '#8b5cf6', joinBtnTextColor: '#ffffff',
            inviteBtnBg: 'transparent', inviteBtnTextColor: '#8b5cf6',
            starColor: '#8b5cf6', btnTextColor: '#ffffff', btnBorderColor: '#8b5cf6',
        }
    },
    {
        id: 'cyber_neon', name: 'Cyber Neon', emoji: '⚡', desc: 'Futuristic cyan magenta',
        preview: ['#06b6d4', '#ec4899'],
        kit: {
            primaryColor: '#06b6d4', secondaryColor: '#ec4899', textColor: '#ffffff',
            fontFamily: "system-ui, sans-serif", buttonStyle: '8px',
            tabBorderColor: '#06b6d4', tabBgColor: 'rgba(6,182,212,0.1)', tabTextColor: '#06b6d4',
            joinBtnBg: '#06b6d4', joinBtnTextColor: '#ffffff',
            inviteBtnBg: 'transparent', inviteBtnTextColor: '#06b6d4',
            starColor: '#06b6d4', btnTextColor: '#ffffff', btnBorderColor: '#06b6d4',
        }
    },
    {
        id: 'signature_orange', name: 'Signature Orange', emoji: '🔥', desc: 'Vibrant orange glow',
        preview: ['#ea580c', '#f97316'],
        kit: {
            primaryColor: '#ea580c', secondaryColor: '#f97316', textColor: '#ffffff',
            fontFamily: "system-ui, sans-serif", buttonStyle: '20px',
            tabBorderColor: '#ea580c', tabBgColor: 'rgba(234, 88, 12, 0.1)', tabTextColor: '#ea580c',
            joinBtnBg: '#ea580c', joinBtnTextColor: '#ffffff',
            inviteBtnBg: 'transparent', inviteBtnTextColor: '#ea580c',
            starColor: '#ea580c', btnTextColor: '#ffffff', btnBorderColor: '#ea580c',
        }
    },
    {
        id: 'cosmic_wave', name: 'Cosmic Wave', emoji: '🌌', desc: 'Purple to sky blue',
        preview: ['#8b5cf6', '#0ea5e9'],
        kit: {
            primaryColor: '#8b5cf6', secondaryColor: '#0ea5e9', textColor: '#ffffff',
            fontFamily: "system-ui, sans-serif", buttonStyle: '16px',
            tabBorderColor: '#8b5cf6', tabBgColor: 'rgba(139, 92, 246, 0.1)', tabTextColor: '#8b5cf6',
            joinBtnBg: '#8b5cf6', joinBtnTextColor: '#ffffff',
            inviteBtnBg: 'transparent', inviteBtnTextColor: '#8b5cf6',
            starColor: '#8b5cf6', btnTextColor: '#ffffff', btnBorderColor: '#8b5cf6',
        }
    },
    {
        id: 'copper_steel', name: 'Copper & Steel', emoji: '🛡️', desc: 'Orange & cool silver',
        preview: ['#d97706', '#cbd5e1'],
        kit: {
            primaryColor: '#d97706', secondaryColor: '#94a3b8', textColor: '#ffffff',
            fontFamily: "system-ui, sans-serif", buttonStyle: '12px',
            tabBorderColor: '#d97706', tabBgColor: 'rgba(217, 119, 6, 0.1)', tabTextColor: '#d97706',
            joinBtnBg: '#d97706', joinBtnTextColor: '#ffffff',
            inviteBtnBg: 'transparent', inviteBtnTextColor: '#d97706',
            starColor: '#d97706', btnTextColor: '#ffffff', btnBorderColor: '#d97706',
        }
    },
    {
        id: 'tropical_sunset', name: 'Tropical Sunset', emoji: '🍹', desc: 'Hot pink & warm orange',
        preview: ['#f43f5e', '#fbd38d'],
        kit: {
            primaryColor: '#f43f5e', secondaryColor: '#f59e0b', textColor: '#ffffff',
            fontFamily: "system-ui, sans-serif", buttonStyle: '24px',
            tabBorderColor: '#f43f5e', tabBgColor: 'rgba(244, 63, 94, 0.1)', tabTextColor: '#f43f5e',
            joinBtnBg: '#f43f5e', joinBtnTextColor: '#ffffff',
            inviteBtnBg: 'transparent', inviteBtnTextColor: '#f43f5e',
            starColor: '#f43f5e', btnTextColor: '#ffffff', btnBorderColor: '#f43f5e',
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
