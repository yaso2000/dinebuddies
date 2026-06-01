import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useTranslation } from 'react-i18next';
import {
    FaAlignCenter,
    FaAlignLeft,
    FaAlignRight,
    FaArrowLeft,
    FaCamera,
    FaPaperPlane,
    FaTimes,
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getBusinessSubscriptionAccess } from '../../utils/businessSubscription';
import { getSafeAvatar } from '../../utils/avatarUtils';
import FeaturedPostEditorPreview from '../../components/FeaturedPostEditorPreview';
import {
    DEFAULT_FEATURED_DESC_STYLE,
    DEFAULT_FEATURED_TITLE_STYLE,
    FEATURED_FONT_OPTIONS,
    FEATURED_TEXT_COLORS,
} from '../../constants/featuredPostEditor';
import {
    GRADIENT_PRESETS,
    normalizeFeaturedPostDoc,
    publishFeaturedSlide,
    updateFeaturedSlide,
} from '../../services/featuredPostService';
import { uploadImageWithModeration } from '../../services/moderatedImageUpload';
import { ensurePublicImageUrl } from '../../services/mediaService';
import { ImageUploadZone } from '../../services/imageUploadZones';
import { notifyImageUploadError } from '../../utils/imageModerationErrors';
import { useDragScrollRail } from '../../hooks/useDragScrollRail';
import { useKeyboardOverlayViewport } from '../../hooks/useKeyboardOverlayViewport';
import AIFloatingLauncher from '../../components/AIFloatingLauncher';
import { extractAIContentFields, extractAIImageUrl } from '../../utils/aiContentFieldMapper';
import './CreateFeaturedPost.css';

export default function CreateFeaturedPost() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const editFeaturedPostId = location.state?.editFeaturedPostId
        ? String(location.state.editFeaturedPostId)
        : null;
    const { currentUser, userProfile } = useAuth();
    const { showToast } = useToast();
    const tier = getBusinessSubscriptionAccess(userProfile?.subscriptionTier);

    const businessName =
        userProfile?.businessInfo?.businessName ||
        userProfile?.display_name ||
        userProfile?.displayName ||
        'Business';
    const businessLogoUrl = getSafeAvatar(userProfile);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [textColor, setTextColor] = useState('#ffffff');
    const [textAlign, setTextAlign] = useState('center');
    const [fontId, setFontId] = useState(FEATURED_FONT_OPTIONS[0].id);
    const [activeField, setActiveField] = useState('title');
    const [gradientId, setGradientId] = useState(GRADIENT_PRESETS[0].id);
    const [bgImageUrl, setBgImageUrl] = useState('');
    const [backgroundMode, setBackgroundMode] = useState('gradient');
    const [publishing, setPublishing] = useState(false);
    const [uploadingBg, setUploadingBg] = useState(false);
    const [loadingEdit, setLoadingEdit] = useState(Boolean(editFeaturedPostId));
    const [editingFeaturedId, setEditingFeaturedId] = useState(editFeaturedPostId);
    const bgFileInputRef = useRef(null);

    const {
        railRef: gradientRailRef,
        isDragging: gradientDragging,
        onPointerDown: onGradientRailDown,
        onPointerMove: onGradientRailMove,
        onPointerUp: onGradientRailUp,
        onPointerCancel: onGradientRailCancel,
        onWheel: onGradientRailWheel,
        wasDragged: gradientWasDragged,
        scrollItemIntoView: scrollGradientIntoView,
    } = useDragScrollRail();

    const {
        railRef: fontRailRef,
        isDragging: fontDragging,
        onPointerDown: onFontRailDown,
        onPointerMove: onFontRailMove,
        onPointerUp: onFontRailUp,
        onPointerCancel: onFontRailCancel,
        onWheel: onFontRailWheel,
        wasDragged: fontWasDragged,
    } = useDragScrollRail();

    const {
        railRef: colorRailRef,
        isDragging: colorDragging,
        onPointerDown: onColorRailDown,
        onPointerMove: onColorRailMove,
        onPointerUp: onColorRailUp,
        onPointerCancel: onColorRailCancel,
        onWheel: onColorRailWheel,
        wasDragged: colorWasDragged,
    } = useDragScrollRail();

    const [showMobilePreviewChrome, setShowMobilePreviewChrome] = useState(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return true;
        return window.matchMedia('(max-width: 1023px)').matches;
    });

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 1023px)');
        const sync = () => setShowMobilePreviewChrome(mq.matches);
        sync();
        mq.addEventListener('change', sync);
        return () => mq.removeEventListener('change', sync);
    }, []);

    useKeyboardOverlayViewport(showMobilePreviewChrome);

    const fontFamily = useMemo(() => {
        const preset = FEATURED_FONT_OPTIONS.find((f) => f.id === fontId);
        return preset?.fontFamily || DEFAULT_FEATURED_TITLE_STYLE.fontFamily;
    }, [fontId]);

    const titleStyle = useMemo(
        () => ({
            ...DEFAULT_FEATURED_TITLE_STYLE,
            color: textColor,
            textAlign,
            fontFamily,
        }),
        [textColor, textAlign, fontFamily]
    );

    const descStyle = useMemo(
        () => ({
            ...DEFAULT_FEATURED_DESC_STYLE,
            color: textColor,
            textAlign,
            fontFamily,
        }),
        [textColor, textAlign, fontFamily]
    );

    const background = useMemo(() => {
        if (backgroundMode === 'image' && bgImageUrl) {
            return { type: 'image', value: bgImageUrl };
        }
        const preset = GRADIENT_PRESETS.find((g) => g.id === gradientId) || GRADIENT_PRESETS[0];
        return { type: 'gradient', value: preset.value };
    }, [backgroundMode, bgImageUrl, gradientId]);

    const buildFeaturedAiPrompt = useCallback(() => {
        const parts = [
            businessName && `اسم المنشأة: ${businessName}`,
            title.trim() && `عنوان حالي: ${title.trim()}`,
            description.trim() && `وصف حالي: ${description.trim()}`,
        ].filter(Boolean);
        return parts.join('\n') || `منشور مميز لـ ${businessName}`;
    }, [businessName, title, description]);

    const handleFeaturedAiContent = useCallback((data) => {
        const fields = extractAIContentFields('featured_post', data);
        if (fields.title) setTitle(fields.title);
        if (fields.description) setDescription(fields.description);

        const imageUrl = extractAIImageUrl(data);
        if (imageUrl) {
            setBgImageUrl(imageUrl);
            setBackgroundMode('image');
        }
    }, []);

    const pickGradient = (id, el) => {
        setGradientId(id);
        setBackgroundMode('gradient');
        if (el) scrollGradientIntoView(el);
    };

    const onGradientSwatchActivate = (id, el) => (e) => {
        if (gradientWasDragged()) return;
        e.stopPropagation();
        pickGradient(id, el);
    };

    useEffect(() => {
        if (!editFeaturedPostId || !currentUser?.uid) {
            setLoadingEdit(false);
            return undefined;
        }

        let cancelled = false;
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'featured_posts', editFeaturedPostId));
                if (cancelled) return;
                if (!snap.exists()) {
                    showToast(t('post_not_found', 'Post not found.'), 'error');
                    navigate('/posts-feed', { replace: true });
                    return;
                }
                const data = normalizeFeaturedPostDoc(snap.id, snap.data());
                if (data.partnerId !== currentUser.uid) {
                    showToast(t('post_edit_denied', 'You can only edit your own posts.'), 'error');
                    navigate('/posts-feed', { replace: true });
                    return;
                }

                setEditingFeaturedId(snap.id);
                setTitle(String(data.title?.text ?? ''));
                setDescription(String(data.description?.text ?? ''));
                const titleColor = data.title?.color || data.description?.color;
                if (titleColor) setTextColor(titleColor);
                if (data.title?.textAlign) setTextAlign(data.title.textAlign);

                const storedFont = data.title?.fontFamily || data.description?.fontFamily;
                if (storedFont) {
                    const fontMatch = FEATURED_FONT_OPTIONS.find((f) => f.fontFamily === storedFont);
                    if (fontMatch) setFontId(fontMatch.id);
                }

                const bg = data.background;
                if (bg?.type === 'image' && bg.value) {
                    setBgImageUrl(String(bg.value));
                    setBackgroundMode('image');
                } else if (bg?.type === 'gradient' && bg.value) {
                    const preset =
                        GRADIENT_PRESETS.find((g) => g.value === bg.value) || GRADIENT_PRESETS[0];
                    setGradientId(preset.id);
                    setBackgroundMode('gradient');
                }
            } catch (err) {
                console.error('[CreateFeaturedPost] load edit', err);
                if (!cancelled) {
                    showToast(t('post_failed', 'Failed to load post.'), 'error');
                    navigate('/posts-feed', { replace: true });
                }
            } finally {
                if (!cancelled) setLoadingEdit(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [editFeaturedPostId, currentUser?.uid, navigate, showToast, t]);

    const onBgFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !currentUser?.uid) return;
        setUploadingBg(true);
        try {
            const url = await uploadImageWithModeration(file, currentUser.uid, ImageUploadZone.FEATURED);
            setBgImageUrl(url);
            setBackgroundMode('image');
        } catch (err) {
            notifyImageUploadError(showToast, err, t, 'upload_failed');
        } finally {
            setUploadingBg(false);
            e.target.value = '';
        }
    };

    const onPublish = async () => {
        if (!tier.canCreateFeaturedPost) {
            showToast(t('featured_post_paid_only', 'Featured posts require a paid business plan.'), 'info');
            navigate('/settings/subscription');
            return;
        }
        if (!currentUser?.uid) return;
        setPublishing(true);
        try {
            let publishBackground = background;
            if (backgroundMode === 'image' && bgImageUrl) {
                const persistedUrl = await ensurePublicImageUrl(
                    bgImageUrl,
                    currentUser.uid,
                    'featured_posts'
                );
                publishBackground = { type: 'image', value: persistedUrl };
            }

            if (editingFeaturedId) {
                await updateFeaturedSlide({
                    featuredPostId: editingFeaturedId,
                    partnerId: currentUser.uid,
                    titleText: title,
                    titleStyle,
                    descriptionText: description,
                    descriptionStyle: descStyle,
                    background: publishBackground,
                    layout: 'center',
                });
                showToast(t('featured_post_updated', 'Featured post updated.'), 'success');
            } else {
                const result = await publishFeaturedSlide({
                    partnerId: currentUser.uid,
                    businessName,
                    businessLogoUrl: businessLogoUrl || null,
                    titleText: title,
                    titleStyle,
                    descriptionText: description,
                    descriptionStyle: descStyle,
                    background: publishBackground,
                    layout: 'center',
                });
                const sent = Number(result?.notifyResult?.sent || 0);
                const membersIncluded = result?.notifyResult?.includeMembers === true;
                if (sent > 0) {
                    showToast(
                        membersIncluded
                            ? t('featured_post_published_notify_members', 'Published! {{count}} followers and members notified.', { count: sent })
                            : t('featured_post_published_notify_followers', 'Published! {{count}} followers notified.', { count: sent }),
                        'success'
                    );
                } else {
                    showToast(t('featured_post_published', 'Featured post published to the home feed!'), 'success');
                }
            }
            navigate('/posts-feed');
        } catch (err) {
            if (err?.message === 'featured_title_required') {
                showToast(t('featured_title_required', 'Add a headline for your featured post.'), 'error');
            } else {
                console.error(err);
                showToast(t('post_failed', 'Failed to publish. Try again.'), 'error');
            }
        } finally {
            setPublishing(false);
        }
    };

    if (loadingEdit) {
        return (
            <div className="fp-page">
                <div className="fp-page__loading">{t('loading', 'Loading...')}</div>
            </div>
        );
    }

    return (
        <div className="fp-page">
            <header className="app-header sticky-header-glass fp-page__header">
                <button type="button" className="back-btn" onClick={() => navigate(-1)} aria-label={t('back', 'Back')}>
                    <FaArrowLeft />
                </button>
                <h3 className="fp-page__title">
                    {editingFeaturedId
                        ? t('business_edit_featured_title', 'Edit featured post')
                        : t('business_create_featured_title', 'Featured Post')}
                </h3>
                <div className="fp-page__header-spacer" aria-hidden />
            </header>

            {!tier.canCreateFeaturedPost && (
                <p className="fp-paid-banner">{t('featured_post_paid_only', 'Featured posts require a paid business plan.')}</p>
            )}

            <input
                ref={bgFileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={onBgFile}
                disabled={uploadingBg}
            />

            <section className="fp-studio" aria-label={t('featured_editor_workspace', 'Featured post editor')}>
                <div className="fp-studio__preview-zone">
                    <p className="fp-studio__zone-label">{t('featured_preview_label', 'المعاينة')}</p>
                    <div
                        className={`fp-preview-card${showMobilePreviewChrome ? ' fp-preview-card--mobile-chrome' : ''}`}
                    >
                        <FeaturedPostEditorPreview
                            title={title}
                            description={description}
                            onTitleChange={setTitle}
                            onDescriptionChange={setDescription}
                            titleStyle={titleStyle}
                            descStyle={descStyle}
                            background={background}
                            activeField={activeField}
                            onFocusField={setActiveField}
                            withOverlayChrome={showMobilePreviewChrome}
                            titlePlaceholder={t('featured_title_placeholder', 'اكتب العنوان هنا…')}
                            descPlaceholder={t('featured_desc_placeholder', 'وصف قصير (اختياري)…')}
                        />

                        {showMobilePreviewChrome ? (
                            <>
                                <label
                                    className={`fp-preview-camera-glass${backgroundMode === 'image' && bgImageUrl ? ' fp-preview-camera-glass--has-photo' : ''}`}
                                    onClick={(e) => {
                                        if (bgImageUrl && backgroundMode === 'gradient') {
                                            e.preventDefault();
                                            setBackgroundMode('image');
                                            return;
                                        }
                                        if (!uploadingBg) {
                                            e.preventDefault();
                                            bgFileInputRef.current?.click();
                                        }
                                    }}
                                >
                                    <span className="fp-preview-camera-glass__icon" aria-hidden>
                                        {bgImageUrl && backgroundMode === 'image' ? (
                                            <img src={bgImageUrl} alt="" className="fp-preview-camera-glass__thumb" />
                                        ) : (
                                            <FaCamera size={18} />
                                        )}
                                    </span>
                                    <span className="fp-preview-camera-glass__text">
                                        {uploadingBg
                                            ? t('uploading', 'جاري الرفع…')
                                            : bgImageUrl
                                              ? backgroundMode === 'gradient'
                                                  ? t('featured_bg_use_saved_photo', 'استخدام الصورة المحفوظة')
                                                  : t('featured_bg_change_photo', 'تغيير صورة الخلفية')
                                              : t('featured_bg_add_photo', 'إضافة صورة خلفية')}
                                    </span>
                                </label>

                                {bgImageUrl && backgroundMode === 'image' ? (
                                    <button
                                        type="button"
                                        className="fp-preview-clear-photo"
                                        onClick={() => setBackgroundMode('gradient')}
                                        aria-label={t('featured_bg_remove_photo', 'إزالة الصورة')}
                                    >
                                        <FaTimes size={12} aria-hidden />
                                    </button>
                                ) : null}
                            </>
                        ) : null}
                    </div>
                </div>

                <div
                    className="fp-controls"
                    role="region"
                    aria-label={t('featured_controls_panel', 'لوحة التحكم')}
                >
                        <div className="fp-controls__row fp-controls__row--format">
                            <div className="fp-align-group" role="group" aria-label={t('studio_align_h', 'المحاذاة')}>
                                {[
                                    { id: 'left', Icon: FaAlignLeft },
                                    { id: 'center', Icon: FaAlignCenter },
                                    { id: 'right', Icon: FaAlignRight },
                                ].map(({ id, Icon }) => (
                                    <button
                                        key={id}
                                        type="button"
                                        className={`fp-align-btn${textAlign === id ? ' active' : ''}`}
                                        onClick={() => setTextAlign(id)}
                                        aria-label={id}
                                        aria-pressed={textAlign === id}
                                    >
                                        <Icon size={16} />
                                    </button>
                                ))}
                            </div>
                            <div
                                ref={fontRailRef}
                                className={`fp-hscroll fp-font-rail${fontDragging ? ' is-dragging' : ''}`}
                                role="listbox"
                                aria-label={t('featured_font_style', 'نوع الخط')}
                                onPointerDown={onFontRailDown}
                                onPointerMove={onFontRailMove}
                                onPointerUp={onFontRailUp}
                                onPointerCancel={onFontRailCancel}
                                onWheel={onFontRailWheel}
                            >
                                {FEATURED_FONT_OPTIONS.map((font) => (
                                    <button
                                        key={font.id}
                                        type="button"
                                        role="option"
                                        className={`fp-font-chip${fontId === font.id ? ' active' : ''}`}
                                        style={{ fontFamily: font.fontFamily }}
                                        aria-selected={fontId === font.id}
                                        onClick={() => {
                                            if (fontWasDragged()) return;
                                            setFontId(font.id);
                                        }}
                                    >
                                        <span className="fp-font-chip__sample" aria-hidden>
                                            {font.sample}
                                        </span>
                                        <span className="fp-font-chip__label">{font.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="fp-controls__row fp-controls__row--labeled">
                            <span className="fp-controls__label">{t('featured_text_color', 'لون الخط')}</span>
                            <div
                                ref={colorRailRef}
                                className={`fp-hscroll fp-color-rail${colorDragging ? ' is-dragging' : ''}`}
                                role="group"
                                aria-label={t('featured_text_color', 'لون الخط')}
                                onPointerDown={onColorRailDown}
                                onPointerMove={onColorRailMove}
                                onPointerUp={onColorRailUp}
                                onPointerCancel={onColorRailCancel}
                                onWheel={onColorRailWheel}
                            >
                                {FEATURED_TEXT_COLORS.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        className={`fp-color-swatch${textColor === c ? ' active' : ''}${
                                            c === '#ffffff' || c === '#f8fafc' ? ' fp-color-swatch--light' : ''
                                        }`}
                                        style={{ background: c }}
                                        onClick={() => {
                                            if (colorWasDragged()) return;
                                            setTextColor(c);
                                        }}
                                        aria-label={c}
                                        aria-pressed={textColor === c}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="fp-controls__row fp-controls__row--labeled">
                            <span className="fp-controls__label">
                                {t('featured_pick_background', 'اختر الخلفية')}
                            </span>
                            <div
                                ref={gradientRailRef}
                                className={`fp-hscroll fp-bg-rail${gradientDragging ? ' is-dragging' : ''}`}
                                role="listbox"
                                aria-label={t('featured_pick_background', 'اختر الخلفية')}
                                onPointerDown={onGradientRailDown}
                                onPointerMove={onGradientRailMove}
                                onPointerUp={onGradientRailUp}
                                onPointerCancel={onGradientRailCancel}
                                onWheel={onGradientRailWheel}
                            >
                                {GRADIENT_PRESETS.map((g) => (
                                    <button
                                        key={g.id}
                                        type="button"
                                        role="option"
                                        className={`fp-bg-tile${
                                            gradientId === g.id && backgroundMode === 'gradient' ? ' active' : ''
                                        }`}
                                        style={{ background: g.value }}
                                        aria-label={g.id}
                                        aria-selected={gradientId === g.id && backgroundMode === 'gradient'}
                                        onPointerDown={onGradientSwatchActivate(g.id)}
                                        onClick={onGradientSwatchActivate(g.id)}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="fp-controls__row fp-controls__row--action fp-controls__row--desktop-upload">
                            <button
                                type="button"
                                className={`fp-bg-upload-btn ios-tap-target${
                                    backgroundMode === 'image' && bgImageUrl ? ' fp-bg-upload-btn--has-image' : ''
                                }`}
                                onClick={() => bgFileInputRef.current?.click()}
                                disabled={uploadingBg}
                            >
                                <span className="fp-bg-upload-btn__icon" aria-hidden>
                                    {bgImageUrl && backgroundMode === 'image' ? (
                                        <img src={bgImageUrl} alt="" className="fp-bg-upload-btn__thumb" />
                                    ) : (
                                        <FaCamera size={18} />
                                    )}
                                </span>
                                <span className="fp-bg-upload-btn__text">
                                    {uploadingBg
                                        ? t('uploading', 'جاري الرفع…')
                                        : bgImageUrl && backgroundMode === 'image'
                                          ? t('featured_bg_change_photo', 'تغيير صورة الخلفية')
                                          : t('featured_bg_add_photo', 'إضافة صورة خلفية')}
                                </span>
                            </button>
                            {bgImageUrl && backgroundMode === 'image' ? (
                                <button
                                    type="button"
                                    className="fp-text-btn"
                                    onClick={() => setBackgroundMode('gradient')}
                                >
                                    {t('featured_bg_remove_photo', 'إزالة الصورة واستخدام تدرج')}
                                </button>
                            ) : null}
                        </div>

                        <div className="fp-controls__row">
                            <AIFloatingLauncher
                                postType="featured_post"
                                onTextSuccess={handleFeaturedAiContent}
                                buildContextPrompt={buildFeaturedAiPrompt}
                                multimodalMode
                                disabled={publishing || uploadingBg}
                                compact
                            />
                        </div>
                </div>
            </section>

            <div className="fp-publish-bar">
                <button
                    type="button"
                    className="fp-publish-btn ios-tap-target"
                    onClick={onPublish}
                    disabled={publishing || uploadingBg}
                >
                    <FaPaperPlane aria-hidden />
                    {publishing
                        ? t('saving', 'Saving…')
                        : editingFeaturedId
                          ? t('save_changes', 'Save changes')
                          : t('publish_to_feed', 'Publish to home feed')}
                </button>
            </div>
        </div>
    );
}
