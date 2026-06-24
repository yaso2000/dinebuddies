import React, { useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { FaMagic, FaWallet } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { generateAIContent, formatAiErrorMessage, isInsufficientCreditsError } from '../services/generateAIContent';
import {
  validatePrivateAiContext } from
'../utils/privateAiRequestPayload';
import { applyInvitationAiFields, normalizeInvitationAiData } from '../utils/aiContentFieldMapper';
import {
  AI_IMAGE_GENERATION_CREDITS,
  AI_INVITATION_BUNDLE_CREDITS,
  AI_TEXT_GENERATION_CREDITS,
  aiCreditCostForPostType,
  CREDITS_WALLET_PATH } from
'../utils/aiCreditCosts';
import { AI_USER_PROMPT_MAX_CHARS } from '../constants/aiPromptLimits';
import { getAiUserPromptFallback } from '../utils/aiPromptLocale';
import { resolveAiUserPrompt } from '../utils/resolveAiUserPrompt';
import './AIGenerateBar.css';

/** @typedef {'text' | 'image' | 'invitation_bundle'} GenerationPackage */import { AppText, AppTextInput } from "./base";

const PACKAGE_OPTIONS = /** @type {const} */[
{ id: 'text', cost: AI_TEXT_GENERATION_CREDITS, labelKey: 'magic_cover_package_text' },
{ id: 'image', cost: AI_IMAGE_GENERATION_CREDITS, labelKey: 'magic_cover_package_image' },
{
  id: 'invitation_bundle',
  cost: AI_INVITATION_BUNDLE_CREDITS,
  labelKey: 'magic_cover_package_bundle'
}];


/**
 * Text-only AI bar for invitations; optional multimodal packages for business posts.
 *
 * @param {{
 *   postType: 'regular_post' | 'featured_post' | 'animated_post' | 'invitation',
 *   subType?: 'public' | 'private' | 'date',
 *   onSuccess: (data: Record<string, unknown>, meta?: Record<string, unknown>) => void,
 *   buildContextPrompt?: () => string,
 *   multimodalMode?: boolean,
 *   defaultAspectRatio?: '1:1' | '9:16',
 *   disabled?: boolean,
 *   compact?: boolean,
 *   embedded?: boolean,
 *   invitationVenue?: { venueType?: string, venueName?: string },
 *   privateAiContext?: import('../utils/privateAiRequestPayload.js').DatingAiContext,
 *   getPrivateAiContext?: () => import('../utils/privateAiRequestPayload.js').DatingAiContext | undefined,
 *   disabledHint?: string,
 * }} props
 */
export default function AIGenerateBar({
  postType,
  subType,
  onSuccess,
  buildContextPrompt,
  multimodalMode = false,
  defaultAspectRatio = '1:1',
  disabled = false,
  compact = false,
  embedded = false,
  invitationVenue,
  privateAiContext,
  getPrivateAiContext,
  disabledHint
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [insufficientCreditsMessage, setInsufficientCreditsMessage] = useState('');
  const [generationPackage, setGenerationPackage] = useState(/** @type {GenerationPackage} */'text');
  const [aspectRatio, setAspectRatio] = useState(defaultAspectRatio);
  const [invitationPreview, setInvitationPreview] = useState(/** @type {{ title: string, description: string } | null} */null);

  const isPrivateInvitation = postType === 'invitation' && subType === 'private';

  const livePrivateContextForUi = isPrivateInvitation ?
  getPrivateAiContext?.() ?? privateAiContext ?? null :
  null;

  const privateContextReady = isPrivateInvitation ?
  validatePrivateAiContext(livePrivateContextForUi).ok :
  true;

  const generateDisabled = disabled || loading || isPrivateInvitation && !privateContextReady;

  const privatePrerequisiteMessage = t('private_ai_schedule_venue_required', {
    defaultValue: 'Set the date, time, and location first — then AI can draft your message.'
  });

  const showMultimodalPackages = multimodalMode && postType !== 'invitation';

  const costLabel = useMemo(() => {
    const cost = aiCreditCostForPostType(
      postType,
      showMultimodalPackages ? generationPackage : undefined
    );
    return t('ai_generate_cost', { cost });
  }, [postType, generationPackage, showMultimodalPackages, t]);

  const handleGenerate = async () => {
    if (generateDisabled) return;

    const liveDatingContext = isPrivateInvitation ?
    getPrivateAiContext?.() ?? privateAiContext :
    undefined;

    if (isPrivateInvitation) {
      const check = validatePrivateAiContext(liveDatingContext);
      if (!check.ok) {
        console.warn('[AIGenerateBar] dating context incomplete', {
          context: liveDatingContext,
          missing: check.missing
        });
        showToast(privatePrerequisiteMessage, 'error');
        return;
      }
    }

    const userPrompt = resolveAiUserPrompt({
      manualPrompt: prompt,
      buildContextPrompt,
      fallback: getAiUserPromptFallback(
        isPrivateInvitation ? 'invitation' : postType,
        isPrivateInvitation ? 'date' : subType,
        t
      )
    });

    setLoading(true);
    try {
      const pkg = showMultimodalPackages ? generationPackage : undefined;

      const result = await generateAIContent(
        userPrompt,
        isPrivateInvitation ? 'invitation' : postType,
        isPrivateInvitation ? 'date' : subType,
        isPrivateInvitation ?
        { datingContext: liveDatingContext } :
        {
          generationPackage: pkg,
          aspectRatio:
          pkg === 'image' || pkg === 'invitation_bundle' ? aspectRatio : undefined,
          venueType: invitationVenue?.venueType,
          venueName: invitationVenue?.venueName
        }
      );

      if (!result.success) {
        if (isInsufficientCreditsError(result)) {
          setInsufficientCreditsMessage(
            result.message ||
            t('ai_insufficient_credits_default')
          );
          return;
        }

        if (result.code === 'MODERATION_FAILED' || result.status === 422) {
          showToast(t('magic_cover_moderation_failed'), 'error');
          return;
        }

        showToast(formatAiErrorMessage(result, t) || privatePrerequisiteMessage, 'error');
        return;
      }

      const normalizedData =
      postType === 'invitation' ?
      normalizeInvitationAiData(result.data) :
      result.data;

      if (postType === 'invitation') {
        const applied = applyInvitationAiFields(normalizedData, {
          ...(isPrivateInvitation && livePrivateContextForUi?.cardStructure ?
          { cardStructure: livePrivateContextForUi.cardStructure } :
          {})
        });

        if (!applied.hasContent) {
          console.warn('[AIGenerateBar] invitation AI response had no mappable fields', result.data);
          showToast(
            t('private_ai_fields_empty'),
            'error'
          );
          return;
        }

        setInvitationPreview({
          title: applied.title,
          description: applied.description
        });

        flushSync(() => {
          onSuccess(normalizedData, result.meta);
        });

        if (applied.hasTitle && !applied.hasDescription) {
          showToast(
            t('private_ai_description_missing'),
            'info'
          );
        }
      } else {
        onSuccess(normalizedData, result.meta);
      }

      const hasImage = Boolean(result.data?.image?.url || result.data?.image?.mediaLibraryItem?.url);
      const creditsCharged =
      result.meta?.creditsCharged ??
      aiCreditCostForPostType(postType, showMultimodalPackages ? generationPackage : undefined);

      if (hasImage) {
        showToast(t('magic_cover_generated_review'), 'success');
        if (creditsCharged) {
          showToast(t('magic_cover_charged_notice', { cost: creditsCharged }), 'info');
        }
      } else if (postType === 'invitation') {
        showToast(
          t('private_ai_fields_applied'),
          'success'
        );
      } else {
        showToast(t('ai_generate_success'), 'success');
      }
    } catch (err) {
      console.error('[AIGenerateBar]', err);
      showToast(
        t('ai_generate_failed'),
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
        className={`ai-generate-bar${compact ? ' ai-generate-bar--compact' : ''}${showMultimodalPackages ? ' ai-generate-bar--magic' : ''}${embedded ? ' ai-generate-bar--embedded' : ''}`}
        aria-busy={loading}>

                {!embedded ?
        <label className="ai-generate-bar__label" htmlFor={`ai-prompt-${postType}`}>
                        <FaMagic aria-hidden />
                        {t('ai_generate_label')}
                    </label> :
        null}

                {showMultimodalPackages ?
        <fieldset className="ai-generate-bar__packages" disabled={loading || disabled}>
                        <legend className="ai-generate-bar__packages-legend">
                            {t('ai_generate_package_label')}
                        </legend>
                        {PACKAGE_OPTIONS.map((option) =>
          <label
            key={option.id}
            className={`ai-generate-bar__package${generationPackage === option.id ? ' ai-generate-bar__package--active' : ''}`}>

                                <input
              type="radio"
              name={`ai-package-${postType}`}
              value={option.id}
              checked={generationPackage === option.id}
              onChange={() => setGenerationPackage(option.id)} />

                                <AppText as="span">{t(option.labelKey, { cost: option.cost })}</AppText>
                            </label>
          )}
                    </fieldset> :
        null}

                {showMultimodalPackages && (
        generationPackage === 'image' || generationPackage === 'invitation_bundle') ?
        <fieldset className="ai-generate-bar__aspect" disabled={loading || disabled}>
                        <legend className="ai-generate-bar__aspect-legend">{t('magic_cover_aspect_label')}</legend>
                        <div className="ai-generate-bar__aspect-options">
                            <label
              className={`ai-generate-bar__aspect-option${aspectRatio === '1:1' ? ' ai-generate-bar__aspect-option--active' : ''}`}>

                                <input
                type="radio"
                name={`ai-aspect-${postType}`}
                value="1:1"
                checked={aspectRatio === '1:1'}
                onChange={() => setAspectRatio('1:1')} />

                                {t('magic_cover_aspect_1_1')}
                            </label>
                            <label
              className={`ai-generate-bar__aspect-option${aspectRatio === '9:16' ? ' ai-generate-bar__aspect-option--active' : ''}`}>

                                <input
                type="radio"
                name={`ai-aspect-${postType}`}
                value="9:16"
                checked={aspectRatio === '9:16'}
                onChange={() => setAspectRatio('9:16')} />

                                {t('magic_cover_aspect_9_16')}
                            </label>
                        </div>
                    </fieldset> :
        null}

                {disabled && disabledHint || isPrivateInvitation && !privateContextReady ?
        <AppText as="p" className="ai-generate-bar__venue-hint" role="status">
                        {disabledHint || privatePrerequisiteMessage}
                    </AppText> :
        null}

                {postType === 'invitation' && invitationPreview ?
        <div className="ai-generate-bar__invitation-preview" role="status">
                        <AppText as="p" className="ai-generate-bar__invitation-preview-label">
                            {t('private_ai_preview_label')}
                        </AppText>
                        {invitationPreview.title ?
          <AppText as="p" className="ai-generate-bar__invitation-preview-title">
                                <strong>{t('invitation_title')}:</strong> {invitationPreview.title}
                            </AppText> :
          null}
                        {invitationPreview.description ?
          <AppText as="p" className="ai-generate-bar__invitation-preview-message">
                                <strong>{t('message_to_friends')}:</strong> {invitationPreview.description}
                            </AppText> :
          null}
                    </div> :
        null}

                <AppTextInput as="textarea"
        id={`ai-prompt-${postType}`}
        className="ai-generate-bar__input"
        rows={compact ? 2 : 3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value.slice(0, AI_USER_PROMPT_MAX_CHARS))}
        placeholder={t('ai_prompt_placeholder')}
        maxLength={AI_USER_PROMPT_MAX_CHARS}
        disabled={generateDisabled} />

                <AppText as="p" className="ai-generate-bar__prompt-meta" aria-live="polite">
                    <AppText as="span" dir="ltr" style={{ unicodeBidi: 'isolate' }}>
                        {prompt.length} / {AI_USER_PROMPT_MAX_CHARS}
                    </AppText>
                    <AppText as="span" className="ai-generate-bar__prompt-meta-hint">
                        {t('ai_prompt_optional_hint', {
              defaultValue: 'Optional — leave blank to use form details.'
            })}
                    </AppText>
                </AppText>

                <div className="ai-generate-bar__actions">
                    <button
            type="button"
            className="ai-generate-bar__btn ios-tap-target"
            onClick={handleGenerate}
            disabled={generateDisabled}
            aria-busy={loading}
            title={isPrivateInvitation && !privateContextReady ? privatePrerequisiteMessage : undefined}>

                        {loading ?
            <>
                                <AppText as="span" className="ai-generate-bar__spinner" aria-hidden />
                                {t('ai_generate_loading')}
                            </> :

            <>
                                <FaMagic aria-hidden />
                                {t('ai_generate_btn')}
                            </>
            }
                    </button>
                    <AppText as="span" className="ai-generate-bar__cost" aria-live="polite">
                        {costLabel}
                    </AppText>
                </div>
            </div>

            {insufficientCreditsMessage ?
      <div
        className="ai-credits-modal__backdrop"
        role="presentation"
        onClick={closeInsufficientModal}>

                    <div
          className="ai-credits-modal"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="ai-credits-modal-title"
          aria-describedby="ai-credits-modal-desc"
          onClick={(e) => e.stopPropagation()}>

                        <div className="ai-credits-modal__icon" aria-hidden>
                            <FaWallet />
                        </div>
                        <AppText as="h3" id="ai-credits-modal-title" className="ai-credits-modal__title">
                            {t('ai_insufficient_credits_title')}
                        </AppText>
                        <AppText as="p" id="ai-credits-modal-desc" className="ai-credits-modal__message">
                            {insufficientCreditsMessage}
                        </AppText>
                        <div className="ai-credits-modal__actions">
                            <button
              type="button"
              className="ai-credits-modal__btn ai-credits-modal__btn--primary ios-tap-target"
              onClick={goToTopUp}>

                                {t('ai_top_up_now')}
                            </button>
                            <button
              type="button"
              className="ai-credits-modal__btn ai-credits-modal__btn--ghost ios-tap-target"
              onClick={closeInsufficientModal}>

                                {t('close')}
                            </button>
                        </div>
                    </div>
                </div> :
      null}
        </>);

}