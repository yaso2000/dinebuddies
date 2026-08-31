import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft, FaTimes } from 'react-icons/fa';
import { useLiveZodiacPosts } from '../hooks/useLiveZodiacPosts';
import { useZodiacPost } from '../hooks/useZodiacPost';
import { useToast } from '../context/ToastContext';
import GameCardReport from '../components/GameCardReport';
import { ZODIAC_SIGNS, getSign, signLabel } from '../constants/zodiacSigns';
import { AppText } from '../components/base';
import '../styles/gameUI.css';

function TraitChips({ traits, isArabic }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
      {(traits || []).map((tr, i) => (
        <span key={i} style={{ padding: '8px 14px', borderRadius: 999, background: 'rgba(124,58,237,0.14)', border: '1.5px solid rgba(124,58,237,0.4)', fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>
          {isArabic ? tr?.ar : tr?.en}
        </span>
      ))}
    </div>
  );
}

/** Reveal — the true sign, whether the viewer was right, and the crowd's top guesses. */
function Reveal({ reveal, isArabic, t }) {
  const tally = reveal?.tally || {};
  const total = Object.values(tally).reduce((s, n) => s + (Number(n) || 0), 0) || 1;
  const top = ZODIAC_SIGNS
    .map((s) => ({ id: s.id, n: Number(tally[s.id]) || 0 }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 4);
  const truthSign = getSign(reveal?.truth);
  const color = reveal?.correct ? '#10b981' : '#ef4444';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, background: `${color}18`, border: `1.5px solid ${color}66`, marginBottom: 12 }}>
        <span style={{ fontSize: '1.8rem' }} aria-hidden>{truthSign?.icon || '🔮'}</span>
        <div style={{ flex: 1 }}>
          <AppText as="div" style={{ fontWeight: 900, color }}>{reveal?.correct ? t('roa_correct', 'Correct!') : t('roa_wrong', 'Not quite')}</AppText>
          <AppText as="div" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {t('zodiac_truth_was', { defaultValue: 'The sign was {{x}}', x: signLabel(reveal?.truth, isArabic ? 'ar' : 'en') })}
          </AppText>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {top.map((r) => {
          const pct = Math.round((100 * r.n) / total);
          const s = getSign(r.id);
          const isTruth = r.id === reveal?.truth;
          return (
            <div key={r.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 3 }}>
                <AppText as="span" style={{ fontWeight: 700, color: isTruth ? '#10b981' : 'var(--text-main)' }} format={false}>{s?.icon} {isArabic ? s?.ar : s?.en}</AppText>
                <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{pct}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: isTruth ? '#10b981' : '#7c3aed', borderRadius: 999, transition: 'width .3s' }} />
              </div>
            </div>
          );
        })}
      </div>
      <AppText as="div" style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
        {t('roa_total_guesses', { defaultValue: '{{n}} guesses', n: total })}
      </AppText>
    </div>
  );
}

function DeckCard({ postId, isArabic, t, onDone, active }) {
  const { showToast } = useToast();
  const { post, myGuess, vote } = useZodiacPost(postId);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(null);
  const [floating, setFloating] = useState(false);

  // Only the VISIBLE card fetches its reveal (avoid a burst of vote callables).
  useEffect(() => {
    let alive = true;
    if (active && myGuess && !reveal && !busy) {
      vote(myGuess).then((r) => { if (alive) setReveal(r); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [active, myGuess, reveal, busy, vote]);

  const confirmGuess = useCallback(async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const r = await vote(selected);
      setReveal(r);
      setFloating(true);
    } catch (e) {
      showToast(e?.message || t('roa_vote_error', 'Could not record your guess.'), 'error');
    } finally { setBusy(false); }
  }, [selected, busy, vote, showToast, t]);

  if (!post) {
    return <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-main)' }}>{t('loading', 'Loading…')}</div>;
  }

  const decidedInline = Boolean(myGuess) && !floating;

  return (
    <div style={{ height: '100%', position: 'relative', display: 'flex', flexDirection: 'column', background: 'var(--bg-body)' }}>
      <GameCardReport ownerId={post.ownerId} ownerName={post.ownerName} onBlocked={onDone} />
      {/* Owner + traits */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
        {post.ownerAvatar
          ? <img src={post.ownerAvatar} alt="" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '3px solid #7c3aed' }} />
          : <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(140deg,#7c3aed,#4f46e5)', display: 'grid', placeItems: 'center', fontSize: '2.4rem' }}>🔮</div>}
        <AppText as="div" style={{ fontWeight: 800, fontSize: '1.05rem' }}>{post.ownerName || t('zodiac_title', 'Guess my sign?')}</AppText>
        <AppText as="div" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t('zodiac_guess_prompt', 'Which sign am I? My traits:')}</AppText>
        <TraitChips traits={post.traits} isArabic={isArabic} />
      </div>

      {/* Bottom: 12-sign guess grid OR inline reveal */}
      <div style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', padding: 14, maxHeight: '52%', overflowY: 'auto' }}>
        {decidedInline ? (
          reveal ? <Reveal reveal={reveal} isArabic={isArabic} t={t} />
            : <AppText as="div" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{t('loading', 'Loading…')}</AppText>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
              {ZODIAC_SIGNS.map((s) => {
                const sel = selected === s.id;
                return (
                  <button key={s.id} type="button" onClick={() => setSelected(s.id)}
                    style={{ padding: '8px 2px', borderRadius: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      border: `2px solid ${sel ? '#7c3aed' : 'var(--border-color)'}`, background: sel ? 'rgba(124,58,237,0.16)' : 'var(--bg-elevated)', color: 'var(--text-main)' }}>
                    <span style={{ fontSize: '1.2rem' }} aria-hidden>{s.icon}</span>
                    <AppText as="span" style={{ fontSize: '0.66rem', fontWeight: 700 }} format={false}>{isArabic ? s.ar : s.en}</AppText>
                  </button>
                );
              })}
            </div>
            {selected ? (
              <button type="button" onClick={confirmGuess} disabled={busy}
                style={{ width: '100%', padding: '13px 0', borderRadius: 14, fontWeight: 800, cursor: 'pointer', color: '#fff', border: 'none', background: 'linear-gradient(90deg,#7c3aed,#4f46e5)' }}>
                {busy ? t('roa_locking', 'Locking…') : t('roa_lock_cta', 'Lock in my guess')}
              </button>
            ) : (
              <AppText as="div" style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center' }}>{t('roa_lock_hint', 'Your guess is final — pick carefully.')}</AppText>
            )}
          </div>
        )}
      </div>

      {floating && reveal ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', padding: 18 }}
          onClick={() => { setFloating(false); onDone?.(); }}>
          <div className="gg-card" style={{ width: '100%', maxWidth: 420, padding: 18, position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button type="button" aria-label={t('close', 'Close')} onClick={() => { setFloating(false); onDone?.(); }}
              style={{ position: 'absolute', top: 10, insetInlineEnd: 10, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--bg-elevated)', color: 'var(--text-main)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
              <FaTimes />
            </button>
            <Reveal reveal={reveal} isArabic={isArabic} t={t} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ZodiacDeck() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.language || 'ar').startsWith('ar');
  const { posts, loading } = useLiveZodiacPosts({ cap: 30 });
  const [searchParams] = useSearchParams();
  const startId = searchParams.get('start');
  const scrollerRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [order, setOrder] = useState([]);

  // Start the deck on the tapped card (?start=id) when the rail passes one.
  useEffect(() => {
    if (order.length === 0 && posts.length > 0) {
      let ids = posts.map((p) => p.id);
      if (startId && ids.includes(startId)) ids = [startId, ...ids.filter((id) => id !== startId)];
      setOrder(ids);
    }
  }, [posts, order.length, startId]);

  const goHome = useCallback(() => navigate('/posts-feed', { replace: true }), [navigate]);
  const scrollToIndex = useCallback((i) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }, []);
  const advance = useCallback((fromIdx) => {
    scrollToIndex(fromIdx + 1 >= order.length ? order.length : fromIdx + 1);
  }, [order.length, scrollToIndex]);
  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || !el.clientWidth) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  const atEnd = order.length > 0 && index >= order.length;

  return createPortal(
    <div dir={i18n.dir()} style={{ position: 'fixed', inset: 0, zIndex: 2000000000, display: 'flex', flexDirection: 'column', background: 'var(--bg-body)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(12px + env(safe-area-inset-top, 0px)) 16px 12px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
        <button onClick={goHome} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1.2rem', cursor: 'pointer' }}><FaChevronLeft style={{ transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' }} /></button>
        <AppText as="h2" style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, flex: 1 }}>{t('zodiac_title', 'Guess my sign?')}</AppText>
        {order.length > 0 && !atEnd ? <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>{Math.min(index + 1, order.length)}/{order.length}</span> : null}
      </div>

      {order.length === 0 && loading ? (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}><div className="db-spin" /></div>
      ) : order.length === 0 ? (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
          <div>
            <div style={{ fontSize: '2.4rem' }}>🔮</div>
            <AppText as="p" style={{ color: 'var(--text-muted)', marginTop: 8 }}>{t('zodiac_deck_empty', 'No cards to guess right now.')}</AppText>
            <button className="gg-btn gg-btn--primary" style={{ marginTop: 14 }} onClick={goHome}>{t('back_home', 'Back home')}</button>
          </div>
        </div>
      ) : (
        <div ref={scrollerRef} dir="ltr" onScroll={onScroll}
          style={{ flex: 1, display: 'flex', overflowX: 'auto', overflowY: 'hidden', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
          {order.map((id, i) => (
            <div key={id} style={{ flex: '0 0 100%', width: '100%', height: '100%', scrollSnapAlign: 'center', overflow: 'hidden' }}>
              <DeckCard postId={id} isArabic={isArabic} t={t} onDone={() => advance(i)} active={i === index} />
            </div>
          ))}
          <div style={{ flex: '0 0 100%', width: '100%', height: '100%', scrollSnapAlign: 'center', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '2.6rem' }}>🎉</div>
              <AppText as="h3" style={{ fontWeight: 800, marginTop: 10 }}>{t('roa_deck_done_title', 'That’s all the cards!')}</AppText>
              <AppText as="p" style={{ color: 'var(--text-muted)', marginTop: 6, maxWidth: 320 }}>{t('roa_deck_done_body', 'You’ve guessed them all. Back to your feed.')}</AppText>
              <button className="gg-btn gg-btn--primary" style={{ marginTop: 16 }} onClick={goHome}>{t('suitability_go_feed', 'Go to feed')}</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
