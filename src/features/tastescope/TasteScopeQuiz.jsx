import React, { useMemo, useState } from 'react';
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
 * re-created on every quiz render (which would re-trigger a network/decode).
 */
function PoleCard({ pole, src, label, selected, onPick }) {
  return (
    <button
      type="button"
      onClick={() => onPick(pole)}
      aria-label={label}
      style={{
        position: 'relative', display: 'block', width: '100%', flex: 1, minHeight: 0,
        border: selected ? '3px solid var(--primary, #ef4444)' : '3px solid transparent',
        borderRadius: 18, overflow: 'hidden', padding: 0, cursor: 'pointer', background: 'var(--bg-card, #f3f4f6)',
      }}
    >
      <img src={src} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      <span style={{ position: 'absolute', insetInlineStart: 10, bottom: 10, padding: '4px 10px', borderRadius: 999, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '0.8rem', fontWeight: 700 }}>
        {label}
      </span>
    </button>
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

  const round = rounds[index];
  const total = rounds.length;

  const pick = (pole) => {
    const next = { ...answers, [round.axis.id]: pole };
    setAnswers(next);
    if (index + 1 >= total) {
      onComplete(next);
    } else {
      setIndex(index + 1);
    }
  };

  const goBack = () => {
    if (index === 0) { onExit?.(); return; }
    setIndex(index - 1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxWidth: 520, margin: '0 auto' }}>
      {/* Header: back + progress dots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(12px + env(safe-area-inset-top, 0px)) 16px 10px' }}>
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

      {/* Two images side by side — better for free, unbiased choice. */}
      <div style={{ display: 'flex', flexDirection: 'row', gap: 12, flex: 1, minHeight: 0, padding: '4px 16px calc(20px + env(safe-area-inset-bottom, 0px))' }}>
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
    </div>
  );
}
