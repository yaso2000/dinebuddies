import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useTranslation } from 'react-i18next';
import app from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getSpendableCredits } from '../../utils/walletCredits';

const functions = getFunctions(app, 'us-central1');
const PRICE = { reading: 10, cover: 25 };

/**
 * TasteScope: generate a personal reading (text) + cover (image) via the
 * tastescopeGenerate callable. First of each kind is free; regenerating costs
 * 10 / 25 credits. Existing reading/cover stay visible until replaced; nothing
 * is charged on failure. See TASTESCOPE_SPEC Appendix A.
 */
export default function TasteScopeGenerate() {
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.language || 'ar').startsWith('ar');
  const locale = isArabic ? 'ar' : 'en';
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  const ts = userProfile?.tasteScope || null;
  const gen = ts?.generated || {};
  const readingText = gen.reading?.text || '';
  const coverUrl = ts?.coverUrl || gen.cover?.url || '';
  const balance = getSpendableCredits(userProfile);

  const [busy, setBusy] = useState(null); // 'reading' | 'cover' | null
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!ts?.titleId) return null;

  const priceFor = (kind) => ((Number(gen[kind]?.count) || 0) === 0 ? 0 : PRICE[kind]);

  const generate = async (kind) => {
    if (busy) return;
    const price = priceFor(kind);
    if (price > 0 && balance < price) {
      showToast(t('tastescope.gen.insufficient', 'رصيدك لا يكفي'), 'error');
      return;
    }
    setBusy(kind);
    try {
      const res = await httpsCallable(functions, 'tastescopeGenerate')({ kind, locale });
      const out = res?.data || {};
      if (out.ok) {
        // userProfile updates via the users onSnapshot; nothing else to do.
        return;
      }
      if (out.reason === 'insufficient_credits') showToast(t('tastescope.gen.insufficient', 'رصيدك لا يكفي'), 'error');
      else if (out.reason === 'rate_limited') showToast(t('tastescope.gen.failed', 'تعذّر الإنشاء، لم يُخصم شيء'), 'error');
      else showToast(t('tastescope.gen.failed', 'تعذّر الإنشاء، لم يُخصم شيء'), 'error');
    } catch {
      showToast(t('tastescope.gen.failed', 'تعذّر الإنشاء، لم يُخصم شيء'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const priceLabel = (kind) => {
    const p = priceFor(kind);
    return p === 0 ? t('tastescope.gen.free', 'مجاناً') : t('tastescope.gen.price', { n: p, defaultValue: `${p} كريدت` });
  };

  const firstLine = readingText.split('\n').map((s) => s.trim()).filter(Boolean)[0] || '';

  return (
    <div dir={i18n.dir()} style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '4px 0 20px' }}>
      {/* Cover preview (16:9) once generated */}
      {coverUrl ? (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 16, overflow: 'hidden', background: 'var(--bg-card,#f3f4f6)' }}>
          <img src={coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      ) : null}

      {/* Reading: first line + read-more */}
      {readingText ? (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          style={{ textAlign: 'start', background: 'var(--bg-card,#f3f4f6)', border: '1px solid var(--border-color,#e5e7eb)', borderRadius: 14, padding: '12px 14px', cursor: 'pointer' }}
        >
          <span style={{ display: 'block', fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: 1.7 }}>{firstLine}</span>
          <span style={{ display: 'block', marginTop: 6, fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary,#ef4444)' }}>
            {t('tastescope.gen.readMore', 'اقرأ القراءة كاملة')}
          </span>
        </button>
      ) : null}

      {/* Generate / regenerate buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        {['reading', 'cover'].map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => generate(kind)}
            disabled={Boolean(busy)}
            style={{
              flex: 1, padding: '11px 12px', borderRadius: 12, border: '1px solid var(--border-color,#e5e7eb)',
              background: 'transparent', color: 'var(--text-main)', fontWeight: 800, fontSize: '0.9rem',
              cursor: busy ? 'wait' : 'pointer', opacity: busy && busy !== kind ? 0.6 : 1,
            }}
          >
            {busy === kind ? (
              t('tastescope.gen.generating', 'جارٍ الإنشاء…')
            ) : (
              <>
                <span style={{ display: 'block' }}>
                  {(gen[kind]?.count ? t('tastescope.gen.regenerate', 'أنشئ من جديد') : (kind === 'reading' ? t('tastescope.gen.reading.cta', 'أنشئ قراءتي') : t('tastescope.gen.cover.cta', 'أنشئ غلافي')))}
                </span>
                <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary,#6b7280)' }}>
                  {priceLabel(kind)}
                </span>
              </>
            )}
          </button>
        ))}
      </div>
      {balance >= 0 ? (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary,#9ca3af)', textAlign: 'center' }}>
          {t('tastescope.gen.balance', { n: balance, defaultValue: `رصيدك: ${balance}` })}
        </span>
      ) : null}

      {sheetOpen && readingText ? (
        <div onClick={() => setSheetOpen(false)} style={overlay}>
          <div onClick={(e) => e.stopPropagation()} dir={i18n.dir()} style={sheet}>
            <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--border-color,#e5e7eb)', margin: '0 auto 14px' }} />
            {coverUrl ? <img src={coverUrl} alt="" style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 12, marginBottom: 14 }} /> : null}
            <p style={{ whiteSpace: 'pre-wrap', fontSize: '1rem', lineHeight: 1.9, color: 'var(--text-main)', margin: 0 }}>{readingText}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' };
const sheet = { width: '100%', maxWidth: 520, maxHeight: '88dvh', overflowY: 'auto', background: 'var(--bg-card,#fff)', borderRadius: '20px 20px 0 0', padding: '18px 20px calc(28px + env(safe-area-inset-bottom,0px))' };
