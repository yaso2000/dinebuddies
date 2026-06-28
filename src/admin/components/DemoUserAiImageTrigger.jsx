import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { adminApi } from '../api';
import { AppText } from '../../components/base';
import AdminAiIconButton from './AdminAiIconButton';
import './AdminAiControls.css';

const COVER_SCENES = [
  { id: 'cafe', icon: '☕' },
  { id: 'restaurant', icon: '🍽️' },
  { id: 'beach', icon: '🏖️' },
  { id: 'city', icon: '🌆' },
  { id: 'nature', icon: '🌿' },
  { id: 'rooftop', icon: '🌇' },
];

/**
 * AI magic icon + popover for demo user avatar or cover generation.
 */
export default function DemoUserAiImageTrigger({
  kind = 'avatar',
  profile = {},
  geo = {},
  disabled = false,
  onGenerated,
}) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const promptId = useId();
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const [coverScene, setCoverScene] = useState('cafe');
  const [generating, setGenerating] = useState(false);

  const isCover = kind === 'cover';

  const canGenerate =
    Boolean(profile?.gender) &&
    Boolean(profile?.ageCategory) &&
    Boolean(currentUser?.uid) &&
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
      const res = await adminApi.generateDemoUserImage({
        kind,
        profile: {
          displayName: profile.displayName,
          gender: profile.gender,
          ageCategory: profile.ageCategory,
          bio: profile.bio,
          diningPersona: profile.diningPersona,
          firstDatePlaceHint: profile.firstDatePlaceHint,
        },
        city: geo.city,
        stateName: geo.stateName,
        countryName: geo.countryName,
        countryCode: geo.countryCode,
        userPrompt: userPrompt.trim(),
        coverScene: isCover ? coverScene : undefined,
        referenceAvatarUrl: isCover ? profile?.photo_url || '' : undefined,
      });
      if (!res?.imageUrl) {
        throw new Error(t('admin_demo_user_ai_empty', 'AI returned no image.'));
      }
      onGenerated?.(res.imageUrl);
      setOpen(false);
      showToast(
        isCover
          ? t('admin_demo_user_ai_cover_done', 'Cover image generated.')
          : t('admin_demo_user_ai_avatar_done', 'Profile photo generated.'),
        'success'
      );
    } catch (err) {
      console.error('Demo user AI image failed:', err);
      showToast(err?.message || t('admin_demo_user_ai_failed', 'AI image generation failed.'), 'error');
    } finally {
      setGenerating(false);
    }
  };

  const iconTitle = isCover
    ? t('admin_demo_user_ai_generate_cover', 'Generate cover with AI')
    : t('admin_demo_user_ai_generate_avatar', 'Generate avatar with AI');

  return (
    <div className="admin-ai-trigger-wrap" ref={wrapRef}>
      <AdminAiIconButton
        loading={generating}
        disabled={disabled}
        open={open}
        title={iconTitle}
        onClick={() => setOpen((prev) => !prev)}
      />

      {open ? (
        <div className="admin-ai-popover" role="dialog" aria-label={iconTitle}>
          <AppText as="p" className="admin-ai-popover__hint">
            {isCover
              ? profile?.photo_url
                ? t(
                    'admin_demo_user_ai_cover_hint_same_person',
                    'Uses the current profile photo as reference — same person in a wide lifestyle scene.'
                  )
                : t(
                    'admin_demo_user_ai_cover_hint',
                    'Wide lifestyle scene only (no person). Use “AI character pair” above for a matching person.'
                  )
              : t(
                  'admin_demo_user_ai_avatar_hint',
                  'Avatar portrait from gender, age group, bio, and your prompt.'
                )}
          </AppText>

          {isCover ? (
            <div>
              <AppText as="span" className="db-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                {t('admin_demo_user_ai_scene', 'Scene preset')}
              </AppText>
              <div className="admin-ai-popover__scenes">
                {COVER_SCENES.map((scene) => (
                  <button
                    key={scene.id}
                    type="button"
                    className={`db-btn admin-ai-popover__scene${coverScene === scene.id ? ' db-btn--lime' : ''}`}
                    disabled={disabled || generating}
                    onClick={() => setCoverScene(scene.id)}
                  >
                    {scene.icon}{' '}
                    {t(`admin_demo_user_ai_scene_${scene.id}`, {
                      defaultValue: scene.id.charAt(0).toUpperCase() + scene.id.slice(1),
                    })}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <label className="db-label" htmlFor={promptId}>
            {t('admin_demo_user_ai_prompt', 'Custom prompt (optional)')}
          </label>
          <textarea
            id={promptId}
            className="db-input"
            rows={2}
            value={userPrompt}
            disabled={disabled || generating}
            placeholder={
              isCover
                ? t('admin_demo_user_ai_cover_prompt_ph', 'e.g. warm evening light…')
                : t('admin_demo_user_ai_avatar_prompt_ph', 'e.g. casual smile, natural light…')
            }
            onChange={(e) => setUserPrompt(e.target.value)}
            style={{ resize: 'vertical' }}
          />

          {!profile?.gender || !profile?.ageCategory ? (
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
              ? t('admin_demo_user_ai_generating', 'Generating with AI…')
              : iconTitle}
          </button>
        </div>
      ) : null}
    </div>
  );
}
