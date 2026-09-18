import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaImages, FaPenAlt } from 'react-icons/fa';

/**
 * Single "AI" header entry that opens a menu of AI tools. Replaces the separate
 * image/text header buttons; built to grow as more agents are added later.
 *
 * @param {boolean} isBusinessAccount  hide user-only tools (personal assistant)
 * @param {boolean} active             highlight when on an AI route
 */
export default function AiStudioMenu({ isBusinessAccount = false, active = false }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const btnRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const width = 240;
    let left = r.right - width; // right-align the menu to the button
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    setPos({ top: r.bottom + 8, left, width });
  }, [open]);

  const items = [
    { key: 'image', icon: <FaImages />, color: '#8b5cf6', label: t('ai_image_nav', 'AI Images'), desc: t('ai_image_desc', 'تصميم صور بالذكاء الصناعي'), to: '/ai-design-studio' },
    ...(!isBusinessAccount
      ? [{ key: 'text', icon: <FaPenAlt />, color: '#ef4444', label: t('ai_text_nav', 'Personal assistant'), desc: t('ai_text_desc', 'نصائح ومحادثة بالذكاء الصناعي'), to: '/ai-text-studio' }]
      : []),
  ];

  const goTo = (to) => { setOpen(false); navigate(to); };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`notification-bell header-ai-studio-btn${active ? ' active' : ''}`}
        title="AI"
        aria-label="AI"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ fontWeight: 900, fontSize: '0.95rem', letterSpacing: '0.02em' }}
      >
        AI
      </button>

      {open && createPortal(
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2147483000 }}
        >
          {pos ? (
            <div
              onClick={(e) => e.stopPropagation()}
              dir={i18n.dir()}
              role="menu"
              style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, background: 'var(--bg-card, #fff)', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.24)', border: '1px solid var(--border-color, #e5e7eb)', overflow: 'hidden', padding: 6 }}
            >
              {items.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  role="menuitem"
                  onClick={() => goTo(it.to)}
                  dir={i18n.dir()}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'start', padding: '11px 12px', borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: `${it.color}1a`, color: it.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{it.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 800, color: 'var(--text-main)' }}>{it.label}</span>
                    <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{it.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>,
        document.body,
      )}
    </>
  );
}
