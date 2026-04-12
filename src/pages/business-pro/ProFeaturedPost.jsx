/**
 * Elite Featured Post editor – template with all content options, live preview in phone mockup, publish to feed.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useToast } from '../../context/ToastContext';
import { FaSave, FaEye, FaPalette, FaFont, FaUpload, FaAlignLeft, FaAlignCenter, FaAlignRight, FaBold, FaItalic, FaSun, FaMoon } from 'react-icons/fa';

const BORDER_WIDTHS = [
    { value: 0, label: 'Off' },
    { value: 0.25, label: '¼' },
    { value: 0.5, label: '½' },
    { value: 1, label: '1' },
];
import { uploadImage } from '../../utils/imageUpload';
import FeaturedPostSlideCard, { EMOJI_GRID, FONT_FAMILIES, LAYOUT_OPTIONS, ANIMATION_OPTIONS } from '../../components/FeaturedPostSlideCard';

function hexToSix(hex) {
    if (!hex || typeof hex !== 'string') return '#ffffff';
    const m = hex.trim().match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    if (!m) return '#ffffff';
    let h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return '#' + h;
}

function ColorPicker({ value, onChange }) {
    const hex = hexToSix(value || '#ffffff');
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
                type="color"
                value={hex}
                onChange={e => onChange(hexToSix(e.target.value))}
                style={{ width: 36, height: 36, padding: 2, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent' }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{hex}</span>
        </div>
    );
}


const BACKGROUND_TYPES = [
    { value: 'color', label: 'Color' },
    { value: 'gradient', label: 'Gradient' },
    { value: 'image', label: 'Image' },
];
const DESC_MODES = [
    { value: 'single', label: 'Single paragraph' },
    { value: 'paragraphs', label: 'Up to 10 paragraphs' },
];

function getBackgroundForPreview(bg) {
    if (!bg) return { type: 'gradient', value: 'linear-gradient(135deg, #1e1e2e, #2d2b42)' };
    if (bg.type === 'gradient') {
        const start = hexToSix(bg.gradientStart || '#1e1e2e');
        const end = hexToSix(bg.gradientEnd || '#2d2b42');
        return { type: 'gradient', value: `linear-gradient(135deg, ${start}, ${end})` };
    }
    if (bg.type === 'color') return { type: 'color', value: bg.value ? hexToSix(bg.value) : '#1e1e2e' };
    return { type: bg.type || 'gradient', value: bg.value ?? '' };
}

/** Remove undefined from object so Firestore accepts it (Firestore does not allow undefined). */
function stripUndefined(obj) {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(stripUndefined).filter((v) => v !== undefined);
    if (typeof obj !== 'object') return obj;
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v === undefined) continue;
        out[k] = stripUndefined(v);
    }
    return out;
}

const DEFAULT_SLIDE = {
    background: { type: 'gradient', gradientStart: '#1e1e2e', gradientEnd: '#2d2b42' },
    title: {
        text: 'Your Title Here',
        fontFamily: 'Inter, sans-serif',
        fontSize: 28,
        color: '#ffffff',
        textAlign: 'left',
        fontWeight: 'bold',
        fontStyle: 'normal',
        borderWidth: 0,
        borderColor: '#000000',
        shadow: true,
        shadowColor: 'rgba(0,0,0,0.4)',
    },
    description: {
        mode: 'single',
        positionVertical: 'center',
        singleText: 'Add your description. One paragraph or up to three paragraphs.',
        paragraphs: ['', '', '', '', '', '', '', '', '', ''],
        paragraphIcons: ['', '', '', '', '', '', '', '', '', ''],
        paragraphIconsAfter: ['', '', '', '', '', '', '', '', '', ''],
        fontSize: 16,
        color: 'rgba(255,255,255,0.9)',
        textAlign: 'left',
        fontWeight: 'normal',
        fontStyle: 'normal',
        borderWidth: 0,
        borderColor: '#000000',
        shadow: false,
        shadowColor: 'rgba(0,0,0,0.4)',
        maxCharsSingle: 280,
        boxEnabled: false,
        boxBg: '#000000',
        boxOpacity: 0.4,
        boxBorderWidth: 0,
        boxBorderColor: '#ffffff',
        boxBorderRadius: 12,
    },
    animation: 'stagger',
    animationDuration: 0.5,
    layout: 'center',
};

function EmojiPicker({ value, onChange, openLeft = false }) {
    const [open, setOpen] = useState(false);
    const popRef = useRef(null);
    const anchorRef = useRef(null);
    useEffect(() => {
        if (!open) return;
        const close = (e) => {
            if (popRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [open]);
    return (
        <span style={{ position: 'relative' }}>
            <button
                type="button"
                ref={anchorRef}
                onClick={() => setOpen(v => !v)}
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-elevated)',
                    fontSize: value ? '1.2rem' : '0.85rem',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                }}
            >
                {value || '—'}
            </button>
            {open && (
                <div
                    ref={popRef}
                    style={{
                        position: 'absolute',
                        ...(openLeft ? { right: 0 } : { left: 0 }),
                        top: '100%',
                        marginTop: 4,
                        zIndex: 50,
                        padding: 8,
                        borderRadius: 12,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        gap: 4,
                    }}
                >
                    {EMOJI_GRID.map((emoji) => (
                        <button
                            key={emoji || 'none'}
                            type="button"
                            onClick={() => { onChange(emoji); setOpen(false); }}
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 6,
                                border: 'none',
                                background: value === emoji ? 'rgba(167,139,250,0.3)' : 'transparent',
                                fontSize: '1.1rem',
                                cursor: 'pointer',
                            }}
                        >
                            {emoji || '—'}
                        </button>
                    ))}
                </div>
            )}
        </span>
    );
}

export default function ProFeaturedPost({ onBack, editingPost, onSuccess }) {
    const { currentUser, userProfile } = useAuth();
    const { showToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [previewKey, setPreviewKey] = useState(0);
    const [uploadingBgImage, setUploadingBgImage] = useState(false);
    const [overflowWarning, setOverflowWarning] = useState(false);
    const backgroundImageInputRef = useRef(null);
    // Init from editingPost if in edit mode, otherwise fresh DEFAULT_SLIDE
    const [data, setData] = useState(() => {
        if (editingPost) {
            const { id, partnerId, businessName: bn, businessLogoUrl: bl, publishedAt, createdAt, updatedAt, ...rest } = editingPost;
            return { ...JSON.parse(JSON.stringify(DEFAULT_SLIDE)), ...rest };
        }
        return { ...JSON.parse(JSON.stringify(DEFAULT_SLIDE)) };
    });

    const update = useCallback((path, value) => {
        setData(prev => {
            const next = { ...prev };
            const parts = path.split('.');
            let cur = next;
            for (let i = 0; i < parts.length - 1; i++) {
                const p = parts[i];
                cur[p] = { ...(cur[p] || {}) };
                cur = cur[p];
            }
            cur[parts[parts.length - 1]] = value;
            return next;
        });
    }, []);

    const handleSave = async (status) => {
        if (!currentUser?.uid) { showToast('Please sign in', 'error'); return; }
        setSaving(true);
        try {
            const rawPayload = {
                type: 'elite_slide',
                partnerId: currentUser.uid,
                businessName: businessName ?? '',
                businessLogoUrl: businessLogoUrl || null,
                layout: data.layout || 'center',
                animation: data.animation || 'stagger',
                animationDuration: Math.min(5, Math.max(0.1, data.animationDuration ?? 0.5)),
                background: getBackgroundForPreview(data.background),
                title: (() => { const { iconBefore, iconAfter, ...t } = data.title || {}; return t; })(),
                description: {
                    mode: data.description?.mode || 'single',
                    positionVertical: data.description?.positionVertical || 'center',
                    singleText: data.description?.mode === 'single' ? (data.description.singleText || '').slice(0, data.description.maxCharsSingle || 500) : undefined,
                    paragraphs: data.description?.mode === 'paragraphs' ? (data.description.paragraphs || ['', '', '', '', '', '', '', '', '', '']).slice(0, 10) : undefined,
                    paragraphIcons: (data.description?.paragraphIcons || ['', '', '', '', '', '', '', '', '', '']).slice(0, 10),
                    paragraphIconsAfter: (data.description?.paragraphIconsAfter || ['', '', '', '', '', '', '', '', '', '']).slice(0, 10),
                    fontSize: data.description?.fontSize ?? 16,
                    color: data.description?.color ?? 'rgba(255,255,255,0.9)',
                    textAlign: data.description?.textAlign ?? 'left',
                    fontWeight: data.description?.fontWeight ?? 'normal',
                    fontStyle: data.description?.fontStyle ?? 'normal',
                    borderWidth: data.description?.borderWidth ?? 0,
                    borderColor: data.description?.borderColor ?? '#000000',
                    shadow: data.description?.shadow ?? false,
                    shadowColor: data.description?.shadowColor ?? 'rgba(0,0,0,0.4)',
                    boxEnabled: !!(data.description?.boxEnabled),
                    boxBg: data.description?.boxBg ?? '#000000',
                    boxOpacity: data.description?.boxOpacity ?? 0.4,
                    boxBorderWidth: data.description?.boxBorderWidth ?? 0,
                    boxBorderColor: data.description?.boxBorderColor ?? '#ffffff',
                    boxBorderRadius: data.description?.boxBorderRadius ?? 12,
                },
            };
            const payload = stripUndefined(rawPayload);
            if (editingPost?.id) {
                // Update existing doc
                await updateDoc(doc(db, 'featured_posts', editingPost.id), {
                    ...payload,
                    status,
                    updatedAt: serverTimestamp(),
                });
                showToast(status === 'published' ? 'Published!' : 'Saved as draft', 'success');
            } else {
                // Create new doc
                await addDoc(collection(db, 'featured_posts'), {
                    ...payload,
                    status,
                    publishedAt: status === 'published' ? serverTimestamp() : null,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
                showToast(status === 'published' ? 'Published to feed!' : 'Saved as draft', 'success');
                setData({ ...JSON.parse(JSON.stringify(DEFAULT_SLIDE)) });
                setPreviewKey(k => k + 1);
            }
            if (onSuccess) onSuccess();
        } catch (e) {
            console.error(e);
            showToast(e?.message || 'Publish failed', 'error');
        } finally {
            setSaving(false);
        }
    };

    const businessName = userProfile?.businessInfo?.businessName || userProfile?.display_name || 'Business';
    const businessLogoUrl = userProfile?.businessInfo?.logoImage || userProfile?.photo_url || null;

    const btn = (label, active, onClick) => (
        <button key={label} type="button" onClick={onClick}
            style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: active ? '2px solid #a78bfa' : '1px solid var(--border)',
                background: active ? 'rgba(167,139,250,0.2)' : 'var(--bg-elevated)',
                color: 'var(--text-main)',
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                fontSize: '0.85rem',
            }}>
            {label}
        </button>
    );

    const iconBtn = (Icon, active, onClick, title) => (
        <button key={title} type="button" onClick={onClick} title={title}
            style={{
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                border: active ? '2px solid #a78bfa' : '1px solid var(--border)',
                background: active ? 'rgba(167,139,250,0.2)' : 'var(--bg-elevated)',
                color: 'var(--text-main)',
                cursor: 'pointer',
                fontSize: '1.1rem',
            }}>
            <Icon />
        </button>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
                {/* Left: back + title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    {(onBack || onSuccess) && (
                        <button type="button" className="ui-btn ui-btn--secondary" style={{ padding: '6px 12px' }} onClick={onBack || onSuccess}>
                            ← Back
                        </button>
                    )}
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
                        {editingPost ? '✏️ Editing post' : '✨ New post'}
                    </span>
                </div>
                {/* Right actions */}
                <button type="button" className="ui-btn ui-btn--secondary" onClick={() => setPreviewKey(k => k + 1)}>
                    <FaEye /> Refresh
                </button>
                <button type="button" className="ui-btn ui-btn--secondary" onClick={() => handleSave('draft')} disabled={saving}
                    style={{ borderColor: 'rgba(167,139,250,0.4)', color: 'rgba(167,139,250,0.9)' }}>
                    <FaSave /> {saving ? '…' : 'Save draft'}
                </button>
                <button type="button" className="ui-btn ui-btn--primary" onClick={() => handleSave('published')} disabled={saving}>
                    <FaSave /> {saving ? 'Saving…' : 'Publish'}
                </button>
            </div>

            <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                {/* Expanded editing tools (left, takes main area) */}
                <div style={{ flex: 1, minWidth: 380, overflowY: 'auto', borderRight: '1px solid var(--border)', background: 'var(--bg-base)' }}>
                    <div className="bpro-stat-card" style={{ padding: 20, margin: 12, marginRight: 0 }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FaPalette /> Content
                    </h3>

                    {/* ─── Section 3: Entrance animation ─── */}
                    <section data-section="3" style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a78bfa', marginBottom: 10, letterSpacing: '0.05em' }}>3. ENTRANCE ANIMATION</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                            {ANIMATION_OPTIONS.map((a) => (
                                <button
                                    key={a}
                                    type="button"
                                    onClick={() => { update('animation', a); setPreviewKey(k => k + 1); }}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: 10,
                                        border: (data.animation || 'stagger') === a ? '2px solid #a78bfa' : '1px solid var(--border)',
                                        background: (data.animation || 'stagger') === a ? 'rgba(167,139,250,0.2)' : 'var(--bg-elevated)',
                                        color: 'var(--text-main)',
                                        fontWeight: (data.animation || 'stagger') === a ? 700 : 500,
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                    }}
                                >
                                    {a}
                                </button>
                            ))}
                        </div>
                        <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', marginBottom: 6, display: 'block' }}>Duration (max 5s)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input
                                type="range"
                                min={0.1}
                                max={5}
                                step={0.1}
                                value={Math.min(5, Math.max(0.1, data.animationDuration ?? 0.5))}
                                onChange={e => { const v = Number(e.target.value); update('animationDuration', v); setPreviewKey(k => k + 1); }}
                                style={{ flex: 1, accentColor: '#a78bfa' }}
                            />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', minWidth: 36 }}>{Number(data.animationDuration ?? 0.5).toFixed(1)}s</span>
                        </div>
                    </section>

                    {/* ─── Section 4: Background ─── */}
                    <section data-section="4" style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a78bfa', marginBottom: 10, letterSpacing: '0.05em' }}>4. BACKGROUND</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                            {BACKGROUND_TYPES.map(({ value, label }) => btn(label, (data.background?.type || 'gradient') === value, () => update('background.type', value)))}
                        </div>
                        {data.background?.type === 'color' && (
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', marginBottom: 6, display: 'block' }}>Color</label>
                                <input
                                    type="color"
                                    value={hexToSix(data.background?.value || '#1e1e2e')}
                                    onChange={e => update('background.value', hexToSix(e.target.value))}
                                    style={{ width: 56, height: 40, padding: 4, borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent' }}
                                />
                            </div>
                        )}
                        {data.background?.type === 'gradient' && (
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>Gradient colors</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <input
                                            type="color"
                                            value={hexToSix(data.background?.gradientStart || '#1e1e2e')}
                                            onChange={e => update('background.gradientStart', hexToSix(e.target.value))}
                                            style={{ width: 44, height: 36, padding: 2, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent' }}
                                        />
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Start</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <input
                                            type="color"
                                            value={hexToSix(data.background?.gradientEnd || '#2d2b42')}
                                            onChange={e => update('background.gradientEnd', hexToSix(e.target.value))}
                                            style={{ width: 44, height: 36, padding: 2, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent' }}
                                        />
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>End</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        {data.background?.type === 'image' && (
                            <div style={{ marginBottom: 16 }}>
                                <input
                                    ref={backgroundImageInputRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={async (e) => {
                                        const file = e.target?.files?.[0];
                                        if (!file || !currentUser?.uid) return;
                                        setUploadingBgImage(true);
                                        try {
                                            const path = `featured_posts/${currentUser.uid}/bg_${Date.now()}.jpg`;
                                            const url = await uploadImage(file, path, null, { maxSizeMB: 1, maxWidthOrHeight: 1200 });
                                            update('background.value', url);
                                        } catch (err) {
                                            console.error(err);
                                            showToast(err?.message || 'Upload failed', 'error');
                                        } finally {
                                            setUploadingBgImage(false);
                                            e.target.value = '';
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => backgroundImageInputRef.current?.click()}
                                    disabled={uploadingBgImage}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10,
                                        border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-main)', cursor: uploadingBgImage ? 'wait' : 'pointer', fontSize: '0.9rem',
                                    }}
                                >
                                    <FaUpload /> {uploadingBgImage ? 'Uploading…' : 'Upload image'}
                                </button>
                            </div>
                        )}
                    </section>

                    {/* ─── Section 5: Title ─── */}
                    <section data-section="5" style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a78bfa', marginBottom: 10, letterSpacing: '0.05em' }}>5. TITLE</div>
                        {/* Title input with dynamic maxLength */}
                        {(() => {
                            const titleFs = data.title?.fontSize || 28;
                            const titleMax = Math.max(30, Math.floor(1680 / titleFs)); // ~60 chars at 28px
                            const titleLen = (data.title?.text || '').length;
                            return (
                                <div style={{ marginBottom: 10 }}>
                                    <input type="text" placeholder="Title"
                                        value={data.title?.text || ''}
                                        maxLength={titleMax}
                                        onChange={e => update('title.text', e.target.value)}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text-main)', border: `1px solid ${titleLen >= titleMax ? '#ef4444' : 'var(--border)'}`, boxSizing: 'border-box' }} />
                                    <div style={{ textAlign: 'right', fontSize: '0.65rem', marginTop: 3, color: titleLen >= titleMax ? '#f87171' : 'rgba(255,255,255,0.35)' }}>
                                        {titleLen}/{titleMax}
                                    </div>
                                </div>
                            );
                        })()}
                        <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', marginBottom: 6, display: 'block' }}>Font</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                            {FONT_FAMILIES.map((f) => btn(f.split(',')[0], (data.title?.fontFamily || FONT_FAMILIES[0]) === f, () => update('title.fontFamily', f)))}
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div>
                                <label style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', display: 'block', marginBottom: 4 }}>Size</label>
                                <input type="number" min={12} max={64} value={data.title?.fontSize || 28} onChange={e => update('title.fontSize', Math.min(64, Math.max(12, Number(e.target.value) || 28)))}
                                    style={{ width: 64, padding: '6px 8px', borderRadius: 6, background: 'var(--bg-elevated)', color: 'var(--text-main)', border: '1px solid var(--border)', fontSize: '0.8rem' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', display: 'block', marginBottom: 4 }}>Color</label>
                                <input type="color" value={hexToSix(data.title?.color || '#ffffff')} onChange={e => update('title.color', hexToSix(e.target.value))}
                                    style={{ width: 44, height: 36, padding: 2, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, alignItems: 'flex-start', width: '100%' }}>
                            <div style={{ flex: '1 1 auto', minWidth: 0, paddingRight: 12, marginRight: 12, borderRight: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>Align</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                    {[
                                        [FaAlignLeft, 'left', 'Align left'],
                                        [FaAlignCenter, 'center', 'Align center'],
                                        [FaAlignRight, 'right', 'Align right'],
                                    ].map(([Icon, val, t]) => iconBtn(Icon, (data.title?.textAlign || 'left') === val, () => update('title.textAlign', val), t))}
                                </div>
                            </div>
                            <div style={{ flex: '1 1 auto', minWidth: 0, paddingRight: 12, marginRight: 12, borderRight: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>Style</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                    {iconBtn(
                                        FaBold,
                                        (data.title?.fontWeight || 'bold') === 'bold',
                                        () => update('title.fontWeight', (data.title?.fontWeight || 'bold') === 'bold' ? 'normal' : 'bold'),
                                        'Bold'
                                    )}
                                    {iconBtn(
                                        FaItalic,
                                        (data.title?.fontStyle || 'normal') === 'italic',
                                        () => update('title.fontStyle', (data.title?.fontStyle || 'normal') === 'italic' ? 'normal' : 'italic'),
                                        'Italic'
                                    )}
                                </div>
                            </div>
                            <div style={{ flex: '1 1 auto', minWidth: 0, paddingRight: 12, marginRight: 12, borderRight: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>Border</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                    {BORDER_WIDTHS.map(({ value, label }) => (
                                        <button key={value} type="button" onClick={() => update('title.borderWidth', value)} title={value === 0 ? 'Border off' : `Border ${value}px`}
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: 8,
                                                border: Number(data.title?.borderWidth ?? 0) === value ? '2px solid #a78bfa' : '1px solid var(--border)',
                                                background: Number(data.title?.borderWidth ?? 0) === value ? 'rgba(167,139,250,0.2)' : 'var(--bg-elevated)',
                                                color: 'var(--text-main)',
                                                fontWeight: Number(data.title?.borderWidth ?? 0) === value ? 700 : 500,
                                                cursor: 'pointer',
                                                fontSize: '0.85rem',
                                            }}>
                                            {label}
                                        </button>
                                    ))}
                                    {Number(data.title?.borderWidth ?? 0) > 0 && (
                                        <input type="color" value={hexToSix(data.title?.borderColor || '#000000')} onChange={e => update('title.borderColor', hexToSix(e.target.value))} title="Border color"
                                            style={{ width: 36, height: 36, padding: 2, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', flexShrink: 0 }} />
                                    )}
                                </div>
                            </div>
                            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>Shadow</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                    {iconBtn(FaSun, (data.title?.shadow !== false && data.title?.shadow !== 'off') === true, () => update('title.shadow', true), 'Shadow on')}
                                    {iconBtn(FaMoon, (data.title?.shadow !== false && data.title?.shadow !== 'off') === false, () => update('title.shadow', false), 'Shadow off')}
                                    {(data.title?.shadow !== false && data.title?.shadow !== 'off') && (
                                        <input type="color" value={hexToSix(typeof data.title?.shadowColor === 'string' && data.title.shadowColor.startsWith('#') ? data.title.shadowColor : '#000000')} onChange={e => update('title.shadowColor', hexToSix(e.target.value))} title="Shadow color"
                                            style={{ width: 36, height: 36, padding: 2, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', flexShrink: 0 }} />
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ─── Section 6: Description ─── */}
                    <section data-section="6" style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a78bfa', marginBottom: 10, letterSpacing: '0.05em' }}>6. DESCRIPTION</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                            {DESC_MODES.map(({ value, label }) => btn(label, (data.description?.mode || 'single') === value, () => update('description.mode', value)))}
                        </div>
                        {/* ── Global Paragraph Box ── */}
                        <div style={{ marginBottom: 10, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: data.description?.boxEnabled ? 12 : 0 }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>📦 Paragraph Box</span>
                                <button onClick={() => update('description.boxEnabled', !data.description?.boxEnabled)}
                                    style={{ padding: '4px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                                        background: data.description?.boxEnabled ? '#a78bfa' : 'rgba(255,255,255,0.1)',
                                        color: data.description?.boxEnabled ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                                    {data.description?.boxEnabled ? 'ON' : 'OFF'}
                                </button>
                            </div>
                            {data.description?.boxEnabled && (<>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Background</div>
                                        <input type="color" value={hexToSix(data.description?.boxBg || '#000000')}
                                            onChange={e => update('description.boxBg', hexToSix(e.target.value))}
                                            style={{ width: 40, height: 36, padding: 2, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent' }} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 120 }}>
                                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Opacity: {Math.round((data.description?.boxOpacity ?? 0.4) * 100)}%</div>
                                        <input type="range" min={0} max={1} step={0.05} value={data.description?.boxOpacity ?? 0.4}
                                            onChange={e => update('description.boxOpacity', parseFloat(e.target.value))}
                                            style={{ width: '100%', accentColor: '#a78bfa' }} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                                    <div style={{ flex: 1, minWidth: 120 }}>
                                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Border: {data.description?.boxBorderWidth ?? 0}px</div>
                                        <input type="range" min={0} max={8} step={1} value={data.description?.boxBorderWidth ?? 0}
                                            onChange={e => update('description.boxBorderWidth', parseInt(e.target.value))}
                                            style={{ width: '100%', accentColor: '#a78bfa' }} />
                                    </div>
                                    {(data.description?.boxBorderWidth ?? 0) > 0 && (
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Border Color</div>
                                            <input type="color" value={hexToSix(data.description?.boxBorderColor || '#ffffff')}
                                                onChange={e => update('description.boxBorderColor', hexToSix(e.target.value))}
                                                style={{ width: 40, height: 36, padding: 2, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent' }} />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Radius: {data.description?.boxBorderRadius ?? 12}px</div>
                                    <input type="range" min={0} max={40} step={2} value={data.description?.boxBorderRadius ?? 12}
                                        onChange={e => update('description.boxBorderRadius', parseInt(e.target.value))}
                                        style={{ width: '100%', accentColor: '#a78bfa' }} />
                                </div>
                            </>)}
                        </div>

                        <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>Vertical position</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {[['top', 'Top'], ['center', 'Center'], ['bottom', 'Bottom']].map(([val, label]) => btn(label, (data.description?.positionVertical || 'center') === val, () => update('description.positionVertical', val)))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, alignItems: 'flex-start', width: '100%', marginBottom: 12 }}>
                            <div style={{ flex: '1 1 auto', minWidth: 0, paddingRight: 12, marginRight: 12, borderRight: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>Align</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {[[FaAlignLeft, 'left'], [FaAlignCenter, 'center'], [FaAlignRight, 'right']].map(([Icon, val]) => iconBtn(Icon, (data.description?.textAlign || 'left') === val, () => update('description.textAlign', val), `Align ${val}`))}
                                </div>
                            </div>
                            <div style={{ flex: '1 1 auto', minWidth: 0, paddingRight: 12, marginRight: 12, borderRight: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>Style</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {iconBtn(
                                        FaBold,
                                        (data.description?.fontWeight || 'normal') === 'bold',
                                        () => update('description.fontWeight', (data.description?.fontWeight || 'normal') === 'bold' ? 'normal' : 'bold'),
                                        'Bold'
                                    )}
                                    {iconBtn(
                                        FaItalic,
                                        (data.description?.fontStyle || 'normal') === 'italic',
                                        () => update('description.fontStyle', (data.description?.fontStyle || 'normal') === 'italic' ? 'normal' : 'italic'),
                                        'Italic'
                                    )}
                                </div>
                            </div>
                            <div style={{ flex: '1 1 auto', minWidth: 0, paddingRight: 12, marginRight: 12, borderRight: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>Border</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                    {BORDER_WIDTHS.map(({ value, label }) => (
                                        <button key={value} type="button" onClick={() => update('description.borderWidth', value)} title={value === 0 ? 'Border off' : `Border ${value}px`}
                                            style={{ padding: '6px 10px', borderRadius: 8, border: Number(data.description?.borderWidth ?? 0) === value ? '2px solid #a78bfa' : '1px solid var(--border)', background: Number(data.description?.borderWidth ?? 0) === value ? 'rgba(167,139,250,0.2)' : 'var(--bg-elevated)', color: 'var(--text-main)', fontWeight: Number(data.description?.borderWidth ?? 0) === value ? 700 : 500, cursor: 'pointer', fontSize: '0.85rem' }}>
                                            {label}
                                        </button>
                                    ))}
                                    {Number(data.description?.borderWidth ?? 0) > 0 && (
                                        <input type="color" value={hexToSix(data.description?.borderColor || '#000000')} onChange={e => update('description.borderColor', hexToSix(e.target.value))} title="Border color"
                                            style={{ width: 36, height: 36, padding: 2, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', flexShrink: 0 }} />
                                    )}
                                </div>
                            </div>
                            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>Shadow</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                    {iconBtn(FaSun, (data.description?.shadow !== false && data.description?.shadow !== 'off') === true, () => update('description.shadow', true), 'Shadow on')}
                                    {iconBtn(FaMoon, (data.description?.shadow !== false && data.description?.shadow !== 'off') === false, () => update('description.shadow', false), 'Shadow off')}
                                    {(data.description?.shadow !== false && data.description?.shadow !== 'off') && (
                                        <input type="color" value={hexToSix(typeof data.description?.shadowColor === 'string' && data.description.shadowColor?.startsWith('#') ? data.description.shadowColor : '#000000')} onChange={e => update('description.shadowColor', hexToSix(e.target.value))} title="Shadow color"
                                            style={{ width: 36, height: 36, padding: 2, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent', flexShrink: 0 }} />
                                    )}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                            <div>
                                <label style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', display: 'block', marginBottom: 4 }}>Size</label>
                                <input type="number" min={10} max={26} value={data.description?.fontSize || 16} onChange={e => update('description.fontSize', Math.min(26, Math.max(10, Number(e.target.value) || 16)))}
                                    style={{ width: 56, padding: '6px 8px', borderRadius: 6, background: 'var(--bg-elevated)', color: 'var(--text-main)', border: '1px solid var(--border)', fontSize: '0.8rem' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', display: 'block', marginBottom: 4 }}>Color</label>
                                <input type="color" value={hexToSix(data.description?.color?.startsWith('rgba') ? '#ffffff' : (data.description?.color || '#ffffff'))} onChange={e => update('description.color', hexToSix(e.target.value))}
                                    style={{ width: 44, height: 36, padding: 2, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'transparent' }} />
                            </div>
                        </div>
                        {data.description?.mode === 'single' && (() => {
                            const dFs = data.description?.fontSize || 16;
                            const dMax = Math.max(80, Math.min(280, Math.floor(3600 / dFs))); // ~225 at 16px
                            const dLen = (data.description?.singleText || '').length;
                            return (
                                <div style={{ marginBottom: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                        <div style={{ flexShrink: 0 }}>
                                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', display: 'block', marginBottom: 4 }}>Icon before</span>
                                            <EmojiPicker value={(data.description?.paragraphIcons || ['', '', ''])[0] ?? ''} onChange={v => update('description.paragraphIcons', [v, (data.description?.paragraphIcons || ['', '', ''])[1] ?? '', (data.description?.paragraphIcons || ['', '', ''])[2] ?? ''])} />
                                        </div>
                                        <textarea placeholder="Description text" value={data.description?.singleText || ''}
                                            maxLength={dMax}
                                            onChange={e => update('description.singleText', e.target.value)}
                                            rows={3} style={{ flex: 1, minWidth: 0, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text-main)', border: `1px solid ${dLen >= dMax ? '#ef4444' : 'var(--border)'}`, resize: 'vertical' }} />
                                    </div>
                                    <div style={{ textAlign: 'right', fontSize: '0.65rem', marginTop: 3, color: dLen >= dMax ? '#f87171' : 'rgba(255,255,255,0.35)' }}>{dLen}/{dMax}</div>
                                </div>
                            );
                        })()}
                        {data.description?.mode === 'paragraphs' && (() => {
                            const dFs = data.description?.fontSize || 16;
                            const pMax = Math.max(60, Math.min(200, Math.floor(2400 / dFs))); // ~150 at 16px per paragraph
                            return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => {
                                const pLen = (data.description?.paragraphs?.[i] || '').length;
                                return (
                                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                            <div style={{ flexShrink: 0, minWidth: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)', display: 'block', textAlign: 'center' }}>Before</span>
                                                <EmojiPicker value={(data.description?.paragraphIcons || ['','','','','','','','','',''])[i] ?? ''} onChange={v => {
                                                    const arr = [...(data.description?.paragraphIcons || ['','','','','','','','','',''])]; arr[i] = v; update('description.paragraphIcons', arr);
                                                }} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <textarea placeholder={`Paragraph ${i + 1}`} value={data.description?.paragraphs?.[i] ?? ''}
                                                    maxLength={pMax}
                                                    onChange={e => {
                                                        const p = [...(data.description?.paragraphs || ['','','','','','','','','',''])]; p[i] = e.target.value; update('description.paragraphs', p);
                                                    }}
                                                    rows={2} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text-main)', border: `1px solid ${pLen >= pMax ? '#ef4444' : 'var(--border)'}`, resize: 'vertical', boxSizing: 'border-box' }} />
                                                <div style={{ textAlign: 'right', fontSize: '0.65rem', marginTop: 2, color: pLen >= pMax ? '#f87171' : 'rgba(255,255,255,0.35)' }}>{pLen}/{pMax}</div>
                                            </div>
                                            <div style={{ flexShrink: 0, minWidth: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)', display: 'block', textAlign: 'center' }}>After</span>
                                                <EmojiPicker openLeft value={(data.description?.paragraphIconsAfter || ['','','','','','','','','',''])[i] ?? ''} onChange={v => {
                                                    const arr = [...(data.description?.paragraphIconsAfter || ['','','','','','','','','',''])]; arr[i] = v; update('description.paragraphIconsAfter', arr);
                                                }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            });
                        })()}

                    </section>
                    </div>
                </div>

                {/* ── Preview: iPhone 15 Pro at 65% scale (393×852pt → 256×557px) ── */}
                <div style={{ flex: '0 0 340px', minWidth: 310, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '20px 16px 16px', gap: 10, overflowY: 'auto', background: 'var(--bg-elevated)' }}>

                    {/* Overflow warning */}
                    {overflowWarning && (
                        <div style={{ width: '100%', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '1rem' }}>⚠️</span>
                            <div>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fca5a5' }}>Content overflows the screen</div>
                                <div style={{ fontSize: '0.68rem', color: 'rgba(252,165,165,0.8)' }}>Reduce font size or shorten text to prevent overlap</div>
                            </div>
                        </div>
                    )}

                    {/* iPhone 15 Pro body */}
                    <div style={{
                        position: 'relative',
                        width: 256,
                        height: 557,
                        background: 'linear-gradient(160deg, #3a3a3c 0%, #1c1c1e 60%, #2a2a2c 100%)',
                        borderRadius: 46,
                        boxShadow: '0 0 0 1px rgba(255,255,255,0.14), 0 0 0 3px #1c1c1e, 0 0 0 4px rgba(255,255,255,0.08), 0 30px 80px rgba(0,0,0,0.7)',
                        flexShrink: 0,
                    }}>
                        {/* Left side: silence + volume buttons */}
                        <div style={{ position:'absolute', left:-3, top:88,  width:3, height:24, background:'#3a3a3c', borderRadius:'2px 0 0 2px' }} />
                        <div style={{ position:'absolute', left:-3, top:130, width:3, height:44, background:'#3a3a3c', borderRadius:'2px 0 0 2px' }} />
                        <div style={{ position:'absolute', left:-3, top:186, width:3, height:44, background:'#3a3a3c', borderRadius:'2px 0 0 2px' }} />
                        {/* Right side: power button */}
                        <div style={{ position:'absolute', right:-3, top:148, width:3, height:64, background:'#3a3a3c', borderRadius:'0 2px 2px 0' }} />

                        {/* Screen bezel */}
                        <div style={{
                            position:'absolute', top:6, left:6, right:6, bottom:6,
                            borderRadius:42, overflow:'hidden', background:'#000',
                            display:'flex', flexDirection:'column',
                        }}>
                            {/* Dynamic Island */}
                            <div style={{ position:'absolute', top:10, left:'50%', transform:'translateX(-50%)', width:78, height:24, background:'#000', borderRadius:12, zIndex:20, boxShadow:'0 0 0 1px rgba(255,255,255,0.08)' }} />

                            {/* Status bar */}
                            <div style={{ height:44, flexShrink:0, display:'flex', alignItems:'flex-end', justifyContent:'space-between', padding:'0 22px 6px', zIndex:10, position:'relative' }}>
                                <span style={{ fontSize:9, fontWeight:700, color:'#fff', letterSpacing:0.3, fontFamily:'system-ui' }}>9:41</span>
                                <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                                    <svg width="12" height="9" viewBox="0 0 12 9"><rect x="0" y="3" width="2" height="6" rx="1" fill="white" opacity="0.5"/><rect x="3" y="2" width="2" height="7" rx="1" fill="white" opacity="0.7"/><rect x="6" y="1" width="2" height="8" rx="1" fill="white" opacity="0.85"/><rect x="9" y="0" width="2" height="9" rx="1" fill="white"/></svg>
                                    <svg width="12" height="9" viewBox="0 0 12 9"><path d="M0 4.5 Q6 0 12 4.5" stroke="white" fill="none" strokeWidth="1.5" opacity="0.6"/><path d="M2 6 Q6 2.5 10 6" stroke="white" fill="none" strokeWidth="1.5" opacity="0.8"/><circle cx="6" cy="7.5" r="1.2" fill="white"/></svg>
                                    <div style={{ display:'flex', alignItems:'center', gap:1 }}>
                                        <div style={{ width:20, height:10, borderRadius:2, border:'1px solid rgba(255,255,255,0.5)', padding:1 }}>
                                            <div style={{ height:'100%', width:'80%', background:'#30d158', borderRadius:1 }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Feed content area — no side padding so slide fills screen width */}
                            <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column' }}>
                                {/* Slide card at full feed width */}
                                <FeaturedPostSlideCard
                                    key={previewKey}
                                    data={{ ...data, background: getBackgroundForPreview(data.background) }}
                                    businessName={businessName}
                                    businessLogoUrl={businessLogoUrl}
                                    playEntrance={true}
                                    compact={true}
                                    noRadius={true}
                                    onOverflow={setOverflowWarning}
                                />
                            </div>

                            {/* Home indicator */}
                            <div style={{ height:20, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                <div style={{ width:90, height:4, background:'rgba(255,255,255,0.35)', borderRadius:2 }} />
                            </div>
                        </div>
                    </div>

                    {/* Scale label */}
                    <div style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.3)', textAlign:'center', lineHeight:1.5 }}>
                        iPhone 15 Pro · 65% scale<br/>393 × 852 pt → 256 × 557 px
                    </div>
                </div>
            </div>
        </div>
    );
}
