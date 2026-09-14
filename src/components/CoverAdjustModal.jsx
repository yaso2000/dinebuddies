import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaSearchPlus } from 'react-icons/fa';

/**
 * Floating cover editor: drag the image with a finger/mouse to pan (left/right/
 * up/down when zoomed) plus a zoom slider. Renders in a portal above everything
 * so nothing (avatars, bars) hides it. Values are stored as a translate percent
 * of the frame (x, y) + a scale (zoom); the same transform is applied wherever
 * the cover is shown. Reused by the consumer and business profile covers.
 *
 * @param {{ imageUrl:string, aspect?:string, initial?:{x,y,zoom},
 *   onSave:(v:{x,y,zoom})=>Promise|void, onClose:()=>void }} props
 */
export default function CoverAdjustModal({ imageUrl, aspect = '16 / 9', initial, onSave, onClose }) {
  const { t, i18n } = useTranslation();
  const [x, setX] = useState(Number(initial?.x) || 0);
  const [y, setY] = useState(Number(initial?.y) || 0);
  const [zoom, setZoom] = useState(Number(initial?.zoom) || 1);
  const [saving, setSaving] = useState(false);
  const frameRef = useRef(null);
  const drag = useRef(null);

  // Pannable range so the frame never shows a gap: ±(zoom-1)*50 % of the frame.
  const limit = Math.max(0, (zoom - 1) * 50);
  const clamp = useCallback((v) => Math.max(-limit, Math.min(limit, v)), [limit]);

  useEffect(() => { setX((v) => clamp(v)); setY((v) => clamp(v)); }, [zoom, clamp]);

  const point = (e) => (e.touches && e.touches[0]) || e;
  const onDown = (e) => { const p = point(e); drag.current = { sx: p.clientX, sy: p.clientY, x, y }; };
  const onMove = (e) => {
    if (!drag.current) return;
    const p = point(e);
    const w = frameRef.current?.offsetWidth || 300;
    const h = frameRef.current?.offsetHeight || 169;
    const dx = ((p.clientX - drag.current.sx) / w) * 100;
    const dy = ((p.clientY - drag.current.sy) / h) * 100;
    setX(clamp(drag.current.x + dx));
    setY(clamp(drag.current.y + dy));
    if (e.cancelable) e.preventDefault();
  };
  const onUp = () => { drag.current = null; };

  const save = async () => {
    setSaving(true);
    try { await onSave({ x, y, zoom }); } finally { setSaving(false); }
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        dir={i18n.dir()}
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 460, background: 'var(--bg-card, #fff)', borderRadius: 18, padding: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}
      >
        <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-main)', margin: '0 0 4px' }}>
          {t('adjust_cover', 'ضبط الغلاف')}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary,#6b7280)', margin: '0 0 12px' }}>
          {t('cover_drag_hint', 'اسحب الصورة لتحريكها، وكبّرها بالشريط')}
        </div>

        <div
          ref={frameRef}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          onTouchStart={onDown}
          onTouchMove={onMove}
          onTouchEnd={onUp}
          style={{ position: 'relative', width: '100%', aspectRatio: aspect, borderRadius: 12, overflow: 'hidden', background: 'var(--bg-body,#f3f4f6)', cursor: 'grab', touchAction: 'none' }}
        >
          <img
            src={imageUrl}
            alt=""
            draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `translate(${x}%, ${y}%) scale(${zoom})`, userSelect: 'none', pointerEvents: 'none', display: 'block' }}
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 700, margin: '14px 0 4px' }}>
          <FaSearchPlus aria-hidden />
          <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1 }} />
        </label>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '11px 12px', borderRadius: 12, border: '1px solid var(--border-color,#e5e7eb)', background: 'transparent', color: 'var(--text-main)', fontWeight: 800, cursor: 'pointer' }}>
            {t('cancel', 'إلغاء')}
          </button>
          <button type="button" onClick={save} disabled={saving} style={{ flex: 1, padding: '11px 12px', borderRadius: 12, border: 'none', background: 'var(--primary,#ef4444)', color: '#fff', fontWeight: 800, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? t('uploading', 'Saving…') : t('save', 'حفظ')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
