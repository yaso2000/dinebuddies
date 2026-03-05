import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { FaArrowLeft, FaSave, FaCheck, FaPalette, FaFont } from 'react-icons/fa';
import { getSafeAvatar } from '../../utils/avatarUtils';
import { BUSINESS_THEMES } from '../../utils/businessThemes';

const FONT_OPTIONS = [
    { value: 'Inter, sans-serif', label: 'Inter', preview: 'Modern & Clean' },
    { value: "'Cairo', sans-serif", label: 'Cairo', preview: 'عربي / Arabic' },
    { value: "'Montserrat', sans-serif", label: 'Montserrat', preview: 'Bold & Strong' },
    { value: "'Playfair Display', serif", label: 'Playfair', preview: 'Elegant & Classic' },
    { value: "'Poppins', sans-serif", label: 'Poppins', preview: 'Friendly & Round' },
];

const BUTTON_STYLES = [
    { value: '40px', label: 'Pill', icon: '💊', desc: 'Fully rounded' },
    { value: '14px', label: 'Rounded', icon: '▭', desc: 'Modern card' },
    { value: '6px', label: 'Sharp', icon: '▬', desc: 'Minimal flat' },
];

const PRESET_COLORS = [
    '#f5c518', '#c0394f', '#00e5a0', '#a78bfa', '#f97316',
    '#3b82f6', '#10b981', '#e91e8c', '#cd7f32', '#c0c8d8',
    '#e8a0b0', '#8cb87a', '#ffffff', '#000000',
];

const ColorSwatch = ({ color, selected, onClick }) => (
    <button
        onClick={() => onClick(color)}
        title={color}
        style={{
            width: 32, height: 32, borderRadius: '50%',
            background: color,
            border: selected ? '3px solid #a78bfa' : '2px solid rgba(255,255,255,0.15)',
            cursor: 'pointer',
            boxShadow: selected ? '0 0 0 2px rgba(167,139,250,0.4)' : 'none',
            flexShrink: 0,
            transition: 'transform 0.15s',
            transform: selected ? 'scale(1.15)' : 'scale(1)',
        }}
    />
);

const BrandKit = ({ onBack }) => {
    const { currentUser, userProfile } = useAuth();

    // Get current theme accent as default primary color
    const currentTheme = BUSINESS_THEMES.find(t => t.id === userProfile?.businessInfo?.theme) || BUSINESS_THEMES[0];
    const defaultPrimary = currentTheme?.colors?.accent || '#a78bfa';

    const brandKit = userProfile?.businessInfo?.brandKit || {};

    const [primaryColor, setPrimaryColor] = useState(brandKit.primaryColor || defaultPrimary);
    const [secondaryColor, setSecondaryColor] = useState(brandKit.secondaryColor || '#f97316');
    const [fontFamily, setFontFamily] = useState(brandKit.fontFamily || 'Inter, sans-serif');
    const [buttonStyle, setButtonStyle] = useState(brandKit.buttonStyle || '14px');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSave = async () => {
        if (!currentUser?.uid) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                'businessInfo.brandKit': { primaryColor, secondaryColor, fontFamily, buttonStyle }
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (e) {
            console.error('Brand kit save error:', e);
        } finally {
            setSaving(false);
        }
    };

    const selectedFont = FONT_OPTIONS.find(f => f.value === fontFamily) || FONT_OPTIONS[0];
    const businessName = userProfile?.businessInfo?.businessName || userProfile?.display_name || 'Your Business';
    const logo = getSafeAvatar(userProfile);

    return (
        <div>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button
                    onClick={onBack}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#f1f5f9', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.85rem', fontWeight: 600 }}
                >
                    <FaArrowLeft /> Design Studio
                </button>
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9' }}>Brand Kit</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>

                {/* LEFT: Editor */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Primary Color */}
                    <div className="bpro-stat-card" style={{ padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(167,139,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa' }}>
                                <FaPalette />
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>Primary Color</div>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>Main brand color used across your profile</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                            {PRESET_COLORS.map(c => (
                                <ColorSwatch key={c} color={c} selected={primaryColor === c} onClick={setPrimaryColor} />
                            ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                            <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Custom:</label>
                            <input
                                type="color"
                                value={primaryColor}
                                onChange={e => setPrimaryColor(e.target.value)}
                                style={{ width: 40, height: 32, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'transparent' }}
                            />
                            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>{primaryColor}</span>
                        </div>
                    </div>

                    {/* Secondary Color */}
                    <div className="bpro-stat-card" style={{ padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(249,115,22,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316' }}>
                                <FaPalette />
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>Secondary Color</div>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>Accent for buttons, badges, and highlights</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                            {PRESET_COLORS.map(c => (
                                <ColorSwatch key={c} color={c} selected={secondaryColor === c} onClick={setSecondaryColor} />
                            ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                            <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Custom:</label>
                            <input
                                type="color"
                                value={secondaryColor}
                                onChange={e => setSecondaryColor(e.target.value)}
                                style={{ width: 40, height: 32, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'transparent' }}
                            />
                            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>{secondaryColor}</span>
                        </div>
                    </div>

                    {/* Button Style */}
                    <div className="bpro-stat-card" style={{ padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(249,115,22,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316', fontSize: '1rem' }}>🔘</div>
                            <div>
                                <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>Button Style</div>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>Shape of action buttons across your profile</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            {BUTTON_STYLES.map(s => (
                                <button
                                    key={s.value}
                                    onClick={() => setButtonStyle(s.value)}
                                    style={{
                                        flex: 1, padding: '14px 8px', borderRadius: 10, cursor: 'pointer',
                                        background: buttonStyle === s.value ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)',
                                        border: buttonStyle === s.value ? '1px solid rgba(167,139,250,0.5)' : '1px solid rgba(255,255,255,0.07)',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {/* Mini button preview */}
                                    <div style={{ width: '100%', height: 24, borderRadius: s.value, background: primaryColor, marginBottom: 4 }} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: buttonStyle === s.value ? '#a78bfa' : 'rgba(255,255,255,0.6)' }}>{s.label}</span>
                                    <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)' }}>{s.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Font */}
                    <div className="bpro-stat-card" style={{ padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                                <FaFont />
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>Brand Font</div>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>Typography style for your content</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {FONT_OPTIONS.map(font => (
                                <button
                                    key={font.value}
                                    onClick={() => setFontFamily(font.value)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '10px 14px', borderRadius: 10,
                                        background: fontFamily === font.value ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)',
                                        border: fontFamily === font.value ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(255,255,255,0.07)',
                                        cursor: 'pointer', textAlign: 'left', width: '100%',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <span style={{ fontFamily: font.value, fontSize: '1rem', color: '#f1f5f9', fontWeight: 600 }}>{font.label}</span>
                                    <span style={{ fontFamily: font.value, fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>{font.preview}</span>
                                    {fontFamily === font.value && <FaCheck style={{ color: '#a78bfa', marginLeft: 8 }} />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bpro-btn-primary"
                        style={{ width: '100%', justifyContent: 'center', height: 48, fontSize: '0.95rem', gap: 10 }}
                    >
                        {saved ? <><FaCheck /> Saved!</> : saving ? 'Saving…' : <><FaSave /> Save Brand Kit</>}
                    </button>
                </div>

                {/* RIGHT: Preview Card */}
                <div style={{ position: 'sticky', top: 0 }}>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Live Preview</div>
                    <div style={{
                        borderRadius: 20, overflow: 'hidden',
                        background: `linear-gradient(135deg, ${primaryColor}22, ${secondaryColor}11)`,
                        border: `1px solid ${primaryColor}44`,
                        boxShadow: `0 8px 32px ${primaryColor}22`,
                    }}>
                        {/* Header */}
                        <div style={{ background: `linear-gradient(135deg, ${primaryColor}55, ${secondaryColor}33)`, padding: '20px 20px 16px', textAlign: 'center' }}>
                            <img src={logo} alt={businessName} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${primaryColor}`, marginBottom: 10 }} onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(businessName)}&background=7c3aed&color=fff`; }} />
                            <div style={{ fontFamily: selectedFont.value, fontWeight: 800, fontSize: '1.15rem', color: '#fff', marginBottom: 4 }}>{businessName}</div>
                            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)' }}>DineBuddies Partner</div>
                        </div>
                        {/* Body */}
                        <div style={{ padding: '14px 20px 18px' }}>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                <span style={{ background: `${primaryColor}25`, color: primaryColor, border: `1px solid ${primaryColor}44`, borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px' }}>Primary</span>
                                <span style={{ background: `${secondaryColor}25`, color: secondaryColor, border: `1px solid ${secondaryColor}44`, borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px' }}>Secondary</span>
                            </div>
                            <button style={{ width: '100%', height: 38, borderRadius: buttonStyle, border: 'none', background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`, color: '#fff', fontFamily: selectedFont.value, fontWeight: 700, fontSize: '0.85rem', cursor: 'default' }}>
                                Join Community
                            </button>
                            <div style={{ marginTop: 12, fontFamily: selectedFont.value, fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                                Sample text in your brand font — {selectedFont.label}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BrandKit;
