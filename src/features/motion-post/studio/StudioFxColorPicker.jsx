import React, { useCallback, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { FaPalette } from 'react-icons/fa';
import { STUDIO_FX_COLORS } from './studioConstants';

/** @param {string} color */import { AppText } from "../../../components/base";
export function toColorInputHex(color) {
  const s = String(color || '#000000').trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    const [, r, g, b] = s;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return '#000000';
}

/**
 * Color chip — opens floating native picker (drag on the gradient square).
 * @param {{ color: string; onChange: (hex: string) => void; open: boolean; onOpen: () => void; onClose: () => void; label: string; presets?: string[] }} props
 */
export default function StudioFxColorPicker({
  color,
  onChange,
  open,
  onOpen,
  onClose,
  label,
  presets = STUDIO_FX_COLORS
}) {
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const popoverRef = useRef(null);
  const titleId = useId();
  const hex = toColorInputHex(color);

  const positionPopover = useCallback(() => {
    const btn = btnRef.current;
    const pop = popoverRef.current;
    if (!btn || !pop) return;

    const margin = 10;
    const gap = 8;
    const btnRect = btn.getBoundingClientRect();
    const popW = pop.offsetWidth || 220;
    const popH = pop.offsetHeight || 200;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = btnRect.top - popH - gap;
    if (top < margin) {
      top = btnRect.bottom + gap;
    }
    top = Math.max(margin, Math.min(top, vh - popH - margin));

    let left = btnRect.left + btnRect.width / 2 - popW / 2;
    left = Math.max(margin, Math.min(left, vw - popW - margin));

    pop.style.position = 'fixed';
    pop.style.top = `${Math.round(top)}px`;
    pop.style.left = `${Math.round(left)}px`;
    pop.style.right = 'auto';
    pop.style.bottom = 'auto';
    pop.style.transform = 'none';
    pop.style.insetInlineStart = 'auto';
    pop.style.insetInlineEnd = 'auto';
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    positionPopover();
    const onReflow = () => positionPopover();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, positionPopover]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const apply = (next) => {
    onChange(toColorInputHex(next));
  };

  return (
    <div className="sps-fx-color-picker" ref={wrapRef}>
            <button
        ref={btnRef}
        type="button"
        className="sps-fx-color-btn"
        onClick={() => open ? onClose() : onOpen()}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={label}>

                <AppText as="span" className="sps-fx-color-btn__dot" style={{ background: hex }} aria-hidden />
                <FaPalette size={12} aria-hidden />
            </button>
            {open ?
      <div
        ref={popoverRef}
        className="sps-fx-color-popover sps-fx-color-popover--viewport"
        role="dialog"
        aria-labelledby={titleId}>

                    <AppText as="p" id={titleId} className="sps-fx-color-popover__title">
                        {label}
                    </AppText>
                    <label className="sps-fx-color-popover__surface">
                        <input
            type="color"
            className="sps-fx-color-popover__input"
            value={hex}
            onChange={(e) => apply(e.target.value)}
            aria-label={label} />

                    </label>
                    <div className="sps-fx-color-popover__presets" role="list">
                        {presets.map((c) =>
          <button
            key={c}
            type="button"
            role="listitem"
            className={`sps-fx-color-preset${hex === c ? ' active' : ''}`}
            style={{ background: c }}
            onClick={() => apply(c)}
            aria-label={c}
            aria-pressed={hex === c} />

          )}
                    </div>
                </div> :
      null}
        </div>);

}