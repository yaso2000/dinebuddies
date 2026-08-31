import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft, FaCheck, FaCrown } from 'react-icons/fa';
import { useSuitabilityPost } from '../hooks/useSuitabilityPost';
import { useToast } from '../context/ToastContext';
import { AppText } from '../components/base';
import { SUITABILITY_ARCHETYPES } from '../constants/suitabilityArchetypes';
import { getTrait } from '../constants/personalityTraits';
import '../styles/gameUI.css';

function timeLeftLabel(expiresAt, t) {
  const ms = (expiresAt?.toMillis?.() ?? 0) - Date.now();
  if (ms <= 0) return t('suitability_ended', 'Ended');
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 1) return t('suitability_hours_left', { defaultValue: '{{h}}h left', h });
  return t('suitability_minutes_left', { defaultValue: '{{m}}m left', m });
}

export default function SuitabilityPostRoom() {
  const { id: postId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const isArabic = (i18n.language || 'ar').startsWith('ar');
  const { post, myVote, loading, isOwner, vote, end } = useSuitabilityPost(postId);
  const [busy, setBusy] = useState('');

  const isLive = !!post && post.status === 'live' && (post.expiresAt?.toMillis?.() ?? 0) > Date.now();

  const ranked = useMemo(() => {
    const tally = post?.tally || {};
    const total = SUITABILITY_ARCHETYPES.reduce((s, a) => s + (Number(tally[a.id]) || 0), 0);
    const rows = SUITABILITY_ARCHETYPES.map((a) => {
      const n = Number(tally[a.id]) || 0;
      return { ...a, n, pct: total ? Math.round((100 * n) / total) : 0 };
    }).sort((x, y) => y.n - x.n);
    return { rows, total };
  }, [post?.tally]);

  const doVote = async (archetype) => {
    if (busy) return;
    setBusy(archetype);
    try { await vote(archetype); }
    catch (e) { showToast(e?.message || t('suitability_vote_error', 'Could not record your vote.'), 'error'); }
    finally { setBusy(''); }
  };

  const doEnd = async () => {
    setBusy('end');
    try { await end(); showToast(t('suitability_end_done', 'Your poll has ended.'), 'success'); }
    catch (e) { showToast(e?.message || t('suitability_end_error', 'Could not end the poll.'), 'error'); }
    finally { setBusy(''); }
  };

  if (loading) {
    return <div dir={i18n.dir()} style={{ minHeight: '100vh', background: 'var(--bg-body)', display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>{t('loading', 'Loading…')}</div>;
  }
  if (!post) {
    return (
      <div dir={i18n.dir()} style={{ minHeight: '100vh', background: 'var(--bg-body)', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
        <div>
          <div style={{ fontSize: '2.4rem' }}>🧭</div>
          <AppText as="p" style={{ color: 'var(--text-muted)', marginTop: 8 }}>{t('suitability_not_found', 'This card is no longer available.')}</AppText>
          <button className="gg-btn gg-btn--primary" style={{ marginTop: 14 }} onClick={() => navigate('/')}>{t('back_home', 'Back home')}</button>
        </div>
      </div>
    );
  }

  const top = ranked.rows[0];
  const showResults = isOwner || !isLive || !!myVote;

  return (
    <div dir={i18n.dir()} style={{ minHeight: '100vh', background: 'var(--bg-body)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1.2rem', cursor: 'pointer' }}><FaChevronLeft style={{ transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' }} /></button>
        <AppText as="h2" style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, flex: 1 }}>{t('suitability_title', 'Who suits you?')}</AppText>
        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: isLive ? '#7c3aed' : 'var(--text-muted)', background: isLive ? 'rgba(124,58,237,0.1)' : 'var(--bg-elevated)', padding: '4px 10px', borderRadius: 999 }}>
          {timeLeftLabel(post.expiresAt, t)}
        </span>
      </div>

      <div style={{ maxWidth: 540, margin: '0 auto', padding: 20 }}>
        {/* Owner card */}
        <div className="gg-card" style={{ padding: 18, marginBottom: 18, textAlign: 'center' }}>
          {post.ownerAvatar && String(post.ownerAvatar).startsWith('http')
            ? <img src={post.ownerAvatar} alt="" style={{ width: 110, height: 110, borderRadius: '50%', objectFit: 'cover', border: '3px solid #7c3aed', margin: '0 auto' }} />
            : <div style={{ width: 110, height: 110, borderRadius: '50%', background: '#7c3aed', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 40, margin: '0 auto' }}>{(post.ownerName || '?').charAt(0)}</div>}
          <AppText as="div" style={{ fontWeight: 800, fontSize: '1.2rem', marginTop: 12 }} format={false}>{post.ownerName || t('suitability_someone', 'Someone')}</AppText>
          {Array.isArray(post.traits) && post.traits.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', marginTop: 10 }}>
              {post.traits.map((id) => {
                const tr = getTrait(id);
                if (!tr) return null;
                return (
                  <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 999, fontSize: '0.85rem', fontWeight: 700, background: 'var(--bg-elevated)', border: '1.5px solid #7c3aed55', color: 'var(--text-main)' }}>
                    <span aria-hidden>{tr.emoji}</span>{isArabic ? tr.ar : tr.en}
                  </span>
                );
              })}
            </div>
          ) : (post.about ? <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: 6, lineHeight: 1.6 }} format={false}>{post.about}</AppText> : null)}
        </div>

        {/* Non-owner, live, not yet voted → the ballot */}
        {!isOwner && isLive ? (
          <div style={{ marginBottom: 18 }}>
            <AppText as="div" style={{ fontWeight: 800, marginBottom: 4, textAlign: 'center' }}>
              {myVote ? t('suitability_change_prompt', 'Which type suits them? (tap to change)') : t('suitability_pick_prompt', 'Which partner type suits them best?')}
            </AppText>
            <AppText as="div" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12, textAlign: 'center' }}>{t('suitability_pick_hint', 'Pick the one that fits their vibe.')}</AppText>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {SUITABILITY_ARCHETYPES.map((a) => {
                const sel = myVote === a.id;
                return (
                  <button key={a.id} type="button" disabled={busy === a.id} onClick={() => doVote(a.id)}
                    style={{ position: 'relative', textAlign: 'start', padding: '12px 12px', borderRadius: 14, cursor: 'pointer',
                      border: `2px solid ${sel ? a.color : 'var(--border-color)'}`, background: sel ? `${a.color}14` : 'var(--bg-card)', color: 'var(--text-main)' }}>
                    <div style={{ fontSize: '1.4rem', marginBottom: 4 }} aria-hidden>{a.emoji}</div>
                    <AppText as="div" style={{ fontWeight: 800, fontSize: '0.92rem' }} format={false}>{isArabic ? a.ar : a.en}</AppText>
                    <AppText as="div" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }} format={false}>{isArabic ? a.descAr : a.descEn}</AppText>
                    {sel ? <span style={{ position: 'absolute', top: 8, insetInlineEnd: 8, width: 22, height: 22, borderRadius: '50%', background: a.color, color: '#fff', display: 'grid', placeItems: 'center' }}><FaCheck size={11} /></span> : null}
                  </button>
                );
              })}
            </div>
            {myVote ? <AppText as="p" style={{ textAlign: 'center', color: '#10b981', fontWeight: 700, fontSize: '0.85rem', marginTop: 12 }}>✓ {t('suitability_vote_saved', 'Your pick is saved.')}</AppText> : null}
          </div>
        ) : null}

        {/* Results — owner always; everyone once ended or after they voted */}
        {showResults ? (
          <div className="gg-card" style={{ padding: 18 }}>
            {isOwner ? (
              <AppText as="div" style={{ fontWeight: 800, marginBottom: 4 }}>
                {ranked.total ? t('suitability_owner_result', 'The crowd thinks the one who suits you is:') : t('suitability_owner_waiting', 'No votes yet — share your card!')}
              </AppText>
            ) : (
              <AppText as="div" style={{ fontWeight: 800, marginBottom: 4 }}>{t('suitability_results_title', 'Results so far')}</AppText>
            )}

            {ranked.total && top ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, background: `${top.color}14`, border: `1.5px solid ${top.color}55`, margin: '10px 0 14px' }}>
                <span style={{ fontSize: '1.8rem' }} aria-hidden>{top.emoji}</span>
                <div style={{ flex: 1 }}>
                  <AppText as="div" style={{ fontWeight: 900, fontSize: '1.05rem', color: top.color }} format={false}>{isArabic ? top.ar : top.en}</AppText>
                  <AppText as="div" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }} format={false}>{isArabic ? top.descAr : top.descEn}</AppText>
                </div>
                <span style={{ fontWeight: 900, fontSize: '1.1rem', color: top.color }}>{top.pct}%</span>
                <FaCrown color={top.color} />
              </div>
            ) : null}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ranked.rows.map((r) => (
                <div key={r.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 3 }}>
                    <AppText as="span" style={{ fontWeight: 700 }} format={false}>{r.emoji} {isArabic ? r.ar : r.en}</AppText>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{r.pct}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${r.pct}%`, background: r.color, borderRadius: 999, transition: 'width .3s' }} />
                  </div>
                </div>
              ))}
            </div>
            <AppText as="div" style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 12 }}>
              {t('suitability_total_votes', { defaultValue: '{{n}} votes', n: ranked.total })}
            </AppText>

            {isOwner && isLive ? (
              <button type="button" className="gg-btn gg-btn--block" disabled={busy === 'end'} onClick={doEnd} style={{ marginTop: 14, background: 'var(--bg-elevated)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                {busy === 'end' ? t('suitability_ending', 'Ending…') : t('suitability_end_cta', 'End poll now')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
