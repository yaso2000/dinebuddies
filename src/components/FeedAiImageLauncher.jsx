import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaImages, FaTimes, FaWallet } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import {
  generateAIDesignStudioImage,
  formatAiErrorMessage,
  isInsufficientCreditsError,
} from '../services/generateAIContent';
import { extractAIImageUrl } from '../utils/aiContentFieldMapper';
import { resolveAiGeneratedCoverPreview } from '../services/mediaService';
import { AI_IMAGE_GENERATION_CREDITS, CREDITS_WALLET_PATH } from '../utils/aiCreditCosts';
import { AI_USER_PROMPT_MAX_CHARS } from '../constants/aiPromptLimits';
import { AppText, AppTextInput } from './base';
import './FeedAiImageLauncher.css';

export default function FeedAiImageLauncher({ disabled = false, onInsert }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [insufficientCreditsMessage, setInsufficientCreditsMessage] = useState('');

  const close = useCallback(() => {
    setOpen(false);
    setPreviewUrl('');
    setRemoteUrl('');
    setInsufficientCreditsMessage('');
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const handleGenerate = useCallback(async () => {
    if (loading || disabled) return;
    setLoading(true);
    setPreviewUrl('');
    setRemoteUrl('');

    try {
      const result = await generateAIDesignStudioImage({
        userPrompt: prompt,
        designCategory: 'square',
        aspectRatio: '1:1',
      });

      if (!result.success) {
        if (isInsufficientCreditsError(result)) {
          setInsufficientCreditsMessage(result.message || t('ai_insufficient_credits_default'));
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
        showToast(t('ai_generate_failed'), 'error');
        return;
      }

      let displayUrl = url;
      try {
        const resolved = await resolveAiGeneratedCoverPreview(url);
        displayUrl = resolved.displayUrl;
      } catch {
        /* use raw url */
      }

      setRemoteUrl(url);
      setPreviewUrl(displayUrl);
      showToast(t('feed_ai_image_ready'), 'success');
    } catch (err) {
      console.error('[FeedAiImageLauncher]', err);
      showToast(t('ai_generate_failed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [disabled, loading, prompt, showToast, t]);

  const handleInsert = useCallback(() => {
    const url = remoteUrl || previewUrl;
    if (!url || !onInsert) return;
    onInsert({ url, preview: previewUrl || url });
    close();
    showToast(t('feed_ai_image_inserted'), 'success');
  }, [close, onInsert, previewUrl, remoteUrl, showToast, t]);

  const sheet = open ? (
    <div className="feed-ai-image-sheet__backdrop" role="presentation" onClick={close}>
      <div
        className="feed-ai-image-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feed-ai-image-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="feed-ai-image-sheet__header">
          <AppText as="h2" id="feed-ai-image-sheet-title" className="feed-ai-image-sheet__title">
            <FaImages aria-hidden />
            {t('feed_ai_image_sheet_title')}
          </AppText>
          <button type="button" className="feed-ai-image-sheet__close ios-tap-target" onClick={close} aria-label={t('close')}>
            <FaTimes aria-hidden />
          </button>
        </header>
        <div className="feed-ai-image-sheet__body">
          <AppTextInput
            as="textarea"
            className="feed-ai-image-sheet__prompt"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, AI_USER_PROMPT_MAX_CHARS))}
            placeholder={t('feed_ai_image_prompt_placeholder')}
            maxLength={AI_USER_PROMPT_MAX_CHARS}
            disabled={loading}
          />
          <AppText as="p" className="feed-ai-image-sheet__meta" dir="ltr" style={{ unicodeBidi: 'isolate' }}>
            {prompt.length} / {AI_USER_PROMPT_MAX_CHARS}
          </AppText>
          <div className="feed-ai-image-sheet__actions">
            <button
              type="button"
              className="feed-ai-image-sheet__generate ios-tap-target"
              onClick={handleGenerate}
              disabled={loading || disabled}
              aria-busy={loading}
            >
              {loading ? t('ai_generate_loading') : t('feed_ai_image_generate', { cost: AI_IMAGE_GENERATION_CREDITS })}
            </button>
            {previewUrl ? (
              <button type="button" className="feed-ai-image-sheet__insert ios-tap-target" onClick={handleInsert}>
                {t('feed_ai_image_insert')}
              </button>
            ) : null}
          </div>
          {previewUrl ? (
            <div className="feed-ai-image-sheet__preview">
              <img src={previewUrl} alt={t('ai_design_studio_preview_alt')} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        className="feed-ai-image-launcher ios-tap-target"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={t('feed_ai_image_btn')}
        aria-label={t('feed_ai_image_btn')}
      >
        <FaImages aria-hidden />
      </button>
      {typeof document !== 'undefined' ? createPortal(sheet, document.body) : null}
      {insufficientCreditsMessage ? (
        <div className="ai-credits-modal__backdrop" role="presentation" onClick={() => setInsufficientCreditsMessage('')}>
          <div className="ai-credits-modal" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <AppText as="h3" className="ai-credits-modal__title">{t('ai_insufficient_credits_title')}</AppText>
            <AppText as="p" className="ai-credits-modal__message">{insufficientCreditsMessage}</AppText>
            <div className="ai-credits-modal__actions">
              <button type="button" className="ai-credits-modal__btn ai-credits-modal__btn--ghost" onClick={() => setInsufficientCreditsMessage('')}>
                {t('close', 'Close')}
              </button>
              <button
                type="button"
                className="ai-credits-modal__btn ai-credits-modal__btn--primary"
                onClick={() => {
                  setInsufficientCreditsMessage('');
                  close();
                  navigate(CREDITS_WALLET_PATH);
                }}
              >
                <FaWallet aria-hidden />
                {t('ai_top_up_now', 'Top up credits')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
