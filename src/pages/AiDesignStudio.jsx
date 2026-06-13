import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaChevronDown, FaDownload, FaMagic, FaTimes, FaWallet } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import {
    generateAIDesignStudioImage,
    formatAiErrorMessage,
    isInsufficientCreditsError,
} from '../services/generateAIContent';
import { applyStudioImageUse } from '../services/aiDesignStudioApply';
import { extractAIImageUrl } from '../utils/aiContentFieldMapper';
import {
    aspectRatioForDesignCategory,
    listAiDesignStudioCategories,
    suggestedDestinationIdForCategory,
} from '../constants/aiDesignStudioCategories';
import { listAiDesignUseDestinations } from '../constants/aiDesignStudioUseDestinations';
import {
    AI_IMAGE_GENERATION_CREDITS,
    CREDITS_WALLET_PATH,
} from '../utils/aiCreditCosts';
import { saveOrShareRemoteImage } from '../utils/saveRemoteImage';
import { isIOS } from '../services/notificationService';
import { isBusinessUser } from '../utils/accountRole';
import { notifyImageUploadError } from '../utils/imageModerationErrors';
import {
    AI_DESIGN_STUDIO_STASH_MAX,
    createAiDesignStudioStashId,
    pushAiDesignStudioStash,
    readAiDesignStudioStash,
    removeAiDesignStudioStashEntry,
    writeAiDesignStudioStash,
} from '../utils/aiDesignStudioStash';
import './AiDesignStudio.css';

function previewFrameClass(aspectRatio) {
    if (aspectRatio === '9:16') return 'ai-design-studio__preview-frame--9-16';
    if (aspectRatio === '16:9') return 'ai-design-studio__preview-frame--16-9';
    return 'ai-design-studio__preview-frame--1-1';
}

export default function AiDesignStudio() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { currentUser, userProfile, updateProfile } = useAuth();
    const userId = currentUser?.uid || null;

    const [categoryId, setCategoryId] = useState('square');
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [applyingUseId, setApplyingUseId] = useState(null);
    const [useMenuOpen, setUseMenuOpen] = useState(false);
    const [stash, setStash] = useState(() => readAiDesignStudioStash(userId));
    const [selectedStashId, setSelectedStashId] = useState(() => readAiDesignStudioStash(userId)[0]?.id || null);
    const [insufficientCreditsMessage, setInsufficientCreditsMessage] = useState('');
    const useMenuRef = useRef(null);

    const isBusinessAccount = isBusinessUser(userProfile);
    const studioCategories = useMemo(
        () => listAiDesignStudioCategories(isBusinessAccount),
        [isBusinessAccount]
    );
    const useDestinations = useMemo(
        () => listAiDesignUseDestinations(isBusinessAccount),
        [isBusinessAccount]
    );

    const selectedCategory = useMemo(
        () => studioCategories.find((c) => c.id === categoryId) || studioCategories[0],
        [categoryId, studioCategories]
    );

    const suggestedDestination = useMemo(() => {
        const destId = suggestedDestinationIdForCategory(categoryId, isBusinessAccount);
        if (!destId) return null;
        return useDestinations.find((d) => d.id === destId) || null;
    }, [categoryId, isBusinessAccount, useDestinations]);

    useEffect(() => {
        if (!studioCategories.some((c) => c.id === categoryId)) {
            setCategoryId(studioCategories[0]?.id || 'square');
        }
    }, [categoryId, studioCategories]);

    useEffect(() => {
        if (!userId) {
            setStash([]);
            setSelectedStashId(null);
            return;
        }
        const stored = readAiDesignStudioStash(userId);
        setStash(stored);
        setSelectedStashId((prev) => {
            if (prev && stored.some((e) => e.id === prev)) return prev;
            return stored[0]?.id || null;
        });
    }, [userId]);

    useEffect(() => {
        writeAiDesignStudioStash(userId, stash);
    }, [stash, userId]);

    const activeEntry = useMemo(
        () => stash.find((e) => e.id === selectedStashId) || stash[0] || null,
        [stash, selectedStashId]
    );

    const imageUrl = activeEntry?.imageUrl || '';
    const optimizedPrompt = activeEntry?.optimizedPrompt || '';
    const previewCategoryId = activeEntry?.categoryId || categoryId;
    const previewAspectRatio = aspectRatioForDesignCategory(previewCategoryId);

    const selectStashEntry = useCallback((entry) => {
        if (!entry) return;
        setSelectedStashId(entry.id);
        setPrompt(entry.userPrompt || '');
        if (entry.categoryId) {
            setCategoryId(entry.categoryId);
        }
    }, []);

    const handleRemoveStashEntry = useCallback(
        (entryId, e) => {
            e?.stopPropagation();
            setStash((prev) => {
                const next = removeAiDesignStudioStashEntry(prev, entryId);
                setSelectedStashId((current) => {
                    if (current !== entryId) return current;
                    return next[0]?.id || null;
                });
                return next;
            });
        },
        []
    );

    const categoryLabel = t(selectedCategory.labelKey, {
        defaultValue: i18n.language?.startsWith('ar')
            ? selectedCategory.defaultLabelAr
            : selectedCategory.defaultLabel,
    });

    const handleGenerate = async () => {
        const trimmed = prompt.trim();
        if (!trimmed) {
            showToast(
                t('ai_prompt_required', 'أدخل وصفاً قصيراً لما تريد توليده بالذكاء الاصطناعي.'),
                'error'
            );
            return;
        }

        setLoading(true);

        try {
            const result = await generateAIDesignStudioImage({
                userPrompt: trimmed,
                designCategory: categoryId,
                aspectRatio: aspectRatioForDesignCategory(categoryId),
                outputLanguage: i18n.language,
            });

            if (!result.success) {
                if (isInsufficientCreditsError(result)) {
                    setInsufficientCreditsMessage(
                        result.message ||
                            t(
                                'ai_insufficient_credits_default',
                                'رصيدك غير كافٍ. تحتاج إلى المزيد من الكريدت لإتمام هذه العملية.'
                            )
                    );
                    return;
                }

                if (result.code === 'MODERATION_FAILED' || result.status === 422) {
                    showToast(t('magic_cover_moderation_failed'), 'error');
                    return;
                }

                showToast(formatAiErrorMessage(result, t), 'error');
                return;
            }

            const url = extractAIImageUrl(result.data);
            if (!url) {
                showToast(t('ai_generate_failed', 'تعذّر التوليد بالذكاء الاصطناعي. حاول مرة أخرى.'), 'error');
                return;
            }

            const studioMeta = result.meta?.designStudio;
            const promptFromMeta =
                (typeof studioMeta?.optimized_prompt === 'string' && studioMeta.optimized_prompt) ||
                (typeof result.data?.imagePrompt === 'string' && result.data.imagePrompt) ||
                '';

            const entry = {
                id: createAiDesignStudioStashId(),
                imageUrl: url,
                categoryId,
                aspectRatio: aspectRatioForDesignCategory(categoryId),
                userPrompt: trimmed,
                optimizedPrompt: promptFromMeta,
                createdAt: Date.now(),
            };

            const { stash: nextStash, evictedOldest } = pushAiDesignStudioStash(stash, entry);
            if (evictedOldest) {
                showToast(
                    t(
                        'ai_design_stash_replaced_oldest',
                        'تم حفظ الصورة الجديدة واستبدال أقدم صورة في الذاكرة المؤقتة (5 كحد أقصى).'
                    ),
                    'info'
                );
            }
            setStash(nextStash);
            setSelectedStashId(entry.id);

            showToast(t('ai_design_studio_success', 'تم إنشاء الصورة — يمكنك تحميلها الآن.'), 'success');

            const creditsCharged = result.meta?.creditsCharged ?? AI_IMAGE_GENERATION_CREDITS;
            if (creditsCharged) {
                showToast(t('magic_cover_charged_notice', { cost: creditsCharged }), 'info');
            }
        } catch (err) {
            console.error('[AiDesignStudio]', err);
            showToast(t('ai_generate_failed', 'تعذّر التوليد بالذكاء الاصطناعي. حاول مرة أخرى.'), 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = useCallback(async () => {
        if (!imageUrl || downloading) return;
        setDownloading(true);
        try {
            const ext = imageUrl.includes('.png') ? 'png' : 'jpg';
            const safeCategory = String(previewCategoryId).replace(/[^a-z0-9_-]/gi, '_');
            const result = await saveOrShareRemoteImage(
                imageUrl,
                `dinebuddies-${safeCategory}-${Date.now()}.${ext}`
            );

            if (result === 'cancelled') {
                return;
            }

            if (result === 'shared') {
                showToast(
                    t(
                        'ai_design_save_ios_hint',
                        'اختر «حفظ الصورة» أو «Add to Photos» من قائمة المشاركة.'
                    ),
                    'info'
                );
                return;
            }

            showToast(t('ai_design_download_started', 'بدء تحميل الصورة.'), 'success');
        } catch (err) {
            console.error('[AiDesignStudio] download', err);
            showToast(
                t(
                    'ai_design_save_long_press_hint',
                    'اضغط مطولاً على الصورة في المعاينة ثم اختر «حفظ في الصور».'
                ),
                'info'
            );
        } finally {
            setDownloading(false);
        }
    }, [downloading, imageUrl, previewCategoryId, showToast, t]);

    const downloadButtonLabel = downloading
        ? t('ai_design_downloading', 'جاري التحميل…')
        : isIOS()
          ? t('ai_design_studio_save_ios', 'حفظ الصورة')
          : t('ai_design_studio_download', 'تحميل الصورة');

    useEffect(() => {
        if (!useMenuOpen) return undefined;
        const onDocClick = (e) => {
            if (useMenuRef.current && !useMenuRef.current.contains(e.target)) {
                setUseMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('touchstart', onDocClick);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('touchstart', onDocClick);
        };
    }, [useMenuOpen]);

    const handleUseDestination = useCallback(
        async (destinationId) => {
            if (!imageUrl || applyingUseId) return;
            const uid = currentUser?.uid;
            if (!uid) {
                showToast(t('please_sign_in', { defaultValue: 'Please sign in to continue.' }), 'error');
                return;
            }

            setApplyingUseId(destinationId);
            setUseMenuOpen(false);

            try {
                const result = await applyStudioImageUse({
                    destinationId,
                    imageUrl,
                    userId: uid,
                    updateUserProfile: updateProfile,
                    navigate,
                });

                if (result.action === 'navigate') {
                    showToast(
                        t('ai_design_use_navigate_ok', 'تم حفظ الصورة — أكمل من صفحة الإنشاء.'),
                        'success'
                    );
                    return;
                }

                showToast(
                    t('ai_design_use_applied_ok', 'تم حفظ الصورة وتطبيقها بنجاح.'),
                    'success'
                );

                if (result.updateKey === 'profile_cover') {
                    navigate('/profile');
                } else if (result.updateKey === 'profile_avatar') {
                    navigate('/profile');
                } else if (result.updateKey === 'business_cover' || result.updateKey === 'business_logo') {
                    navigate(`/business/${uid}`);
                }
            } catch (err) {
                console.error('[AiDesignStudio] use destination', err);
                notifyImageUploadError(showToast, err, t, 'ai_design_use_failed');
            } finally {
                setApplyingUseId(null);
            }
        },
        [applyingUseId, currentUser?.uid, imageUrl, navigate, showToast, t, updateProfile]
    );

    const closeInsufficientModal = () => setInsufficientCreditsMessage('');

    const goToTopUp = () => {
        closeInsufficientModal();
        navigate(CREDITS_WALLET_PATH);
    };

    return (
        <div className="ai-design-studio">
            <header className="ai-design-studio__header">
                <button
                    type="button"
                    className="ai-design-studio__back ios-tap-target"
                    onClick={() => navigate(-1)}
                    aria-label={t('back', 'رجوع')}
                >
                    <FaArrowLeft aria-hidden />
                </button>
                <div className="ai-design-studio__title-block">
                    <h1>{t('ai_design_studio_title', 'استوديو تصميم الصور')}</h1>
                    <p>
                        {t(
                            'ai_design_studio_subtitle',
                            'اختر نوع الصورة والقياس، صِف ما تريد، ثم حمّل النتيجة على جهازك.'
                        )}
                    </p>
                </div>
            </header>

            <section className="ai-design-studio__panel" aria-labelledby="ai-design-categories">
                <h2 id="ai-design-categories" className="ai-design-studio__section-label">
                    {t('ai_design_studio_categories', 'فئة القياس')}
                </h2>
                <div className="ai-design-studio__categories" role="radiogroup" aria-label={t('ai_design_studio_categories', 'فئة القياس')}>
                    {studioCategories.map((cat) => {
                        const label = t(cat.labelKey, {
                            defaultValue: i18n.language?.startsWith('ar') ? cat.defaultLabelAr : cat.defaultLabel,
                        });
                        const active = categoryId === cat.id;
                        return (
                            <button
                                key={cat.id}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                disabled={loading}
                                className={`ai-design-studio__cat-btn${active ? ' ai-design-studio__cat-btn--active' : ''}`}
                                onClick={() => setCategoryId(cat.id)}
                            >
                                <span className="ai-design-studio__cat-icon" aria-hidden>
                                    {cat.icon}
                                </span>
                                <span className="ai-design-studio__cat-name">{label}</span>
                                <span className="ai-design-studio__cat-ratio">{cat.aspectRatio}</span>
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="ai-design-studio__panel" aria-labelledby="ai-design-prompt">
                <h2 id="ai-design-prompt" className="ai-design-studio__section-label">
                    {t('ai_design_studio_prompt_label', 'وصف التصميم')}
                </h2>
                <textarea
                    className="ai-design-studio__prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={t(
                        'ai_design_studio_prompt_placeholder',
                        'مثال: غروب دافئ على شاطئ، ألوان ترابية، بدون نصوص…'
                    )}
                    disabled={loading}
                    maxLength={2000}
                    rows={4}
                />
                <div className="ai-design-studio__actions">
                    <button
                        type="button"
                        className="ai-design-studio__generate-btn ios-tap-target"
                        onClick={handleGenerate}
                        disabled={loading}
                        aria-busy={loading}
                    >
                        {loading ? (
                            <>
                                <span className="ai-design-studio__spinner" aria-hidden />
                                {t('ai_generate_loading', 'جاري التوليد بالذكاء الاصطناعي...')}
                            </>
                        ) : (
                            <>
                                <FaMagic aria-hidden />
                                {t('ai_design_studio_generate', {
                                    cost: AI_IMAGE_GENERATION_CREDITS,
                                    defaultValue: `Generate image (${AI_IMAGE_GENERATION_CREDITS} credits)`,
                                })}
                            </>
                        )}
                    </button>
                    <span className="ai-design-studio__cost">
                        {categoryLabel} · {aspectRatioForDesignCategory(categoryId)}
                    </span>
                </div>
            </section>

            <section className="ai-design-studio__panel ai-design-studio__preview-panel" aria-labelledby="ai-design-preview">
                <h2 id="ai-design-preview" className="ai-design-studio__section-label" style={{ alignSelf: 'stretch' }}>
                    {t('ai_design_studio_preview', 'المعاينة')}
                </h2>
                <div className={`ai-design-studio__preview-frame ${previewFrameClass(previewAspectRatio)}`}>
                    {imageUrl ? (
                        <img src={imageUrl} alt={t('ai_design_studio_preview_alt', 'صورة مُولَّدة')} className="ai-design-studio__preview-img" />
                    ) : (
                        <p className="ai-design-studio__preview-empty">
                            {loading
                                ? t('ai_generate_loading', 'جاري التوليد بالذكاء الاصطناعي...')
                                : t('ai_design_studio_preview_empty', 'ستظهر الصورة هنا بعد التوليد.')}
                        </p>
                    )}
                    {loading && imageUrl ? (
                        <div className="ai-design-studio__preview-loading" aria-hidden>
                            <span className="ai-design-studio__spinner" />
                        </div>
                    ) : null}
                </div>
                {stash.length > 0 ? (
                    <div className="ai-design-studio__stash" aria-labelledby="ai-design-stash-label">
                        <div className="ai-design-studio__stash-head">
                            <h3 id="ai-design-stash-label" className="ai-design-studio__stash-title">
                                {t('ai_design_stash_title', 'الصور الأخيرة')}
                            </h3>
                            <span className="ai-design-studio__stash-count">
                                {stash.length}/{AI_DESIGN_STUDIO_STASH_MAX}
                            </span>
                        </div>
                        <p className="ai-design-studio__stash-hint">
                            {t(
                                'ai_design_stash_hint',
                                'اضغط على مصغّر للعودة إلى صورة سابقة. تُحفظ حتى 5 صور خلال هذه الجلسة.'
                            )}
                        </p>
                        <div className="ai-design-studio__stash-row" role="listbox" aria-label={t('ai_design_stash_title', 'الصور الأخيرة')}>
                            {stash.map((entry) => {
                                const isActive = entry.id === activeEntry?.id;
                                return (
                                    <div
                                        key={entry.id}
                                        role="option"
                                        aria-selected={isActive}
                                        className={`ai-design-studio__stash-item${isActive ? ' ai-design-studio__stash-item--active' : ''}`}
                                    >
                                        <button
                                            type="button"
                                            className="ai-design-studio__stash-thumb ios-tap-target"
                                            onClick={() => selectStashEntry(entry)}
                                            title={entry.userPrompt}
                                        >
                                            <img src={entry.imageUrl} alt="" loading="lazy" />
                                        </button>
                                        <button
                                            type="button"
                                            className="ai-design-studio__stash-remove ios-tap-target"
                                            onClick={(e) => handleRemoveStashEntry(entry.id, e)}
                                            aria-label={t('ai_design_stash_remove', 'إزالة من الذاكرة المؤقتة')}
                                        >
                                            <FaTimes aria-hidden />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : null}
                <div className="ai-design-studio__result-actions">
                    <button
                        type="button"
                        className="ai-design-studio__download-btn ios-tap-target"
                        onClick={handleDownload}
                        disabled={!imageUrl || downloading || Boolean(applyingUseId)}
                    >
                        <FaDownload aria-hidden />
                        {downloadButtonLabel}
                    </button>
                    {suggestedDestination && imageUrl ? (
                        <button
                            type="button"
                            className="ai-design-studio__quick-apply-btn ios-tap-target"
                            onClick={() => handleUseDestination(suggestedDestination.id)}
                            disabled={downloading || Boolean(applyingUseId)}
                        >
                            <span aria-hidden>{suggestedDestination.icon}</span>
                            {applyingUseId === suggestedDestination.id
                                ? t('ai_design_use_applying', 'جاري التطبيق…')
                                : t(suggestedDestination.labelKey, {
                                      defaultValue: i18n.language?.startsWith('ar')
                                          ? suggestedDestination.defaultLabelAr
                                          : suggestedDestination.defaultLabel,
                                  })}
                        </button>
                    ) : null}
                    <div className="ai-design-studio__use-wrap" ref={useMenuRef}>
                        <button
                            type="button"
                            className="ai-design-studio__use-btn ios-tap-target"
                            onClick={() => setUseMenuOpen((v) => !v)}
                            disabled={!imageUrl || downloading || Boolean(applyingUseId)}
                            aria-haspopup="menu"
                            aria-expanded={useMenuOpen}
                        >
                            {applyingUseId
                                ? t('ai_design_use_applying', 'جاري التطبيق…')
                                : t('ai_design_studio_use_btn', 'استخدام في التطبيق')}
                            <FaChevronDown aria-hidden />
                        </button>
                        {useMenuOpen && imageUrl ? (
                            <div className="ai-design-studio__use-menu" role="menu">
                                <p className="ai-design-studio__use-menu-title">
                                    {t('ai_design_studio_use_menu_title', 'اختر الوجهة')}
                                </p>
                                {useDestinations.map((dest) => {
                                    const label = t(dest.labelKey, {
                                        defaultValue: i18n.language?.startsWith('ar')
                                            ? dest.defaultLabelAr
                                            : dest.defaultLabel,
                                    });
                                    return (
                                        <button
                                            key={dest.id}
                                            type="button"
                                            role="menuitem"
                                            className="ai-design-studio__use-item ios-tap-target"
                                            disabled={Boolean(applyingUseId)}
                                            onClick={() => handleUseDestination(dest.id)}
                                        >
                                            <span aria-hidden>{dest.icon}</span>
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : null}
                    </div>
                </div>
                {imageUrl && isIOS() ? (
                    <p className="ai-design-studio__meta">
                        {t(
                            'ai_design_ios_save_footer',
                            'على iPhone: بعد الضغط على «حفظ الصورة» اختر «حفظ الصورة» أو Add to Photos من الأسفل.'
                        )}
                    </p>
                ) : null}
                {optimizedPrompt ? (
                    <p className="ai-design-studio__meta">
                        <strong>{t('ai_design_optimized_prompt', 'الوصف المحسّن')}:</strong> {optimizedPrompt}
                    </p>
                ) : null}
            </section>

            {insufficientCreditsMessage ? (
                <div className="ai-credits-modal__backdrop" role="presentation" onClick={closeInsufficientModal}>
                    <div
                        className="ai-credits-modal"
                        role="alertdialog"
                        aria-modal="true"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="ai-credits-modal__icon" aria-hidden>
                            <FaWallet />
                        </div>
                        <h3 className="ai-credits-modal__title">
                            {t('ai_insufficient_credits_title', 'رصيد غير كافٍ')}
                        </h3>
                        <p className="ai-credits-modal__message">{insufficientCreditsMessage}</p>
                        <div className="ai-credits-modal__actions">
                            <button
                                type="button"
                                className="ai-credits-modal__btn ai-credits-modal__btn--primary ios-tap-target"
                                onClick={goToTopUp}
                            >
                                {t('ai_top_up_now', 'شحن الرصيد الآن')}
                            </button>
                            <button
                                type="button"
                                className="ai-credits-modal__btn ai-credits-modal__btn--ghost ios-tap-target"
                                onClick={closeInsufficientModal}
                            >
                                {t('close', 'إغلاق')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
