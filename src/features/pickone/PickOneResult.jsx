import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { AppText } from '../../components/base';
import { shareNativeOrFallback } from '../../utils/shareNativeOrFallback';
import { saveImageDataUrl } from '../../utils/saveImageDataUrl';
import { getSafeAvatar } from '../../utils/avatarUtils';
import { publishImageBlobAsStory } from '../../utils/publishAutoStory';
import { entryName, siblingList, listTitle } from './pickoneData';
import { renderStoryCard } from './renderStoryCard';
import './pickone.css';

const PLAY_URL = 'https://dinebuddies.com/pickone';

/** A tappable checkbox row (Post to Story / Post to Feed). */
function CheckRow({ checked, onChange, label, dir }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      dir={dir}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'start',
        padding: '11px 13px', borderRadius: 12, cursor: 'pointer',
        border: `1.5px solid ${checked ? 'var(--primary, #ef4444)' : 'var(--border-color, #e5e7eb)'}`,
        background: checked ? 'rgba(239,68,68,0.08)' : 'transparent',
      }}
    >
      <span style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        border: `2px solid ${checked ? 'var(--primary, #ef4444)' : 'var(--border-color, #cbd5e1)'}`,
        background: checked ? 'var(--primary, #ef4444)' : 'transparent',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900,
      }}>{checked ? '✓' : ''}</span>
      <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{label}</span>
    </button>
  );
}

/**
 * Result: champion + "Share to story" (canvas card → native share / download),
 * play again, try the other list, and the 19-duel history.
 */
export default function PickOneResult({ list, state, sameAsLast, onPlayAgain, onPlayList, onDone }) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { currentUser, userProfile } = useAuth();
  const uid = currentUser?.uid;
  const rtl = i18n.dir() === 'rtl';
  const language = i18n.language;
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [broken, setBroken] = useState(false);
  const [postStory, setPostStory] = useState(true);
  const [postFeed, setPostFeed] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  const champion = state.champion;
  const name = entryName(champion, language);
  const last = state.history[state.history.length - 1];
  const runnerUp = list.entries.find((e) => e.id === last?.loserId) || null;
  const byId = Object.fromEntries(list.entries.map((e) => [e.id, e]));
  const other = siblingList(list.id);

  const cardText = () => ({
    caption: t('pickone.card.captionFood', 'My favorite dish'),
    beat: t('pickone.card.beatFood', { n: state.total, defaultValue: `Beat ${state.total} dishes` }),
    play: t('pickone.card.play', 'Play: dinebuddies.com/pickone'),
  });

  const buildCard = async () => {
    const { blob, dataUrl } = await renderStoryCard({ entry: champion, name, region: 'global', rtl, text: cardText() });
    return { blob, dataUrl };
  };

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { blob, dataUrl } = await buildCard();
      const file = new File([blob], `pickone-${champion.id}.png`, { type: 'image/png' });
      const text = t('pickone.share.textFood', { name, defaultValue: `My favorite dish is ${name}. What's yours? ${PLAY_URL}` });
      const saveInstead = async () => {
        const s = await saveImageDataUrl(dataUrl, `pickone-${champion.id}.png`);
        if (s !== 'cancelled') showToast(t('pickone.result.saved', 'Image saved — post it to your story'), 'success');
      };
      // Only use the OS share sheet when this browser can actually share the
      // IMAGE file; otherwise save it (a text-only share would look like the
      // story never posted). This is the reliable path on mobile web.
      const canShareFile = typeof navigator !== 'undefined'
        && typeof navigator.canShare === 'function'
        && navigator.canShare({ files: [file] });
      if (canShareFile) {
        const r = await shareNativeOrFallback({ file, title: t('pickone.title', 'Pick One'), text, url: PLAY_URL, skipExternalFallback: true });
        if (r !== 'native' && r !== 'aborted') await saveInstead();
      } else {
        await saveInstead();
      }
    } catch {
      showToast(t('pickone.result.shareFailed', 'Could not build the card, try again'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { dataUrl } = await buildCard();
      await saveImageDataUrl(dataUrl, `pickone-${champion.id}.png`);
    } catch {
      showToast(t('pickone.result.shareFailed', 'Could not build the card, try again'), 'error');
    } finally {
      setBusy(false);
    }
  };

  // Publish to DineBuddies itself — a 24h Story and/or a Feed post.
  const publish = async () => {
    if (publishing || (!postStory && !postFeed)) return;
    if (!uid) { showToast(t('pickone.result.signIn', 'Sign in to publish'), 'info'); return; }
    setPublishing(true);
    try {
      if (postStory) {
        const { blob } = await buildCard();
        // One story slot per category — replaying replaces it (max four stories).
        await publishImageBlobAsStory({ currentUser, blob, replaceKey: `pickone-${list.id}` });
      }
      if (postFeed) {
        const authorName = userProfile?.display_name || currentUser?.displayName || 'User';
        await addDoc(collection(db, 'communityPosts'), {
          author: { id: uid, name: authorName, avatar: getSafeAvatar(userProfile || currentUser) },
          authorId: uid,
          postTitle: `${t('pickone.card.captionFood', 'My favorite dish')}: ${name}`,
          content: t('pickone.result.beatFood', { n: state.total, defaultValue: `Beat ${state.total} dishes` }),
          mediaUrl: champion.image || null,
          mediaType: champion.image ? 'image' : null,
          textStyle: { fontSize: 16, textAlign: rtl ? 'right' : 'left', fontWeight: 'normal', fontStyle: 'normal', color: 'var(--text-main)', backgroundColor: 'transparent', fontFamily: '"Inter", sans-serif' },
          overlayText: '', overlayStyle: null,
          createdAt: serverTimestamp(),
          likes: [], comments: [], reposts: [],
          attachedInvitation: null,
          source: 'pickone',
        });
      }
      setPublished(true);
      showToast(t('pickone.result.published', 'Published ✓'), 'success');
    } catch {
      showToast(t('pickone.result.publishFailed', 'Could not publish, try again'), 'error');
    } finally {
      setPublishing(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard?.writeText?.(`${PLAY_URL}?list=${list.id}`);
      showToast(t('pickone.result.linkCopied', 'Link copied'), 'success');
    } catch {
      showToast(t('pickone.result.shareFailed', 'Could not build the card, try again'), 'error');
    }
  };

  const btn = (primary) => ({
    display: 'block', width: '100%', padding: primary ? '14px 18px' : '12px 16px', borderRadius: 14,
    border: primary ? 'none' : '1.5px solid var(--border-color, #e5e7eb)',
    background: primary ? 'var(--primary, #ef4444)' : 'transparent',
    color: primary ? '#fff' : 'var(--text-main)', fontSize: primary ? '1rem' : '0.95rem', fontWeight: 800,
    cursor: 'pointer', marginBottom: 10, opacity: busy ? 0.7 : 1,
  });

  return (
    <div dir={i18n.dir()} style={{ maxWidth: 520, margin: '0 auto', padding: '24px 20px calc(120px + env(safe-area-inset-bottom, 0px))', textAlign: 'center' }}>
      <AppText as="div" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-tertiary, #9ca3af)', marginBottom: 10 }}>
        {t('pickone.result.titleFood', 'Your favorite dish')}
      </AppText>

      <div className="po-result__hero" style={{ background: `linear-gradient(160deg, ${champion.color} 0%, #111 140%)` }}>
        {champion.image && !broken ? (
          <img src={champion.image} alt={name} onError={() => setBroken(true)} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '5rem', fontWeight: 900 }}>
            {name.trim().charAt(0)}
          </div>
        )}
      </div>

      <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: '0 0 6px', color: 'var(--text-main)' }}>{name}</h1>
      <AppText as="p" style={{ fontSize: '0.95rem', color: 'var(--text-secondary, #6b7280)', margin: '0 0 4px' }}>
        {t('pickone.result.beatFood', { n: state.total, defaultValue: `Beat ${state.total} dishes` })}
      </AppText>
      {runnerUp && (
        <AppText as="p" style={{ fontSize: '0.85rem', color: 'var(--text-tertiary, #9ca3af)', margin: '0 0 6px' }}>
          {t('pickone.result.runnerUp', { name: entryName(runnerUp, language), defaultValue: `Runner-up: ${entryName(runnerUp, language)}` })}
        </AppText>
      )}
      {sameAsLast && (
        <AppText as="p" style={{ fontSize: '0.85rem', color: 'var(--primary, #ef4444)', fontWeight: 700, margin: '0 0 6px' }}>
          {t('pickone.result.sameAsLast', { name, defaultValue: `You picked ${name} last time too` })}
        </AppText>
      )}

      <div style={{ height: 16 }} />

      {/* Publish inside DineBuddies: a 24h Story and/or a Feed post. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        <CheckRow checked={postStory} onChange={setPostStory} dir={i18n.dir()} label={t('pickone.result.toStory', 'Post to my Story')} />
        <CheckRow checked={postFeed} onChange={setPostFeed} dir={i18n.dir()} label={t('pickone.result.toFeed', 'Post to the Feed')} />
      </div>
      <button type="button" onClick={publish} disabled={publishing || (!postStory && !postFeed)} style={btn(true)}>
        {publishing ? t('pickone.result.publishing', 'Publishing…') : (published ? t('pickone.result.publishedBtn', 'Published ✓') : t('pickone.result.publish', 'Publish'))}
      </button>

      {/* External share (WhatsApp / Instagram / the OS share sheet). */}
      <button type="button" onClick={share} disabled={busy} style={btn(false)}>
        {busy ? t('pickone.result.building', 'Preparing your card…') : t('pickone.result.shareExternal', 'Share externally')}
      </button>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={download} disabled={busy} style={{ ...btn(false), flex: 1 }}>{t('pickone.result.download', 'Download image')}</button>
        <button type="button" onClick={copyLink} style={{ ...btn(false), flex: 1 }}>{t('pickone.result.copyLink', 'Copy link')}</button>
      </div>
      <button type="button" onClick={onPlayAgain} style={btn(false)}>{t('pickone.result.again', 'Play again')}</button>
      {other && (
        <button type="button" onClick={() => onPlayList(other)} style={btn(false)}>
          {t('pickone.result.otherList', { title: listTitle(other, language), defaultValue: `Try: ${listTitle(other, language)}` })}
        </button>
      )}
      <button type="button" onClick={onDone} style={{ ...btn(false), border: 'none', color: 'var(--text-secondary, #6b7280)' }}>{t('pickone.result.done', 'Done')}</button>

      <button
        type="button"
        onClick={() => setShowHistory((v) => !v)}
        style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary, #9ca3af)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', marginTop: 6 }}
      >
        {showHistory ? t('pickone.result.hideHistory', 'Hide your picks') : t('pickone.result.history', 'See how you voted')}
      </button>

      {showHistory && (
        <div style={{ textAlign: 'start', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {state.history.map((h) => (
            <div key={h.round} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'var(--bg-card, #f3f4f6)', border: '1px solid var(--border-color, #e5e7eb)', fontSize: '0.85rem' }}>
              <span style={{ width: 22, color: 'var(--text-tertiary, #9ca3af)', fontWeight: 800 }}>{h.round}</span>
              <span style={{ flex: 1, fontWeight: 800, color: 'var(--text-main)' }}>{entryName(byId[h.winnerId], language)}</span>
              <span style={{ color: 'var(--text-tertiary, #9ca3af)', textDecoration: 'line-through' }}>{entryName(byId[h.loserId], language)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
