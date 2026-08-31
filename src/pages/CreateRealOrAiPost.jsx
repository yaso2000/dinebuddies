import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft, FaCamera, FaMagic, FaRedo } from 'react-icons/fa';
import UnifiedCamera from '../components/UnifiedCamera';
import {
    uploadRealOrAiPhoto,
    uploadAiEditInput,
    isImageModerationRejected,
    isImageModerationUnavailable,
    CAM_AI_NO_SELFIE,
    CAM_AI_GAME_BLOCKED,
} from '../services/moderatedImageUpload';
import { generateAIImageEdit } from '../services/generateAIContent';
import AiContentNotice from '../components/AiContentNotice';
import { realOrAiApi } from '../hooks/useRealOrAiPost';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { goToLogin } from '../utils/goToLogin';
import { AppText } from '../components/base';
import '../styles/gameUI.css';

const AI_COST = 25;
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-main)', fontFamily: 'inherit', fontSize: '0.95rem' };

/**
 * "Camera or AI?" (كاميرا أو ذكاء) — the owner posts a SELFIE that is EITHER a
 * real live camera shot OR the same selfie edited with AI. The crowd guesses.
 * There is exactly one input: a camera selfie. A clear human face is enforced
 * server-side (see moderateImage); repeated non-selfie uploads are penalised.
 */
export default function CreateRealOrAiPost() {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { currentUser, isGuest } = useAuth();
    const { showToast } = useToast();
    const uid = currentUser?.uid || null;

    const [mode, setMode] = useState(null);        // 'real' | 'aiedit' | null
    const [showCamera, setShowCamera] = useState(false);
    const [editInput, setEditInput] = useState(null); // { url, path } captured selfie to edit
    const [prompt, setPrompt] = useState('');
    const [image, setImage] = useState(null);      // final { url, path } to publish
    const [busy, setBusy] = useState('');

    const requireAuth = () => {
        if (isGuest || !currentUser) { goToLogin(); return false; }
        return true;
    };

    /** Show the right message for a selfie/abuse rejection; returns true if handled. */
    const handleSelfieError = (e) => {
        if (e?.code === CAM_AI_GAME_BLOCKED) {
            showToast(t('cam_ai_blocked', 'You are blocked from this game for 24 hours due to repeated misuse.'), 'error');
            return true;
        }
        if (e?.code === CAM_AI_NO_SELFIE) {
            showToast(
                e?.level >= 2
                    ? t('cam_ai_no_selfie_warn', 'This must be a selfie with a clear face. Warning: next misuse blocks you from the game for 24 hours.')
                    : t('cam_ai_no_selfie', 'This must be a selfie with a clear face.'),
                'error',
            );
            return true;
        }
        if (isImageModerationRejected(e)) { showToast(t('image_rejected', 'This image was rejected.'), 'error'); return true; }
        if (isImageModerationUnavailable(e)) { showToast(t('moderation_unavailable', 'Image check is temporarily unavailable. Try again.'), 'error'); return true; }
        return false;
    };

    const startMode = (m) => {
        if (!requireAuth()) return;
        setMode(m);
        setEditInput(null);
        setPrompt('');
        setImage(null);
        setShowCamera(true);
    };

    // Camera selfie captured → moderate (face-gated). Real → ready to publish.
    // AI-edit → keep as the edit input and show the edit prompt.
    const onCameraCaptured = async (file, _preview, type) => {
        setShowCamera(false);
        if (type !== 'image' || !file) return;
        setBusy('upload');
        try {
            if (mode === 'aiedit') {
                const res = await uploadAiEditInput(file, uid);
                setEditInput(res);
            } else {
                const res = await uploadRealOrAiPhoto(file, uid);
                setImage(res);
            }
        } catch (e) {
            if (!handleSelfieError(e)) showToast(e?.message || t('roa_upload_error', 'Could not upload the photo.'), 'error');
        } finally { setBusy(''); }
    };

    // Edit the captured selfie with AI (25 credits) → ready to publish.
    const runEdit = async () => {
        if (!editInput?.path) return;
        if (!prompt.trim()) { showToast(t('aiedit_prompt_first', 'Describe the edit you want.'), 'info'); return; }
        setBusy('edit');
        try {
            const r = await generateAIImageEdit({ inputImagePath: editInput.path, inputImageBucket: editInput.bucket, userPrompt: prompt.trim(), postType: 'real_or_ai' });
            if (!r?.success) {
                const code = String(r?.code || r?.error || '');
                if (/credit/i.test(code) || r?.status === 402) {
                    showToast(t('insufficient_dine_credits_wallet', 'Not enough Dine Credits. Open Settings → Dine Credits to top up.'), 'error');
                    navigate('/settings/credits');
                    return;
                }
                const detail = String(r?.error || r?.code || '').slice(0, 180);
                showToast(detail ? `${t('aiedit_error', 'Could not edit the image.')} — ${detail}` : t('aiedit_error', 'Could not edit the image.'), 'error');
                return;
            }
            const img = r?.data?.image;
            if (!img?.url || !img?.path) { showToast(t('aiedit_error', 'Could not edit the image.'), 'error'); return; }
            setImage({ url: img.url, path: img.path });
        } catch (e) { showToast(e?.message || t('aiedit_error', 'Could not edit the image.'), 'error'); }
        finally { setBusy(''); }
    };

    const publish = async () => {
        if (!requireAuth() || !image) return;
        setBusy('publish');
        try {
            await realOrAiApi.create({ imageUrl: image.url, imagePath: image.path });
            showToast(t('roa_published', 'Your card is live!'), 'success');
            navigate('/realornai/mine', { replace: true });
        } catch (e) { showToast(e?.message || t('roa_create_error', 'Could not publish your card.'), 'error'); }
        finally { setBusy(''); }
    };

    const reset = () => { setImage(null); setEditInput(null); setPrompt(''); setMode(null); };

    if (showCamera) {
        return <UnifiedCamera stopCamera={() => setShowCamera(false)} onMediaCaptured={onCameraCaptured} mode="photo" allowFilePicker={false} />;
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-body)' }} dir={i18n.dir()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(14px + env(safe-area-inset-top, 0px)) 16px 14px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
                <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1.2rem', cursor: 'pointer' }}><FaChevronLeft style={{ transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' }} /></button>
                <AppText as="h2" style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{t('roa_create_title', 'Camera or AI?')}</AppText>
            </div>

            <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 20px calc(30px + env(safe-area-inset-bottom, 0px))' }}>
                <div style={{ textAlign: 'center', marginBottom: 18 }}>
                    <div style={{ fontSize: '2.4rem' }}>🤳</div>
                    <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 420, margin: '8px auto 0' }}>
                        {t('roa_create_desc', 'Post a selfie — a real camera shot, or the same selfie edited with AI. The crowd guesses which.')}
                    </AppText>
                </div>

                {image ? (
                    /* ---- Ready to publish ---- */
                    <div className="gg-card" style={{ padding: 16 }}>
                        <div style={{ width: '100%', borderRadius: 14, overflow: 'hidden', background: '#000', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
                            <img src={image.url} alt="" style={{ maxWidth: '100%', maxHeight: 360, objectFit: 'contain' }} />
                        </div>
                        <AppText as="p" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: 12 }}>{t('roa_ready_hint', 'Others will guess: real selfie or AI? The answer stays hidden until they vote.')}</AppText>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button type="button" onClick={reset} disabled={Boolean(busy)}
                                style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontWeight: 700, cursor: 'pointer', background: 'var(--bg-elevated)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                                {t('roa_retry', 'Start over')}
                            </button>
                            <button type="button" className="gg-btn gg-btn--primary" style={{ flex: 1, background: 'linear-gradient(90deg,#0ea5e9,#a855f7)' }} disabled={Boolean(busy)} onClick={publish}>
                                {busy === 'publish' ? t('roa_publishing', 'Publishing…') : t('roa_publish_cta', 'Publish card')}
                            </button>
                        </div>
                    </div>
                ) : mode === 'aiedit' && editInput ? (
                    /* ---- Edit the captured selfie with AI ---- */
                    <div className="gg-card" style={{ padding: 16 }}>
                        <AppText as="div" style={{ fontWeight: 800, marginBottom: 10 }}>🎨 {t('cam_ai_edit_title', 'Edit your selfie with AI')}</AppText>
                        <div style={{ width: '100%', borderRadius: 14, overflow: 'hidden', background: '#000', display: 'grid', placeItems: 'center', marginBottom: 12, maxHeight: 300 }}>
                            <img src={editInput.url} alt="" style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain' }} />
                        </div>
                        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2}
                            placeholder={t('cam_ai_edit_ph', 'e.g. turn me into a cartoon, add sunglasses, cyberpunk style…')}
                            style={{ ...inputStyle, resize: 'none' }} />
                        <AppText as="div" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '8px 0 4px' }}>{t('roa_ai_cost', { defaultValue: 'Costs {{n}} credits per image.', n: AI_COST })}</AppText>
                        <AiContentNotice style={{ margin: '0 0 12px' }} />
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button type="button" onClick={() => startMode('aiedit')} disabled={Boolean(busy)} style={{ flex: '0 0 auto', padding: '12px 16px', borderRadius: 12, fontWeight: 700, cursor: 'pointer', background: 'var(--bg-elevated)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}><FaRedo /> {t('cam_ai_retake', 'Retake')}</button>
                            <button type="button" className="gg-btn gg-btn--primary" style={{ flex: 1, background: 'linear-gradient(90deg,#0ea5e9,#a855f7)' }} disabled={busy === 'edit'} onClick={runEdit}>
                                <FaMagic /> {busy === 'edit' ? t('roa_generating', 'Editing…') : t('cam_ai_edit_cta', { defaultValue: 'Edit with AI ({{n}} credits)', n: AI_COST })}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* ---- Choose: real selfie or AI-edited selfie ---- */
                    <div style={{ display: 'grid', gap: 14 }}>
                        <button type="button" onClick={() => startMode('real')} disabled={busy === 'upload'}
                            style={{ padding: 20, borderRadius: 18, cursor: 'pointer', textAlign: 'start', display: 'flex', alignItems: 'center', gap: 14, border: '2px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }}>
                            <span style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(14,165,233,0.14)', display: 'grid', placeItems: 'center', color: '#0ea5e9' }}><FaCamera size={24} /></span>
                            <span>
                                <AppText as="div" style={{ fontWeight: 800, fontSize: '1.05rem' }}>{busy === 'upload' ? t('roa_uploading', 'Uploading…') : t('cam_ai_real_title', 'Real selfie')}</AppText>
                                <AppText as="div" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('cam_ai_real_desc', 'Take a live selfie — free.')}</AppText>
                            </span>
                        </button>
                        <button type="button" onClick={() => startMode('aiedit')} disabled={Boolean(busy)}
                            style={{ padding: 20, borderRadius: 18, cursor: 'pointer', textAlign: 'start', display: 'flex', alignItems: 'center', gap: 14, border: '2px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }}>
                            <span style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(168,85,247,0.14)', display: 'grid', placeItems: 'center', color: '#a855f7' }}><FaMagic size={22} /></span>
                            <span>
                                <AppText as="div" style={{ fontWeight: 800, fontSize: '1.05rem' }}>{t('cam_ai_edit_entry', 'AI-edited selfie')}</AppText>
                                <AppText as="div" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('cam_ai_edit_entry_desc', { defaultValue: 'Take a selfie, then edit it with AI ({{n}} credits).', n: AI_COST })}</AppText>
                            </span>
                        </button>
                        <AppText as="p" style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>
                            {t('cam_ai_selfie_note', 'Both must be a selfie with a clear face.')}
                        </AppText>
                    </div>
                )}
            </div>
        </div>
    );
}
