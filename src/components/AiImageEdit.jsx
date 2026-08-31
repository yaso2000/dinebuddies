import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaMagic, FaImage, FaCheck, FaRedo } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { uploadAiEditInput, isImageModerationRejected } from '../services/moderatedImageUpload';
import { generateAIImageEdit } from '../services/generateAIContent';
import AiContentNotice from './AiContentNotice';
import { AppText } from './base';

const AI_EDIT_COST = 25;

/** Scroll a focused input clear of the on-screen keyboard (iOS/Android robust). */
function liftAboveKeyboard(el) {
  if (!el) return;
  const doLift = () => {
    try {
      const vv = typeof window !== 'undefined' ? window.visualViewport : null;
      const rect = el.getBoundingClientRect();
      const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const overflow = rect.bottom - visibleBottom + 28;
      if (overflow > 0) {
        // Find the nearest actually-scrollable ancestor and scroll it up.
        let p = el.parentElement;
        while (p && p !== document.body) {
          const oy = getComputedStyle(p).overflowY;
          if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 4) break;
          p = p.parentElement;
        }
        const sc = p && p !== document.body ? p : document.scrollingElement || document.documentElement;
        sc.scrollTop += overflow;
      } else {
        el.scrollIntoView({ block: 'center' });
      }
    } catch {
      try { el.scrollIntoView({ block: 'center' }); } catch { /* noop */ }
    }
  };
  // Two passes — before and after the keyboard finishes animating.
  setTimeout(doLift, 350);
  setTimeout(doLift, 750);
}

/**
 * Reusable "edit an image with AI" panel. Pick an image → describe the edit →
 * generate (25 credits). Calls `onImageReady(url)` with the edited image URL.
 *
 * @param {{ onImageReady: (url: string) => void, onCancel?: () => void, aspectRatio?: string, postType?: string }} props
 */
export default function AiImageEdit({ onImageReady, onCancel, aspectRatio = '1:1', postType = 'design_studio' }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const uid = currentUser?.uid || null;
  const fileRef = useRef(null);

  const [input, setInput] = useState(null); // { url, path }
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState('');

  const pickFile = () => fileRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uid) return;
    if (!file.type?.startsWith('image/')) { showToast(t('roa_prompt_first', 'Pick an image.'), 'info'); return; }
    setResult('');
    setBusy('upload');
    try {
      const res = await uploadAiEditInput(file, uid);
      setInput(res);
    } catch (err) {
      if (isImageModerationRejected(err)) showToast(t('image_rejected', 'This image was rejected.'), 'error');
      else showToast(err?.message || t('aiedit_upload_error', 'Could not upload the image.'), 'error');
    } finally { setBusy(''); }
  };

  const runEdit = async () => {
    if (!input?.path) { pickFile(); return; }
    if (!prompt.trim()) { showToast(t('aiedit_prompt_first', 'Describe the edit you want.'), 'info'); return; }
    setBusy('edit');
    try {
      const r = await generateAIImageEdit({ inputImagePath: input.path, inputImageBucket: input.bucket, userPrompt: prompt.trim(), postType, aspectRatio });
      if (!r?.success) {
        const code = String(r?.code || r?.error || '');
        if (/credit/i.test(code) || r?.status === 402) {
          showToast(t('insufficient_dine_credits_wallet', 'Not enough Dine Credits. Open Settings → Dine Credits to top up.'), 'error');
          navigate('/settings/credits');
          return;
        }
        // Surface the technical detail so we can diagnose the (new) edit path.
        const detail = String(r?.error || r?.code || '').slice(0, 180);
        showToast(detail ? `${t('aiedit_error', 'Could not edit the image.')} — ${detail}` : (r?.message || t('aiedit_error', 'Could not edit the image.')), 'error');
        return;
      }
      const img = r?.data?.image;
      if (!img?.url) { showToast(t('aiedit_error', 'Could not edit the image.'), 'error'); return; }
      setResult({ url: img.url, path: img.path || '' });
    } catch (err) { showToast(err?.message || t('aiedit_error', 'Could not edit the image.'), 'error'); }
    finally { setBusy(''); }
  };

  const previewSrc = result?.url || input?.url || '';

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />

      {/* Preview area */}
      <button type="button" onClick={pickFile} disabled={busy === 'upload'}
        style={{ width: '100%', aspectRatio: '1 / 1', maxHeight: 320, borderRadius: 16, border: '2px dashed var(--border-color)', background: '#00000010', cursor: 'pointer', display: 'grid', placeItems: 'center', overflow: 'hidden', padding: 0 }}>
        {previewSrc
          ? <img src={previewSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
          : <span style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <FaImage size={30} />
              <AppText as="div" style={{ marginTop: 8, fontSize: '0.85rem' }}>{busy === 'upload' ? t('aiedit_uploading', 'Uploading…') : t('aiedit_pick', 'Pick an image to edit')}</AppText>
            </span>}
      </button>

      {input ? (
        <div style={{ marginTop: 12 }}>
          <AppText as="div" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>{t('aiedit_instruction', 'What should the AI change?')}</AppText>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2}
            onFocus={(e) => liftAboveKeyboard(e.target)}
            placeholder={t('aiedit_prompt_ph', 'e.g. add a sunset background, turn it into a cartoon…')}
            style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-main)', fontFamily: 'inherit', fontSize: '0.9rem', resize: 'none' }} />
          <AppText as="div" style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '6px 0 10px' }}>{t('roa_ai_cost', { defaultValue: 'Costs {{n}} credits per image.', n: AI_EDIT_COST })}</AppText>
          <AiContentNotice style={{ margin: '0 0 10px' }} />

          <div style={{ display: 'flex', gap: 10 }}>
            {onCancel ? (
              <button type="button" onClick={onCancel} disabled={Boolean(busy)} style={{ flex: '0 0 auto', padding: '11px 16px', borderRadius: 12, fontWeight: 700, cursor: 'pointer', background: 'var(--bg-elevated)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>{t('cancel', 'Cancel')}</button>
            ) : null}
            {result ? (
              <>
                <button type="button" onClick={runEdit} disabled={busy === 'edit'} style={{ flex: '0 0 auto', padding: '11px 14px', borderRadius: 12, fontWeight: 700, cursor: 'pointer', background: 'var(--bg-elevated)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                  <FaRedo /> {t('aiedit_again', 'Edit again')}
                </button>
                <button type="button" onClick={() => onImageReady?.(result.url, { path: result.path })} style={{ flex: 1, padding: '11px 0', borderRadius: 12, fontWeight: 800, cursor: 'pointer', color: '#fff', border: 'none', background: 'linear-gradient(90deg,#0ea5e9,#a855f7)' }}>
                  <FaCheck /> {t('aiedit_use', 'Use this image')}
                </button>
              </>
            ) : (
              <button type="button" onClick={runEdit} disabled={busy === 'edit'} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontWeight: 800, cursor: 'pointer', color: '#fff', border: 'none', background: 'linear-gradient(90deg,#0ea5e9,#a855f7)' }}>
                <FaMagic /> {busy === 'edit' ? t('aiedit_editing', 'Editing…') : t('aiedit_cta', { defaultValue: 'Edit with AI ({{n}} credits)', n: AI_EDIT_COST })}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
