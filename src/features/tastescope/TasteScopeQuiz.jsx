import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft } from 'react-icons/fa';
import { AXES } from './tastescopeData';

/** Fisher–Yates shuffle (returns a new array). */
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * One tappable image card. Hoisted to module scope so the <img> is not
 * re-created on every quiz render. The image is shown WHOLE (object-fit:
 * contain) — never cropped — and carries no visible caption; the photo is the
 * question. The pole name stays as an accessible label only.
 */
function PoleCard({ pole, src, label, selected, onPick }) {
  return (
    <button
      type="button"
      onClick={() => onPick(pole)}
      aria-label={label}
      style={{
        display: 'block', width: '100%', flex: 1, minHeight: 0,
        border: selected ? '3px solid var(--primary, #ef4444)' : '3px solid var(--border-color, #e5e7eb)',
        borderRadius: 18, overflow: 'hidden', padding: 0, cursor: 'pointer', background: 'var(--bg-body, #f7f7f7)',
      }}
    >
      <img src={src} alt={label} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
    </button>
  );
}

/** Small phone glyph that tips portrait → landscape (for the rotate nudge). */
function RotatePhoneIcon() {
  return (
    <svg width="46" height="46" viewBox="0 0 24 24" fill="none" style={{ animation: 'tsTiltPhone 1.5s ease-in-out infinite' }}>
      <rect x="8" y="2.5" width="8" height="19" rx="2" stroke="#fff" strokeWidth="1.7" />
      <line x1="10.6" y1="18.8" x2="13.4" y2="18.8" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/**
 * TasteScope quiz: 10 image-pair rounds. Tap = answer (no confirm). Round order
 * and left/right position are randomized once per session to average out bias.
 * Answers are stored as { axisId: poleId }. See TASTESCOPE_SPEC.md §2, §7.
 */
export default function TasteScopeQuiz({ onComplete, onExit }) {
  const { t, i18n } = useTranslation();
  const rtl = i18n.dir() === 'rtl';

  // Fix the round order and per-round pole orientation for the whole session.
  const rounds = useMemo(() => shuffled(AXES).map((axis) => ({
    axis,
    poles: Math.random() < 0.5 ? axis.poles : [axis.poles[1], axis.poles[0]],
  })), []);

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});

  // Track orientation so the rotate nudge only shows in portrait.
  const [isPortrait, setIsPortrait] = useState(() => {
    try { return window.matchMedia('(orientation: portrait)').matches; } catch { return true; }
  });
  useEffect(() => {
    let mq;
    try {
      mq = window.matchMedia('(orientation: portrait)');
      const onChange = (e) => setIsPortrait(e.matches);
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else mq.addListener(onChange);
      return () => {
        if (mq.removeEventListener) mq.removeEventListener('change', onChange);
        else mq.removeListener(onChange);
      };
    } catch { return undefined; }
  }, []);

  // Brief centered "rotate your phone" nudge: appears on entry (portrait only)
  // for ~2s, then fades out on its own. Purely a hint — never blocks the quiz.
  const [showRotate, setShowRotate] = useState(false);
  useEffect(() => {
    if (!isPortrait) { setShowRotate(false); return undefined; }
    setShowRotate(true);
    const timer = setTimeout(() => setShowRotate(false), 2200);
    return () => clearTimeout(timer);
  }, [isPortrait]);

  const round = rounds[index];
  const total = rounds.length;

  const pick = (pole) => {
    const next = { ...answers, [round.axis.id]: pole };
    setAnswers(next);
    if (index + 1 >= total) onComplete(next);
    else setIndex(index + 1);
  };

  const goBack = () => {
    if (index === 0) { onExit?.(); return; }
    setIndex(index - 1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxWidth: 720, margin: '0 auto', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes tsTiltPhone { 0%,12% { transform: rotate(0deg); } 45%,60% { transform: rotate(-90deg); } 92%,100% { transform: rotate(0deg); } }
        @keyframes tsNudgeFade { 0% { opacity: 0; } 12% { opacity: 1; } 75% { opacity: 1; } 100% { opacity: 0; } }
      `}</style>

      {/* Header: back + progress dots + counter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(12px + env(safe-area-inset-top, 0px)) 16px 8px' }}>
        <button type="button" onClick={goBack} aria-label={t('back', 'رجوع')} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1.2rem', cursor: 'pointer', padding: 4 }}>
          <FaChevronLeft style={{ transform: rtl ? 'scaleX(-1)' : 'none' }} />
        </button>
        <div style={{ display: 'flex', gap: 6, flex: 1, justifyContent: 'center' }}>
          {rounds.map((r, i) => (
            <span key={r.axis.id} style={{ width: i === index ? 20 : 7, height: 7, borderRadius: 999, background: i <= index ? 'var(--primary, #ef4444)' : 'var(--border-color, #e5e7eb)', transition: 'width 120ms ease' }} />
          ))}
        </div>
        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-secondary, #6b7280)', minWidth: 42, textAlign: 'center' }}>
          {t('tastescope.round.progress', { n: index + 1, defaultValue: `${index + 1} / ${total}` })}
        </span>
      </div>

      {/* Prompt */}
      <div style={{ textAlign: 'center', fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', padding: '2px 16px 8px' }}>
        {t('tastescope.round.tapPrompt', 'اضغط ما تشتهيه')}
      </div>

      {/* Two whole images, side by side */}
      <div style={{ display: 'flex', flexDirection: 'row', gap: 12, flex: 1, minHeight: 0, padding: '2px 16px 8px' }}>
        {round.poles.map((pole) => (
          <PoleCard
            key={pole}
            pole={pole}
            src={round.axis.image[pole]}
            label={t(`tastescope.pole.${pole}`, pole)}
            selected={answers[round.axis.id] === pole}
            onPick={pick}
          />
        ))}
      </div>

      {/* Footer reassurance */}
      <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-tertiary, #9ca3af)', padding: '0 16px calc(14px + env(safe-area-inset-bottom, 0px))' }}>
        {t('tastescope.round.noWrong', 'لا توجد إجابة خاطئة')}
      </div>

      {/* Centered rotate nudge — shows ~2s on entry (portrait), then fades away */}
      {showRotate && isPortrait && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 60 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '18px 22px', borderRadius: 18, background: 'rgba(0,0,0,0.72)', animation: 'tsNudgeFade 2.2s ease forwards' }}>
            <RotatePhoneIcon />
            <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 700 }}>
              {t('tastescope.round.rotateHint', 'أدِر جهازك أفقيًا لعرض أكبر')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
