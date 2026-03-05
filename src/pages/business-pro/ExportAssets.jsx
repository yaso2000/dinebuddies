import React, { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FaArrowLeft, FaDownload, FaUser, FaUsers } from 'react-icons/fa';
import { getSafeAvatar } from '../../utils/avatarUtils';
import { BUSINESS_THEMES } from '../../utils/businessThemes';
import html2canvas from 'html2canvas';

// ─── Profile Card Template ──────────────────────────────────────────────────
const ProfileCardTemplate = ({ userProfile, primaryColor, secondaryColor }) => {
    const businessName = userProfile?.businessInfo?.businessName || userProfile?.display_name || 'Business';
    const cuisine = userProfile?.businessInfo?.cuisine || userProfile?.businessInfo?.category || 'Restaurant';
    const members = userProfile?.communityMembers?.length || 0;
    const logo = getSafeAvatar(userProfile);

    return (
        <div style={{
            width: 400, borderRadius: 24, overflow: 'hidden',
            background: `linear-gradient(135deg, #0d0812 0%, #1a0f2e 100%)`,
            border: `1px solid ${primaryColor}44`,
            fontFamily: userProfile?.businessInfo?.brandKit?.fontFamily || 'Inter, sans-serif',
        }}>
            {/* Cover / header */}
            <div style={{
                height: 120, background: `linear-gradient(135deg, ${primaryColor}cc, ${secondaryColor}88)`,
                display: 'flex', alignItems: 'flex-end', padding: '0 20px 0',
                position: 'relative',
            }}>
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)' }} />
                <img
                    src={logo}
                    alt={businessName}
                    crossOrigin="anonymous"
                    style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${primaryColor}`, position: 'relative', bottom: -30, zIndex: 1 }}
                    onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(businessName)}&background=7c3aed&color=fff&size=72`; }}
                />
            </div>

            {/* Body */}
            <div style={{ padding: '38px 20px 20px' }}>
                <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#fff', marginBottom: 4 }}>{businessName}</div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: 14 }}>{cuisine} · DineBuddies Partner</div>

                {/* Stats row */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    <div style={{ flex: 1, background: `${primaryColor}22`, borderRadius: 10, padding: '8px 12px', textAlign: 'center', border: `1px solid ${primaryColor}33` }}>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: primaryColor }}>{members}</div>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)' }}>MEMBERS</div>
                    </div>
                    <div style={{ flex: 1, background: `${secondaryColor}22`, borderRadius: 10, padding: '8px 12px', textAlign: 'center', border: `1px solid ${secondaryColor}33` }}>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: secondaryColor }}>⭐ {userProfile?.rating || '5.0'}</div>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)' }}>RATING</div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid rgba(255,255,255,0.08)`, paddingTop: 12 }}>
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>dinebuddies.com</span>
                    <span style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`, borderRadius: 20, padding: '4px 12px', fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>
                        Join Community
                    </span>
                </div>
            </div>
        </div>
    );
};

// ─── Community Badge Template ───────────────────────────────────────────────
const BadgeTemplate = ({ userProfile, primaryColor, secondaryColor }) => {
    const businessName = userProfile?.businessInfo?.businessName || userProfile?.display_name || 'Business';
    const members = userProfile?.communityMembers?.length || 0;
    const logo = getSafeAvatar(userProfile);

    return (
        <div style={{
            width: 280, height: 280, borderRadius: '50%', overflow: 'hidden',
            background: `conic-gradient(${primaryColor}, ${secondaryColor}, ${primaryColor})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
        }}>
            {/* Inner circle */}
            <div style={{
                width: 250, height: 250, borderRadius: '50%',
                background: 'linear-gradient(135deg, #0d0812, #1a0f2e)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                fontFamily: userProfile?.businessInfo?.brandKit?.fontFamily || 'Inter, sans-serif',
            }}>
                <img
                    src={logo}
                    alt={businessName}
                    crossOrigin="anonymous"
                    style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginBottom: 8, border: `2px solid ${primaryColor}` }}
                    onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(businessName)}&background=7c3aed&color=fff&size=80`; }}
                />
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff', textAlign: 'center', maxWidth: 180, lineHeight: 1.2 }}>{businessName}</div>
                <div style={{ fontSize: '0.65rem', color: primaryColor, marginTop: 4, fontWeight: 700 }}>
                    {members} MEMBERS
                </div>
                <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>DINEBUDDIES</div>
            </div>
        </div>
    );
};

// ─── Main Export Assets Component ──────────────────────────────────────────
const ExportAssets = ({ onBack }) => {
    const { userProfile } = useAuth();
    const cardRef = useRef(null);
    const badgeRef = useRef(null);
    const [exporting, setExporting] = useState(null); // 'card' | 'badge' | null

    const brandKit = userProfile?.businessInfo?.brandKit || {};
    const currentTheme = BUSINESS_THEMES.find(t => t.id === userProfile?.businessInfo?.theme) || BUSINESS_THEMES[0];
    const primaryColor = brandKit.primaryColor || currentTheme?.colors?.accent || '#a78bfa';
    const secondaryColor = brandKit.secondaryColor || '#f97316';

    const handleExport = async (ref, filename, type) => {
        if (!ref.current) return;
        setExporting(type);
        try {
            const canvas = await html2canvas(ref.current, {
                backgroundColor: null,
                scale: 2,
                useCORS: true,
                allowTaint: false,
                logging: false,
            });
            canvas.toBlob(blob => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
            }, 'image/png');
        } catch (e) {
            console.error('Export error:', e);
        } finally {
            setExporting(null);
        }
    };

    const businessName = userProfile?.businessInfo?.businessName || userProfile?.display_name || 'business';
    const safeName = businessName.toLowerCase().replace(/\s+/g, '-');

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
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9' }}>Export Assets</span>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', marginBottom: 24, maxWidth: 560 }}>
                Download your branded assets as high-quality PNG images (2× resolution). Colors are pulled from your Brand Kit.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 24 }}>

                {/* ── Card 1: Profile Card ── */}
                <div className="bpro-stat-card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(167,139,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa', fontSize: '1.1rem' }}>
                            <FaUser />
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, color: '#f1f5f9' }}>Profile Card</div>
                            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>400×220px · PNG · 2× resolution</div>
                        </div>
                    </div>

                    {/* Preview */}
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center', transform: 'scale(0.85)', transformOrigin: 'top center' }}>
                        <div ref={cardRef}>
                            <ProfileCardTemplate userProfile={userProfile} primaryColor={primaryColor} secondaryColor={secondaryColor} />
                        </div>
                    </div>

                    <button
                        onClick={() => handleExport(cardRef, `${safeName}-profile-card.png`, 'card')}
                        disabled={exporting === 'card'}
                        className="bpro-btn-primary"
                        style={{ width: '100%', justifyContent: 'center', height: 44, gap: 8 }}
                    >
                        {exporting === 'card' ? '⏳ Generating…' : <><FaDownload /> Download Profile Card</>}
                    </button>
                </div>

                {/* ── Card 2: Community Badge ── */}
                <div className="bpro-stat-card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontSize: '1.1rem' }}>
                            <FaUsers />
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, color: '#f1f5f9' }}>Community Badge</div>
                            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>280×280px · PNG · 2× resolution</div>
                        </div>
                    </div>

                    {/* Preview */}
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center', transform: 'scale(0.75)', transformOrigin: 'top center' }}>
                        <div ref={badgeRef}>
                            <BadgeTemplate userProfile={userProfile} primaryColor={primaryColor} secondaryColor={secondaryColor} />
                        </div>
                    </div>

                    <button
                        onClick={() => handleExport(badgeRef, `${safeName}-community-badge.png`, 'badge')}
                        disabled={exporting === 'badge'}
                        className="bpro-btn-primary"
                        style={{ width: '100%', justifyContent: 'center', height: 44, gap: 8 }}
                    >
                        {exporting === 'badge' ? '⏳ Generating…' : <><FaDownload /> Download Badge</>}
                    </button>
                </div>
            </div>

            {/* Tip */}
            <div style={{ marginTop: 24, padding: '14px 18px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
                💡 <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Tip:</strong> Customize your colors and font in the <strong style={{ color: '#a78bfa' }}>Brand Kit</strong> tool first — the changes will reflect here automatically.
            </div>
        </div>
    );
};

export default ExportAssets;
