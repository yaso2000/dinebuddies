import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft, FaQuestion, FaCheck } from 'react-icons/fa';
import { suitabilityApi } from '../hooks/useSuitabilityPost';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { goToLogin } from '../utils/goToLogin';
import { getSafeAvatar } from '../utils/avatarUtils';
import { AppText } from '../components/base';
import { SUITABILITY_ARCHETYPES } from '../constants/suitabilityArchetypes';
import { PERSONALITY_TRAITS, TRAITS_REQUIRED } from '../constants/personalityTraits';
import '../styles/gameUI.css';

export default function CreateSuitabilityPost() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { currentUser, userProfile, isGuest } = useAuth();
  const { showToast } = useToast();
  const isArabic = (i18n.language || 'ar').startsWith('ar');

  const [traits, setTraits] = useState([]);
  const [busy, setBusy] = useState(false);

  const avatar = getSafeAvatar(userProfile || currentUser);
  const name = userProfile?.displayName || userProfile?.display_name || '';

  const toggleTrait = (id) => {
    setTraits((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= TRAITS_REQUIRED) return prev; // cap at 3
      return [...prev, id];
    });
  };

  const create = async () => {
    if (isGuest || !currentUser) { goToLogin(); return; }
    if (!avatar || !String(avatar).startsWith('http')) { showToast(t('suitability_need_photo', 'Add a profile photo first.'), 'info'); return; }
    if (traits.length !== TRAITS_REQUIRED) {
      showToast(t('suitability_pick_traits', { defaultValue: 'Pick exactly {{n}} traits.', n: TRAITS_REQUIRED }), 'info');
      return;
    }
    setBusy(true);
    try {
      const res = await suitabilityApi.create({ traits });
      navigate(`/suitability/${res.postId}`);
    } catch (e) { showToast(e?.message || t('suitability_create_error', 'Could not publish your card.'), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-body)' }} dir={i18n.dir()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1.2rem', cursor: 'pointer' }}><FaChevronLeft style={{ transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' }} /></button>
        <AppText as="h2" style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{t('suitability_create_title', 'Who suits you?')}</AppText>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: '2.4rem' }}>🧭</div>
          <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 420, margin: '8px auto 0' }}>
            {t('suitability_create_desc', 'Share your card and let the crowd pick which partner type suits you best. It stays live on the stories rail for 24 hours.')}
          </AppText>
        </div>

        {/* Your card preview */}
        <div className="gg-card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            {avatar && String(avatar).startsWith('http')
              ? <img src={avatar} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)' }} />
              : <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#7c3aed', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 24 }}>{(name || '?').charAt(0)}</div>}
            <div>
              <AppText as="div" style={{ fontWeight: 800, fontSize: '1rem' }} format={false}>{name || t('suitability_you', 'You')}</AppText>
              <AppText as="div" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('suitability_real_photo_hint', 'Your real profile photo is used.')}</AppText>
            </div>
          </div>

          {/* Pick exactly 3 personality traits — shown on your card */}
          <AppText as="div" style={{ fontWeight: 800, marginBottom: 2 }}>
            {t('suitability_traits_title', 'Pick 3 traits that describe you')}
          </AppText>
          <AppText as="div" style={{ fontSize: '0.78rem', color: traits.length === TRAITS_REQUIRED ? '#10b981' : 'var(--text-muted)', marginBottom: 12 }}>
            {traits.length} / {TRAITS_REQUIRED}
          </AppText>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PERSONALITY_TRAITS.map((tr) => {
              const sel = traits.includes(tr.id);
              const disabled = !sel && traits.length >= TRAITS_REQUIRED;
              return (
                <button key={tr.id} type="button" onClick={() => toggleTrait(tr.id)} disabled={disabled}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 999, fontSize: '0.85rem', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
                    background: sel ? 'rgba(124,58,237,0.14)' : 'var(--bg-elevated)', border: `1.5px solid ${sel ? '#7c3aed' : 'var(--border-color)'}`, color: 'var(--text-main)', opacity: disabled ? 0.45 : 1 }}>
                  <span aria-hidden>{tr.emoji}</span>{isArabic ? tr.ar : tr.en}
                  {sel ? <FaCheck size={10} color="#7c3aed" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* The archetypes people will choose from */}
        <div className="gg-card" style={{ padding: 16, marginBottom: 16 }}>
          <AppText as="div" style={{ fontWeight: 800, marginBottom: 4 }}>🗳️ {t('suitability_types_title', 'People will pick one of these for you')}</AppText>
          <AppText as="div" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>{t('suitability_types_hint', 'Warm personality types — never about looks.')}</AppText>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUITABILITY_ARCHETYPES.map((a) => (
              <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 999, fontSize: '0.82rem', fontWeight: 700, background: 'var(--bg-elevated)', border: `1.5px solid ${a.color}55`, color: 'var(--text-main)' }}>
                <span aria-hidden>{a.emoji}</span>{isArabic ? a.ar : a.en}
              </span>
            ))}
          </div>
        </div>

        <button type="button" className="gg-btn gg-btn--primary gg-btn--block" disabled={busy || traits.length !== TRAITS_REQUIRED} onClick={create} style={{ background: 'linear-gradient(90deg,#7c3aed,#22d3ee)', opacity: busy || traits.length !== TRAITS_REQUIRED ? 0.55 : 1 }}>
          <FaQuestion /> {busy ? t('suitability_publishing', 'Publishing…') : t('suitability_publish_cta', 'Publish my card')}
        </button>
      </div>
    </div>
  );
}
