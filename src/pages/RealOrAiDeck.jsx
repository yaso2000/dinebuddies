import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft, FaCamera, FaRobot, FaTimes, FaCheck } from 'react-icons/fa';
import { useLiveRealOrAiPosts } from '../hooks/useLiveRealOrAiPosts';
import { useRealOrAiPost } from '../hooks/useRealOrAiPost';
import { useToast } from '../context/ToastContext';
import GameCardReport from '../components/GameCardReport';
import { AppText } from '../components/base';
import '../styles/gameUI.css';

/** Reveal panel — the truth, whether the viewer was right, and the crowd split. */
function Reveal({ reveal, isArabic, t }) {
  const total = (Number(reveal?.tally?.real) || 0) + (Number(reveal?.tally?.ai) || 0);
  const realPct = total ? Math.round((100 * (Number(reveal?.tally?.real) || 0)) / total) : 0;
  const aiPct = total ? 100 - realPct : 0;
  const truthReal = reveal?.truth === 'real';
  const truthLabel = truthReal ? t('roa_real', 'Real') : t('roa_ai', 'AI');
  const color = reveal?.correct ? '#10b981' : '#ef4444';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, background: `${color}18`, border: `1.5px solid ${color}66`, marginBottom: 12 }}>
        <span style={{ fontSize: '1.6rem' }} aria-hidden>{reveal?.correct ? '✅' : '❌'}</span>
        <div style={{ flex: 1 }}>
          <AppText as="div" style={{ fontWeight: 900, color }}>{reveal?.correct ? t('roa_correct', 'Correct!') : t('roa_wrong', 'Not quite')}</AppText>
          <AppText as="div" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {t('roa_truth_was', { defaultValue: 'It was {{x}}', x: truthLabel })}{' '}{truthReal ? '📷' : '🤖'}
          </AppText>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[{ k: 'real', label: `📷 ${t('roa_real', 'Real')}`, pct: realPct, color: '#0ea5e9' },
          { k: 'ai', label: `🤖 ${t('roa_ai', 'AI')}`, pct: aiPct, color: '#a855f7' }].map((r) => (
          <div key={r.k}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 3 }}>
              <AppText as="span" style={{ fontWeight: 700 }} format={false}>{r.label}</AppText>
              <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{r.pct}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${r.pct}%`, background: r.color, borderRadius: 999, transition: 'width .3s' }} />
            </div>
          </div>
        ))}
      </div>
      <AppText as="div" style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
        {t('roa_total_guesses', { defaultValue: '{{n}} guesses', n: total })}
      </AppText>
    </div>
  );
}

function DeckCard({ postId, isArabic, t, onDone, active }) {
  const { showToast } = useToast();
  const { post, myGuess, vote } = useRealOrAiPost(postId);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(null);
  const [floating, setFloating] = useState(false);

  // Only the VISIBLE card fetches its reveal — otherwise every already-guessed
  // card in the deck would fire a vote callable at once on open.
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
    return <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#fff' }}>{t('loading', 'Loading…')}</div>;
  }

  const decidedInline = Boolean(myGuess) && !floating;

  return (
    <div style={{ height: '100%', position: 'relative', background: '#000', display: 'flex', flexDirection: 'column' }}>
      <GameCardReport ownerId={post.ownerId} ownerName={post.ownerName} onBlocked={onDone} />
      {/* The image — full area, whole image visible (contain). */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
        <img src={post.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      </div>

      {/* Bottom panel: guess buttons OR inline reveal */}
      <div style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', padding: 14, maxHeight: '46%', overflowY: 'auto' }}>
        {decidedInline ? (
          reveal ? <Reveal reveal={reveal} isArabic={isArabic} t={t} />
            : <AppText as="div" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{t('loading', 'Loading…')}</AppText>
        ) : (
          <div>
            <AppText as="div" style={{ fontWeight: 800, textAlign: 'center', marginBottom: 10 }}>{t('roa_guess_prompt', 'Real photo or AI-generated?')}</AppText>
            <div style={{ display: 'flex', gap: 12 }}>
              {[{ g: 'real', icon: FaCamera, label: t('roa_real', 'Real'), color: '#0ea5e9' },
                { g: 'ai', icon: FaRobot, label: t('roa_ai', 'AI'), color: '#a855f7' }].map(({ g, icon: Icon, label, color }) => {
                const sel = selected === g;
                return (
                  <button key={g} type="button" onClick={() => setSelected(g)}
                    style={{ flex: 1, padding: '16px 0', borderRadius: 16, cursor: 'pointer', fontWeight: 800, fontSize: '1.05rem',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      border: `2.5px solid ${sel ? color : 'var(--border-color)'}`, background: sel ? `${color}1e` : 'var(--bg-elevated)', color: 'var(--text-main)' }}>
                    <Icon size={22} color={sel ? color : 'var(--text-muted)'} />
                    {label}
                  </button>
                );
              })}
            </div>
            {selected ? (
              <button type="button" onClick={confirmGuess} disabled={busy}
                style={{ width: '100%', marginTop: 12, padding: '13px 0', borderRadius: 14, fontWeight: 800, cursor: 'pointer', color: '#fff', border: 'none', background: 'linear-gradient(90deg,#0ea5e9,#a855f7)' }}>
                {busy ? t('roa_locking', 'Locking…') : t('roa_lock_cta', 'Lock in my guess')}
              </button>
            ) : (
              <AppText as="div" style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>{t('roa_lock_hint', 'Your guess is final — pick carefully.')}</AppText>
            )}
          </div>
        )}
      </div>

      {/* Fresh guess → floating closable reveal → close = next card */}
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

export default function RealOrAiDeck() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.language || 'ar').startsWith('ar');
  const { posts, loading } = useLiveRealOrAiPosts({ cap: 30 });
  const [searchParams] = useSearchParams();
  const startId = searchParams.get('start');
  const scrollerRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [order, setOrder] = useState([]);

  // Build the deck once; if the rail passed the tapped card (?start=id), show it
  // first so "tap a card → see it → swipe through the rest" holds.
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
        <AppText as="h2" style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, flex: 1 }}>{t('roa_title', 'Real or AI?')}</AppText>
        {order.length > 0 && !atEnd ? <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>{Math.min(index + 1, order.length)}/{order.length}</span> : null}
      </div>

      {order.length === 0 && loading ? (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}><div className="db-spin" /></div>
      ) : order.length === 0 ? (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
          <div>
            <div style={{ fontSize: '2.4rem' }}>🎭</div>
            <AppText as="p" style={{ color: 'var(--text-muted)', marginTop: 8 }}>{t('roa_deck_empty', 'No cards to guess right now.')}</AppText>
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
