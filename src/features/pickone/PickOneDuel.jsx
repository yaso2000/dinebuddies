import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaTimes } from 'react-icons/fa';
import { createDuel, isFinished, pick as enginePick, slots } from './duelEngine';
import { entryName } from './pickoneData';
import './pickone.css';

const OUT_MS = 220;
const IN_MS = 260;

function reducedMotion() {
  try { return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false; } catch { return false; }
}

/** Tiny tick on pick. @capacitor/haptics is not a dependency; navigator.vibrate covers Android. */
function haptic() {
  try { navigator.vibrate?.(12); } catch { /* optional */ }
}

/** One half of the screen: image (or color fallback) + name. Whole area is the tap target. */
function Half({ entry, slot, anim, language, disabled, onPick }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [entry?.id]);
  if (!entry) return <div className={`po-half po-half--${slot}`} aria-hidden />;
  const name = entryName(entry, language);
  const showImage = entry.image && !broken;
  return (
    <button
      type="button"
      className={`po-half po-half--${slot}`}
      data-anim={anim || undefined}
      onClick={() => !disabled && onPick()}
      disabled={disabled}
      aria-label={name}
      style={showImage ? undefined : { background: `linear-gradient(160deg, ${entry.color} 0%, #111 140%)` }}
    >
      {showImage ? (
        <>
          <img className="po-half__img" src={entry.image} alt="" draggable={false} onError={() => setBroken(true)} />
          <div className="po-half__shade" />
          <div className="po-half__name">{name}</div>
        </>
      ) : (
        <div className="po-half__fallback">
          <span className="po-half__initial" aria-hidden>{name.trim().charAt(0)}</span>
          <div className="po-half__fallbackName">{name}</div>
        </div>
      )}
    </button>
  );
}

/**
 * Full-screen duel (portal). Champion keeps its slot; loser slides out, next
 * challenger slides in. Calls onFinish(finalState) after the last pick.
 */
export default function PickOneDuel({ list, seed, onFinish, onExit }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const [state, setState] = useState(() => createDuel(list.entries, { seed }));
  const [anim, setAnim] = useState({ top: null, bottom: null });
  const [busy, setBusy] = useState(false);
  const [askLeave, setAskLeave] = useState(false);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.current.push(id); };

  // Preload the whole list once (cheap: 20 small webp files).
  useEffect(() => {
    list.entries.forEach((e) => { if (e.image) { const im = new Image(); im.src = e.image; } });
  }, [list]);

  const view = useMemo(() => slots(state), [state]);
  const finished = isFinished(state);

  useEffect(() => { if (finished) onFinish?.(state); }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePick = useCallback((slot) => {
    if (busy || finished) return;
    const side = view[slot].side;
    const loserSlot = slot === 'top' ? 'bottom' : 'top';
    setBusy(true);
    haptic();
    const instant = reducedMotion();
    setAnim({ [slot]: instant ? null : 'win', [loserSlot]: instant ? null : `out-${loserSlot}` });
    later(() => {
      setState((s) => enginePick(s, side));
      setAnim({ [slot]: null, [loserSlot]: instant ? null : `in-${loserSlot}` });
      later(() => { setAnim({ top: null, bottom: null }); setBusy(false); }, instant ? 0 : IN_MS);
    }, instant ? 0 : OUT_MS);
  }, [busy, finished, view]);

  // Keyboard: ↑ / ↓ pick, Esc asks to leave.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowUp') handlePick('top');
      else if (e.key === 'ArrowDown') handlePick('bottom');
      else if (e.key === 'Escape') setAskLeave(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlePick]);

  const pct = Math.round((state.history.length / state.total) * 100);

  return createPortal(
    <div className="po-duel" dir={i18n.dir()} role="dialog" aria-modal="true" aria-label={t('pickone.title', 'Pick One')}>
      <div className="po-duel__stage">
        <div className="po-progress" aria-hidden><i style={{ width: `${pct}%` }} /></div>

        <button type="button" className="po-close" onClick={() => setAskLeave(true)} aria-label={t('close', 'Close')}>
          <FaTimes />
        </button>

        <Half entry={view.top.entry} slot="top" anim={anim.top} language={language} disabled={busy || finished} onPick={() => handlePick('top')} />
        <div className="po-vs" aria-live="polite">
          <span>{Math.min(state.round, state.total)}<small>/{state.total}</small></span>
        </div>
        <Half entry={view.bottom.entry} slot="bottom" anim={anim.bottom} language={language} disabled={busy || finished} onPick={() => handlePick('bottom')} />
      </div>

      {askLeave && (
        <div className="po-dialog" onClick={() => setAskLeave(false)}>
          <div className="po-dialog__box" onClick={(e) => e.stopPropagation()} role="alertdialog">
            <div style={{ fontWeight: 900, fontSize: '1.05rem', marginBottom: 6 }}>{t('pickone.leave.title', 'Leave the game?')}</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary, #6b7280)', marginBottom: 16 }}>{t('pickone.leave.body', 'Your progress will be lost.')}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setAskLeave(false)} style={{ flex: 1, padding: '11px 12px', borderRadius: 12, border: '1px solid var(--border-color, #e5e7eb)', background: 'transparent', color: 'var(--text-main)', fontWeight: 800, cursor: 'pointer' }}>
                {t('pickone.leave.stay', 'Keep playing')}
              </button>
              <button type="button" onClick={() => { setAskLeave(false); onExit?.(); }} style={{ flex: 1, padding: '11px 12px', borderRadius: 12, border: 'none', background: 'var(--primary, #ef4444)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                {t('pickone.leave.leave', 'Leave')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
