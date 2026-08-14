import React from 'react';
import { useTranslation } from 'react-i18next';

export default function BusinessProfileCardPreviewOverlay({ profile }) {
  const { t } = useTranslation();
  const { headerCardPreviewUrl, closeHeaderPreview, handleShareFromOverlay } = profile;

  if (!headerCardPreviewUrl) return null;

  return (
    <div onClick={closeHeaderPreview} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#1e1e2e', borderRadius: 20, padding: 20, maxWidth: 380, width: '100%', position: 'relative', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
                <button onClick={closeHeaderPreview} style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.15)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                <img src={headerCardPreviewUrl} alt="Business Card" style={{ width: '100%', borderRadius: 12, display: 'block', marginBottom: 14 }} />
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={handleShareFromOverlay} style={{ flex: 1, padding: '13px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>📤 {t('share_image', 'Share Image')}</button>
                    <a href={headerCardPreviewUrl} download="business-card.png" style={{ padding: '13px 16px', borderRadius: 12, textDecoration: 'none', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⬇</a>
                </div>
            </div>
        </div>);

}
