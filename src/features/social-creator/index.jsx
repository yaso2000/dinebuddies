/**
 * SocialCreator — Main Entry Point
 * Route: /social-creator
 *
 * ISOLATED MODULE — to remove entirely:
 *  1. Delete src/features/social-creator/
 *  2. Remove the <Route> in App.jsx
 *  Nothing else references this feature.
 */
import React, { useState, useRef } from 'react';
import './SocialCreator.css';
import StoryTemplate from './templates/StoryTemplate';
import PostTemplate from './templates/PostTemplate';
import SlideTemplate from './templates/SlideTemplate';
import { exportAsPNG, exportSlidesAsPNGs } from './utils/exportCanvas';

// ─── Default Config ───────────────────────────────────────────────────────────
const DEFAULT_STORY = {
    headline: 'Come Join Us Tonight',
    subtext: 'Experience unforgettable dining with friends',
    bgColor: '#0f0f1a',
    accentColor: '#8b5cf6',
    textColor: '#ffffff',
    animation: 'slideUp',
    bgGradient: true,
    logoEmoji: '🏪',
    businessName: 'My Restaurant',
};

const DEFAULT_POST = {
    headline: 'Special Offer Today',
    subtext: 'Book a table and get 20% off your first visit',
    bgColor: '#0f0f1a',
    accentColor: '#f97316',
    textColor: '#ffffff',
    animation: 'zoomIn',
    bgGradient: true,
    logoEmoji: '🍽️',
    businessName: 'My Restaurant',
};

const DEFAULT_SLIDE = {
    accentColor: '#8b5cf6',
    bgColor: '#0f0f1a',
    textColor: '#ffffff',
    animation: 'slideLeft',
    bgGradient: true,
    logoEmoji: '🏪',
    businessName: 'My Restaurant',
    slides: [
        { headline: 'Welcome to Our Story', body: 'Swipe to discover more about us' },
        { headline: 'Our Signature Dishes', body: 'Made fresh daily with premium ingredients' },
        { headline: 'Book a Table Now', body: 'Reserve your spot through DineBuddies' },
    ],
};

const ANIMATIONS = [
    { id: 'fadeIn', label: 'Fade In' },
    { id: 'slideUp', label: 'Slide Up' },
    { id: 'slideLeft', label: 'Slide ←' },
    { id: 'zoomIn', label: 'Zoom In' },
    { id: 'glow', label: 'Glow' },
    { id: 'none', label: 'None' },
];

const ACCENT_PRESETS = ['#8b5cf6', '#f97316', '#10b981', '#3b82f6', '#ec4899', '#f59e0b', '#ef4444', '#06b6d4'];
const BG_PRESETS = ['#0f0f1a', '#1a0a2e', '#0a1a0f', '#1a0f00', '#000000', '#1e1e2e'];

// ─── Component ────────────────────────────────────────────────────────────────
const SocialCreator = () => {
    const [type, setType] = useState('story');   // 'story' | 'post' | 'slide'
    const [storyConfig, setStoryConfig] = useState(DEFAULT_STORY);
    const [postConfig, setPostConfig] = useState(DEFAULT_POST);
    const [slideConfig, setSlideConfig] = useState(DEFAULT_SLIDE);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [exporting, setExporting] = useState(false);
    const previewRef = useRef(null);

    // Generic updater
    const update = (setter) => (key, value) => setter(prev => ({ ...prev, [key]: value }));
    const updateStory = update(setStoryConfig);
    const updatePost = update(setPostConfig);
    const updateSlide = update(setSlideConfig);

    const activeConfig = type === 'story' ? storyConfig : type === 'post' ? postConfig : slideConfig;
    const activeUpdate = type === 'story' ? updateStory : type === 'post' ? updatePost : updateSlide;

    // ── Slide helpers ──
    const addSlide = () => {
        const next = [...slideConfig.slides, { headline: `Slide ${slideConfig.slides.length + 1}`, body: '' }];
        setSlideConfig(p => ({ ...p, slides: next }));
        setCurrentSlide(next.length - 1);
    };
    const removeSlide = (i) => {
        if (slideConfig.slides.length <= 1) return;
        const next = slideConfig.slides.filter((_, idx) => idx !== i);
        setSlideConfig(p => ({ ...p, slides: next }));
        setCurrentSlide(Math.min(currentSlide, next.length - 1));
    };
    const updateSlideItem = (i, key, val) => {
        const next = slideConfig.slides.map((s, idx) => idx === i ? { ...s, [key]: val } : s);
        setSlideConfig(p => ({ ...p, slides: next }));
    };

    // ── Export ──
    const handleExport = async () => {
        if (!previewRef.current) return;
        setExporting(true);
        try {
            const name = `${type}-${activeConfig.businessName?.replace(/\s+/g, '-') || 'post'}`;
            await exportAsPNG(previewRef.current, name);
        } finally { setExporting(false); }
    };

    const handleExportAllSlides = async () => {
        // Show all slides and capture each — simplified sequential capture
        setExporting(true);
        for (let i = 0; i < slideConfig.slides.length; i++) {
            setCurrentSlide(i);
            await new Promise(r => setTimeout(r, 400)); // wait for animation
            if (previewRef.current) {
                await exportAsPNG(previewRef.current, `slide-${i + 1}-${slideConfig.businessName?.replace(/\s+/g, '-')}`);
            }
        }
        setExporting(false);
    };

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="sc-page">
            {/* Header */}
            <div className="sc-header">
                <span style={{ fontSize: '1.4rem' }}>✨</span>
                <h1>Social Creator</h1>
                <div className="sc-elite-badge">👑 Elite</div>
                <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>
                    Design animated posts for social media
                </div>
            </div>

            <div className="sc-body">
                {/* ── SIDEBAR ── */}
                <div className="sc-sidebar">

                    {/* Type selector */}
                    <div>
                        <div className="sc-section-title">Format</div>
                        <div className="sc-type-tabs">
                            {[
                                { id: 'story', icon: '📱', label: 'Story' },
                                { id: 'post', icon: '🖼️', label: 'Post' },
                                { id: 'slide', icon: '🎠', label: 'Slides' },
                            ].map(t => (
                                <button
                                    key={t.id}
                                    className={`sc-type-tab ${type === t.id ? 'active' : ''}`}
                                    onClick={() => setType(t.id)}
                                >
                                    <span style={{ fontSize: '1.3rem' }}>{t.icon}</span>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Business info */}
                    <div>
                        <div className="sc-section-title">Business</div>
                        <label className="sc-label">Name</label>
                        <input
                            className="sc-input"
                            value={activeConfig.businessName}
                            onChange={e => activeUpdate('businessName', e.target.value)}
                            placeholder="Restaurant name"
                        />
                        <div style={{ marginTop: 8 }}>
                            <label className="sc-label">Logo Emoji</label>
                            <input
                                className="sc-input"
                                value={activeConfig.logoEmoji}
                                onChange={e => activeUpdate('logoEmoji', e.target.value)}
                                placeholder="🏪"
                                style={{ width: 60 }}
                            />
                        </div>
                    </div>

                    {/* Text content */}
                    <div>
                        <div className="sc-section-title">Text Content</div>
                        {type !== 'slide' ? (
                            <>
                                <label className="sc-label">Headline</label>
                                <input
                                    className="sc-input"
                                    value={activeConfig.headline}
                                    onChange={e => activeUpdate('headline', e.target.value)}
                                    placeholder="Main headline"
                                />
                                <div style={{ marginTop: 8 }}>
                                    <label className="sc-label">Subtext</label>
                                    <textarea
                                        className="sc-textarea"
                                        rows={3}
                                        value={activeConfig.subtext}
                                        onChange={e => activeUpdate('subtext', e.target.value)}
                                        placeholder="Supporting text..."
                                    />
                                </div>
                            </>
                        ) : (
                            // Slide editor
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {slideConfig.slides.map((s, i) => (
                                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div
                                            className={`sc-slide-thumb ${currentSlide === i ? 'active' : ''}`}
                                            onClick={() => setCurrentSlide(i)}
                                        >
                                            <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>S{i + 1}</span>
                                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {s.headline || `Slide ${i + 1}`}
                                            </span>
                                            {slideConfig.slides.length > 1 && (
                                                <button
                                                    onClick={e => { e.stopPropagation(); removeSlide(i); }}
                                                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}
                                                >✕</button>
                                            )}
                                        </div>
                                        {currentSlide === i && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 8 }}>
                                                <input
                                                    className="sc-input"
                                                    value={s.headline}
                                                    onChange={e => updateSlideItem(i, 'headline', e.target.value)}
                                                    placeholder="Slide headline"
                                                />
                                                <textarea
                                                    className="sc-textarea"
                                                    rows={2}
                                                    value={s.body}
                                                    onChange={e => updateSlideItem(i, 'body', e.target.value)}
                                                    placeholder="Slide body text..."
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {slideConfig.slides.length < 8 && (
                                    <button className="sc-btn sc-btn-ghost" style={{ width: '100%', justifyContent: 'center', padding: '7px' }} onClick={addSlide}>
                                        + Add Slide
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Animation */}
                    <div>
                        <div className="sc-section-title">Animation</div>
                        <div className="sc-anim-grid">
                            {ANIMATIONS.map(a => (
                                <button
                                    key={a.id}
                                    className={`sc-anim-btn ${activeConfig.animation === a.id ? 'active' : ''}`}
                                    onClick={() => activeUpdate('animation', a.id)}
                                >
                                    {a.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Colors */}
                    <div>
                        <div className="sc-section-title">Colors</div>
                        <label className="sc-label">Accent Color</label>
                        <div className="sc-color-row" style={{ flexWrap: 'wrap', gap: 6 }}>
                            {ACCENT_PRESETS.map(c => (
                                <div
                                    key={c}
                                    className={`sc-color-swatch ${activeConfig.accentColor === c ? 'active' : ''}`}
                                    style={{ background: c }}
                                    onClick={() => activeUpdate('accentColor', c)}
                                />
                            ))}
                            <input
                                type="color"
                                value={activeConfig.accentColor}
                                onChange={e => activeUpdate('accentColor', e.target.value)}
                                style={{ width: 28, height: 28, border: 'none', borderRadius: '50%', cursor: 'pointer', background: 'transparent' }}
                            />
                        </div>

                        <div style={{ marginTop: 10 }}>
                            <label className="sc-label">Background</label>
                            <div className="sc-color-row" style={{ flexWrap: 'wrap', gap: 6 }}>
                                {BG_PRESETS.map(c => (
                                    <div
                                        key={c}
                                        className={`sc-color-swatch ${activeConfig.bgColor === c ? 'active' : ''}`}
                                        style={{ background: c, border: '2px solid rgba(255,255,255,0.2)' }}
                                        onClick={() => activeUpdate('bgColor', c)}
                                    />
                                ))}
                                <input
                                    type="color"
                                    value={activeConfig.bgColor}
                                    onChange={e => activeUpdate('bgColor', e.target.value)}
                                    style={{ width: 28, height: 28, border: 'none', borderRadius: '50%', cursor: 'pointer', background: 'transparent' }}
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                                type="checkbox"
                                id="sc-gradient"
                                checked={activeConfig.bgGradient}
                                onChange={e => activeUpdate('bgGradient', e.target.checked)}
                                style={{ cursor: 'pointer' }}
                            />
                            <label htmlFor="sc-gradient" className="sc-label" style={{ marginBottom: 0, cursor: 'pointer' }}>
                                Gradient background
                            </label>
                        </div>
                    </div>

                </div>

                {/* ── PREVIEW AREA ── */}
                <div className="sc-preview-area">
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Live Preview
                    </div>

                    <div className="sc-preview-wrapper">
                        {type === 'story' && <StoryTemplate config={storyConfig} previewRef={previewRef} />}
                        {type === 'post' && <PostTemplate config={postConfig} previewRef={previewRef} />}
                        {type === 'slide' && (
                            <SlideTemplate
                                config={slideConfig}
                                currentSlide={currentSlide}
                                previewRef={previewRef}
                            />
                        )}
                    </div>

                    {/* Slide nav */}
                    {type === 'slide' && slideConfig.slides.length > 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                            <div className="sc-slide-dots">
                                {slideConfig.slides.map((_, i) => (
                                    <div
                                        key={i}
                                        className={`sc-dot ${currentSlide === i ? 'active' : ''}`}
                                        onClick={() => setCurrentSlide(i)}
                                    />
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    className="sc-btn sc-btn-ghost"
                                    style={{ padding: '7px 14px', fontSize: '0.8rem' }}
                                    onClick={() => setCurrentSlide(p => Math.max(0, p - 1))}
                                    disabled={currentSlide === 0}
                                >← Prev</button>
                                <button
                                    className="sc-btn sc-btn-ghost"
                                    style={{ padding: '7px 14px', fontSize: '0.8rem' }}
                                    onClick={() => setCurrentSlide(p => Math.min(slideConfig.slides.length - 1, p + 1))}
                                    disabled={currentSlide === slideConfig.slides.length - 1}
                                >Next →</button>
                            </div>
                        </div>
                    )}

                    {/* Export buttons */}
                    <div className="sc-action-bar">
                        <button
                            className="sc-btn sc-btn-primary"
                            onClick={handleExport}
                            disabled={exporting}
                        >
                            {exporting ? '⏳ Exporting…' : '⬇ Download PNG'}
                        </button>
                        {type === 'slide' && slideConfig.slides.length > 1 && (
                            <button
                                className="sc-btn sc-btn-ghost"
                                onClick={handleExportAllSlides}
                                disabled={exporting}
                            >
                                ⬇ Export All Slides
                            </button>
                        )}
                    </div>

                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center', maxWidth: 380 }}>
                        Exported at 2× resolution for high quality printing & social media
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SocialCreator;
