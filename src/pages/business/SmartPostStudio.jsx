import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
    FaFont,
    FaEye,
    FaMagic,
    FaPalette,
    FaSlidersH,
    FaTextHeight,
    FaTags,
    FaArrowsAlt,
    FaAdjust,
    FaArrowUp,
    FaExpandAlt,
    FaLayerGroup,
    FaSearchPlus,
    FaSave,
    FaPaperPlane,
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { uploadPostMedia } from '../../utils/imageUpload';
import {
    getImageUploadErrorMessage,
    notifyImageUploadError,
} from '../../utils/imageModerationErrors';

function studioPostErrorMessage(err, t) {
    const code = String(err?.code || '');
    if (code === 'permission-denied' || code.includes('permission')) {
        return t(
            'studio_post_permission_denied',
            'لا توجد صلاحية لحفظ المنشور. تأكد أن حسابك تجاري وانشر قواعد Firestore.'
        );
    }
    if (code === 'unauthenticated') {
        return t('studio_post_sign_in', 'سجّل الدخول ثم أعد المحاولة.');
    }
    return getImageUploadErrorMessage(err, t, 'post_failed');
}
import StudioLivePreview from '../../features/motion-post/studio/StudioLivePreview';
import {
    STUDIO_LAYOUTS,
    STUDIO_PROMO_STICKERS,
    STUDIO_QUICK_STYLES,
    STUDIO_PROMO_MAX,
    pickPromoCornerSlot,
    STUDIO_STYLE_PRESETS,
    layoutToMotionUi,
    studioFontsForLanguage,
} from '../../features/motion-post/studio/studioConstants';
import {
    StudioAlignPanel,
    StudioEffectsPanel,
    StudioColorsPanel,
    StudioPromoPanel,
    StudioTransparencyPanel,
    StudioTypographyPanel,
    StudioStepperRow,
} from '../../features/motion-post/studio/StudioToolPanels';
import {
    createMotionPostDraft,
    publishMotionPost,
    updateMotionPostDraft,
} from '../../features/motion-post/motionPostDraftService';
import { syncPublishedMotionPostToCommunityFeed } from '../../features/motion-post/motionPostFeedPublish';
import { useStudioTypingViewport } from '../../features/motion-post/studio/useStudioTypingViewport';
import {
    STUDIO_ANIM_DURATION_MS,
    STUDIO_TEXT_ANIMATIONS,
    normalizeStudioTextAnimation,
} from '../../features/motion-post/studio/studioTextAnimation';
import './SmartPostStudio.css';

const DEFAULT_STYLE = {
    ...STUDIO_STYLE_PRESETS.modern,
    preset: 'modern',
    fontId: 'cairo',
    animation: 'slide',
};

const STUDIO_ANIM_ICONS = {
    fade: FaAdjust,
    slide: FaArrowUp,
    pop: FaExpandAlt,
    stagger: FaLayerGroup,
    zoom: FaSearchPlus,
};

function StudioToolRail({ tools, activeTool, onToggle, t, showLabels = false }) {
    return (
        <nav
            className="sps-tool-rail"
            role="toolbar"
            aria-label={t('studio_edit_tools', 'أدوات التحرير')}
        >
            {tools.map((tool) => {
                const Icon = tool.icon;
                const isActive = activeTool === tool.id;
                const label = t(tool.labelKey, tool.label);
                return (
                    <button
                        key={tool.id}
                        type="button"
                        className={`sps-tool-rail__btn${isActive ? ' active' : ''}`}
                        onClick={() => onToggle(tool.id)}
                        aria-label={label}
                        aria-expanded={isActive}
                        title={label}
                    >
                        <Icon size={16} aria-hidden />
                        {showLabels ? <span className="sps-tool-rail__label">{label}</span> : null}
                    </button>
                );
            })}
        </nav>
    );
}

function StudioAnimRail({ animations, activeAnim, onSelect, t, showLabels = false }) {
    return (
        <nav
            className="sps-anim-rail"
            role="toolbar"
            aria-label={t('studio_text_entrance', 'حركة دخول النص')}
        >
            {animations.map((anim) => {
                const Icon = STUDIO_ANIM_ICONS[anim.id] || FaMagic;
                const isActive = activeAnim === anim.id;
                const label = t(anim.labelKey, anim.label);
                return (
                    <button
                        key={anim.id}
                        type="button"
                        className={`sps-anim-rail__btn${isActive ? ' active' : ''}`}
                        onClick={() => onSelect(anim.id)}
                        aria-label={label}
                        aria-pressed={isActive}
                        title={label}
                    >
                        <Icon size={16} aria-hidden />
                        {showLabels ? <span className="sps-anim-rail__label">{label}</span> : null}
                    </button>
                );
            })}
        </nav>
    );
}

function StudioQuickStyles({ styles, onApply, t, layout = 'horizontal' }) {
    return (
        <div className={`sps-quick-styles sps-quick-styles--${layout}`}>
            <span className="sps-quick-styles__label">{t('studio_quick_styles', 'أنماط سريعة')}</span>
            <div className="sps-quick-styles__track">
                {styles.map((qs) => (
                    <button
                        key={qs.id}
                        type="button"
                        className="sps-quick-chip"
                        style={{ '--sps-chip-accent': qs.patch.textColor }}
                        onClick={() => onApply(qs.patch)}
                    >
                        <span className="sps-quick-chip__dot" aria-hidden />
                        <span className="sps-quick-chip__label">{qs.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function StudioPublishActions({
    canPublish,
    isBusy,
    savingDraft,
    publishing,
    onSaveDraft,
    onPublish,
    t,
}) {
    return (
        <div className="sps-actions">
            <button
                type="button"
                className="sps-actions__ghost"
                disabled={!canPublish || isBusy}
                onClick={onSaveDraft}
            >
                <FaSave aria-hidden />
                {savingDraft
                    ? t('studio_saving_draft', 'جاري الحفظ…')
                    : t('studio_save_draft', 'حفظ مسودة')}
            </button>
            <button
                type="button"
                className="sps-actions__export"
                disabled={!canPublish || isBusy}
                onClick={onPublish}
                title={t('studio_publish_hint', 'نشر المنشور على الفيد والصفحة الرئيسية')}
            >
                <FaPaperPlane aria-hidden />
                {publishing ? t('posting', 'جاري النشر…') : t('studio_publish', 'نشر')}
            </button>
        </div>
    );
}

/** @typedef {string} StudioToolId */

const EDITOR_TOOLS = [
    { id: 'align', icon: FaSlidersH, labelKey: 'studio_tool_align', label: 'المحاذاة' },
    { id: 'size', icon: FaTextHeight, labelKey: 'studio_tool_size', label: 'الحجم' },
    { id: 'font', icon: FaFont, labelKey: 'studio_tool_font', label: 'الخط' },
    { id: 'transparency', icon: FaEye, labelKey: 'studio_tool_transparency', label: 'الشفافية' },
    { id: 'colors', icon: FaPalette, labelKey: 'studio_tool_colors', label: 'الألوان' },
    { id: 'effects', icon: FaMagic, labelKey: 'studio_tool_effects', label: 'التأثيرات' },
    { id: 'promo', icon: FaTags, labelKey: 'studio_tool_promo', label: 'عروض' },
];

export default function SmartPostStudio() {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const editMotionPostId = location.state?.editMotionPostId
        ? String(location.state.editMotionPostId)
        : null;
    const isRtl = i18n.language === 'ar' || i18n.language?.startsWith('ar');
    const { currentUser, userProfile } = useAuth();
    const { showToast } = useToast();

    const [layoutModel, setLayoutModel] = useState('square');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [media, setMedia] = useState(null);
    /** Hide cover in preview while a solid backdrop is selected; file stays in memory */
    const [coverHidden, setCoverHidden] = useState(false);
    const [studioStyle, setStudioStyle] = useState(DEFAULT_STYLE);
    const [activeField, setActiveField] = useState('title');
    const [activeTool, setActiveTool] = useState(null);
    const [publishing, setPublishing] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [showGrid, setShowGrid] = useState(true);
    const [promoStickers, setPromoStickers] = useState(
        /** @type {{ id: string; stickerId: string; slot: string }[]} */ ([])
    );
    const [animPlayKey, setAnimPlayKey] = useState(1);
    const [editingMotionId, setEditingMotionId] = useState(editMotionPostId);
    const [loadingEdit, setLoadingEdit] = useState(Boolean(editMotionPostId));
    const fileInputRef = useRef(null);
    const previewZoneRef = useRef(null);
    const {
        pageRef,
        cardRef,
        isTyping,
        previewSize,
        onTextFocus,
        onTextBlur,
        resetPreviewLock,
    } = useStudioTypingViewport();

    useEffect(() => {
        return () => {
            if (media?.preview && String(media.preview).startsWith('blob:')) {
                URL.revokeObjectURL(media.preview);
            }
        };
    }, [media?.preview]);

    useEffect(() => {
        if (!editMotionPostId || !currentUser?.uid) {
            setLoadingEdit(false);
            return undefined;
        }

        let cancelled = false;
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'business_motion_posts', editMotionPostId));
                if (cancelled) return;
                if (!snap.exists()) {
                    showToast(t('post_not_found', 'Post not found.'), 'error');
                    return;
                }
                const data = snap.data();
                if (data.ownerId !== currentUser.uid) {
                    showToast(t('post_edit_denied', 'You can only edit your own posts.'), 'error');
                    return;
                }
                const content =
                    data.content && typeof data.content === 'object' ? data.content : {};
                setTitle(String(content.title || ''));
                setBody(String(content.description || content.subtitle || ''));
                const imageUrl = String(
                    (data.media && data.media.imageUrl) || content.imageUrl || ''
                ).trim();
                if (imageUrl) {
                    setMedia({ preview: imageUrl });
                    setCoverHidden(false);
                }
                const se =
                    data.studioEditor && typeof data.studioEditor === 'object'
                        ? data.studioEditor
                        : null;
                if (se?.layoutModel) setLayoutModel(se.layoutModel);
                if (se?.style && typeof se.style === 'object') {
                    setStudioStyle((s) => ({ ...s, ...se.style }));
                }
                if (Array.isArray(se?.promoStickers)) {
                    setPromoStickers(se.promoStickers);
                }
                if (se?.textAnimation) {
                    setStudioStyle((s) => ({
                        ...s,
                        animation: normalizeStudioTextAnimation(se.textAnimation),
                    }));
                }
                setEditingMotionId(editMotionPostId);
            } catch (err) {
                console.error('[SmartPostStudio] load edit', err);
                if (!cancelled) showToast(t('post_failed', 'Failed to load post.'), 'error');
            } finally {
                if (!cancelled) setLoadingEdit(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [editMotionPostId, currentUser?.uid, showToast, t]);

    useEffect(() => {
        if (!media?.preview) {
            setCoverHidden(false);
            return;
        }
        const bg = studioStyle.backgroundColor;
        setCoverHidden(Boolean(bg && bg !== 'transparent'));
    }, [studioStyle.backgroundColor, media?.preview]);

    const previewStyle = useMemo(
        () => ({
            fontFamily: studioStyle.fontFamily,
            fontSize: studioStyle.titleFontSize ?? studioStyle.fontSize,
            titleFontSize: studioStyle.titleFontSize ?? studioStyle.fontSize ?? 26,
            bodyFontSize:
                studioStyle.bodyFontSize ??
                Math.max(14, (studioStyle.titleFontSize ?? studioStyle.fontSize ?? 26) - 4),
            fontWeight: studioStyle.fontWeight,
            fontStyle: studioStyle.fontStyle || 'normal',
            textAlign: studioStyle.textAlign,
            textVerticalAlign: studioStyle.textVerticalAlign || 'center',
            textColor: studioStyle.textColor || '#ffffff',
            subtitleColor: studioStyle.subtitleColor || '#ff9d2e',
            backgroundColor: studioStyle.backgroundColor || 'transparent',
            overlayTintColor: studioStyle.overlayTintColor ?? '#000000',
            overlayOpacity: studioStyle.overlayOpacity ?? 35,
            opacity: studioStyle.opacity ?? 100,
            glowIntensity: studioStyle.glowIntensity ?? 28,
            textStroke: studioStyle.textStroke,
            strokeWidth: studioStyle.strokeWidth ?? 2,
            strokeColor: studioStyle.strokeColor || '#000000',
            shadowDepth: studioStyle.shadowDepth ?? 55,
            shadowBlur: studioStyle.shadowBlur ?? 14,
            shadowOffsetX: studioStyle.shadowOffsetX ?? 0,
            shadowOffsetY: studioStyle.shadowOffsetY ?? 4,
            shadowColor: studioStyle.shadowColor || '#000000',
            glowColor: studioStyle.glowColor,
            titleColorMode: 'solid',
            bodyColorMode: 'solid',
            letterSpacing: studioStyle.letterSpacing ?? 0,
            lineHeight: studioStyle.lineHeight ?? 1.25,
            textShadow: studioStyle.textShadow !== false,
            textStackGap: studioStyle.textStackGap ?? 6,
            textPaddingTop: studioStyle.textPaddingTop ?? 0,
            textPaddingBottom: studioStyle.textPaddingBottom ?? 0,
        }),
        [studioStyle]
    );

    const studioFonts = useMemo(() => studioFontsForLanguage(i18n.language), [i18n.language]);

    const applyFont = useCallback(
        (fontId) => {
            const font = studioFonts.find((f) => f.id === fontId);
            if (!font) return;
            setStudioStyle((s) => ({
                ...s,
                fontFamily: font.family,
                fontId: font.id,
            }));
        },
        [studioFonts]
    );

    useEffect(() => {
        const list = studioFontsForLanguage(i18n.language);
        setStudioStyle((s) => {
            if (list.find((f) => f.id === s.fontId)) return s;
            const first = list[0];
            if (!first) return s;
            return { ...s, fontFamily: first.family, fontId: first.id };
        });
    }, [i18n.language]);

    const toggleTool = (toolId) => {
        setActiveTool((prev) => (prev === toolId ? null : toolId));
    };

    const selectLayout = (id) => {
        setLayoutModel(id);
        resetPreviewLock();
        setAnimPlayKey((k) => k + 1);
    };

    const selectTextAnimation = useCallback((animId) => {
        const next = normalizeStudioTextAnimation(animId);
        setStudioStyle((s) => ({ ...s, animation: next }));
        setAnimPlayKey((k) => k + 1);
    }, []);

    const openImagePicker = () => {
        if (coverHidden && media?.preview) {
            setStudioStyle((s) => ({ ...s, backgroundColor: 'transparent' }));
            setCoverHidden(false);
            return;
        }
        fileInputRef.current?.click();
    };

    const handleFile = (e) => {
        const file = e.target.files?.[0];
        if (!file || !file.type.startsWith('image/')) {
            showToast(t('only_images_allowed', 'Please select an image file.'), 'error');
            return;
        }
        if (media?.preview) URL.revokeObjectURL(media.preview);
        setMedia({ file, preview: URL.createObjectURL(file) });
        setCoverHidden(false);
        e.target.value = '';
    };

    const handleFieldFocus = useCallback(
        (field) => {
            setActiveField(field);
            setActiveTool(null);
            onTextFocus();
        },
        [onTextFocus]
    );

    const hasText = Boolean(title.trim() || body.trim());
    const canPublish = hasText;
    const isBusy = publishing || savingDraft;

    const buildDraftInput = useCallback(async () => {
        if (!currentUser?.uid) throw new Error('Not signed in');
        let imageUrl = '';
        if (media?.file) {
            const safeName = String(media.file.name || 'cover.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
            const path = `business-motion/${currentUser.uid}/studio_${Date.now()}_${safeName}`;
            imageUrl = await uploadPostMedia(media.file, currentUser.uid, path, null, 'image');
        }

        const motionUi = layoutToMotionUi(layoutModel);
        const businessId = userProfile?.businessId || currentUser.uid;
        const tier = String(userProfile?.subscriptionTier || 'free').toLowerCase();
        const publishTitle = title.trim().slice(0, 60) || body.trim().slice(0, 60);
        const publishBody = body.trim().slice(0, 180);

        return {
            ownerId: currentUser.uid,
            businessId,
            subscriptionTier: tier,
            payload: {
                type: 'normal_post',
                format: 'square',
                templateId: 'normal_post_stub_v1',
                content: {
                    title: publishTitle,
                    description: publishBody,
                    imageUrl,
                },
                style: {
                    animation: normalizeStudioTextAnimation(studioStyle.animation),
                    themeId: 'midnight',
                    durationMs: STUDIO_ANIM_DURATION_MS,
                },
            },
            ui: {
                ...motionUi,
                aiDesign: {
                    textPlacement:
                        layoutModel === 'header_card'
                            ? 'bottom_panel'
                            : studioStyle.textVerticalAlign || 'center',
                    styleMood: studioStyle.preset || 'modern',
                },
            },
            studioEditor: {
                layoutModel,
                style: previewStyle,
                promoStickers,
                textAnimation: normalizeStudioTextAnimation(studioStyle.animation),
            },
        };
    }, [
        body,
        currentUser?.uid,
        layoutModel,
        media?.file,
        previewStyle,
        promoStickers,
        studioStyle.animation,
        studioStyle.preset,
        studioStyle.textVerticalAlign,
        title,
        userProfile?.businessId,
        userProfile?.subscriptionTier,
    ]);

    const handleSaveDraft = useCallback(async () => {
        if (!canPublish || isBusy) return;
        setSavingDraft(true);
        try {
            const input = await buildDraftInput();
            await createMotionPostDraft(input);
            showToast(t('studio_draft_saved', 'تم حفظ المسودة على البروفايل'), 'success');
        } catch (err) {
            console.error('[SmartPostStudio] save draft', err);
            showToast(studioPostErrorMessage(err, t), 'error');
        } finally {
            setSavingDraft(false);
        }
    }, [buildDraftInput, canPublish, isBusy, showToast, t]);

    const handlePublish = useCallback(async () => {
        if (!canPublish || isBusy) return;
        setPublishing(true);
        try {
            const input = await buildDraftInput();
            if (editingMotionId) {
                await updateMotionPostDraft(editingMotionId, input);
                await syncPublishedMotionPostToCommunityFeed(
                    editingMotionId,
                    input.ownerId,
                    input.businessId
                );
                showToast(t('studio_post_updated', 'تم تحديث المنشور'), 'success');
            } else {
                const postId = await createMotionPostDraft(input);
                await publishMotionPost(postId, input.ownerId, input.businessId);
                showToast(t('studio_published_feed', 'تم النشر على الفيد والصفحة الرئيسية'), 'success');
            }
        } catch (err) {
            console.error('[SmartPostStudio] publish', err);
            showToast(studioPostErrorMessage(err, t), 'error');
        } finally {
            setPublishing(false);
        }
    }, [buildDraftInput, canPublish, editingMotionId, isBusy, showToast, t]);

    const insertPromoSticker = useCallback((stickerId) => {
        if (!STUDIO_PROMO_STICKERS.some((s) => s.id === stickerId)) return;
        setPromoStickers((list) => {
            if (list.length >= STUDIO_PROMO_MAX) return list;
            const slot = pickPromoCornerSlot(list.map((s) => s.slot));
            if (!slot) return list;
            return [
                ...list,
                {
                    id: `promo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    stickerId,
                    slot,
                },
            ];
        });
    }, []);

    const removePromoSticker = useCallback((instanceId) => {
        setPromoStickers((list) => list.filter((s) => s.id !== instanceId));
    }, []);

    const applyQuickStyle = useCallback(
        (patch) => setStudioStyle((s) => ({ ...s, ...patch })),
        []
    );

    const activeAnim = normalizeStudioTextAnimation(studioStyle.animation);

    const renderToolPanel = () => {
        if (!activeTool) return null;
        const panelProps = { style: studioStyle, setStyle: setStudioStyle, t };

        switch (activeTool) {
            case 'align':
                return <StudioAlignPanel {...panelProps} />;
            case 'size':
                return (
                    <div className="sps-glass-panel sps-glass-panel--compact sps-panel--size-dual">
                        <StudioStepperRow
                            label={t('studio_title_font_size', 'حجم العنوان')}
                            value={studioStyle.titleFontSize ?? studioStyle.fontSize ?? 26}
                            min={16}
                            max={56}
                            onChange={(v) =>
                                setStudioStyle((s) => ({
                                    ...s,
                                    titleFontSize: v,
                                    fontSize: v,
                                }))
                            }
                            suffix="px"
                        />
                        <StudioStepperRow
                            label={t('studio_body_font_size', 'حجم النص')}
                            value={
                                studioStyle.bodyFontSize ??
                                Math.max(14, (studioStyle.titleFontSize ?? studioStyle.fontSize ?? 26) - 4)
                            }
                            min={12}
                            max={40}
                            onChange={(v) => setStudioStyle((s) => ({ ...s, bodyFontSize: v }))}
                            suffix="px"
                        />
                    </div>
                );
            case 'font':
                return (
                    <StudioTypographyPanel
                        {...panelProps}
                        fonts={studioFonts}
                        applyFont={applyFont}
                    />
                );
            case 'transparency':
                return <StudioTransparencyPanel {...panelProps} />;
            case 'colors':
                return <StudioColorsPanel {...panelProps} />;
            case 'effects':
                return (
                    <StudioEffectsPanel {...panelProps} t={t} />
                );
            case 'promo':
                return (
                    <StudioPromoPanel
                        onInsertSticker={insertPromoSticker}
                        stickerCount={promoStickers.length}
                        t={t}
                    />
                );
            default:
                return null;
        }
    };

    const cardLockStyle =
        isTyping && previewSize
            ? {
                  '--sps-lock-w': `${previewSize.w}px`,
                  '--sps-lock-h': `${previewSize.h}px`,
              }
            : undefined;

    const previewBlock = (
        <>
            {showGrid && <div className="sps-canvas-stage__grid" aria-hidden />}
            <div
                ref={cardRef}
                className={`sps-canvas-stage__card${isTyping && previewSize ? ' sps-canvas-stage__card--locked' : ''}`}
                style={cardLockStyle}
            >
                <StudioLivePreview
                    layoutModel={layoutModel}
                    title={title}
                    body={body}
                    imageUrl={coverHidden ? '' : media?.preview || ''}
                    style={previewStyle}
                    activeField={activeField}
                    onTitleChange={setTitle}
                    onBodyChange={setBody}
                    onFocusField={handleFieldFocus}
                    onBlurField={onTextBlur}
                    typingMode={isTyping}
                    onImagePick={openImagePicker}
                    scrollContainerRef={previewZoneRef}
                    imagePickLabel={t('studio_tap_image', 'اضغط لإضافة صورة')}
                    imageChangeLabel={t('studio_tap_change_image', 'اضغط لتغيير الصورة')}
                    promoStickers={promoStickers}
                    onRemovePromoSticker={removePromoSticker}
                    textAnimation={studioStyle.animation}
                    animPlayKey={animPlayKey}
                />
            </div>
            <button
                type="button"
                className="sps-canvas-float"
                onClick={() => setShowGrid((g) => !g)}
                aria-pressed={showGrid}
                title={t('studio_toggle_grid', 'شبكة المحاذاة')}
            >
                <FaArrowsAlt />
            </button>
            {media?.preview && (
                <button
                    type="button"
                    className="sps-canvas-clear"
                    onClick={() => {
                        if (media.preview) URL.revokeObjectURL(media.preview);
                        setMedia(null);
                        setCoverHidden(false);
                    }}
                    aria-label={t('remove', 'Remove')}
                >
                    ×
                </button>
            )}
        </>
    );

    if (loadingEdit) {
        return (
            <div className="sps-page sps-page--premium" dir={isRtl ? 'rtl' : 'ltr'}>
                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--sps-muted)' }}>
                    {t('loading', 'Loading...')}
                </div>
            </div>
        );
    }

    return (
        <div
            ref={pageRef}
            className={`sps-page sps-page--premium${activeTool ? ' sps-page--panel-open' : ''}${isTyping ? ' sps-page--typing' : ''}`}
            dir={isRtl ? 'rtl' : 'ltr'}
        >
            <nav
                className="sps-layout-strip sps-layout-strip--top"
                role="tablist"
                aria-label={t('studio_layout_tabs', 'قياس المنشور')}
            >
                {STUDIO_LAYOUTS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={layoutModel === item.id}
                        className={`sps-layout-strip__btn${layoutModel === item.id ? ' active' : ''}`}
                        onClick={() => selectLayout(item.id)}
                    >
                        {t(item.labelKey, item.label)}
                    </button>
                ))}
            </nav>

            <main className="sps-canvas-zone" ref={previewZoneRef}>
                <div className="sps-canvas-stage">
                    <StudioToolRail
                        tools={EDITOR_TOOLS}
                        activeTool={activeTool}
                        onToggle={toggleTool}
                        t={t}
                    />
                    <div className="sps-canvas-stage__viewport">{previewBlock}</div>
                    <StudioAnimRail
                        animations={STUDIO_TEXT_ANIMATIONS}
                        activeAnim={activeAnim}
                        onSelect={selectTextAnimation}
                        t={t}
                    />
                </div>
            </main>

            <section className="sps-editor-dock">
                {activeTool && <div className="sps-editor-panels">{renderToolPanel()}</div>}

                <div className="sps-editor-dock__footer">
                    <StudioQuickStyles
                        styles={STUDIO_QUICK_STYLES}
                        onApply={applyQuickStyle}
                        t={t}
                        layout="horizontal"
                    />
                    <StudioPublishActions
                        canPublish={canPublish}
                        isBusy={isBusy}
                        savingDraft={savingDraft}
                        publishing={publishing}
                        onSaveDraft={handleSaveDraft}
                        onPublish={handlePublish}
                        t={t}
                    />
                </div>
            </section>

            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFile} />
        </div>
    );
}
