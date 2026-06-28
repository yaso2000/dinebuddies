import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { adminApi } from '../api';
import { AppText } from '../../components/base';
import AdminAiIconButton from './AdminAiIconButton';
import './AdminAiControls.css';

/**
 * Bio textarea with inline AI icon to generate bio text only.
 */
export default function DemoUserAiBioField({
  value = '',
  onChange,
  profile = {},
  geo = {},
  disabled = false,
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const promptId = useId();
  const bioId = useId();
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  const canGenerate =
    Boolean(geo?.city) &&
    Boolean(geo?.countryCode) &&
    Boolean(profile?.gender) &&
    Boolean(profile?.ageCategory) &&
    !disabled &&
    !generating;

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      const res = await adminApi.suggestDemoUserProfile({
        scope: 'bio',
        city: geo.city,
        countryCode: geo.countryCode,
        countryName: geo.countryName,
        stateName: geo.stateName,
        userPrompt: userPrompt.trim(),
        profile: {
          displayName: profile.displayName,
          gender: profile.gender,
          ageCategory: profile.ageCategory,
          bio: value,
          diningPersona: profile.diningPersona,
        },
      });
      const bio = res?.profile?.bio;
      if (!bio) {
        throw new Error(t('admin_demo_user_bio_ai_empty', 'AI returned no bio.'));
      }
      onChange?.(bio);
      setOpen(false);
      showToast(t('admin_demo_user_bio_ai_done', 'Bio generated — review and edit.'), 'success');
    } catch (err) {
      console.error('Demo user bio AI failed:', err);
      showToast(err?.message || t('admin_demo_user_bio_ai_failed', 'Bio generation failed.'), 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="admin-ai-bio-field">
      <div className="admin-ai-label-row">
        <label className="db-label" htmlFor={bioId} style={{ margin: 0 }}>
          {t('bio', 'Bio')}
        </label>
        <div className="admin-ai-trigger-wrap" ref={wrapRef}>
          <AdminAiIconButton
            loading={generating}
            disabled={disabled}
            open={open}
            title={t('admin_demo_user_bio_ai_btn', 'Generate bio with AI')}
            onClick={() => setOpen((prev) => !prev)}
          />

          {open ? (
            <div
              className="admin-ai-popover"
              role="dialog"
              aria-label={t('admin_demo_user_bio_ai_btn', 'Generate bio with AI')}
            >
              <AppText as="p" className="admin-ai-popover__hint">
                {t(
                  'admin_demo_user_bio_ai_hint',
                  'Writes a short bio in the local language based on city, gender, age, and profile vibe.'
                )}
              </AppText>

              <label className="db-label" htmlFor={promptId}>
                {t('admin_demo_user_ai_prompt', 'Custom prompt (optional)')}
              </label>
              <textarea
                id={promptId}
                className="db-input"
                rows={2}
                value={userPrompt}
                disabled={disabled || generating}
                placeholder={t(
                  'admin_demo_user_bio_ai_prompt_ph',
                  'e.g. foodie, loves brunch spots, playful tone…'
                )}
                onChange={(e) => setUserPrompt(e.target.value)}
                style={{ resize: 'vertical' }}
              />

              {!geo?.city || !geo?.countryCode ? (
                <AppText as="p" className="admin-ai-popover__hint">
                  {t('admin_demo_users_pick_city', 'Select country and city first.')}
                </AppText>
              ) : null}

              {(!profile?.gender || !profile?.ageCategory) && geo?.city ? (
                <AppText as="p" className="admin-ai-popover__hint">
                  {t('admin_demo_user_ai_need_profile', 'Select gender and age group first.')}
                </AppText>
              ) : null}

              <button
                type="button"
                className="db-btn db-btn--lime"
                disabled={!canGenerate}
                onClick={handleGenerate}
              >
                {generating
                  ? t('admin_demo_user_bio_ai_generating', 'Writing bio…')
                  : t('admin_demo_user_bio_ai_btn', 'Generate bio with AI')}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <textarea
        id={bioId}
        className="db-input"
        rows={3}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        style={{ resize: 'vertical' }}
      />
    </div>
  );
}
