import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, updateDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { FaShareAlt, FaPaperPlane, FaTimes } from 'react-icons/fa';
import app, { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getSpendableCredits } from '../../utils/walletCredits';
import { normalizeUserGender, getSafeAvatar } from '../../utils/avatarUtils';
import { shareNativeOrFallback } from '../../utils/shareNativeOrFallback';
import { fetchPostImageFile } from '../../utils/sharePostMedia';
import { getAppOrigin } from '../../utils/appOrigin';
import InternalShareModal from '../../components/InternalShareModal';
import { titleName, titleVisuals } from './titleDisplay';

const functions = getFunctions(app, 'us-central1');
const PRICE = { reading: 10, cover: 25 };

/**
 * TasteScope: generate a personal reading (text) + cover (image) via the
 * tastescopeGenerate callable. First of each kind is free; regenerating costs
 * 10 / 25 credits. Existing reading/cover stay visible until replaced; nothing
 * is charged on failure. Once generated, the result can be set as the account
 * cover and shared internally (chat) or externally. See TASTESCOPE_SPEC A.
 */
export default function TasteScopeGenerate() {
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.language || 'ar').startsWith('ar');
  const locale = isArabic ? 'ar' : 'en';
  const { userProfile, currentUser } = useAuth();
  const { showToast } = useToast();

  const ts = userProfile?.tasteScope || null;
  const gen = ts?.generated || {};
  const readingText = gen.reading?.text || '';
  const coverUrl = ts?.coverUrl || gen.cover?.url || '';
  const balance = getSpendableCredits(userProfile);
  const isAccountCover = Boolean(coverUrl) && userProfile?.cover_photo === coverUrl;
  const uid = userProfile?.uid || currentUser?.uid || '';
  // Title name only (no emoji) — for the cover overlay and share text.
  const name = ts?.titleId ? titleName(t, ts.titleId, normalizeUserGender(userProfile), isArabic) : '';
  const accent = ts?.titleId ? titleVisuals(ts.titleId).accent : 'var(--primary,#ef4444)';

  const [busy, setBusy] = useState(null); // 'reading' | 'cover' | null
  const [sheetOpen, setSheetOpen] = useState(false);
  const [settingCover, setSettingCover] = useState(false);
  const [sharingExt, setSharingExt] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);

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

  const setAsAccountCover = async () => {
    if (!coverUrl || settingCover || isAccountCover || !uid) return;
    setSettingCover(true);
    try {
      await updateDoc(doc(db, 'users', uid), { cover_photo: coverUrl });
      showToast(t('tastescope.gen.coverSet', 'صارت غلاف حسابك ✓'), 'success');
    } catch {
      showToast(t('tastescope.gen.coverSetFailed', 'تعذّر التعيين'), 'error');
    } finally {
      setSettingCover(false);
    }
  };

  const firstLine = readingText.split('\n').map((s) => s.trim()).filter(Boolean)[0] || '';
  const hasResult = Boolean(readingText || coverUrl);

  // External share: cover image (if any) + title + reading via the OS sheet.
  const shareExternal = async () => {
    if (sharingExt) return;
    setSharingExt(true);
    try {
      const file = coverUrl ? await fetchPostImageFile(coverUrl) : null;
      const head = isArabic ? `لقبي الغذائي: ${name}` : `My taste title: ${name}`;
      const text = [head, readingText].filter(Boolean).join('\n\n');
      const url = uid ? `${getAppOrigin()}/profile/${uid}` : getAppOrigin();
      await shareNativeOrFallback({ file, title: name || t('tastescope.name', 'TasteScope'), text, url });
    } catch {
      showToast(t('tastescope.gen.failed', 'تعذّر الإنشاء، لم يُخصم شيء'), 'error');
    } finally {
      setSharingExt(false);
    }
  };

  // Internal share card (rendered by SharedContentBubble in chat / communities).
  const internalShareData = {
    type: 'tastescope',
    id: uid,
    title: name ? `${name} — ${t('tastescope.name', 'TasteScope')}` : t('tastescope.name', 'TasteScope'),
    description: firstLine || readingText.slice(0, 160),
    image: coverUrl || null,
    url: uid ? `/profile/${uid}` : '',
    authorName: userProfile?.display_name || currentUser?.displayName || '',
    authorAvatar: getSafeAvatar(userProfile || currentUser),
  };

  return (
    <div dir={i18n.dir()} style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '4px 0 20px' }}>
      {/* Cover preview (16:9) once generated, with the title name overlaid */}
      {coverUrl ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 16, overflow: 'hidden', background: 'var(--bg-card,#f3f4f6)' }}>
            <img src={coverUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            {name ? (
              <span style={{ position: 'absolute', top: 10, insetInlineStart: 10, maxWidth: '78%', padding: '5px 12px', borderRadius: 999, background: accent, color: '#fff', fontWeight: 900, fontSize: '0.95rem', lineHeight: 1.15, boxShadow: '0 2px 8px rgba(0,0,0,0.35)', pointerEvents: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={setAsAccountCover}
            disabled={settingCover || isAccountCover}
            style={{
              alignSelf: 'stretch', padding: '10px 12px', borderRadius: 12,
              border: `1px solid ${isAccountCover ? 'var(--border-color,#e5e7eb)' : 'var(--primary,#ef4444)'}`,
              background: 'transparent', color: isAccountCover ? 'var(--text-tertiary,#9ca3af)' : 'var(--primary,#ef4444)',
              fontWeight: 800, fontSize: '0.9rem', cursor: (settingCover || isAccountCover) ? 'default' : 'pointer',
            }}
          >
            {settingCover
              ? t('tastescope.gen.coverSetting', 'جارٍ التعيين…')
              : isAccountCover
                ? t('tastescope.gen.coverIsSet', 'غلاف حسابك ✓')
                : t('tastescope.gen.setAsCover', 'اجعلها غلاف حسابي')}
          </button>
        </div>
      ) : null}

      {/* Reading: first line + read-more (reopens the sheet any time) */}
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

      {/* Share the result (internal chat + external OS sheet) */}
      {hasResult ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => setInternalOpen(true)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border-color,#e5e7eb)', background: 'transparent', color: 'var(--text-main)', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer' }}
          >
            <FaPaperPlane /> {t('tastescope.gen.shareInternal', 'إرسال في المحادثة')}
          </button>
          <button
            type="button"
            onClick={shareExternal}
            disabled={sharingExt}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border-color,#e5e7eb)', background: 'transparent', color: 'var(--text-main)', fontWeight: 800, fontSize: '0.88rem', cursor: sharingExt ? 'wait' : 'pointer', opacity: sharingExt ? 0.6 : 1 }}
          >
            <FaShareAlt /> {t('tastescope.gen.shareExternal', 'مشاركة')}
          </button>
        </div>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-main)' }}>{name}</span>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label={t('tastescope.gen.close', 'إغلاق')}
                style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'var(--bg-darker,rgba(0,0,0,0.06))', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', flexShrink: 0 }}
              >
                <FaTimes />
              </button>
            </div>
            {coverUrl ? <img src={coverUrl} alt={name} style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 12, marginBottom: 14 }} /> : null}
            <p style={{ whiteSpace: 'pre-wrap', fontSize: '1rem', lineHeight: 1.9, color: 'var(--text-main)', margin: '0 0 16px' }}>{readingText}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => { setSheetOpen(false); setInternalOpen(true); }}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 12px', borderRadius: 12, border: '1px solid var(--border-color,#e5e7eb)', background: 'transparent', color: 'var(--text-main)', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer' }}
              >
                <FaPaperPlane /> {t('tastescope.gen.shareInternal', 'إرسال في المحادثة')}
              </button>
              <button
                type="button"
                onClick={shareExternal}
                disabled={sharingExt}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 12px', borderRadius: 12, border: 'none', background: 'var(--primary,#ef4444)', color: '#fff', fontWeight: 800, fontSize: '0.88rem', cursor: sharingExt ? 'wait' : 'pointer', opacity: sharingExt ? 0.7 : 1 }}
              >
                <FaShareAlt /> {t('tastescope.gen.shareExternal', 'مشاركة')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <InternalShareModal isOpen={internalOpen} onClose={() => setInternalOpen(false)} shareData={internalShareData} />
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' };
const sheet = { width: '100%', maxWidth: 520, maxHeight: '88dvh', overflowY: 'auto', background: 'var(--bg-card,#fff)', borderRadius: '20px 20px 0 0', padding: '18px 20px calc(28px + env(safe-area-inset-bottom,0px))' };
