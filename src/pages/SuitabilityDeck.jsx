import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft, FaCheck, FaCrown, FaTimes } from 'react-icons/fa';
import { useLiveSuitabilityPosts } from '../hooks/useLiveSuitabilityPosts';
import { useSuitabilityPost } from '../hooks/useSuitabilityPost';
import { useToast } from '../context/ToastContext';
import { AppText } from '../components/base';
import { SUITABILITY_ARCHETYPES } from '../constants/suitabilityArchetypes';
import { getTrait } from '../constants/personalityTraits';
import '../styles/gameUI.css';

/** Ranked tally for a post's votes. */
function rankTally(tally) {
  const total = SUITABILITY_ARCHETYPES.reduce((s, a) => s + (Number(tally?.[a.id]) || 0), 0);
  const rows = SUITABILITY_ARCHETYPES.map((a) => {
    const n = Number(tally?.[a.id]) || 0;
    return { ...a, n, pct: total ? Math.round((100 * n) / total) : 0 };
  }).sort((x, y) => y.n - x.n);
  return { rows, total };
}

/** Results view — the ranked bars + a crowned top type. */
function ResultsView({ post, isArabic, t, compact = false }) {
  const { rows, total } = useMemo(() => rankTally(post?.tally), [post?.tally]);
  const top = rows[0];
  return (
    <div>
      {total && top ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, background: `${top.color}14`, border: `1.5px solid ${top.color}55`, marginBottom: 12 }}>
          <span style={{ fontSize: '1.7rem' }} aria-hidden>{top.emoji}</span>
          <div style={{ flex: 1 }}>
            <AppText as="div" style={{ fontWeight: 900, fontSize: '1.02rem', color: top.color }} format={false}>{isArabic ? top.ar : top.en}</AppText>
            <AppText as="div" style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }} format={false}>{isArabic ? top.descAr : top.descEn}</AppText>
          </div>
          <span style={{ fontWeight: 900, fontSize: '1.05rem', color: top.color }}>{top.pct}%</span>
          <FaCrown color={top.color} />
        </div>
      ) : (
        <AppText as="p" style={{ color: 'var(--text-muted)', textAlign: 'center', margin: '4px 0 12px' }}>
          {t('suitability_owner_waiting', 'No votes yet — share your card!')}
        </AppText>
      )}
      {!compact && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {rows.map((r) => (
            <div key={r.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 2 }}>
                <AppText as="span" style={{ fontWeight: 700 }} format={false}>{r.emoji} {isArabic ? r.ar : r.en}</AppText>
                <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{r.pct}%</span>
              </div>
              <div style={{ height: 7, borderRadius: 999, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${r.pct}%`, background: r.color, borderRadius: 999, transition: 'width .3s' }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <AppText as="div" style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
        {t('suitability_total_votes', { defaultValue: '{{n}} votes', n: total })}
      </AppText>
    </div>
  );
}

/** One deck card — full-width square photo with name+bio overlaid, options or results below. */
function DeckCard({ postId, isArabic, t, onDone }) {
  const { showToast } = useToast();
  const { post, myVote, isOwner, vote } = useSuitabilityPost(postId);
  const [selected, setSelected] = useState(null); // archetype tapped, pre-confirm
  const [busy, setBusy] = useState(false);
  const [floatingResults, setFloatingResults] = useState(false); // shown right after a fresh vote

  // Already decided for this card: the owner, or a viewer who already locked a vote.
  const decided = Boolean(isOwner || myVote);

  const confirmVote = useCallback(async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await vote(selected);
      setFloatingResults(true); // fresh results as a floating, closable box
    } catch (e) {
      showToast(e?.message || t('suitability_vote_error', 'Could not record your vote.'), 'error');
    } finally {
      setBusy(false);
    }
  }, [selected, busy, vote, showToast, t]);

  if (!post) {
    return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>
        {t('loading', 'Loading…')}
      </div>
    );
  }

  const avatar = typeof post.ownerAvatar === 'string' && post.ownerAvatar.startsWith('http') ? post.ownerAvatar : '';

  return (
    <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ maxWidth: 460, margin: '0 auto', padding: 12 }}>
        {/* Full-width SQUARE photo with name + bio overlaid at the bottom */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', borderRadius: 18, overflow: 'hidden', background: '#7c3aed' }}>
          {avatar
            ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 64 }}>{(post.ownerName || '?').charAt(0)}</div>}
          <div style={{ position: 'absolute', insetInlineStart: 0, insetInlineEnd: 0, bottom: 0, padding: '28px 16px 14px', background: 'linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0.35) 55%, transparent)' }}>
            <AppText as="div" style={{ color: '#fff', fontWeight: 800, fontSize: '1.3rem', textShadow: '0 1px 6px rgba(0,0,0,0.5)' }} format={false}>{post.ownerName || t('suitability_someone', 'Someone')}</AppText>
            {Array.isArray(post.traits) && post.traits.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>
                {post.traits.map((id) => {
                  const tr = getTrait(id);
                  if (!tr) return null;
                  return (
                    <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, fontSize: '0.82rem', fontWeight: 700, background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.28)', color: '#fff' }}>
                      <span aria-hidden>{tr.emoji}</span>{isArabic ? tr.ar : tr.en}
                    </span>
                  );
                })}
              </div>
            ) : (post.about ? <AppText as="p" style={{ color: 'rgba(255,255,255,0.94)', fontSize: '0.9rem', marginTop: 4, lineHeight: 1.5, textShadow: '0 1px 6px rgba(0,0,0,0.55)' }} format={false}>{post.about}</AppText> : null)}
          </div>
        </div>

        {/* Below the photo: results (if already decided) OR the voting options */}
        <div style={{ marginTop: 14 }}>
          {decided ? (
            <div className="gg-card" style={{ padding: 16 }}>
              <AppText as="div" style={{ fontWeight: 800, marginBottom: 8 }}>
                {isOwner ? t('suitability_results_title', 'Results so far') : t('suitability_your_locked_vote', 'You already voted — results:')}
              </AppText>
              <ResultsView post={post} isArabic={isArabic} t={t} />
            </div>
          ) : (
            <div>
              <AppText as="div" style={{ fontWeight: 800, textAlign: 'center', marginBottom: 2 }}>{t('suitability_pick_prompt', 'Which partner type suits them best?')}</AppText>
              <AppText as="div" style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: 12 }}>{t('suitability_pick_hint', 'Pick the one that fits their vibe.')}</AppText>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {SUITABILITY_ARCHETYPES.map((a) => {
                  const sel = selected === a.id;
                  return (
                    <button key={a.id} type="button" onClick={() => setSelected(a.id)}
                      style={{ position: 'relative', textAlign: 'start', padding: 12, borderRadius: 14, cursor: 'pointer',
                        border: `2px solid ${sel ? a.color : 'var(--border-color)'}`, background: sel ? `${a.color}14` : 'var(--bg-card)', color: 'var(--text-main)' }}>
                      <div style={{ fontSize: '1.4rem', marginBottom: 4 }} aria-hidden>{a.emoji}</div>
                      <AppText as="div" style={{ fontWeight: 800, fontSize: '0.9rem' }} format={false}>{isArabic ? a.ar : a.en}</AppText>
                      {sel ? <span style={{ position: 'absolute', top: 8, insetInlineEnd: 8, width: 22, height: 22, borderRadius: '50%', background: a.color, color: '#fff', display: 'grid', placeItems: 'center' }}><FaCheck size={11} /></span> : null}
                    </button>
                  );
                })}
              </div>

              {/* Confirm-lock bar: appears once a type is selected */}
              {selected ? (
                <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
                  <AppText as="div" style={{ fontWeight: 700, textAlign: 'center', marginBottom: 4 }}>{t('suitability_lock_prompt', 'Lock in your answer?')}</AppText>
                  <AppText as="div" style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: 10 }}>{t('suitability_lock_hint', 'Your vote is final and cannot be changed.')}</AppText>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" onClick={() => setSelected(null)} disabled={busy}
                      style={{ flex: 1, padding: '11px 0', borderRadius: 12, fontWeight: 700, cursor: 'pointer', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                      {t('cancel', 'Cancel')}
                    </button>
                    <button type="button" onClick={confirmVote} disabled={busy}
                      style={{ flex: 1, padding: '11px 0', borderRadius: 12, fontWeight: 800, cursor: 'pointer', color: '#fff', border: 'none', background: 'linear-gradient(90deg,#7c3aed,#22d3ee)' }}>
                      {busy ? t('suitability_locking', 'Locking…') : t('suitability_lock_cta', 'Lock it in')}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Floating, closable results box shown right after a fresh vote → close = next card */}
      {floatingResults ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.55)', display: 'grid', placeItems: 'center', padding: 18 }}
          onClick={() => { setFloatingResults(false); onDone?.(); }}>
          <div className="gg-card" style={{ width: '100%', maxWidth: 420, padding: 18, position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button type="button" aria-label={t('close', 'Close')} onClick={() => { setFloatingResults(false); onDone?.(); }}
              style={{ position: 'absolute', top: 10, insetInlineEnd: 10, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--bg-elevated)', color: 'var(--text-main)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
              <FaTimes />
            </button>
            <AppText as="div" style={{ fontWeight: 900, fontSize: '1.05rem', marginBottom: 4 }}>✓ {t('suitability_vote_saved', 'Your pick is saved.')}</AppText>
            <AppText as="div" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>{t('suitability_results_title', 'Results so far')}</AppText>
            <ResultsView post={post} isArabic={isArabic} t={t} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function SuitabilityDeck() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.language || 'ar').startsWith('ar');
  const { posts } = useLiveSuitabilityPosts({ cap: 30 });
  const [searchParams] = useSearchParams();
  const startId = searchParams.get('start');
  const scrollerRef = useRef(null);
  const [index, setIndex] = useState(0);

  // Freeze the deck order on first load so live updates don't reshuffle mid-browse.
  // If the rail passed the tapped card (?start=id), show it first.
  const [order, setOrder] = useState([]);
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
    const next = fromIdx + 1;
    if (next >= order.length) {
      scrollToIndex(order.length); // the trailing "end" slide
    } else {
      scrollToIndex(next);
    }
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
        <AppText as="h2" style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, flex: 1 }}>{t('suitability_title', 'Who suits you?')}</AppText>
        {order.length > 0 && !atEnd ? <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>{Math.min(index + 1, order.length)}/{order.length}</span> : null}
      </div>

      {order.length === 0 ? (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
          <div>
            <div style={{ fontSize: '2.4rem' }}>🧭</div>
            <AppText as="p" style={{ color: 'var(--text-muted)', marginTop: 8 }}>{t('suitability_deck_empty', 'No cards to browse right now.')}</AppText>
            <button className="gg-btn gg-btn--primary" style={{ marginTop: 14 }} onClick={goHome}>{t('back_home', 'Back home')}</button>
          </div>
        </div>
      ) : (
        <div
          ref={scrollerRef}
          dir="ltr"
          onScroll={onScroll}
          style={{ flex: 1, display: 'flex', overflowX: 'auto', overflowY: 'hidden', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
          {order.map((id, i) => (
            <div key={id} style={{ flex: '0 0 100%', width: '100%', height: '100%', scrollSnapAlign: 'center', overflow: 'hidden' }}>
              <DeckCard postId={id} isArabic={isArabic} t={t} onDone={() => advance(i)} />
            </div>
          ))}
          {/* Trailing end slide */}
          <div style={{ flex: '0 0 100%', width: '100%', height: '100%', scrollSnapAlign: 'center', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '2.6rem' }}>🎉</div>
              <AppText as="h3" style={{ fontWeight: 800, marginTop: 10 }}>{t('suitability_deck_done_title', 'That’s all the cards!')}</AppText>
              <AppText as="p" style={{ color: 'var(--text-muted)', marginTop: 6, maxWidth: 320 }}>{t('suitability_deck_done_body', 'You’ve been through every card. Back to your feed.')}</AppText>
              <button className="gg-btn gg-btn--primary" style={{ marginTop: 16 }} onClick={goHome}>{t('suitability_go_feed', 'Go to feed')}</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
