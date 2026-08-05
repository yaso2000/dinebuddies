import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppBackNavigation } from '../hooks/useAppBackNavigation';
import { FaArrowLeft, FaCopy, FaPenAlt, FaWallet } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { AppText, AppTextInput } from '../components/base';
import { useToast } from '../context/ToastContext';
import {
  generateAIContent,
  formatAiErrorMessage,
  isInsufficientCreditsError,
} from '../services/generateAIContent';
import { AI_TEXT_GENERATION_CREDITS, CREDITS_WALLET_PATH } from '../utils/aiCreditCosts';
import { AI_USER_PROMPT_MAX_CHARS } from '../constants/aiPromptLimits';
import './AiTextStudio.css';

const STARTER_KEYS = [
  'ai_text_starter_first_date',
  'ai_text_starter_boundaries',
  'ai_text_starter_communication',
  'ai_text_starter_rejection',
];

function createTurnId() {
  return `ai-text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AiTextStudio() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { goBack } = useAppBackNavigation();
  const { showToast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [turns, setTurns] = useState([]);
  const [insufficientCreditsMessage, setInsufficientCreditsMessage] = useState('');

  const starters = useMemo(
    () =>
      STARTER_KEYS.map((key) => ({
        key,
        label: t(key),
      })),
    [t]
  );

  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    try {
      const result = await generateAIContent(trimmed, 'text_assistant');

      if (!result.success) {
        if (isInsufficientCreditsError(result)) {
          setInsufficientCreditsMessage(result.message || t('ai_insufficient_credits_default'));
          return;
        }
        showToast(formatAiErrorMessage(result, t) || t('ai_generate_failed'), 'error');
        return;
      }

      const answer =
        typeof result.data?.answer === 'string' && result.data.answer.trim()
          ? result.data.answer.trim()
          : '';

      if (!answer) {
        showToast(t('ai_text_empty_answer'), 'error');
        return;
      }

      setTurns((prev) => [
        {
          id: createTurnId(),
          question: trimmed,
          answer,
          createdAt: Date.now(),
        },
        ...prev,
      ]);
      setPrompt('');
      showToast(t('ai_text_studio_success'), 'success');

      const creditsCharged = result.meta?.creditsCharged ?? AI_TEXT_GENERATION_CREDITS;
      if (creditsCharged) {
        showToast(t('magic_cover_charged_notice', { cost: creditsCharged }), 'info');
      }
    } catch (err) {
      console.error('[AiTextStudio]', err);
      showToast(t('ai_generate_failed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [loading, prompt, showToast, t]);

  const copyAnswer = useCallback(
    async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        showToast(t('ai_text_copied'), 'success');
      } catch {
        showToast(t('copy_failed', 'Could not copy.'), 'error');
      }
    },
    [showToast, t]
  );

  const closeInsufficientModal = () => setInsufficientCreditsMessage('');

  return (
    <div className="ai-text-studio page-container">
      <header className="ai-text-studio__header">
        <button
          type="button"
          className="ai-text-studio__back ios-tap-target"
          onClick={goBack}
          aria-label={t('back')}
        >
          <FaArrowLeft aria-hidden />
        </button>
        <div className="ai-text-studio__title-block">
          <AppText as="h1">{t('ai_text_studio_title')}</AppText>
          <AppText as="p">{t('ai_text_studio_subtitle')}</AppText>
          <AppText as="p" className="ai-text-studio__disclaimer">
            {t('ai_text_studio_disclaimer')}
          </AppText>
        </div>
      </header>

      <section className="ai-text-studio__panel" aria-labelledby="ai-text-starters">
        <AppText as="h2" id="ai-text-starters" className="ai-text-studio__section-label">
          {t('ai_text_studio_starters')}
        </AppText>
        <div className="ai-text-studio__starters">
          {starters.map((item) => (
            <button
              key={item.key}
              type="button"
              className="ai-text-studio__starter-btn ios-tap-target"
              disabled={loading}
              onClick={() => setPrompt(item.label)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="ai-text-studio__panel ai-text-studio__composer" aria-labelledby="ai-text-ask">
        <AppText as="h2" id="ai-text-ask" className="ai-text-studio__section-label">
          {t('ai_text_studio_ask_label')}
        </AppText>
        <AppTextInput
          as="textarea"
          className="ai-text-studio__prompt"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, AI_USER_PROMPT_MAX_CHARS))}
          placeholder={t('ai_text_studio_prompt_placeholder')}
          maxLength={AI_USER_PROMPT_MAX_CHARS}
          disabled={loading}
        />
        <AppText as="p" className="ai-text-studio__prompt-meta" aria-live="polite">
          <AppText as="span" dir="ltr" style={{ unicodeBidi: 'isolate' }}>
            {prompt.length} / {AI_USER_PROMPT_MAX_CHARS}
          </AppText>
        </AppText>
        <div className="ai-text-studio__actions">
          <button
            type="button"
            className="ai-text-studio__generate-btn ios-tap-target"
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <AppText as="span" className="ai-text-studio__spinner" aria-hidden />
                {t('ai_generate_loading')}
              </>
            ) : (
              <>
                <FaPenAlt aria-hidden />
                {t('ai_text_studio_ask_btn', { cost: AI_TEXT_GENERATION_CREDITS })}
              </>
            )}
          </button>
        </div>
      </section>

      <section className="ai-text-studio__panel" aria-labelledby="ai-text-history">
        <AppText as="h2" id="ai-text-history" className="ai-text-studio__section-label">
          {t('ai_text_studio_history')}
        </AppText>
        {turns.length === 0 ? (
          <AppText as="p" className="ai-text-studio__empty">
            {t('ai_text_studio_empty')}
          </AppText>
        ) : (
          <div className="ai-text-studio__turns">
            {turns.map((turn) => (
              <article key={turn.id} className="ai-text-studio__turn">
                <div className="ai-text-studio__bubble ai-text-studio__bubble--question">
                  <AppText as="p" className="ai-text-studio__bubble-label">
                    {t('ai_text_studio_you')}
                  </AppText>
                  <AppText as="p" className="ai-text-studio__bubble-body">{turn.question}</AppText>
                </div>
                <div className="ai-text-studio__bubble ai-text-studio__bubble--answer">
                  <div className="ai-text-studio__answer-head">
                    <AppText as="p" className="ai-text-studio__bubble-label">
                      {t('ai_text_studio_assistant')}
                    </AppText>
                    <button
                      type="button"
                      className="ai-text-studio__copy-btn ios-tap-target"
                      onClick={() => copyAnswer(turn.answer)}
                      aria-label={t('copy', 'Copy')}
                    >
                      <FaCopy aria-hidden />
                    </button>
                  </div>
                  <AppText as="p" className="ai-text-studio__bubble-body">{turn.answer}</AppText>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {insufficientCreditsMessage ? (
        <div className="ai-credits-modal__backdrop" role="presentation" onClick={closeInsufficientModal}>
          <div
            className="ai-credits-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="ai-text-credits-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <AppText as="h3" id="ai-text-credits-modal-title" className="ai-credits-modal__title">
              {t('ai_insufficient_credits_title')}
            </AppText>
            <AppText as="p" className="ai-credits-modal__message">{insufficientCreditsMessage}</AppText>
            <div className="ai-credits-modal__actions">
              <button type="button" className="ai-credits-modal__btn ai-credits-modal__btn--ghost" onClick={closeInsufficientModal}>
                {t('close', 'Close')}
              </button>
              <button
                type="button"
                className="ai-credits-modal__btn ai-credits-modal__btn--primary"
                onClick={() => {
                  closeInsufficientModal();
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
    </div>
  );
}
