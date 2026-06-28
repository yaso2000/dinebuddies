import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaMagic } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { adminApi } from '../api';
import { AppText } from '../../components/base';
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
 * Generates avatar + cover as the same person (Imagen subject customization).
 */
export default function DemoUserAiCharacterPairTrigger({
  profile = {},
  geo = {},
  disabled = false,
  onGenerated,
}) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const promptId = useId();
  const [userPrompt, setUserPrompt] = useState('');
  const [coverScene, setCoverScene] = useState('cafe');
  const [generating, setGenerating] = useState(false);

  const canGenerate =
    Boolean(profile?.gender) &&
    Boolean(profile?.ageCategory) &&
    Boolean(currentUser?.uid) &&
    !disabled &&
    !generating;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      const res = await adminApi.generateDemoUserCharacterPair({
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
        coverScene,
      });

      const avatarUrl = res?.avatar?.imageUrl;
      const coverUrl = res?.cover?.imageUrl;
      if (!avatarUrl || !coverUrl) {
        throw new Error(t('admin_demo_user_ai_empty', 'AI returned no image.'));
      }

      onGenerated?.({ avatarUrl, coverUrl });
      showToast(
        res?.cover?.usedSubjectFallback
          ? t(
              'admin_demo_user_ai_pair_done_fallback',
              'Profile + cover generated (cover used fallback mode).'
            )
          : t('admin_demo_user_ai_pair_done', 'Profile photo and matching cover generated.'),
        'success'
      );
    } catch (err) {
      console.error('Demo user character pair failed:', err);
      showToast(err?.message || t('admin_demo_user_ai_failed', 'AI image generation failed.'), 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="admin-ai-character-pair">
      <div className="admin-ai-character-pair__head">
        <span className="admin-ai-character-pair__icon" aria-hidden>
          <FaMagic />
        </span>
        <div>
          <AppText as="p" className="admin-ai-character-pair__title" format={false}>
            {t('admin_demo_user_ai_pair_title', 'AI character pair')}
          </AppText>
          <AppText as="p" className="admin-ai-character-pair__hint">
            {t(
              'admin_demo_user_ai_pair_hint',
              'Generates a face portrait and a wide cover photo of the same person in a lifestyle scene.'
            )}
          </AppText>
        </div>
      </div>

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
          'admin_demo_user_ai_pair_prompt_ph',
          'e.g. casual style, warm smile, summer outfit…'
        )}
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
          ? t('admin_demo_user_ai_pair_generating', 'Generating character pair…')
          : t('admin_demo_user_ai_pair_btn', 'Generate profile + cover pair')}
      </button>
    </div>
  );
}
