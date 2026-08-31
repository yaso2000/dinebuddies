import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft, FaCheck } from 'react-icons/fa';
import { ZODIAC_SIGNS, signTraits } from '../constants/zodiacSigns';
import { zodiacApi } from '../hooks/useZodiacPost';

const TRAITS_REQUIRED = 3;
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { goToLogin } from '../utils/goToLogin';
import { AppText } from '../components/base';
import '../styles/gameUI.css';

/**
 * Create a "Guess my sign?" card — the owner picks their REAL sign (hidden truth)
 * and 3 personality traits shown as hints. The crowd then guesses on the story rail.
 */
export default function CreateZodiacPost() {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const isArabic = (i18n.language || 'ar').startsWith('ar');
    const { currentUser, isGuest } = useAuth();
    const { showToast } = useToast();

    const [sign, setSign] = useState('');
    const [traits, setTraits] = useState([]); // selected trait objects {ar,en}
    const [busy, setBusy] = useState(false);

    const requireAuth = () => {
        if (isGuest || !currentUser) { goToLogin(); return false; }
        return true;
    };

    // Traits are sign-specific — changing the sign clears the picks.
    const pickSign = (id) => { setSign(id); setTraits([]); };

    const toggleTrait = (tr) => {
        setTraits((prev) => {
            const has = prev.some((x) => x.ar === tr.ar && x.en === tr.en);
            if (has) return prev.filter((x) => !(x.ar === tr.ar && x.en === tr.en));
            if (prev.length >= TRAITS_REQUIRED) return prev;
            return [...prev, { ar: tr.ar, en: tr.en }];
        });
    };

    const publish = async () => {
        if (!requireAuth()) return;
        if (!sign) { showToast(t('zodiac_pick_sign_first', 'Pick your zodiac sign.'), 'info'); return; }
        if (traits.length !== TRAITS_REQUIRED) { showToast(t('zodiac_pick_traits_first', 'Pick 3 traits.'), 'info'); return; }
        setBusy(true);
        try {
            await zodiacApi.create({ sign, traits });
            showToast(t('zodiac_published', 'Your card is live!'), 'success');
            navigate('/zodiac/mine', { replace: true });
        } catch (e) { showToast(e?.message || t('zodiac_create_error', 'Could not publish your card.'), 'error'); }
        finally { setBusy(false); }
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-body)' }} dir={i18n.dir()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(14px + env(safe-area-inset-top, 0px)) 16px 14px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
                <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1.2rem', cursor: 'pointer' }}><FaChevronLeft style={{ transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' }} /></button>
                <AppText as="h2" style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{t('zodiac_create_title', 'Guess my sign?')}</AppText>
            </div>

            <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 20px calc(30px + env(safe-area-inset-bottom, 0px))' }}>
                <div style={{ textAlign: 'center', marginBottom: 18 }}>
                    <div style={{ fontSize: '2.4rem' }}>🔮</div>
                    <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 420, margin: '8px auto 0' }}>
                        {t('zodiac_create_desc', 'Pick your real sign and 3 traits. The crowd sees the traits and guesses your sign — your sign stays hidden until they vote.')}
                    </AppText>
                </div>

                {/* Your real sign (hidden from the crowd) */}
                <AppText as="div" style={{ fontWeight: 800, marginBottom: 4 }}>{t('zodiac_your_sign', 'Your sign')} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>({t('zodiac_hidden', 'hidden from others')})</span></AppText>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
                    {ZODIAC_SIGNS.map((s) => {
                        const on = sign === s.id;
                        return (
                            <button key={s.id} type="button" onClick={() => pickSign(s.id)}
                                style={{ padding: '10px 4px', borderRadius: 12, cursor: 'pointer', border: `2px solid ${on ? '#7c3aed' : 'var(--border-color)'}`, background: on ? 'rgba(124,58,237,0.14)' : 'var(--bg-card)', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <span style={{ fontSize: '1.3rem' }} aria-hidden>{s.icon}</span>
                                <AppText as="span" style={{ fontSize: '0.72rem', fontWeight: 700 }} format={false}>{isArabic ? s.ar : s.en}</AppText>
                            </button>
                        );
                    })}
                </div>

                {/* 3 of the sign's OWN traits — shown as the text hint the crowd guesses from */}
                {sign ? (
                    <>
                        <AppText as="div" style={{ fontWeight: 800, marginBottom: 2 }}>{t('zodiac_pick_hints', 'Pick 3 hints')} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>({traits.length}/{TRAITS_REQUIRED})</span></AppText>
                        <AppText as="div" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>{t('zodiac_pick_hints_desc', 'These traits of your sign appear on your card — the crowd guesses from them.')}</AppText>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
                            {signTraits(sign).map((tr) => {
                                const on = traits.some((x) => x.ar === tr.ar && x.en === tr.en);
                                const dim = !on && traits.length >= TRAITS_REQUIRED;
                                return (
                                    <button key={tr.en} type="button" onClick={() => toggleTrait(tr)} disabled={dim}
                                        style={{ padding: '8px 12px', borderRadius: 999, cursor: dim ? 'default' : 'pointer', opacity: dim ? 0.4 : 1, fontWeight: 700, fontSize: '0.85rem',
                                            border: `2px solid ${on ? '#7c3aed' : 'var(--border-color)'}`, background: on ? 'rgba(124,58,237,0.14)' : 'var(--bg-card)', color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                        {isArabic ? tr.ar : tr.en} {on ? <FaCheck size={10} color="#7c3aed" /> : null}
                                    </button>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <AppText as="p" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 22 }}>{t('zodiac_pick_sign_hint', 'Pick your sign first — its traits will appear to choose from.')}</AppText>
                )}

                <button type="button" className="gg-btn gg-btn--primary gg-btn--block" style={{ background: 'linear-gradient(90deg,#7c3aed,#4f46e5)' }} disabled={busy} onClick={publish}>
                    {busy ? t('zodiac_publishing', 'Publishing…') : t('zodiac_publish_cta', 'Publish card')}
                </button>
            </div>
        </div>
    );
}
