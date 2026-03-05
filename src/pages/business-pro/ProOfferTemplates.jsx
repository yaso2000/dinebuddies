/**
 * ProOfferTemplates.jsx
 * 6 live-preview banner templates
 * Premium icon set + vibrant backgrounds + 3D card styles + shine sweep
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { premiumOfferService } from '../../services/premiumOfferService';
import { getSafeAvatar } from '../../utils/avatarUtils';
import { FaImage, FaUpload, FaCheckCircle, FaTimes, FaPaperPlane, FaUtensils } from 'react-icons/fa';

/* ══════════════════════════════════════════════════════════════════════════
   PREMIUM SVG ICON LIBRARY
   Each icon is a self-animating 40×40 SVG component.
   ══════════════════════════════════════════════════════════════════════════*/

const ICON_CSS = `
@keyframes crownFloat   { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-5px) rotate(2deg)} }
@keyframes crownGlow    { 0%,100%{filter:drop-shadow(0 0 4px currentColor)} 50%{filter:drop-shadow(0 0 12px currentColor) brightness(1.3)} }
@keyframes gemSpin      { 0%,100%{transform:scale(1) rotateY(0)} 50%{transform:scale(1.08) rotateY(20deg)} }
@keyframes trophyShine  { 0%,100%{filter:drop-shadow(0 0 4px #ffd700)} 50%{filter:drop-shadow(0 0 14px #ffd700) brightness(1.25)} }
@keyframes giftBounce   { 0%,100%{transform:translateY(0) scale(1)} 40%{transform:translateY(-4px) scale(1.05)} 70%{transform:translateY(-2px) scale(1.02)} }
@keyframes starPulse    { 0%,100%{transform:scale(1) rotate(0deg)} 50%{transform:scale(1.15) rotate(12deg)} }
@keyframes lightningZap { 0%,60%,100%{opacity:1;filter:drop-shadow(0 0 4px #ffd600)} 70%{opacity:0.3} 80%{opacity:1;filter:drop-shadow(0 0 18px #ffd600)} }
@keyframes medalSwing   { 0%,100%{transform:rotate(-6deg)} 50%{transform:rotate(6deg)} }
@keyframes tagBob       { 0%,100%{transform:rotate(-3deg) scale(1)} 50%{transform:rotate(3deg) scale(1.06)} }
@keyframes ribbonPulse  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1);filter:brightness(1.2)} }
@keyframes gemRotate    { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
@keyframes fireFlicker  { 0%,100%{transform:scale(1) skewX(0)} 33%{transform:scale(1.05,.95) skewX(-3deg)} 66%{transform:scale(.95,1.05) skewX(3deg)} }
@keyframes diamondFacet { 0%,100%{filter:brightness(1) drop-shadow(0 0 6px #b9f2ff)} 50%{filter:brightness(1.4) drop-shadow(0 0 18px #b9f2ff)} }
@keyframes tickerPop    { 0%,100%{transform:scale(1)} 20%{transform:scale(1.18)} 40%{transform:scale(.95)} 60%{transform:scale(1.08)} }
`;

// ── Gold Crown ──────────────────────────────────────────────────────────────
const GoldCrownIcon = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'crownFloat 2.5s ease-in-out infinite, crownGlow 2.5s ease-in-out infinite', color: '#ffd700' }}>
        <defs>
            <linearGradient id="gcg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fff7a0" /><stop offset="40%" stopColor="#ffd700" /><stop offset="100%" stopColor="#b8860b" />
            </linearGradient>
        </defs>
        <polygon points="4,30 4,18 12,26 20,8 28,26 36,18 36,30" fill="url(#gcg)" stroke="#b8860b" strokeWidth="1" strokeLinejoin="round" />
        <rect x="4" y="30" width="32" height="5" rx="2" fill="url(#gcg)" stroke="#b8860b" strokeWidth=".5" />
        <circle cx="4" cy="18" r="2.5" fill="#fff7a0" /><circle cx="20" cy="8" r="2.5" fill="#fff7a0" /><circle cx="36" cy="18" r="2.5" fill="#fff7a0" />
    </svg>
);

// ── Silver Crown ────────────────────────────────────────────────────────────
const SilverCrownIcon = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'crownFloat 3s ease-in-out infinite, crownGlow 3s ease-in-out infinite', color: '#c0c0c0' }}>
        <defs>
            <linearGradient id="scg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" /><stop offset="45%" stopColor="#c0c0c0" /><stop offset="100%" stopColor="#707070" />
            </linearGradient>
        </defs>
        <polygon points="4,30 4,18 12,26 20,8 28,26 36,18 36,30" fill="url(#scg)" stroke="#808080" strokeWidth="1" strokeLinejoin="round" />
        <rect x="4" y="30" width="32" height="5" rx="2" fill="url(#scg)" stroke="#808080" strokeWidth=".5" />
        <circle cx="4" cy="18" r="2.5" fill="#fff" /><circle cx="20" cy="8" r="2.5" fill="#fff" /><circle cx="36" cy="18" r="2.5" fill="#fff" />
    </svg>
);

// ── Bronze Crown ─────────────────────────────────────────────────────────────
const BronzeCrownIcon = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'crownFloat 3.5s ease-in-out infinite, crownGlow 3.5s ease-in-out infinite', color: '#cd7f32' }}>
        <defs>
            <linearGradient id="bcg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f0c080" /><stop offset="45%" stopColor="#cd7f32" /><stop offset="100%" stopColor="#6b3a10" />
            </linearGradient>
        </defs>
        <polygon points="4,30 4,18 12,26 20,8 28,26 36,18 36,30" fill="url(#bcg)" stroke="#6b3a10" strokeWidth="1" strokeLinejoin="round" />
        <rect x="4" y="30" width="32" height="5" rx="2" fill="url(#bcg)" stroke="#6b3a10" strokeWidth=".5" />
        <circle cx="4" cy="18" r="2.5" fill="#f0c080" /><circle cx="20" cy="8" r="2.5" fill="#f0c080" /><circle cx="36" cy="18" r="2.5" fill="#f0c080" />
    </svg>
);

// ── Diamond ──────────────────────────────────────────────────────────────────
const DiamondIcon = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'diamondFacet 2s ease-in-out infinite' }}>
        <defs>
            <linearGradient id="diam" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e0f7ff" /><stop offset="35%" stopColor="#7dd3fc" /><stop offset="65%" stopColor="#38bdf8" /><stop offset="100%" stopColor="#0369a1" />
            </linearGradient>
        </defs>
        <polygon points="20,3 38,14 20,37 2,14" fill="url(#diam)" stroke="#7dd3fc" strokeWidth="1" />
        <polygon points="20,3 38,14 20,20" fill="rgba(255,255,255,.3)" />
        <polygon points="2,14 20,20 20,37" fill="rgba(0,50,120,.25)" />
        <line x1="2" y1="14" x2="38" y2="14" stroke="#b0e8ff" strokeWidth=".8" opacity=".7" />
    </svg>
);

// ── Trophy ───────────────────────────────────────────────────────────────────
const TrophyIcon = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'trophyShine 2.2s ease-in-out infinite' }}>
        <defs><linearGradient id="troph" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fff7a0" /><stop offset="50%" stopColor="#ffd700" /><stop offset="100%" stopColor="#b8860b" /></linearGradient></defs>
        <path d="M12 4 H28 V18 Q28 28 20 30 Q12 28 12 18 Z" fill="url(#troph)" stroke="#b8860b" strokeWidth="1" />
        <path d="M12 10 Q4 10 4 18 Q4 24 12 24" fill="none" stroke="#ffd700" strokeWidth="3" strokeLinecap="round" />
        <path d="M28 10 Q36 10 36 18 Q36 24 28 24" fill="none" stroke="#ffd700" strokeWidth="3" strokeLinecap="round" />
        <rect x="17" y="30" width="6" height="5" fill="url(#troph)" />
        <rect x="12" y="35" width="16" height="3" rx="1.5" fill="url(#troph)" stroke="#b8860b" strokeWidth=".5" />
        <text x="20" y="20" fontFamily="serif" fontWeight="900" fontSize="10" fill="#b8860b" textAnchor="middle">1</text>
    </svg>
);

// ── Gold Star ────────────────────────────────────────────────────────────────
const GoldStarIcon = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'starPulse 2s ease-in-out infinite' }}>
        <defs><linearGradient id="gstar" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fff9c0" /><stop offset="50%" stopColor="#ffd700" /><stop offset="100%" stopColor="#b8860b" /></linearGradient></defs>
        <polygon points="20,2 24.5,14 38,14 27,22 31,35 20,27 9,35 13,22 2,14 15.5,14" fill="url(#gstar)" stroke="#b8860b" strokeWidth=".8" />
    </svg>
);

// ── Gift Box ─────────────────────────────────────────────────────────────────
const GiftIcon = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'giftBounce 2s ease-in-out infinite' }}>
        <rect x="5" y="18" width="30" height="20" rx="2" fill="#ef4444" stroke="#dc2626" strokeWidth="1" />
        <rect x="3" y="13" width="34" height="7" rx="2" fill="#dc2626" />
        <rect x="18" y="3" width="4" height="35" fill="#ffd700" />
        <rect x="3" y="15" width="34" height="3" fill="#ffd700" />
        <path d="M20 13 Q14 8 14 4 Q14 1 17 1 Q20 1 20 6 Q20 1 23 1 Q26 1 26 4 Q26 8 20 13 Z" fill="#fbbf24" />
    </svg>
);

// ── Lightning ────────────────────────────────────────────────────────────────
const LightningIcon = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'lightningZap 1.8s ease-in-out infinite' }}>
        <defs><linearGradient id="ltng" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fef08a" /><stop offset="100%" stopColor="#eab308" /></linearGradient></defs>
        <polygon points="22,2 10,22 20,22 18,38 30,16 20,16" fill="url(#ltng)" stroke="#ca8a04" strokeWidth=".8" />
    </svg>
);

// ── Percent Tag ───────────────────────────────────────────────────────────────
const PercentIcon = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'tagBob 2.2s ease-in-out infinite' }}>
        <defs><linearGradient id="ptag" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f87171" /><stop offset="100%" stopColor="#dc2626" /></linearGradient></defs>
        <path d="M6 22 L6 34 L32 34 Q38 34 38 22 L38 6 L22 6 Q6 6 6 22 Z" fill="url(#ptag)" stroke="#b91c1c" strokeWidth="1" />
        <circle cx="10" cy="10" r="3" fill="#fca5a5" />
        <text x="22" y="27" fontFamily="system-ui" fontWeight="900" fontSize="15" fill="#fff" textAnchor="middle">%</text>
    </svg>
);

// ── Medal ────────────────────────────────────────────────────────────────────
const MedalIcon = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ transformOrigin: '50% 10%', animation: 'medalSwing 2s ease-in-out infinite' }}>
        <defs><linearGradient id="medal" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fff7a0" /><stop offset="50%" stopColor="#ffd700" /><stop offset="100%" stopColor="#b8860b" /></linearGradient></defs>
        <rect x="17" y="1" width="6" height="14" rx="1" fill="#6366f1" />
        <circle cx="20" cy="28" r="11" fill="url(#medal)" stroke="#b8860b" strokeWidth="1.5" />
        <circle cx="20" cy="28" r="8" fill="none" stroke="#fff7a0" strokeWidth=".8" opacity=".6" />
        <text x="20" y="32" fontFamily="serif" fontWeight="900" fontSize="10" fill="#b8860b" textAnchor="middle">★</text>
    </svg>
);

// ── VIP Ribbon ────────────────────────────────────────────────────────────────
const RibbonIcon = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'ribbonPulse 2s ease-in-out infinite' }}>
        <defs><linearGradient id="rib" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#c084fc" /><stop offset="100%" stopColor="#7c3aed" /></linearGradient></defs>
        <circle cx="20" cy="16" r="13" fill="url(#rib)" stroke="#6d28d9" strokeWidth="1" />
        <polygon points="12,28 20,24 28,28 26,38 20,34 14,38" fill="#7c3aed" />
        <text x="20" y="20" fontFamily="system-ui" fontWeight="900" fontSize="9" fill="#fff" textAnchor="middle">VIP</text>
    </svg>
);

// ── Diamond Gem (colored) ─────────────────────────────────────────────────────
const EmeraldIcon = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'gemSpin 3s ease-in-out infinite' }}>
        <defs><linearGradient id="emg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#a7f3d0" /><stop offset="50%" stopColor="#10b981" /><stop offset="100%" stopColor="#064e3b" /></linearGradient></defs>
        <polygon points="20,3 36,14 36,28 20,37 4,28 4,14" fill="url(#emg)" stroke="#059669" strokeWidth="1" />
        <polygon points="20,3 36,14 20,20" fill="rgba(255,255,255,.28)" />
        <polygon points="4,14 20,20 4,28" fill="rgba(0,80,40,.3)" />
    </svg>
);

// ── Rocket ────────────────────────────────────────────────────────────────────
const RocketIcon = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'giftBounce 1.6s ease-in-out infinite' }}>
        <defs><linearGradient id="rkt" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#f1f5f9" /><stop offset="100%" stopColor="#94a3b8" /></linearGradient></defs>
        <path d="M20 2 Q28 4 28 20 L20 28 L12 20 Q12 4 20 2 Z" fill="url(#rkt)" stroke="#64748b" strokeWidth="1" />
        <circle cx="20" cy="16" r="4" fill="#3b82f6" />
        <path d="M12 20 L6 28 L12 26 Z" fill="#ef4444" />
        <path d="M28 20 L34 28 L28 26 Z" fill="#ef4444" />
        <path d="M16 28 Q18 36 20 38 Q22 36 24 28" fill="#fbbf24" opacity=".8" />
    </svg>
);

// ── Icon map ──────────────────────────────────────────────────────────────────
const PREMIUM_ICONS = [
    { key: 'GoldCrown', label: 'Gold Crown', C: GoldCrownIcon },
    { key: 'SilverCrown', label: 'Silver Crown', C: SilverCrownIcon },
    { key: 'BronzeCrown', label: 'Bronze Crown', C: BronzeCrownIcon },
    { key: 'Diamond', label: 'Diamond', C: DiamondIcon },
    { key: 'Trophy', label: 'Trophy', C: TrophyIcon },
    { key: 'GoldStar', label: 'Gold Star', C: GoldStarIcon },
    { key: 'Gift', label: 'Gift Box', C: GiftIcon },
    { key: 'Lightning', label: 'Lightning', C: LightningIcon },
    { key: 'Percent', label: 'Discount %', C: PercentIcon },
    { key: 'Medal', label: 'Medal', C: MedalIcon },
    { key: 'Ribbon', label: 'VIP Ribbon', C: RibbonIcon },
    { key: 'Emerald', label: 'Emerald', C: EmeraldIcon },
    { key: 'Rocket', label: 'Rocket', C: RocketIcon },
];

function PremiumIcon({ iconKey, size = 36 }) {
    const icon = PREMIUM_ICONS.find(i => i.key === iconKey);
    if (!icon) return null;
    return <icon.C size={size} />;
}

/* ══════════════════════════════════════════════════════════════════════════
   PALETTES
   ══════════════════════════════════════════════════════════════════════════*/

const BG_COLORS = [
    // Dark classics
    { name: 'Jet Black', value: '#0a0a0a' },
    { name: 'Deep Navy', value: '#001f3f' },
    { name: 'Dark Brown', value: '#1c1008' },
    { name: 'Royal Purple', value: '#2e1065' },
    { name: 'Crimson', value: '#7f1d1d' },
    { name: 'Forest Night', value: '#052e16' },
    { name: 'Steel Blue', value: '#1565c0' },
    { name: 'Charcoal', value: '#1e293b' },
    { name: 'Espresso', value: '#1a0a00' },
    { name: 'Teal Dark', value: '#0d3d40' },
    // Vibrant & vivid
    { name: 'Spring Green', value: 'linear-gradient(135deg,#00c853,#69f0ae)' },
    { name: 'Electric Yellow', value: 'linear-gradient(135deg,#f9a825,#ffee58)' },
    { name: 'Spring Lime', value: 'linear-gradient(135deg,#76ff03,#ccff90)' },
    { name: 'Hot Pink', value: 'linear-gradient(135deg,#e91e63,#f48fb1)' },
    { name: 'Coral Blaze', value: 'linear-gradient(135deg,#ff6d00,#ff9e40)' },
    { name: 'Turquoise', value: 'linear-gradient(135deg,#00bcd4,#80deea)' },
    { name: 'Electric Blue', value: 'linear-gradient(135deg,#1565c0,#42a5f5)' },
    { name: 'Violet Burst', value: 'linear-gradient(135deg,#6a1b9a,#ce93d8)' },
    // Metallic
    { name: 'Gold Metallic', value: 'linear-gradient(135deg,#3d2b00 0%,#7a5600 30%,#c49a00 50%,#7a5600 70%,#3d2b00 100%)' },
    { name: 'Silver Metallic', value: 'linear-gradient(135deg,#1e1e1e 0%,#5a5a5a 30%,#b0b0b0 50%,#5a5a5a 70%,#1e1e1e 100%)' },
    { name: 'Bronze Metallic', value: 'linear-gradient(135deg,#1a0a00 0%,#5a2e00 30%,#a05a00 50%,#5a2e00 70%,#1a0a00 100%)' },
    { name: 'Platinum', value: 'linear-gradient(135deg,#303030 0%,#7a7a7a 40%,#e0e0e0 50%,#7a7a7a 60%,#303030 100%)' },
];

const CARD_STYLES = [
    {
        key: 'glass',
        label: 'Glass 🪟',
        desc: 'Frosted glass',
        getBorder: () => '1px solid rgba(255,255,255,0.25)',
        getShadow: () => '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.35), inset 0 -1px 1px rgba(0,0,0,0.4)',
        getOverlay: () => 'linear-gradient(155deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.04) 40%, rgba(0,0,0,0.1) 100%)',
        backdropFilter: 'blur(12px) saturate(180%)',
        borderRadius: 14,
    },
    {
        key: 'metal',
        label: 'Metal 🔩',
        desc: 'Brushed metallic',
        getBorder: () => '1px solid rgba(255,255,255,0.3)',
        getShadow: () => '0 12px 40px rgba(0,0,0,0.8), inset 0 2px 2px rgba(255,255,255,0.45), inset 0 -2px 6px rgba(0,0,0,0.7), inset 4px 0 8px rgba(255,255,255,0.08)',
        getOverlay: () => 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.03) 35%, rgba(0,0,0,0.22) 100%)',
        backdropFilter: 'none',
        borderRadius: 12,
    },
    {
        key: 'crystal',
        label: 'Crystal 💎',
        desc: 'Refractive deep crystal',
        getBorder: () => '1.5px solid rgba(180,220,255,0.4)',
        getShadow: () => '0 16px 48px rgba(0,0,60,0.7), 0 0 20px rgba(100,180,255,0.15), inset 0 2px 3px rgba(255,255,255,0.5), inset 0 -2px 8px rgba(0,0,100,0.4)',
        getOverlay: () => 'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(200,230,255,0.05) 40%, rgba(0,50,120,0.18) 100%)',
        backdropFilter: 'blur(8px) saturate(200%)',
        borderRadius: 14,
    },
    {
        key: 'matte',
        label: 'Matte 🪵',
        desc: 'Subtle elevation',
        getBorder: () => '1px solid rgba(255,255,255,0.07)',
        getShadow: () => '0 6px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.1)',
        getOverlay: () => 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 40%)',
        backdropFilter: 'none',
        borderRadius: 10,
    },
];

const SHINES = [
    { key: 'none', label: 'None' },
    { key: 'gold', label: '🟡 Gold', grad: 'linear-gradient(105deg, transparent 10%, rgba(255,220,80,.03) 28%, rgba(255,248,160,.38) 50%, rgba(255,220,80,.03) 72%, transparent 90%)' },
    { key: 'silver', label: '⚪ Silver', grad: 'linear-gradient(105deg, transparent 10%, rgba(200,210,230,.03) 28%, rgba(255,255,255,.40) 50%, rgba(200,210,230,.03) 72%, transparent 90%)' },
    { key: 'bronze', label: '🟤 Bronze', grad: 'linear-gradient(105deg, transparent 10%, rgba(160,100,30,.04) 28%, rgba(225,175,90,.36) 50%, rgba(160,100,30,.04) 72%, transparent 90%)' },
];

const GLOBAL_CSS = `
${ICON_CSS}
@keyframes shineLoop {
    0%, 65% { transform: translateX(-130%) skewX(-18deg); opacity: 0; }
    8%       { opacity: 1; }
    55%      { opacity: 1; }
    62%,100% { transform: translateX(230%)  skewX(-18deg); opacity: 0; }
}
`;

/* ─── Card helpers ───────────────────────────────────────────────────────── */
const ImgPlaceholder = ({ style = {} }) => (
    <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
        <FaImage style={{ opacity: .13, fontSize: '1.2rem' }} />
    </div>
);

function ShineOverlay({ shine }) {
    const s = SHINES.find(x => x.key === shine);
    if (!s?.grad) return null;
    return <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '60%', background: s.grad, animation: 'shineLoop 6s ease-in-out infinite', pointerEvents: 'none', zIndex: 20 }} />;
}

function Identity({ d, size = 36 }) {
    if (d.identityMode === 'icon' && d.iconKey) {
        return <PremiumIcon iconKey={d.iconKey} size={size} />;
    }
    if (d.logoUrl) {
        return <img src={d.logoUrl} alt="logo" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,.3)', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,.5)' }} onError={e => { e.target.style.display = 'none'; }} />;
    }
    return <GoldCrownIcon size={size} />;
}

function Card3D({ d, children }) {
    const cs = CARD_STYLES.find(s => s.key === d.cardStyle) || CARD_STYLES[0];
    return (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '5/1', borderRadius: cs.borderRadius, overflow: 'hidden', background: d.bgColor, border: cs.getBorder(), boxShadow: cs.getShadow(), backdropFilter: cs.backdropFilter, WebkitBackdropFilter: cs.backdropFilter, transform: 'translateZ(0)' }}>
            <div style={{ position: 'absolute', inset: 0, background: cs.getOverlay(), pointerEvents: 'none', zIndex: 8 }} />
            <ShineOverlay shine={d.shine} />
            <div style={{ position: 'relative', zIndex: 5, height: '100%', display: 'flex' }}>{children}</div>
        </div>
    );
}

/* ──────────────────────────────────────────────────────── 6 TEMPLATES ───── */
function M1({ d }) {
    const ts = (d.titleSize || 13) + 'px', ds = (d.descSize || 10) + 'px';
    return <Card3D d={d}><div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 14px', gap: 3 }}><div style={{ fontSize: ts, fontWeight: 900, color: d.titleColor || '#fff', textTransform: 'uppercase', letterSpacing: '.5px', lineHeight: 1.15, textShadow: '0 1px 6px rgba(0,0,0,.8)' }}>{d.title || 'SPECIAL OFFER!'}</div><div style={{ fontSize: ds, color: d.descColor || 'rgba(255,255,255,.65)', textTransform: 'uppercase', letterSpacing: '.3px' }}>{d.description || '50% OFF · LIMITED TIME'}</div></div><div style={{ width: '35%', flexShrink: 0, overflow: 'hidden' }}>{d.imageUrl ? <img src={d.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImgPlaceholder />}</div></Card3D>;
}

function M2({ d }) {
    const ts = (d.titleSize || 13) + 'px', ds = (d.descSize || 10) + 'px';
    const iz = d.iconSize || 28;
    const solidBg = d.bgColor.startsWith('linear') ? '#0a0a0a' : d.bgColor;
    return <Card3D d={d}>
        <div style={{ position: 'absolute', inset: 0, background: solidBg, clipPath: 'polygon(0 0, 70% 0, 30% 100%, 0 100%)', zIndex: 1 }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '70%', overflow: 'hidden', zIndex: 0 }}>
            {d.imageUrl ? <img src={d.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImgPlaceholder />}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 14, gap: 3, zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Identity d={d} size={iz} />
                <div style={{ fontSize: ts, fontWeight: 900, color: d.titleColor || '#fff', textTransform: 'uppercase', letterSpacing: '.5px', lineHeight: 1.15, textShadow: '0 1px 6px rgba(0,0,0,.8)' }}>{d.title || 'HAPPY HOUR IS HERE!'}</div>
            </div>
            <div style={{ fontSize: ds, color: d.descColor || 'rgba(255,255,255,.65)', textTransform: 'uppercase', letterSpacing: '.3px' }}>{d.description || 'ALL DRINKS HALF PRICE'}</div>
        </div>
    </Card3D>;
}

function M3({ d }) {
    const ts = (d.titleSize || 13) + 'px', ds = (d.descSize || 10) + 'px';
    const iz = d.iconSize || 28;
    return <Card3D d={d}>{d.imageUrl && <img src={d.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />}<div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(0,0,0,.32) 0%, rgba(0,0,0,.72) 100%)', zIndex: 1 }} /><div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 38px', position: 'relative', zIndex: 2 }}><div style={{ fontSize: ts, fontWeight: 900, color: d.titleColor || '#fff', textTransform: 'uppercase', letterSpacing: '.8px', lineHeight: 1.1, textShadow: '0 2px 10px rgba(0,0,0,.9)' }}>{d.title || 'EXCLUSIVE DJ NIGHT'}</div><div style={{ fontSize: ds, color: d.descColor || 'rgba(255,255,255,.7)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '.4px' }}>{d.description || 'BOOK A TABLE FOR 25% OFF'}</div></div><div style={{ position: 'absolute', top: 7, right: 8, zIndex: 15, width: Math.max(iz, 20), height: Math.max(iz, 20), borderRadius: '50%', border: '2px solid rgba(255,255,255,.35)', overflow: 'hidden', background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Identity d={d} size={Math.max(iz - 8, 14)} /></div></Card3D>;
}

function M4({ d }) {
    const ts = (d.titleSize || 13) + 'px', ds = (d.descSize || 10) + 'px';
    const iz = d.iconSize || 28;
    return <Card3D d={d}><div style={{ flex: 1, paddingLeft: 14, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}><div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Identity d={d} size={iz} /><div style={{ fontSize: ts, fontWeight: 900, color: d.titleColor || '#fff', textTransform: 'uppercase', letterSpacing: '.4px', lineHeight: 1.1, textShadow: '0 1px 6px rgba(0,0,0,.8)' }}>{d.title || 'PREMIUM BREAKFAST'}</div></div><div style={{ fontSize: ds, color: d.descColor || 'rgba(255,255,255,.68)', textTransform: 'uppercase', letterSpacing: '.3px' }}>{d.description || 'SPECIAL COMBO 19 SAR'}</div></div><div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', border: '3px solid rgba(255,255,255,.25)', boxShadow: '0 4px 20px rgba(0,0,0,.6)', zIndex: 10 }}>{d.imageUrl ? <img src={d.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImgPlaceholder />}</div></Card3D>;
}

function M5({ d }) {
    const dark = !d.bgColor.startsWith('#') || parseInt(d.bgColor.slice(1, 3), 16) < 140;
    const tc = d.titleColor || (dark ? '#fff' : '#111'), sc = d.descColor || (dark ? 'rgba(255,255,255,.58)' : '#555');
    const ts = (d.titleSize || 13) + 'px', ds = (d.descSize || 10) + 'px';
    const iz = d.iconSize || 28;
    return <Card3D d={d}><div style={{ width: '22%', flexShrink: 0, height: '100%', overflow: 'hidden' }}>{d.imageUrl ? <img src={d.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImgPlaceholder style={{ background: 'rgba(255,255,255,.06)' }} />}</div><div style={{ flex: 1, textAlign: 'center', padding: '0 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}><div style={{ fontSize: ts, fontWeight: 700, color: tc, textTransform: 'uppercase', letterSpacing: '1px', lineHeight: 1.2 }}>{d.title || 'ROMANTIC QUIET DINNER'}</div><div style={{ width: 30, height: 1, background: dark ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.15)', margin: '4px 0' }} /><div style={{ fontSize: ds, color: sc, letterSpacing: '.4px', textTransform: 'uppercase' }}>{d.description || '15% OFF FOR COUPLES'}</div></div><div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: sc, paddingRight: 8 }}><Identity d={d} size={iz} /></div></Card3D>;
}

function M6({ d }) {
    const solidBg = d.bgColor.startsWith('linear') ? '#0a0a0a' : d.bgColor;
    const ts = (d.titleSize || 13) + 'px', ds = (d.descSize || 10) + 'px';
    const iz = d.iconSize || 28;
    return <Card3D d={d}><div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '46%', overflow: 'hidden', zIndex: 1 }}>{d.imageUrl ? <img src={d.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: .52 }} /> : <div style={{ width: '100%', height: '100%' }} />}<div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, ${solidBg} 0%, transparent 55%)` }} /></div><div style={{ zIndex: 4, paddingLeft: 14, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}><div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Identity d={d} size={iz} /><div style={{ fontSize: ts, fontWeight: 900, color: d.titleColor || '#ffd600', textTransform: 'uppercase', letterSpacing: '.5px', textShadow: '0 0 10px rgba(255,214,0,.55)' }}>{d.title || "DON'T MISS OUT!"}</div></div><div style={{ fontSize: ds, fontWeight: 900, color: d.descColor || '#fff', textTransform: 'uppercase', letterSpacing: '.4px', lineHeight: 1.1, textShadow: '0 2px 8px rgba(0,0,0,.9)' }}>{d.description || 'BUY 1 GET 1 FREE'}</div></div></Card3D>;
}

const TEMPLATES = [
    { id: 1, label: 'Classic Split', sub: 'Text · Image right', C: M1 },
    { id: 2, label: 'Typography First', sub: 'Centered bold text', C: M2 },
    { id: 3, label: 'Floating Card', sub: 'Full-bleed image + overlay', C: M3 },
    { id: 4, label: 'Overlapping', sub: 'Text + Circular image', C: M4 },
    { id: 5, label: 'Minimalist', sub: 'Square image + clean text', C: M5 },
    { id: 6, label: 'Action', sub: 'Bold CTA + Image right', C: M6 },
];

/* ─── UI atoms ───────────────────────────────────────────────────────────── */
const inp = { padding: '7px 11px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#f1f5f9', fontSize: '0.82rem', outline: 'none', width: '100%' };
function SH({ emoji, label }) { return <div style={{ fontSize: '0.67rem', fontWeight: 800, color: 'rgba(255,255,255,.42)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>{emoji} {label}</div>; }
function TabBtn({ label, active, onClick }) { return <button onClick={onClick} style={{ padding: '4px 9px', borderRadius: 7, border: `1px solid ${active ? 'rgba(167,139,250,.6)' : 'rgba(255,255,255,.1)'}`, background: active ? 'rgba(167,139,250,.15)' : 'transparent', color: active ? '#a78bfa' : 'rgba(255,255,255,.44)', cursor: 'pointer', fontSize: '0.71rem', fontWeight: active ? 700 : 500, whiteSpace: 'nowrap' }}>{label}</button>; }
function Swatch({ value, selected, onClick, title, size = 22 }) { return <button onClick={onClick} title={title} style={{ width: size, height: size, borderRadius: '50%', background: value, border: `2px solid ${selected ? '#a78bfa' : 'rgba(255,255,255,.12)'}`, cursor: 'pointer', boxShadow: selected ? '0 0 0 1.5px rgba(167,139,250,.5)' : 'none', flexShrink: 0, transition: 'border-color .15s' }} />; }

/* ─── Main ───────────────────────────────────────────────────────────────── */
const ProOfferTemplates = ({ onBack, editOffer = null }) => {
    const { userProfile } = useAuth();
    // 7 basic text colors
    const TEXT_COLORS = [
        { name: 'White', v: '#ffffff' },
        { name: 'Yellow', v: '#ffd600' },
        { name: 'Gold', v: '#D4AF37' },
        { name: 'Red', v: '#ef4444' },
        { name: 'Cyan', v: '#22d3ee' },
        { name: 'Green', v: '#4ade80' },
        { name: 'Black', v: '#111111' },
    ];

    const [data, setData] = useState({
        title: '', description: '', imageUrl: null,
        identityMode: 'logo', iconKey: 'GoldCrown',
        logoUrl: getSafeAvatar(userProfile),
        bgColor: '#0a0a0a', cardStyle: 'glass', shine: 'none',
        titleSize: 13, titleColor: '#ffffff',
        descSize: 10, descColor: 'rgba(255,255,255,0.65)',
        iconSize: 28,
    });
    const [imageFile, setImageFile] = useState(null);
    const [selected, setSelected] = useState(null);
    const [publishing, setPublishing] = useState(false);
    const [success, setSuccess] = useState(false);
    const imageRef = useRef(null);
    const set = (k, v) => setData(p => ({ ...p, [k]: v }));

    // Prefill editor when editing an existing offer
    useEffect(() => {
        if (!editOffer) return;
        setData(prev => ({
            ...prev,
            title: editOffer.title || '',
            description: editOffer.description || '',
            imageUrl: editOffer.imageUrl || null,
            identityMode: editOffer.identityMode || 'logo',
            iconKey: editOffer.iconKey || 'GoldCrown',
            bgColor: editOffer.bgColor || '#0a0a0a',
            cardStyle: editOffer.cardStyle || 'glass',
            shine: editOffer.shine || 'none',
            titleSize: editOffer.titleSize || 13,
            titleColor: editOffer.titleColor || '#ffffff',
            descSize: editOffer.descSize || 10,
            descColor: editOffer.descColor || 'rgba(255,255,255,0.65)',
            iconSize: editOffer.iconSize || 28,
        }));
        if (editOffer.templateId) setSelected(editOffer.templateId);
    }, [editOffer]);

    const handleImage = (e) => {
        const f = e.target.files[0]; if (!f) return;
        setImageFile(f); set('imageUrl', URL.createObjectURL(f));
    };
    const publish = async () => {
        if (!selected) { alert('Please select a design'); return; }
        if (!data.title.trim()) { alert('Please add a title'); return; }
        try {
            setPublishing(true);
            const pd = { ...data, templateId: selected, imageUrl: data.imageUrl?.startsWith('blob:') ? null : data.imageUrl };
            if (editOffer?.id) {
                // UPDATE existing offer
                await premiumOfferService.updateOffer(editOffer.id, pd, imageFile);
            } else {
                // CREATE new offer
                await premiumOfferService.createOffer(pd, imageFile);
            }
            setSuccess(true);
            setTimeout(() => { setSuccess(false); onBack?.(); }, 2000);
        } catch (err) { alert(`Failed to publish: ${err.message}`); }
        finally { setPublishing(false); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <style>{GLOBAL_CSS}</style>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,.26)', marginBottom: 12 }}>Choose a design — all cards update live as you edit the content below</div>

            {/* 2×3 grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 22 }}>
                {TEMPLATES.map(({ id, label, sub, C }) => {
                    const sel = selected === id;
                    return (
                        <div key={id} onClick={() => setSelected(id)}
                            style={{ cursor: 'pointer', borderRadius: 12, border: `2px solid ${sel ? '#a78bfa' : 'transparent'}`, padding: 2, transition: 'border-color .15s', position: 'relative' }}>
                            {sel && <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 30, background: '#7c3aed', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaCheckCircle style={{ color: '#fff', fontSize: '0.62rem' }} /></div>}
                            <C d={data} />
                            <div style={{ textAlign: 'center', marginTop: 4 }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: sel ? '#a78bfa' : '#f1f5f9' }}>{label}</div>
                                <div style={{ fontSize: '0.59rem', color: 'rgba(255,255,255,.25)' }}>{sub}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 5 control columns */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 16, display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, alignItems: 'start' }}>

                {/* 1 Text */}
                <div>
                    <SH emoji="📝" label="Text" />

                    {/* Title */}
                    <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,.3)', marginBottom: 3 }}>Title</div>
                        <input value={data.title} onChange={e => set('title', e.target.value)} placeholder="SPECIAL OFFER!" style={inp} />
                        {/* Size slider */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                            <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,.28)', whiteSpace: 'nowrap' }}>A {data.titleSize}px</span>
                            <input type="range" min={10} max={24} value={data.titleSize} onChange={e => set('titleSize', Number(e.target.value))}
                                style={{ flex: 1, accentColor: '#a78bfa', cursor: 'pointer', height: 3 }} />
                        </div>
                        {/* 7 color swatches */}
                        <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                            {TEXT_COLORS.map(c => (
                                <button key={c.name} onClick={() => set('titleColor', c.v)} title={c.name}
                                    style={{ width: 18, height: 18, borderRadius: '50%', background: c.v, border: `2px solid ${data.titleColor === c.v ? '#a78bfa' : 'rgba(255,255,255,.15)'}`, cursor: 'pointer', flexShrink: 0, boxShadow: c.v === '#111111' ? 'inset 0 0 0 1px rgba(255,255,255,.2)' : 'none' }} />
                            ))}
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <div style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,.3)', marginBottom: 3 }}>Description</div>
                        <input value={data.description} onChange={e => set('description', e.target.value)} placeholder="50% OFF · LIMITED TIME" style={inp} />
                        {/* Size slider */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                            <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,.28)', whiteSpace: 'nowrap' }}>A {data.descSize}px</span>
                            <input type="range" min={8} max={18} value={data.descSize} onChange={e => set('descSize', Number(e.target.value))}
                                style={{ flex: 1, accentColor: '#a78bfa', cursor: 'pointer', height: 3 }} />
                        </div>
                        {/* 7 color swatches */}
                        <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                            {TEXT_COLORS.map(c => (
                                <button key={c.name} onClick={() => set('descColor', c.v)} title={c.name}
                                    style={{ width: 18, height: 18, borderRadius: '50%', background: c.v, border: `2px solid ${data.descColor === c.v ? '#a78bfa' : 'rgba(255,255,255,.15)'}`, cursor: 'pointer', flexShrink: 0, boxShadow: c.v === '#111111' ? 'inset 0 0 0 1px rgba(255,255,255,.2)' : 'none' }} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* 2 Image */}
                <div>
                    <SH emoji="🖼️" label="Image" />
                    <input ref={imageRef} type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
                    {data.imageUrl
                        ? <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,.1)', aspectRatio: '3/1' }}>
                            <img src={data.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button onClick={() => { set('imageUrl', null); setImageFile(null); }} style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,.75)', border: 'none', color: '#fff', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.56rem' }}><FaTimes /></button>
                        </div>
                        : <button onClick={() => imageRef.current?.click()} style={{ ...inp, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 58, gap: 5, borderStyle: 'dashed' }}>
                            <FaUpload style={{ opacity: .33, fontSize: '1rem' }} />
                            <span style={{ fontSize: '0.68rem', opacity: .36 }}>Upload image</span>
                        </button>}
                </div>

                {/* 3 Identity */}
                <div>
                    <SH emoji="🏷️" label="Identity" />
                    <div style={{ display: 'flex', gap: 5, marginBottom: 7 }}>
                        <TabBtn label="Logo" active={data.identityMode === 'logo'} onClick={() => set('identityMode', 'logo')} />
                        <TabBtn label="Icon" active={data.identityMode === 'icon'} onClick={() => set('identityMode', 'icon')} />
                    </div>

                    {/* Size slider — shared for both logo & icon */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,.28)', whiteSpace: 'nowrap' }}>⬡ {data.iconSize}px</span>
                        <input type="range" min={16} max={60} value={data.iconSize} onChange={e => set('iconSize', Number(e.target.value))}
                            style={{ flex: 1, accentColor: '#a78bfa', cursor: 'pointer', height: 3 }} />
                    </div>

                    {data.identityMode === 'icon' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4 }}>
                            {PREMIUM_ICONS.map(ic => (
                                <button key={ic.key} onClick={() => set('iconKey', ic.key)} title={ic.label}
                                    style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${data.iconKey === ic.key ? 'rgba(167,139,250,.7)' : 'rgba(255,255,255,.07)'}`, background: data.iconKey === ic.key ? 'rgba(167,139,250,.14)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2 }}>
                                    <PremiumIcon iconKey={ic.key} size={22} />
                                </button>
                            ))}
                        </div>
                    )}
                    {data.identityMode === 'logo' && <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,.24)', marginTop: 4 }}>Your profile logo</div>}
                </div>

                {/* 4 Background */}
                <div>
                    <SH emoji="🎨" label="Background" />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 7 }}>
                        {BG_COLORS.map(c => <Swatch key={c.name} value={c.value} selected={data.bgColor === c.value} onClick={() => set('bgColor', c.value)} title={c.name} />)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="color" value={data.bgColor?.startsWith('linear') ? '#1a1a1a' : data.bgColor} onChange={e => set('bgColor', e.target.value)}
                            style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(255,255,255,.15)', background: 'none', cursor: 'pointer', padding: 2 }} />
                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,.26)' }}>Custom</span>
                    </div>
                </div>

                {/* 5 Card Style + Shine */}
                <div>
                    <SH emoji="💎" label="Surface" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                        {CARD_STYLES.map(s => (
                            <button key={s.key} onClick={() => set('cardStyle', s.key)}
                                style={{ textAlign: 'left', padding: '5px 9px', borderRadius: 8, border: `1px solid ${data.cardStyle === s.key ? 'rgba(167,139,250,.6)' : 'rgba(255,255,255,.07)'}`, background: data.cardStyle === s.key ? 'rgba(167,139,250,.12)' : 'transparent', cursor: 'pointer', color: data.cardStyle === s.key ? '#c4b5fd' : 'rgba(255,255,255,.4)', fontSize: '0.71rem', fontWeight: data.cardStyle === s.key ? 700 : 400 }}>
                                <span style={{ fontWeight: 700 }}>{s.label}</span>
                                <span style={{ fontSize: '0.6rem', opacity: .6, display: 'block' }}>{s.desc}</span>
                            </button>
                        ))}
                    </div>
                    <div style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,.3)', marginBottom: 5 }}>✨ Shine sweep</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {SHINES.map(s => <TabBtn key={s.key} label={s.label} active={data.shine === s.key} onClick={() => set('shine', s.key)} />)}
                    </div>
                </div>
            </div>

            {/* Publish */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                {selected
                    ? <div style={{ fontSize: '0.77rem', color: 'rgba(255,255,255,.34)' }}>Template: <strong style={{ color: '#a78bfa' }}>{TEMPLATES.find(t => t.id === selected)?.label}</strong></div>
                    : <div style={{ fontSize: '0.77rem', color: 'rgba(255,255,255,.2)' }}>← Select a design first</div>}
                <div style={{ flex: 1 }} />
                {success && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontWeight: 700, fontSize: '0.82rem' }}><FaCheckCircle /> {editOffer ? 'Saved!' : 'Published!'}</div>}
                <button onClick={publish} disabled={publishing || !selected || !data.title.trim()}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 10, background: selected && data.title.trim() ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'rgba(255,255,255,.06)', border: 'none', color: selected && data.title.trim() ? '#fff' : 'rgba(255,255,255,.2)', fontWeight: 700, fontSize: '0.9rem', cursor: selected && data.title.trim() ? 'pointer' : 'not-allowed' }}>
                    {publishing ? (editOffer ? 'Saving…' : 'Publishing…') : <><FaPaperPlane /> {editOffer ? 'Save Changes' : 'Publish Offer'}</>}
                </button>
            </div>
        </div>
    );
};

export default ProOfferTemplates;
