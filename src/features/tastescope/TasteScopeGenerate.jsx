import React, { useState, useEffect } from 'react';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { FaShareAlt, FaPaperPlane, FaStream } from 'react-icons/fa';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getSafeAvatar, normalizeUserGender } from '../../utils/avatarUtils';
import { shareNativeOrFallback } from '../../utils/shareNativeOrFallback';
import { fetchPostImageFile } from '../../utils/sharePostMedia';
import { getAppOrigin } from '../../utils/appOrigin';
import InternalShareModal from '../../components/InternalShareModal';
import { titleName, titleVisuals } from './titleDisplay';
import useTasteScope from './useTasteScope';

// Cover art styles offered for the one free restyle (mirror COVER_STYLE_IDS).
const STYLE_IDS = ['cinematic', 'calm', 'cartoon', 'anime', 'pixar', 'watercolor', 'popart'];
const VIS_OPTIONS = ['public', 'friends', 'hidden'];

/**
 * TasteScope profile block: shows the generated cover (with the title name),
 * the reading, share actions, "set as account cover", a one-time cover restyle,
 * and the result-visibility switch. Generation itself happens on quiz completion
 * (see useTasteScope.runTest); this component only displays + acts. Appendix A v2.
 */
export default function TasteScopeGenerate() {
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.language || 'ar').startsWith('ar');
  const locale = isArabic ? 'ar' : 'en';
  const { userProfile, currentUser } = useAuth();
  const { showToast } = useToast();
  const { coverRestyleUsed, visibility, restyleCover, setVisibility } = useTasteScope();

  const ts = userProfile?.tasteScope || null;
  const gen = ts?.generated || {};
  const readingText = gen.reading?.text || '';
  const coverUrl = ts?.coverUrl || gen.cover?.url || '';
  const uid = userProfile?.uid || currentUser?.uid || '';
  const name = ts?.titleId ? titleName(t, ts.titleId, normalizeUserGender(userProfile), isArabic) : '';
  const accent = ts?.titleId ? titleVisuals(ts.titleId).accent : 'var(--primary,#ef4444)';
  const isAccountCover = Boolean(coverUrl) && userProfile?.cover_photo === coverUrl;

  const [settingCover, setSettingCover] = useState(false);
  const [sharingExt, setSharingExt] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const [restyleOpen, setRestyleOpen] = useState(false);
  const [restyling, setRestyling] = useState(false);
  const [visBusy, setVisBusy] = useState(false);
  const [postingFeed, setPostingFeed] = useState(false);
  // Optimistic visibility so the selection holds immediately (don't wait for the
  // profile snapshot round-trip); cleared once the profile catches up.
  const [visOverride, setVisOverride] = useState(null);
  const effectiveVis = visOverride || visibility;
  useEffect(() => { if (visOverride && visibility === visOverride) setVisOverride(null); }, [visibility, visOverride]);

  if (!ts?.titleId) return null;

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

  const shareExternal = async () => {
    if (sharingExt) return;
    setSharingExt(true);
    try {
      const file = coverUrl ? await fetchPostImageFile(coverUrl) : null;
      const head = isArabic ? `لقب ذوقي: ${name}` : `My taste title: ${name}`;
      const text = [head, readingText].filter(Boolean).join('\n\n');
      const url = uid ? `${getAppOrigin()}/profile/${uid}` : getAppOrigin();
      await shareNativeOrFallback({ file, title: name || t('tastescope.name', 'TasteScope'), text, url });
    } catch {
      showToast(t('tastescope.gen.failed', 'تعذّر الإنشاء، لم يُخصم شيء'), 'error');
    } finally {
      setSharingExt(false);
    }
  };

  const internalShareData = {
    type: 'tastescope',
    id: uid,
    title: name ? `${name} — ${t('tastescope.name', 'TasteScope')}` : t('tastescope.name', 'TasteScope'),
    description: (readingText.split('\n').map((s) => s.trim()).filter(Boolean)[0] || readingText.slice(0, 160)),
    image: coverUrl || null,
    url: uid ? `/profile/${uid}` : '',
    authorName: userProfile?.display_name || currentUser?.displayName || '',
    authorAvatar: getSafeAvatar(userProfile || currentUser),
  };

  // Publish the taste profile to the community feed (a communityPosts doc).
  const shareToFeed = async () => {
    if (postingFeed || !uid) return;
    setPostingFeed(true);
    try {
      const authorName = userProfile?.display_name || currentUser?.displayName || 'User';
      await addDoc(collection(db, 'communityPosts'), {
        author: { id: uid, name: authorName, avatar: getSafeAvatar(userProfile || currentUser) },
        authorId: uid,
        postTitle: name ? `${name} — ${t('tastescope.name', 'TasteScope')}` : t('tastescope.name', 'TasteScope'),
        content: readingText || '',
        mediaUrl: coverUrl || null,
        mediaType: coverUrl ? 'image' : null,
        textStyle: { fontSize: 16, textAlign: isArabic ? 'right' : 'left', fontWeight: 'normal', fontStyle: 'normal', color: 'var(--text-main)', backgroundColor: 'transparent', fontFamily: '"Inter", sans-serif' },
        overlayText: '', overlayStyle: null,
        createdAt: serverTimestamp(),
        likes: [], comments: [], reposts: [],
        authorInterests: Array.isArray(userProfile?.interests) ? userProfile.interests : (Array.isArray(userProfile?.hobbies) ? userProfile.hobbies : []),
        attachedInvitation: null,
        source: 'tastescope',
      });
      showToast(t('tastescope.gen.sharedToFeed', 'نُشر على الفيد ✓'), 'success');
    } catch {
      showToast(t('tastescope.gen.failed', 'تعذّر الإنشاء، لم يُخصم شيء'), 'error');
    } finally {
      setPostingFeed(false);
    }
  };

  const doRestyle = async (style) => {
    if (restyling || coverRestyleUsed) return;
    setRestyling(true);
    try {
      const res = await restyleCover(style, locale);
      if (res.ok) setRestyleOpen(false);
      else if (res.reason === 'restyle_used') showToast(t('tastescope.gen.restyleUsed', 'استخدمت تغيير النمط لهذا الاختبار'), 'error');
      else showToast(t('tastescope.gen.failed', 'تعذّر الإنشاء، لم يُخصم شيء'), 'error');
    } finally {
      setRestyling(false);
    }
  };

  const changeVisibility = async (v) => {
    if (visBusy || v === effectiveVis) return;
    setVisOverride(v); // optimistic
    setVisBusy(true);
    const res = await setVisibility(v);
    setVisBusy(false);
    if (!res || !res.ok) {
      setVisOverride(null);
      showToast(t('tastescope.gen.visFailed', 'تعذّر حفظ الخصوصية'), 'error');
    }
  };

  const visLabel = (v) => t(`tastescope.gen.vis.${v}`, v === 'public' ? 'عام' : v === 'friends' ? 'أصدقاء' : 'مخفي');

  return (
    <div dir={i18n.dir()} style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '4px 0 8px' }}>
      {/* Cover (16:9) with the title name in the top-start corner */}
      {coverUrl ? (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 16, overflow: 'hidden', background: 'var(--bg-card,#f3f4f6)' }}>
          <img src={coverUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          {name ? (
            <span style={{ position: 'absolute', top: 10, insetInlineStart: 10, maxWidth: '78%', padding: '5px 12px', borderRadius: 999, background: accent, color: '#fff', fontWeight: 900, fontSize: '0.95rem', lineHeight: 1.15, boxShadow: '0 2px 8px rgba(0,0,0,0.35)', pointerEvents: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
          ) : null}
        </div>
      ) : null}

      {/* Set as account cover */}
      {coverUrl ? (
        <button
          type="button"
          onClick={setAsAccountCover}
          disabled={settingCover || isAccountCover}
          style={{
            padding: '10px 12px', borderRadius: 12,
            border: `1px solid ${isAccountCover ? 'var(--border-color,#e5e7eb)' : 'var(--primary,#ef4444)'}`,
            background: 'transparent', color: isAccountCover ? 'var(--text-tertiary,#9ca3af)' : 'var(--primary,#ef4444)',
            fontWeight: 800, fontSize: '0.9rem', cursor: (settingCover || isAccountCover) ? 'default' : 'pointer',
          }}
        >
          {settingCover ? t('tastescope.gen.coverSetting', 'جارٍ التعيين…') : isAccountCover ? t('tastescope.gen.coverIsSet', 'غلاف حسابك ✓') : t('tastescope.gen.setAsCover', 'اجعلها غلاف حسابي')}
        </button>
      ) : null}

      {/* One free cover restyle per test */}
      {coverUrl && !coverRestyleUsed ? (
        restyleOpen ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', borderRadius: 12, background: 'var(--bg-card,#f3f4f6)', border: '1px solid var(--border-color,#e5e7eb)' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary,#6b7280)' }}>
              {t('tastescope.gen.pickStyleOnce', 'اختر نمطًا جديدًا (مرة واحدة)')}
            </span>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {STYLE_IDS.map((sid) => (
                <button
                  key={sid}
                  type="button"
                  onClick={() => doRestyle(sid)}
                  disabled={restyling}
                  style={{ flex: '0 0 auto', padding: '6px 12px', borderRadius: 999, border: '1px solid var(--border-color,#e5e7eb)', background: 'transparent', color: 'var(--text-main)', fontWeight: 700, fontSize: '0.8rem', cursor: restyling ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}
                >
                  {t(`tastescope.gen.style.${sid}`, sid)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRestyleOpen(true)}
            style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border-color,#e5e7eb)', background: 'transparent', color: 'var(--text-main)', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer' }}
          >
            {t('tastescope.gen.changeCoverStyle', 'تغيير نمط الغلاف (مرة واحدة)')}
          </button>
        )
      ) : null}
      {restyling ? (
        <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary,#6b7280)' }}>
          {t('tastescope.gen.restyling', 'جارٍ تغيير الغلاف…')}
        </div>
      ) : null}

      {/* Reading (full) */}
      {readingText ? (
        <p style={{ whiteSpace: 'pre-wrap', fontSize: '1rem', lineHeight: 1.9, color: 'var(--text-main)', margin: 0, textAlign: 'start' }}>{readingText}</p>
      ) : null}

      {/* Publish to the community feed */}
      {(readingText || coverUrl) ? (
        <button
          type="button"
          onClick={shareToFeed}
          disabled={postingFeed}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 12px', borderRadius: 12, border: 'none', background: 'var(--primary,#ef4444)', color: '#fff', fontWeight: 800, fontSize: '0.9rem', cursor: postingFeed ? 'wait' : 'pointer', opacity: postingFeed ? 0.7 : 1 }}
        >
          <FaStream /> {postingFeed ? t('tastescope.gen.posting', 'جارٍ النشر…') : t('tastescope.gen.shareFeed', 'انشر على الفيد')}
        </button>
      ) : null}

      {/* Share (in-chat + external) */}
      {(readingText || coverUrl) ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={() => setInternalOpen(true)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 12px', borderRadius: 12, border: '1px solid var(--border-color,#e5e7eb)', background: 'transparent', color: 'var(--text-main)', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer' }}>
            <FaPaperPlane /> {t('tastescope.gen.shareInternal', 'إرسال في المحادثة')}
          </button>
          <button type="button" onClick={shareExternal} disabled={sharingExt} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 12px', borderRadius: 12, border: '1px solid var(--border-color,#e5e7eb)', background: 'transparent', color: 'var(--text-main)', fontWeight: 800, fontSize: '0.88rem', cursor: sharingExt ? 'wait' : 'pointer', opacity: sharingExt ? 0.7 : 1 }}>
            <FaShareAlt /> {t('tastescope.gen.shareExternal', 'مشاركة')}
          </button>
        </div>
      ) : null}

      {/* Visibility switch */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary,#6b7280)' }}>
          {t('tastescope.gen.visibility', 'من يرى نتيجتك؟')}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {VIS_OPTIONS.map((v) => {
            const active = effectiveVis === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => changeVisibility(v)}
                disabled={visBusy}
                style={{ flex: 1, padding: '8px 6px', borderRadius: 10, border: `1px solid ${active ? 'var(--primary,#ef4444)' : 'var(--border-color,#e5e7eb)'}`, background: active ? 'var(--primary,#ef4444)' : 'transparent', color: active ? '#fff' : 'var(--text-main)', fontWeight: 800, fontSize: '0.82rem', cursor: visBusy ? 'wait' : 'pointer' }}
              >
                {visLabel(v)}
              </button>
            );
          })}
        </div>
      </div>

      <InternalShareModal isOpen={internalOpen} onClose={() => setInternalOpen(false)} shareData={internalShareData} />
    </div>
  );
}
