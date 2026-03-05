/**
 * OfferTemplateRenderer.jsx
 * Shared renderer for the 6 desktop offer templates.
 * Used by both ProOfferTemplates (editor) and PremiumOfferCard (display).
 *
 * Props:
 *   offer  — the Firestore offer object (or live editor data)
 *   scale  — optional CSS scale factor (default 1)
 */

import React from 'react';
import { FaImage } from 'react-icons/fa';

/* ══════════════════════════════════════════════════════════════════
   INLINE ICON LIBRARY (copied from ProOfferTemplates)
   ══════════════════════════════════════════════════════════════════*/
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
@keyframes diamondFacet { 0%,100%{filter:brightness(1) drop-shadow(0 0 6px #b9f2ff)} 50%{filter:brightness(1.4) drop-shadow(0 0 18px #b9f2ff)} }
@keyframes shineLoop {
    0%, 65% { transform: translateX(-130%) skewX(-18deg); opacity: 0; }
    8%       { opacity: 1; }
    55%      { opacity: 1; }
    62%,100% { transform: translateX(230%)  skewX(-18deg); opacity: 0; }
}
`;

/* ── Icon Components ────────────────────────────────────────────── */
const GoldCrownIcon = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'crownFloat 2.5s ease-in-out infinite, crownGlow 2.5s ease-in-out infinite', color: '#ffd700' }}>
        <defs><linearGradient id="r_gcg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fff7a0" /><stop offset="40%" stopColor="#ffd700" /><stop offset="100%" stopColor="#b8860b" /></linearGradient></defs>
        <polygon points="4,30 4,18 12,26 20,8 28,26 36,18 36,30" fill="url(#r_gcg)" stroke="#b8860b" strokeWidth="1" strokeLinejoin="round" />
        <rect x="4" y="30" width="32" height="5" rx="2" fill="url(#r_gcg)" stroke="#b8860b" strokeWidth=".5" />
        <circle cx="4" cy="18" r="2.5" fill="#fff7a0" /><circle cx="20" cy="8" r="2.5" fill="#fff7a0" /><circle cx="36" cy="18" r="2.5" fill="#fff7a0" />
    </svg>
);
const SilverCrownIcon = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'crownFloat 3s ease-in-out infinite, crownGlow 3s ease-in-out infinite', color: '#c0c0c0' }}>
        <defs><linearGradient id="r_scg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ffffff" /><stop offset="45%" stopColor="#c0c0c0" /><stop offset="100%" stopColor="#707070" /></linearGradient></defs>
        <polygon points="4,30 4,18 12,26 20,8 28,26 36,18 36,30" fill="url(#r_scg)" stroke="#808080" strokeWidth="1" strokeLinejoin="round" />
        <rect x="4" y="30" width="32" height="5" rx="2" fill="url(#r_scg)" stroke="#808080" strokeWidth=".5" />
        <circle cx="4" cy="18" r="2.5" fill="#fff" /><circle cx="20" cy="8" r="2.5" fill="#fff" /><circle cx="36" cy="18" r="2.5" fill="#fff" />
    </svg>
);
const BronzeCrownIcon = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'crownFloat 3.5s ease-in-out infinite, crownGlow 3.5s ease-in-out infinite', color: '#cd7f32' }}>
        <defs><linearGradient id="r_bcg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f0c080" /><stop offset="45%" stopColor="#cd7f32" /><stop offset="100%" stopColor="#6b3a10" /></linearGradient></defs>
        <polygon points="4,30 4,18 12,26 20,8 28,26 36,18 36,30" fill="url(#r_bcg)" stroke="#6b3a10" strokeWidth="1" strokeLinejoin="round" />
        <rect x="4" y="30" width="32" height="5" rx="2" fill="url(#r_bcg)" stroke="#6b3a10" strokeWidth=".5" />
        <circle cx="4" cy="18" r="2.5" fill="#f0c080" /><circle cx="20" cy="8" r="2.5" fill="#f0c080" /><circle cx="36" cy="18" r="2.5" fill="#f0c080" />
    </svg>
);
const DiamondIcon = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'diamondFacet 2s ease-in-out infinite' }}>
        <defs><linearGradient id="r_diam" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#e0f7ff" /><stop offset="35%" stopColor="#7dd3fc" /><stop offset="65%" stopColor="#38bdf8" /><stop offset="100%" stopColor="#0369a1" /></linearGradient></defs>
        <polygon points="20,3 38,14 20,37 2,14" fill="url(#r_diam)" stroke="#7dd3fc" strokeWidth="1" />
        <polygon points="20,3 38,14 20,20" fill="rgba(255,255,255,.3)" />
        <polygon points="2,14 20,20 20,37" fill="rgba(0,50,120,.25)" />
        <line x1="2" y1="14" x2="38" y2="14" stroke="#b0e8ff" strokeWidth=".8" opacity=".7" />
    </svg>
);
const TrophyIcon = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'trophyShine 2.2s ease-in-out infinite' }}>
        <defs><linearGradient id="r_troph" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fff7a0" /><stop offset="50%" stopColor="#ffd700" /><stop offset="100%" stopColor="#b8860b" /></linearGradient></defs>
        <path d="M12 4 H28 V18 Q28 28 20 30 Q12 28 12 18 Z" fill="url(#r_troph)" stroke="#b8860b" strokeWidth="1" />
        <path d="M12 10 Q4 10 4 18 Q4 24 12 24" fill="none" stroke="#ffd700" strokeWidth="3" strokeLinecap="round" />
        <path d="M28 10 Q36 10 36 18 Q36 24 28 24" fill="none" stroke="#ffd700" strokeWidth="3" strokeLinecap="round" />
        <rect x="17" y="30" width="6" height="5" fill="url(#r_troph)" />
        <rect x="12" y="35" width="16" height="3" rx="1.5" fill="url(#r_troph)" stroke="#b8860b" strokeWidth=".5" />
        <text x="20" y="20" fontFamily="serif" fontWeight="900" fontSize="10" fill="#b8860b" textAnchor="middle">1</text>
    </svg>
);
const GoldStarIcon = ({ size = 36 }) => (<svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'starPulse 2s ease-in-out infinite' }}><defs><linearGradient id="r_gstar" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fff9c0" /><stop offset="50%" stopColor="#ffd700" /><stop offset="100%" stopColor="#b8860b" /></linearGradient></defs><polygon points="20,2 24.5,14 38,14 27,22 31,35 20,27 9,35 13,22 2,14 15.5,14" fill="url(#r_gstar)" stroke="#b8860b" strokeWidth=".8" /></svg>);
const GiftIcon = ({ size = 36 }) => (<svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'giftBounce 2s ease-in-out infinite' }}><rect x="5" y="18" width="30" height="20" rx="2" fill="#ef4444" stroke="#dc2626" strokeWidth="1" /><rect x="3" y="13" width="34" height="7" rx="2" fill="#dc2626" /><rect x="18" y="3" width="4" height="35" fill="#ffd700" /><rect x="3" y="15" width="34" height="3" fill="#ffd700" /><path d="M20 13 Q14 8 14 4 Q14 1 17 1 Q20 1 20 6 Q20 1 23 1 Q26 1 26 4 Q26 8 20 13 Z" fill="#fbbf24" /></svg>);
const LightningIcon = ({ size = 36 }) => (<svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'lightningZap 1.8s ease-in-out infinite' }}><defs><linearGradient id="r_ltng" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fef08a" /><stop offset="100%" stopColor="#eab308" /></linearGradient></defs><polygon points="22,2 10,22 20,22 18,38 30,16 20,16" fill="url(#r_ltng)" stroke="#ca8a04" strokeWidth=".8" /></svg>);
const PercentIcon = ({ size = 36 }) => (<svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'tagBob 2.2s ease-in-out infinite' }}><defs><linearGradient id="r_ptag" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f87171" /><stop offset="100%" stopColor="#dc2626" /></linearGradient></defs><path d="M6 22 L6 34 L32 34 Q38 34 38 22 L38 6 L22 6 Q6 6 6 22 Z" fill="url(#r_ptag)" stroke="#b91c1c" strokeWidth="1" /><circle cx="10" cy="10" r="3" fill="#fca5a5" /><text x="22" y="27" fontFamily="system-ui" fontWeight="900" fontSize="15" fill="#fff" textAnchor="middle">%</text></svg>);
const MedalIcon = ({ size = 36 }) => (<svg width={size} height={size} viewBox="0 0 40 40" style={{ transformOrigin: '50% 10%', animation: 'medalSwing 2s ease-in-out infinite' }}><defs><linearGradient id="r_medal" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fff7a0" /><stop offset="50%" stopColor="#ffd700" /><stop offset="100%" stopColor="#b8860b" /></linearGradient></defs><rect x="17" y="1" width="6" height="14" rx="1" fill="#6366f1" /><circle cx="20" cy="28" r="11" fill="url(#r_medal)" stroke="#b8860b" strokeWidth="1.5" /><circle cx="20" cy="28" r="8" fill="none" stroke="#fff7a0" strokeWidth=".8" opacity=".6" /><text x="20" y="32" fontFamily="serif" fontWeight="900" fontSize="10" fill="#b8860b" textAnchor="middle">★</text></svg>);
const RibbonIcon = ({ size = 36 }) => (<svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'ribbonPulse 2s ease-in-out infinite' }}><defs><linearGradient id="r_rib" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#c084fc" /><stop offset="100%" stopColor="#7c3aed" /></linearGradient></defs><circle cx="20" cy="16" r="13" fill="url(#r_rib)" stroke="#6d28d9" strokeWidth="1" /><polygon points="12,28 20,24 28,28 26,38 20,34 14,38" fill="#7c3aed" /><text x="20" y="20" fontFamily="system-ui" fontWeight="900" fontSize="9" fill="#fff" textAnchor="middle">VIP</text></svg>);
const EmeraldIcon = ({ size = 36 }) => (<svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'gemSpin 3s ease-in-out infinite' }}><defs><linearGradient id="r_emg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#a7f3d0" /><stop offset="50%" stopColor="#10b981" /><stop offset="100%" stopColor="#064e3b" /></linearGradient></defs><polygon points="20,3 36,14 36,28 20,37 4,28 4,14" fill="url(#r_emg)" stroke="#059669" strokeWidth="1" /><polygon points="20,3 36,14 20,20" fill="rgba(255,255,255,.28)" /><polygon points="4,14 20,20 4,28" fill="rgba(0,80,40,.3)" /></svg>);
const RocketIcon = ({ size = 36 }) => (<svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: 'giftBounce 1.6s ease-in-out infinite' }}><defs><linearGradient id="r_rkt" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#f1f5f9" /><stop offset="100%" stopColor="#94a3b8" /></linearGradient></defs><path d="M20 2 Q28 4 28 20 L20 28 L12 20 Q12 4 20 2 Z" fill="url(#r_rkt)" stroke="#64748b" strokeWidth="1" /><circle cx="20" cy="16" r="4" fill="#3b82f6" /><path d="M12 20 L6 28 L12 26 Z" fill="#ef4444" /><path d="M28 20 L34 28 L28 26 Z" fill="#ef4444" /><path d="M16 28 Q18 36 20 38 Q22 36 24 28" fill="#fbbf24" opacity=".8" /></svg>);

const ICON_MAP = {
    GoldCrown: GoldCrownIcon, SilverCrown: SilverCrownIcon, BronzeCrown: BronzeCrownIcon,
    Diamond: DiamondIcon, Trophy: TrophyIcon, GoldStar: GoldStarIcon,
    Gift: GiftIcon, Lightning: LightningIcon, Percent: PercentIcon,
    Medal: MedalIcon, Ribbon: RibbonIcon, Emerald: EmeraldIcon, Rocket: RocketIcon,
};

/* ══════════════════════════════════════════════════════════════════
   CARD STYLES
   ══════════════════════════════════════════════════════════════════*/
const CARD_STYLES = {
    glass: { border: '1px solid rgba(255,255,255,0.25)', shadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.35)', overlay: 'linear-gradient(155deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.04) 40%, rgba(0,0,0,0.1) 100%)', backdrop: 'blur(12px) saturate(180%)', radius: 14 },
    metal: { border: '1px solid rgba(255,255,255,0.3)', shadow: '0 12px 40px rgba(0,0,0,0.8), inset 0 2px 2px rgba(255,255,255,0.45)', overlay: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.03) 35%, rgba(0,0,0,0.22) 100%)', backdrop: 'none', radius: 12 },
    crystal: { border: '1.5px solid rgba(180,220,255,0.4)', shadow: '0 16px 48px rgba(0,0,60,0.7), inset 0 2px 3px rgba(255,255,255,0.5)', overlay: 'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(200,230,255,0.05) 40%, rgba(0,50,120,0.18) 100%)', backdrop: 'blur(8px) saturate(200%)', radius: 14 },
    matte: { border: '1px solid rgba(255,255,255,0.07)', shadow: '0 6px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.1)', overlay: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 40%)', backdrop: 'none', radius: 10 },
};

const SHINES = {
    gold: 'linear-gradient(105deg, transparent 10%, rgba(255,220,80,.03) 28%, rgba(255,248,160,.38) 50%, rgba(255,220,80,.03) 72%, transparent 90%)',
    silver: 'linear-gradient(105deg, transparent 10%, rgba(200,210,230,.03) 28%, rgba(255,255,255,.40) 50%, rgba(200,210,230,.03) 72%, transparent 90%)',
    bronze: 'linear-gradient(105deg, transparent 10%, rgba(160,100,30,.04) 28%, rgba(225,175,90,.36) 50%, rgba(160,100,30,.04) 72%, transparent 90%)',
};

/* ── Helpers ──────────────────────────────────────────────────────*/
const ImgPlaceholder = () => (
    <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FaImage style={{ opacity: .13, fontSize: '1rem' }} />
    </div>
);

function PremiumIcon({ iconKey, size = 36 }) {
    const C = ICON_MAP[iconKey];
    return C ? <C size={size} /> : null;
}

function IdentityEl({ offer }) {
    const iz = offer.iconSize || 28;
    if (offer.identityMode === 'icon' && offer.iconKey) return <PremiumIcon iconKey={offer.iconKey} size={iz} />;
    if (offer.logoUrl) return <img src={offer.logoUrl} alt="logo" style={{ width: iz, height: iz, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,.3)', boxShadow: '0 2px 8px rgba(0,0,0,.5)' }} onError={e => { e.target.style.display = 'none'; }} />;
    return <GoldCrownIcon size={iz} />;
}

function ShineEl({ shine }) {
    const grad = SHINES[shine];
    if (!grad) return null;
    return <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '60%', background: grad, animation: 'shineLoop 6s ease-in-out infinite', pointerEvents: 'none', zIndex: 20 }} />;
}

/* ── Card3D wrapper ───────────────────────────────────────────────*/
function Card3D({ offer, children }) {
    const cs = CARD_STYLES[offer.cardStyle] || CARD_STYLES.glass;
    return (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '5/1', borderRadius: cs.radius, overflow: 'hidden', background: offer.bgColor || '#0a0a0a', border: cs.border, boxShadow: cs.shadow, backdropFilter: cs.backdrop, WebkitBackdropFilter: cs.backdrop, transform: 'translateZ(0)' }}>
            <div style={{ position: 'absolute', inset: 0, background: cs.overlay, pointerEvents: 'none', zIndex: 8 }} />
            <ShineEl shine={offer.shine} />
            <div style={{ position: 'relative', zIndex: 5, height: '100%', display: 'flex' }}>{children}</div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════
   6 TEMPLATE RENDERERS
   ══════════════════════════════════════════════════════════════════*/
function T1({ o }) {
    const ts = (o.titleSize || 13) + 'px', ds = (o.descSize || 10) + 'px';
    return <Card3D offer={o}><div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 14px', gap: 3 }}><div style={{ fontSize: ts, fontWeight: 900, color: o.titleColor || '#fff', textTransform: 'uppercase', letterSpacing: '.5px', lineHeight: 1.15, textShadow: '0 1px 6px rgba(0,0,0,.8)' }}>{o.title || 'SPECIAL OFFER!'}</div><div style={{ fontSize: ds, color: o.descColor || 'rgba(255,255,255,.65)', textTransform: 'uppercase', letterSpacing: '.3px' }}>{o.description || '50% OFF · LIMITED TIME'}</div></div><div style={{ width: '35%', flexShrink: 0, overflow: 'hidden' }}>{o.imageUrl ? <img src={o.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImgPlaceholder />}</div></Card3D>;
}

function T2({ o }) {
    const ts = (o.titleSize || 13) + 'px', ds = (o.descSize || 10) + 'px';
    const solidBg = o.bgColor?.startsWith('linear') ? '#0a0a0a' : (o.bgColor || '#0a0a0a');
    return <Card3D offer={o}>
        <div style={{ position: 'absolute', inset: 0, background: solidBg, clipPath: 'polygon(0 0, 70% 0, 30% 100%, 0 100%)', zIndex: 1 }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '70%', overflow: 'hidden', zIndex: 0 }}>{o.imageUrl ? <img src={o.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImgPlaceholder />}</div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 14, gap: 3, position: 'relative', zIndex: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><IdentityEl offer={o} /><div style={{ fontSize: ts, fontWeight: 900, color: o.titleColor || '#fff', textTransform: 'uppercase', letterSpacing: '.5px', lineHeight: 1.15, textShadow: '0 1px 6px rgba(0,0,0,.8)' }}>{o.title || 'HAPPY HOUR IS HERE!'}</div></div>
            <div style={{ fontSize: ds, color: o.descColor || 'rgba(255,255,255,.65)', textTransform: 'uppercase', letterSpacing: '.3px' }}>{o.description || 'ALL DRINKS HALF PRICE'}</div>
        </div>
    </Card3D>;
}

function T3({ o }) {
    const ts = (o.titleSize || 13) + 'px', ds = (o.descSize || 10) + 'px';
    const iz = o.iconSize || 28;
    return <Card3D offer={o}>{o.imageUrl && <img src={o.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />}<div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(0,0,0,.32) 0%, rgba(0,0,0,.72) 100%)', zIndex: 1 }} /><div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 38px', position: 'relative', zIndex: 2 }}><div style={{ fontSize: ts, fontWeight: 900, color: o.titleColor || '#fff', textTransform: 'uppercase', letterSpacing: '.8px', lineHeight: 1.1, textShadow: '0 2px 10px rgba(0,0,0,.9)' }}>{o.title || 'EXCLUSIVE DJ NIGHT'}</div><div style={{ fontSize: ds, color: o.descColor || 'rgba(255,255,255,.7)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '.4px' }}>{o.description || 'BOOK A TABLE FOR 25% OFF'}</div></div><div style={{ position: 'absolute', top: 7, right: 8, zIndex: 15, width: Math.max(iz, 20), height: Math.max(iz, 20), borderRadius: '50%', border: '2px solid rgba(255,255,255,.35)', overflow: 'hidden', background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IdentityEl offer={o} /></div></Card3D>;
}

function T4({ o }) {
    const ts = (o.titleSize || 13) + 'px', ds = (o.descSize || 10) + 'px';
    return <Card3D offer={o}><div style={{ flex: 1, paddingLeft: 14, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}><div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><IdentityEl offer={o} /><div style={{ fontSize: ts, fontWeight: 900, color: o.titleColor || '#fff', textTransform: 'uppercase', letterSpacing: '.4px', lineHeight: 1.1, textShadow: '0 1px 6px rgba(0,0,0,.8)' }}>{o.title || 'PREMIUM BREAKFAST'}</div></div><div style={{ fontSize: ds, color: o.descColor || 'rgba(255,255,255,.68)', textTransform: 'uppercase', letterSpacing: '.3px' }}>{o.description || 'SPECIAL COMBO 19 SAR'}</div></div><div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', border: '3px solid rgba(255,255,255,.25)', boxShadow: '0 4px 20px rgba(0,0,0,.6)', zIndex: 10 }}>{o.imageUrl ? <img src={o.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImgPlaceholder />}</div></Card3D>;
}

function T5({ o }) {
    const dark = !o.bgColor?.startsWith('#') || parseInt((o.bgColor || '#0a0a0a').slice(1, 3), 16) < 140;
    const tc = o.titleColor || (dark ? '#fff' : '#111'), sc = o.descColor || (dark ? 'rgba(255,255,255,.58)' : '#555');
    const ts = (o.titleSize || 13) + 'px', ds = (o.descSize || 10) + 'px';
    const iz = o.iconSize || 28;
    return <Card3D offer={o}><div style={{ width: '22%', flexShrink: 0, height: '100%', overflow: 'hidden' }}>{o.imageUrl ? <img src={o.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImgPlaceholder />}</div><div style={{ flex: 1, textAlign: 'center', padding: '0 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}><div style={{ fontSize: ts, fontWeight: 700, color: tc, textTransform: 'uppercase', letterSpacing: '1px', lineHeight: 1.2 }}>{o.title || 'ROMANTIC QUIET DINNER'}</div><div style={{ width: 30, height: 1, background: dark ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.15)', margin: '4px 0' }} /><div style={{ fontSize: ds, color: sc, letterSpacing: '.4px', textTransform: 'uppercase' }}>{o.description || '15% OFF FOR COUPLES'}</div></div><div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingRight: 8 }}><IdentityEl offer={{ ...o, iconSize: iz }} /></div></Card3D>;
}

function T6({ o }) {
    const solidBg = o.bgColor?.startsWith('linear') ? '#0a0a0a' : (o.bgColor || '#0a0a0a');
    const ts = (o.titleSize || 13) + 'px', ds = (o.descSize || 10) + 'px';
    return <Card3D offer={o}><div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '46%', overflow: 'hidden', zIndex: 1 }}>{o.imageUrl ? <img src={o.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: .52 }} /> : <div style={{ width: '100%', height: '100%' }} />}<div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, ${solidBg} 0%, transparent 55%)` }} /></div><div style={{ zIndex: 4, paddingLeft: 14, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}><div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><IdentityEl offer={o} /><div style={{ fontSize: ts, fontWeight: 900, color: o.titleColor || '#ffd600', textTransform: 'uppercase', letterSpacing: '.5px', textShadow: '0 0 10px rgba(255,214,0,.55)' }}>{o.title || "DON'T MISS OUT!"}</div></div><div style={{ fontSize: ds, fontWeight: 900, color: o.descColor || '#fff', textTransform: 'uppercase', letterSpacing: '.4px', lineHeight: 1.1, textShadow: '0 2px 8px rgba(0,0,0,.9)' }}>{o.description || 'BUY 1 GET 1 FREE'}</div></div></Card3D>;
}

const TEMPLATE_MAP = { 1: T1, 2: T2, 3: T3, 4: T4, 5: T5, 6: T6 };

/* ══════════════════════════════════════════════════════════════════
   MAIN EXPORT
   ══════════════════════════════════════════════════════════════════*/
const OfferTemplateRenderer = ({ offer }) => {
    const T = TEMPLATE_MAP[offer?.templateId] || T1;
    return (
        <>
            <style>{ICON_CSS}</style>
            <T o={offer} />
        </>
    );
};

export default OfferTemplateRenderer;
