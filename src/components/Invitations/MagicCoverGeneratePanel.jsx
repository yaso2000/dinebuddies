import React, { useEffect, useRef, useState } from 'react';
import { FaMagic, FaWallet } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import {
    generateAIMagicCover,
    formatAiErrorMessage,
    isInsufficientCreditsError,
} from '../../services/generateAIContent';
import {
    AI_IMAGE_GENERATION_CREDITS,
    CREDITS_WALLET_PATH,
} from '../../utils/aiCreditCosts';
import { extractAIImageUrl } from '../../utils/aiContentFieldMapper';
import '../AIGenerateBar.css';

/**
 * Invitation-only AI cover generation (image package, 25 credits).
 * Lives in the media upload/gallery section — separate from text AIGenerateBar.
 *
 * @param {{
 *   subType?: 'public' | 'private' | 'date',
 *   venueType?: string,
 *   venueName?: string,
 *   aspectRatio?: '1:1' | '9:16',
 *   buildBrief?: () => string,
 *   onImageGenerated: (url: string) => void,
 *   disabled?: boolean,
 *   prepareBusy?: boolean,
 *   requireVenue?: boolean,
 *   embedded?: boolean,
 * }} props
 */
export default function MagicCoverGeneratePanel({
    subType = 'public',
    venueType = '',
    venueName = '',
    aspectRatio: defaultAspectRatio = '1:1',
    buildBrief,
    onImageGenerated,
    disabled = false,
    prepareBusy = false,
    requireVenue = true,
    embedded = false,
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [aspectRatio, setAspectRatio] = useState(defaultAspectRatio);
    const [insufficientCreditsMessage, setInsufficientCreditsMessage] = useState('');
    const generationSeqRef = useRef(0);

    const isBusy = loading || prepareBusy;

    useEffect(() => {
        setAspectRatio(defaultAspectRatio);
    }, [defaultAspectRatio]);

    const lockAspectRatio = subType === 'private' || subType === 'date';
    const effectiveAspectRatio = lockAspectRatio ? '9:16' : aspectRatio;

    const needsVenue = requireVenue && !String(venueName || '').trim();

    const handleGenerate = async () => {
        if (isBusy || disabled || needsVenue) return;

        const userPrompt = (prompt.trim() || buildBrief?.() || '').trim();
        if (!userPrompt) {
            showToast(
                t('ai_prompt_required', 'أدخل وصفاً قصيراً لما تريد توليده بالذكاء الاصطناعي.'),
                'error'
            );
            return;
        }

        const generationId = ++generationSeqRef.current;
        setLoading(true);
        try {
            const result = await generateAIMagicCover({
                userPrompt,
                subType,
                venueType,
                venueName,
                aspectRatio: effectiveAspectRatio,
            });

            if (generationId !== generationSeqRef.current) {
                return;
            }

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

                if (result.code === 'AI_REQUEST_TIMEOUT') {
                    showToast(
                        t('ai_request_timeout', {
                            defaultValue:
                                'Image generation timed out. The server may still be working — wait and try again.',
                        }),
                        'error'
                    );
                    return;
                }

                showToast(formatAiErrorMessage(result, t), 'error');
                return;
            }

            const imageUrl = extractAIImageUrl(result.data);
            if (!imageUrl) {
                showToast(t('ai_generate_failed', 'تعذّر التوليد بالذكاء الاصطناعي. حاول مرة أخرى.'), 'error');
                return;
            }

            if (generationId !== generationSeqRef.current) {
                return;
            }

            onImageGenerated(imageUrl);
            showToast(t('magic_cover_generated_review'), 'success');

            const creditsCharged = result.meta?.creditsCharged ?? AI_IMAGE_GENERATION_CREDITS;
            if (creditsCharged) {
                showToast(t('magic_cover_charged_notice', { cost: creditsCharged }), 'info');
            }
        } catch (err) {
            console.error('[MagicCoverGeneratePanel]', err);
            showToast(
                t('ai_generate_failed', 'تعذّر التوليد بالذكاء الاصطناعي. حاول مرة أخرى.'),
                'error'
            );
        } finally {
            setLoading(false);
        }
    };

    const closeInsufficientModal = () => setInsufficientCreditsMessage('');

    const goToTopUp = () => {
        closeInsufficientModal();
        navigate(CREDITS_WALLET_PATH);
    };

    return (
        <>
            <div
                className={`ai-generate-bar ai-generate-bar--magic magic-cover-panel${embedded ? ' ai-generate-bar--embedded' : ''}`}
                aria-busy={isBusy}
                style={embedded ? undefined : { marginBottom: 14 }}
            >
                <div className="ai-generate-bar__magic-header">
                    <p className="ai-generate-bar__magic-title">{t('magic_cover_cta_title')}</p>
                    <p className="ai-generate-bar__magic-intro">{t('magic_cover_optional_intro')}</p>
                </div>

                {!lockAspectRatio ? (
                    <fieldset className="ai-generate-bar__aspect" disabled={isBusy || disabled}>
                        <legend className="ai-generate-bar__aspect-legend">{t('magic_cover_aspect_label')}</legend>
                        <p className="ai-generate-bar__aspect-hint">{t('magic_cover_aspect_hint')}</p>
                        <div className="ai-generate-bar__aspect-options">
                            <label
                                className={`ai-generate-bar__aspect-option${aspectRatio === '1:1' ? ' ai-generate-bar__aspect-option--active' : ''}`}
                            >
                                <input
                                    type="radio"
                                    name="magic-cover-aspect"
                                    value="1:1"
                                    checked={aspectRatio === '1:1'}
                                    onChange={() => setAspectRatio('1:1')}
                                />
                                {t('magic_cover_aspect_1_1')}
                            </label>
                            <label
                                className={`ai-generate-bar__aspect-option${aspectRatio === '9:16' ? ' ai-generate-bar__aspect-option--active' : ''}`}
                            >
                                <input
                                    type="radio"
                                    name="magic-cover-aspect"
                                    value="9:16"
                                    checked={aspectRatio === '9:16'}
                                    onChange={() => setAspectRatio('9:16')}
                                />
                                {t('magic_cover_aspect_9_16')}
                            </label>
                        </div>
                    </fieldset>
                ) : null}

                {needsVenue ? (
                    <p className="ai-generate-bar__venue-hint" role="status">
                        {t('magic_cover_requires_venue')}
                    </p>
                ) : null}

                <textarea
                    className="ai-generate-bar__input"
                    rows={2}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={t('magic_cover_empty_brief_fallback')}
                    disabled={isBusy || disabled}
                />

                <div className="ai-generate-bar__actions">
                    <button
                        type="button"
                        className="ai-generate-bar__btn ios-tap-target"
                        onClick={handleGenerate}
                        disabled={isBusy || disabled || needsVenue}
                        aria-busy={loading}
                    >
                        {loading ? (
                            <>
                                <span className="ai-generate-bar__spinner" aria-hidden />
                                {t('ai_generate_loading', 'جاري التوليد بالذكاء الاصطناعي...')}
                            </>
                        ) : (
                            <>
                                <FaMagic aria-hidden />
                                {t('magic_cover_generate_cover_btn', {
                                    cost: AI_IMAGE_GENERATION_CREDITS,
                                    defaultValue: `Generate Cover with AI (Costs ${AI_IMAGE_GENERATION_CREDITS} credits)`,
                                })}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {insufficientCreditsMessage ? (
                <div
                    className="ai-credits-modal__backdrop"
                    role="presentation"
                    onClick={closeInsufficientModal}
                >
                    <div
                        className="ai-credits-modal"
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="magic-cover-credits-modal-title"
                        aria-describedby="magic-cover-credits-modal-desc"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="ai-credits-modal__icon" aria-hidden>
                            <FaWallet />
                        </div>
                        <h3 id="magic-cover-credits-modal-title" className="ai-credits-modal__title">
                            {t('ai_insufficient_credits_title', 'رصيد غير كافٍ')}
                        </h3>
                        <p id="magic-cover-credits-modal-desc" className="ai-credits-modal__message">
                            {insufficientCreditsMessage}
                        </p>
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
        </>
    );
}
