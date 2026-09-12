import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft, FaExpand, FaCompress } from 'react-icons/fa';
import { AXES } from './tastescopeData';
import { getRuntime } from '../../platform/runtime';

/** Native (Capacitor) orientation lock — reliable on Android/iOS even when the
 *  device auto-rotate is off; loaded lazily so it never touches the web bundle. */
async function nativeOrientation() {
  try {
    const { ScreenOrientation } = await import('@capacitor/screen-orientation');
    return ScreenOrientation;
  } catch {
    return null;
  }
}

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
        flex: '1 1 0', minWidth: 0, height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
      }}
    >
      {/* Square source image, shown whole (no frame). Centered both axes; sized
          to fit its half — grows in landscape. Selection = a subtle ring only. */}
      <img
        src={src}
        alt={label}
        style={{
          maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto',
          objectFit: 'contain', display: 'block', borderRadius: 16,
          boxShadow: selected ? '0 0 0 3px var(--primary, #ef4444)' : 'none',
        }}
      />
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
    const timer = setTimeout(() => setShowRotate(false), 3000);
    return () => clearTimeout(timer);
  }, [isPortrait]);

  // Force landscape on demand (works even when the device's auto-rotate is off):
  // fullscreen the quiz, then lock the screen orientation to landscape. On
  // platforms that don't support it (e.g. iOS Safari) it silently no-ops and
  // physical rotation still works.
  const rootRef = useRef(null);
  const [forcedLandscape, setForcedLandscape] = useState(false);
  const isNative = typeof window !== 'undefined' && getRuntime().isNative;
  const canForceLandscape =
    isNative ||
    (typeof window !== 'undefined' &&
      (window.screen?.orientation?.lock || document.documentElement.requestFullscreen));

  const toggleLandscape = async () => {
    try {
      if (!forcedLandscape) {
        if (isNative) {
          // Native lock rotates the whole activity — no fullscreen needed, and
          // it works even when the device's auto-rotate switch is off.
          const SO = await nativeOrientation();
          if (SO) await SO.lock({ orientation: 'landscape' });
        } else {
          const el = rootRef.current || document.documentElement;
          if (el.requestFullscreen) await el.requestFullscreen();
          if (window.screen?.orientation?.lock) await window.screen.orientation.lock('landscape');
        }
        setForcedLandscape(true);
      } else {
        if (isNative) {
          const SO = await nativeOrientation();
          if (SO) await SO.unlock();
        } else {
          try { window.screen?.orientation?.unlock?.(); } catch { /* ignore */ }
          if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
        }
        setForcedLandscape(false);
      }
    } catch {
      // Unsupported (older iOS Safari, desktop) — physical rotation is the fallback.
      setForcedLandscape(false);
    }
  };

  // Release the lock / fullscreen when leaving the quiz (always restore portrait).
  useEffect(() => () => {
    if (isNative) {
      nativeOrientation().then((SO) => { try { SO?.unlock?.(); } catch { /* ignore */ } });
    } else {
      try { window.screen?.orientation?.unlock?.(); } catch { /* ignore */ }
      try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); } catch { /* ignore */ }
    }
  }, [isNative]);

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

  return createPortal(
    <div ref={rootRef} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'var(--bg-body)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes tsTiltPhone { 0%,12% { transform: rotate(0deg); } 45%,60% { transform: rotate(-90deg); } 92%,100% { transform: rotate(0deg); } }
        @keyframes tsNudgeFade { 0% { opacity: 0; } 8% { opacity: 1; } 85% { opacity: 1; } 100% { opacity: 0; } }
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
        {canForceLandscape && (
          <button
            type="button"
            onClick={toggleLandscape}
            aria-label={t('tastescope.round.landscape', 'عرض أفقي أكبر')}
            title={t('tastescope.round.landscape', 'عرض أفقي أكبر')}
            style={{ background: 'transparent', border: 'none', color: 'var(--primary, #ef4444)', fontSize: '1.05rem', cursor: 'pointer', padding: 4 }}
          >
            {forcedLandscape ? <FaCompress /> : <FaExpand />}
          </button>
        )}
      </div>

      {/* Prompt (hidden in landscape to give images the full height) */}
      {isPortrait && (
        <div style={{ textAlign: 'center', fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', padding: '2px 16px 8px' }}>
          {t('tastescope.round.tapPrompt', 'اضغط ما تشتهيه')}
        </div>
      )}

      {/* Two whole square images, side by side, centered — no frame */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, flex: 1, minHeight: 0, padding: '2px 16px 8px' }}>
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

      {/* Footer reassurance (hidden in landscape) */}
      {isPortrait && (
        <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-tertiary, #9ca3af)', padding: '0 16px calc(14px + env(safe-area-inset-bottom, 0px))' }}>
          {t('tastescope.round.noWrong', 'لا توجد إجابة خاطئة')}
        </div>
      )}

      {/* Centered rotate nudge — shows ~2s on entry (portrait), then fades away */}
      {showRotate && isPortrait && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 60 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '18px 22px', borderRadius: 18, background: 'rgba(0,0,0,0.72)', animation: 'tsNudgeFade 3s ease forwards' }}>
            <RotatePhoneIcon />
            <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 700 }}>
              {t('tastescope.round.rotateHint', 'أدِر جهازك أفقيًا لعرض أكبر')}
            </span>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
