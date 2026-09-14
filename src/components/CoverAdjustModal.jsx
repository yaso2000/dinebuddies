import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaSearchPlus } from 'react-icons/fa';

const clamp01 = (v) => Math.max(0, Math.min(100, v));

/**
 * Floating cover editor: drag the image (finger/mouse) to pan it inside the
 * frame, plus a zoom slider. Panning uses object-position (0–100%), so whenever
 * the image is larger than the frame in ANY direction — e.g. a tall image in a
 * wide 16:9 frame — dragging works WITHOUT needing to zoom first. Zoom adds
 * extra overflow in both directions. Values (posX, posY, zoom) are applied
 * wherever the cover shows. Reused by the consumer + business covers.
 *
 * @param {{ imageUrl:string, aspect?:string, initial?:{x,y,zoom},
 *   onSave:(v:{x,y,zoom})=>Promise|void, onClose:()=>void }} props
 */
export default function CoverAdjustModal({ imageUrl, aspect = '16 / 9', initial, onSave, onClose }) {
  const { t, i18n } = useTranslation();
  const [x, setX] = useState(Number.isFinite(Number(initial?.x)) ? clamp01(Number(initial.x)) : 50);
  const [y, setY] = useState(Number.isFinite(Number(initial?.y)) ? clamp01(Number(initial.y)) : 50);
  const [zoom, setZoom] = useState(Number(initial?.zoom) || 1);
  const [saving, setSaving] = useState(false);
  const frameRef = useRef(null);
  const drag = useRef(null);

  const point = (e) => (e.touches && e.touches[0]) || e;
  const onDown = (e) => { const p = point(e); drag.current = { sx: p.clientX, sy: p.clientY, x, y }; };
  const onMove = (e) => {
    if (!drag.current) return;
    const p = point(e);
    const w = frameRef.current?.offsetWidth || 300;
    const h = frameRef.current?.offsetHeight || 169;
    // Drag right reveals the left of the image → object-position X decreases.
    const dx = ((p.clientX - drag.current.sx) / w) * 100;
    const dy = ((p.clientY - drag.current.sy) / h) * 100;
    setX(clamp01(drag.current.x - dx));
    setY(clamp01(drag.current.y - dy));
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
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2147483000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'max(16px, env(safe-area-inset-top,0px)) 16px max(16px, env(safe-area-inset-bottom,0px))' }}
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
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${x}% ${y}%`, transform: `scale(${zoom})`, transformOrigin: `${x}% ${y}%`, userSelect: 'none', pointerEvents: 'none', display: 'block' }}
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
