import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft, FaCamera, FaRobot } from 'react-icons/fa';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';
import { useMyLiveRealOrAiPost } from '../hooks/useMyLiveRealOrAiPost';
import { useToast } from '../context/ToastContext';
import OverlappingAvatars from '../components/OverlappingAvatars';
import GroupGameParticipantsSheet from '../components/GroupGameParticipantsSheet';
import { AppText } from '../components/base';
import '../styles/gameUI.css';

const functions = getFunctions(app, 'us-central1');

/** The owner's own live "Camera or AI?" card — results + end the round. Reached by
 *  publishing (publish = enter) or the "Your card" circle on the stories rail. */
export default function MyRealOrAiCard() {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { post } = useMyLiveRealOrAiPost();
    const { showToast } = useToast();
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [voters, setVoters] = useState([]);
    const [showVoters, setShowVoters] = useState(false);

    const postId = post?.id || null;
    const voteCount = Number(post?.voteCount) || 0;
    useEffect(() => {
        if (!postId || voteCount === 0) { setVoters([]); return; }
        let alive = true;
        httpsCallable(functions, 'listRealOrAiVoters')({ postId })
            .then((r) => { if (alive) setVoters(Array.isArray(r?.data?.voters) ? r.data.voters : []); })
            .catch(() => {});
        return () => { alive = false; };
    }, [postId, voteCount]);

    const endRound = async () => {
        if (!post?.id) return;
        setBusy(true);
        try {
            await httpsCallable(functions, 'endRealOrAiPost')({ postId: post.id });
            showToast(t('cam_ai_ended', 'Round ended.'), 'success');
            navigate('/posts-feed', { replace: true });
        } catch (e) {
            showToast(e?.message || t('roa_create_error', 'Something went wrong.'), 'error');
        } finally { setBusy(false); setConfirming(false); }
    };

    const real = Number(post?.tally?.real) || 0;
    const ai = Number(post?.tally?.ai) || 0;
    const total = real + ai;
    const realPct = total ? Math.round((100 * real) / total) : 0;
    const aiPct = total ? 100 - realPct : 0;
    const expMs = post?.expiresAt?.toMillis?.() ?? 0;
    const hoursLeft = expMs ? Math.max(0, Math.ceil((expMs - Date.now()) / 3600000)) : 0;

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-body)' }} dir={i18n.dir()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(14px + env(safe-area-inset-top, 0px)) 16px 14px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
                <button onClick={() => navigate('/posts-feed')} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1.2rem', cursor: 'pointer' }}><FaChevronLeft style={{ transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' }} /></button>
                <AppText as="h2" style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{t('cam_ai_your_card', 'Your card')}</AppText>
            </div>

            <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 20px calc(30px + env(safe-area-inset-bottom, 0px))' }}>
                {post ? (
                    <div className="gg-card" style={{ padding: 16 }}>
                        <div style={{ width: '100%', borderRadius: 14, overflow: 'hidden', background: '#000', display: 'grid', placeItems: 'center', marginBottom: 12 }}>
                            <img src={post.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: 340, objectFit: 'contain' }} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#10b981' }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                                {t('cam_ai_live', 'Live')}
                            </span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>{t('cam_ai_time_left', { defaultValue: '{{h}}h left', h: hoursLeft })}</span>
                        </div>

                        {/* Live crowd split */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                            {[{ label: t('roa_real', 'Real'), Icon: FaCamera, pct: realPct, color: '#0ea5e9' },
                              { label: t('roa_ai', 'AI'), Icon: FaRobot, pct: aiPct, color: '#a855f7' }].map((r, idx) => (
                                <div key={idx}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 3 }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text-main)' }}><r.Icon size={13} color={r.color} /> {r.label}</span>
                                        <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{r.pct}%</span>
                                    </div>
                                    <div style={{ height: 8, borderRadius: 999, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${r.pct}%`, background: r.color, borderRadius: 999, transition: 'width .3s' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <AppText as="div" style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: 14 }}>
                            {t('roa_total_guesses', { defaultValue: '{{n}} guesses', n: total })}
                        </AppText>

                        {voters.length > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 0 16px', borderTop: '1px solid var(--border-color)' }}>
                                <AppText as="div" style={{ fontWeight: 700, fontSize: '0.85rem' }}>{t('cam_ai_voters', 'Voters')}</AppText>
                                <OverlappingAvatars people={voters} total={voters.length} onClick={() => setShowVoters(true)} label={t('cam_ai_tap_voters', 'Connect with them')} />
                            </div>
                        ) : null}

                        {confirming ? (
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button type="button" onClick={() => setConfirming(false)} disabled={busy} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontWeight: 700, cursor: 'pointer', background: 'var(--bg-elevated)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>{t('cancel', 'Cancel')}</button>
                                <button type="button" onClick={endRound} disabled={busy} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontWeight: 800, cursor: 'pointer', color: '#fff', border: 'none', background: '#ef4444' }}>{busy ? t('roa_publishing', 'Working…') : t('cam_ai_end_confirm', 'End now')}</button>
                            </div>
                        ) : (
                            <button type="button" onClick={() => setConfirming(true)} disabled={busy} style={{ width: '100%', padding: '12px 0', borderRadius: 12, fontWeight: 800, cursor: 'pointer', background: 'var(--bg-elevated)', color: '#ef4444', border: '1.5px solid #ef444455' }}>
                                {t('cam_ai_end_cta', 'End the round')}
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <div style={{ fontSize: '2.6rem' }}>🤳</div>
                        <AppText as="p" style={{ color: 'var(--text-muted)', margin: '10px auto 18px', maxWidth: 320 }}>{t('cam_ai_no_live', 'You have no live card right now.')}</AppText>
                        <button type="button" className="gg-btn gg-btn--primary" style={{ background: 'linear-gradient(90deg,#0ea5e9,#a855f7)' }} onClick={() => navigate('/realornai/new')}>{t('cam_ai_create_cta', 'Create a card')}</button>
                    </div>
                )}
            </div>

            {showVoters ? (
                <GroupGameParticipantsSheet players={voters} title={t('cam_ai_voters', 'Voters')} onClose={() => setShowVoters(false)} />
            ) : null}
        </div>
    );
}
