import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaCrown, FaHeart, FaShareAlt, FaSignOutAlt, FaTimes, FaVolumeUp, FaVolumeMute, FaCopy, FaLock, FaTrashAlt, FaCheck } from 'react-icons/fa';
import { useGroupGame, groupGameApi } from '../hooks/useGroupGame';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { goToLogin } from '../utils/goToLogin';
import { playWavePingSound } from '../utils/socialPingSound';
import { playMatchCelebrationSound } from '../utils/matchCelebrationSound';
import { AppText } from '../components/base';

const MUTE_KEY = 'db_group_game_muted';
const ROUND_MS = 10000; // must match the server's per-question window
const MAX_PLAYERS = 16; // must match the server cap
// Two vivid option palettes so the choice feels tactile and fun.
const OPT = [
  { grad: 'linear-gradient(135deg,#6366f1,#8b5cf6)', solid: '#7c3aed', ring: 'rgba(124,58,237,0.5)', letter: 'A' },
  { grad: 'linear-gradient(135deg,#f43f5e,#fb7185)', solid: '#e11d48', ring: 'rgba(225,29,72,0.5)', letter: 'B' },
];

function Avatar({ src, name, size = 40, ring }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, ...(ring ? { boxShadow: `0 0 0 2px ${ring}` } : {}) }}>
      {src
        ? <img src={src} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        : <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg,var(--primary),#f0a24b)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.4 }}>{initial}</div>}
    </div>
  );
}

function EmojiBurst({ show, emojis }) {
  if (!show) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 5 }}>
      {Array.from({ length: 18 }).map((_, i) => (
        <span key={i} style={{ position: 'absolute', left: `${(i * 5.5) % 100}%`, top: '110%', fontSize: `${18 + (i % 4) * 9}px`, animation: `dbBurst ${1.4 + (i % 5) * 0.25}s ease-out ${(i % 6) * 0.08}s forwards` }}>{emojis[i % emojis.length]}</span>
      ))}
    </div>
  );
}

export default function GroupGameRoom() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { currentUser, isGuest } = useAuth();
  const { showToast } = useToast();
  const lang = (i18n.language || 'ar').split('-')[0];

  const { game, players, loading, uid, isHost, isPlayer, start, answer, advance, restart, leave, kick, remove } = useGroupGame(gameId);

  const [myPick, setMyPick] = useState(null);
  const [busy, setBusy] = useState('');
  const [joining, setJoining] = useState(false);
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } });
  const [burst, setBurst] = useState(false);
  const prevPhase = useRef('');

  const qText = (q) => q?.text?.[lang] || q?.text?.en || q?.text?.ar || '';
  const qOpts = (q) => q?.options?.[lang] || q?.options?.en || q?.options?.ar || [];

  const round = game?.currentRound ?? -1;
  const question = round >= 0 && game?.questions ? game.questions[round] : null;
  const roundStatus = game?.roundStatus;
  const status = game?.status;

  useEffect(() => { setMyPick(null); }, [round]);

  // ---- Per-question countdown (10s), host auto-reveals at zero ----
  const endsMs = game?.roundEndsAt?.toMillis
    ? game.roundEndsAt.toMillis()
    : (typeof game?.roundEndsAt?.seconds === 'number' ? game.roundEndsAt.seconds * 1000 : null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (status !== 'active' || roundStatus !== 'answering' || !endsMs) return undefined;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [status, roundStatus, endsMs]);
  const remainingMs = endsMs ? Math.max(0, endsMs - nowMs) : null;
  const remainingSec = remainingMs != null ? Math.ceil(remainingMs / 1000) : null;
  const timeUp = remainingMs != null && remainingMs <= 0;

  const autoAdvancedRef = useRef(-1);
  useEffect(() => {
    if (isHost && status === 'active' && roundStatus === 'answering' && timeUp && autoAdvancedRef.current !== round) {
      autoAdvancedRef.current = round;
      advance().catch(() => {});
    }
  }, [isHost, status, roundStatus, timeUp, round, advance]);

  const toggleMute = () => setMuted((m) => { const n = !m; try { localStorage.setItem(MUTE_KEY, n ? '1' : '0'); } catch { /* ignore */ } return n; });

  useEffect(() => {
    const phase = `${status}:${roundStatus}:${round}`;
    if (prevPhase.current && prevPhase.current !== phase) {
      if (status === 'finished') {
        if (!muted) playMatchCelebrationSound();
        setBurst(true);
        const to = setTimeout(() => setBurst(false), 2800);
        prevPhase.current = phase;
        return () => clearTimeout(to);
      }
      if (roundStatus === 'revealed' && !muted) playWavePingSound();
    }
    prevPhase.current = phase;
    return undefined;
  }, [status, roundStatus, round, muted]);

  const requireAuth = () => { if (isGuest || !currentUser) { goToLogin(); return false; } return true; };

  const doJoin = async () => {
    if (!requireAuth()) return;
    setJoining(true);
    try { await groupGameApi.join({ gameId }); }
    catch (e) { showToast(e?.message || t('group_game_join_error', 'Could not join.'), 'error'); }
    finally { setJoining(false); }
  };

  const wrap = (key, fn) => async (...args) => {
    setBusy(key);
    try { await fn(...args); }
    catch (e) { showToast(e?.message || t('admin_failed', 'Something went wrong.'), 'error'); }
    finally { setBusy(''); }
  };

  const spectator = status === 'active' && !isPlayer;
  const pick = async (idx) => {
    if (timeUp || spectator) return;
    setMyPick(idx);
    try { await answer(round, idx); }
    catch (e) { showToast(e?.message || t('group_game_answer_error', 'Could not submit.'), 'error'); setMyPick(null); }
  };

  const shareLink = useMemo(() => (typeof window === 'undefined' || !gameId) ? '' : `${window.location.origin}/group-game/${gameId}`, [gameId]);
  const doShare = async () => {
    const text = t('group_game_share_text', 'Join my group game on DineBuddies!');
    try {
      if (navigator.share) { await navigator.share({ title: 'DineBuddies', text, url: shareLink }); return; }
      await navigator.clipboard.writeText(shareLink);
      showToast(t('group_game_link_copied', 'Link copied.'), 'success');
    } catch { /* cancelled */ }
  };
  const copyCode = async () => { try { await navigator.clipboard.writeText(game?.joinCode || ''); showToast(t('group_game_code_copied', 'Code copied.'), 'success'); } catch { /* ignore */ } };

  const doDelete = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('group_game_delete_confirm', 'Delete this game for everyone? This cannot be undone.'))) return;
    setBusy('delete');
    try { await remove(); navigate('/posts-feed'); }
    catch (e) { showToast(e?.message || t('admin_failed', 'Something went wrong.'), 'error'); setBusy(''); }
  };

  const answeredCount = players.filter((p) => p.answered).length;
  const ranking = useMemo(() => [...players].sort((a, b) => (b.score || 0) - (a.score || 0)), [players]);

  if (loading) {
    return <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: 'var(--bg-main)' }}><div className="db-spin" /></div>;
  }
  if (!game) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: 'var(--bg-main)', padding: 24, textAlign: 'center' }} dir={i18n.dir()}>
        <div>
          <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>🎮</div>
          <AppText as="p" style={{ color: 'var(--text-muted)', marginBottom: 16 }}>{t('group_game_not_found', 'This game is not available.')}</AppText>
          <button className="db-btn db-btn--lime" onClick={() => navigate('/posts-feed')}>{t('close', 'Close')}</button>
        </div>
      </div>
    );
  }

  const isPrivate = game.visibility === 'invite_only';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative',
      background: 'radial-gradient(1200px 600px at 50% -10%, rgba(232,110,46,0.16), transparent 60%), var(--bg-main)' }} dir={i18n.dir()}>
      <style>{GAME_CSS}</style>
      <EmojiBurst show={burst} emojis={['💞', '🎉', '💘', '✨', '💫', '❤️', '🥳']} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--border-color)', background: 'color-mix(in srgb, var(--bg-card) 88%, transparent)', backdropFilter: 'blur(6px)' }}>
        <AppText as="div" style={{ fontWeight: 900, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: '1.15rem' }}>💞</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('group_game_taste_title', 'Group Compatibility')}</span>
        </AppText>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button type="button" onClick={copyCode} title={t('group_game_code', 'Join code')} className="gg-code">
            {isPrivate ? <FaLock size={11} style={{ opacity: 0.7 }} /> : null}{game.joinCode}<FaCopy size={12} style={{ opacity: 0.6 }} />
          </button>
          <button type="button" onClick={toggleMute} aria-label="mute" className="gg-icon">{muted ? <FaVolumeMute /> : <FaVolumeUp />}</button>
          {isHost ? <button type="button" onClick={doDelete} disabled={busy === 'delete'} aria-label="delete" className="gg-icon gg-icon--danger" title={t('group_game_delete', 'Delete game')}><FaTrashAlt /></button> : null}
          <button type="button" onClick={wrap('leave', async () => { await leave(); navigate('/posts-feed'); })} aria-label="leave" className="gg-icon"><FaSignOutAlt /></button>
        </div>
      </div>

      {/* Progress dots (during play) */}
      {status === 'active' ? (
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', padding: '10px 0 2px' }}>
          {Array.from({ length: game.roundCount }).map((_, i) => (
            <span key={i} style={{ width: i === round ? 22 : 8, height: 8, borderRadius: 6, transition: 'all .3s',
              background: i < round ? 'var(--primary)' : i === round ? 'var(--primary)' : 'var(--border-color)', opacity: i <= round ? 1 : 0.5 }} />
          ))}
        </div>
      ) : null}

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, maxWidth: 640, width: '100%', margin: '0 auto' }}>
        {/* ---------------- LOBBY ---------------- */}
        {status === 'lobby' ? (
          <>
            <div className="gg-card" style={{ textAlign: 'center', padding: 20, marginBottom: 16 }}>
              <AppText as="div" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 6 }}>{t('group_game_code', 'Join code')}</AppText>
              <button type="button" onClick={copyCode} className="gg-bigcode">{game.joinCode} <FaCopy size={16} style={{ opacity: 0.5 }} /></button>
              <div style={{ marginTop: 14 }}>
                <button type="button" onClick={doShare} className="gg-btn gg-btn--soft" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><FaShareAlt /> {t('group_game_share', 'Share invite')}</button>
              </div>
            </div>

            <AppText as="div" style={{ fontWeight: 800, marginBottom: 10 }}>{t('group_game_players', 'Players')} · {players.length} / {MAX_PLAYERS}</AppText>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {players.map((p) => (
                <div key={p.uid} className="gg-card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' }}>
                  <Avatar src={p.avatar} name={p.name} />
                  <AppText as="span" style={{ flex: 1, fontWeight: 700 }}>{p.name}{p.uid === game.hostId ? <span style={{ color: 'var(--primary)', marginInlineStart: 6, fontSize: '0.78rem' }}>👑 {t('group_game_host', 'Host')}</span> : null}</AppText>
                  {isHost && p.uid !== uid ? <button type="button" onClick={wrap('kick', () => kick(p.uid))} aria-label="kick" className="gg-icon gg-icon--danger"><FaTimes /></button> : null}
                </div>
              ))}
            </div>

            {!isPlayer ? (
              <button type="button" className="gg-btn gg-btn--primary gg-btn--block" disabled={joining} onClick={doJoin}>
                {joining ? t('group_game_joining', 'Joining…') : `🎮 ${t('group_game_join', 'Join the game')}`}
              </button>
            ) : isHost ? (
              <>
                <button type="button" className="gg-btn gg-btn--primary gg-btn--block" disabled={busy === 'start' || players.length < 3} onClick={wrap('start', start)}>
                  {players.length < 3 ? `⏳ ${t('group_game_need_players_3', 'Need at least 3 players…')}` : `🚀 ${t('group_game_start', 'Start game')}`}
                </button>
                <button type="button" onClick={doDelete} disabled={busy === 'delete'} className="gg-textbtn gg-textbtn--danger"><FaTrashAlt /> {t('group_game_delete', 'Delete game')}</button>
              </>
            ) : (
              <div className="gg-card" style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)' }}>⏳ {t('group_game_wait_host', 'Waiting for the host to start…')}</div>
            )}
          </>
        ) : null}

        {/* ---------------- ACTIVE ---------------- */}
        {status === 'active' && question ? (
          <>
            {/* players answered strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
              {players.map((p) => (
                <div key={p.uid} style={{ position: 'relative' }}>
                  <Avatar src={p.avatar} name={p.name} size={34} ring={p.answered ? '#16a34a' : 'var(--border-color)'} />
                  {p.answered ? <span className="gg-tick"><FaCheck size={8} /></span> : null}
                </div>
              ))}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginInlineStart: 6, fontWeight: 700 }}>{answeredCount}/{players.length}</span>
            </div>

            {spectator ? (
              <div className="gg-card" style={{ padding: '10px 12px', marginBottom: 12, textAlign: 'center', fontWeight: 700, color: 'var(--text-secondary)', border: '1px dashed var(--border-color)' }}>
                👀 {t('group_game_spectator', 'You are watching — the game started before you joined.')}
              </div>
            ) : null}

            <div className="gg-card gg-qcard" style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 800 }}>{t('group_game_round', 'Round')} {round + 1} / {game.roundCount}</div>
                {roundStatus === 'answering' && remainingSec != null ? (
                  <div style={{ fontWeight: 900, fontSize: '1.1rem', color: remainingSec <= 3 ? '#ef4444' : 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    ⏱️ {remainingSec}
                  </div>
                ) : null}
              </div>
              {roundStatus === 'answering' && remainingMs != null ? (
                <div style={{ height: 6, borderRadius: 4, background: 'var(--border-color)', overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ height: '100%', width: `${(remainingMs / ROUND_MS) * 100}%`, background: remainingSec <= 3 ? '#ef4444' : 'linear-gradient(90deg,var(--primary),#f0a24b)', transition: 'width .25s linear' }} />
                </div>
              ) : null}
              <AppText as="div" style={{ fontSize: '1.35rem', fontWeight: 900, lineHeight: 1.35 }}>{qText(question)}</AppText>
            </div>

            {roundStatus === 'answering' ? (
              <div style={{ display: 'grid', gap: 14 }}>
                {qOpts(question).map((opt, idx) => {
                  const p = OPT[idx] || OPT[0];
                  const selected = myPick === idx;
                  const dim = myPick !== null && !selected;
                  return (
                    <button key={idx} type="button" onClick={() => pick(idx)} disabled={timeUp || spectator} className={`gg-option${selected ? ' is-selected' : ''}`}
                      style={{ background: p.grad, boxShadow: selected ? `0 8px 26px ${p.ring}` : '0 4px 14px rgba(0,0,0,0.12)', opacity: dim || spectator || (timeUp && !selected) ? 0.45 : 1, cursor: (timeUp || spectator) ? 'default' : 'pointer' }}>
                      <span className="gg-option__letter">{selected ? <FaCheck /> : p.letter}</span>
                      <span className="gg-option__text">{opt}</span>
                    </button>
                  );
                })}
                {isHost ? (
                  <button type="button" className="gg-btn gg-btn--primary gg-btn--block" disabled={busy === 'advance'} onClick={wrap('advance', advance)}>👁️ {t('group_game_reveal', 'Reveal answers')}</button>
                ) : spectator ? null : (
                  <AppText as="p" style={{ textAlign: 'center', color: timeUp ? '#ef4444' : 'var(--text-muted)', marginTop: 2, fontSize: '0.9rem', fontWeight: timeUp ? 700 : 400 }}>
                    {timeUp ? `⏱️ ${t('group_game_time_up', "Time's up!")}` : myPick !== null ? `✅ ${t('group_game_locked', 'Answer locked — you can change it until reveal.')}` : t('group_game_pick', 'Pick your answer.')}
                  </AppText>
                )}
              </div>
            ) : (
              <RoundReveal game={game} round={round} qOpts={qOpts(question)} t={t} />
            )}

            {roundStatus === 'revealed' && isHost ? (
              <button type="button" className="gg-btn gg-btn--primary gg-btn--block" style={{ marginTop: 16 }} disabled={busy === 'advance'} onClick={wrap('advance', advance)}>
                {round + 1 < game.roundCount ? `➡️ ${t('group_game_next', 'Next question')}` : `🏁 ${t('group_game_finish', 'See results')}`}
              </button>
            ) : null}

            {roundStatus === 'revealed' ? <MiniLeaderboard ranking={ranking} t={t} /> : null}
          </>
        ) : null}

        {/* ---------------- FINISHED ---------------- */}
        {status === 'finished' && game.result ? (
          <ResultScreen result={game.result} isHost={isHost} busy={busy} onRestart={wrap('restart', restart)} onExit={() => navigate('/posts-feed')} t={t} />
        ) : null}
      </div>
    </div>
  );
}

function PlayerTile({ avatar, name, color, size = 44 }) {
  const inner = size - 12;
  return (
    <div title={name} style={{ width: size, height: size, borderRadius: 12, background: color, display: 'grid', placeItems: 'center', boxShadow: '0 2px 7px rgba(0,0,0,0.15)' }}>
      {avatar
        ? <img src={avatar} alt="" style={{ width: inner, height: inner, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }} />
        : <span style={{ width: inner, height: inner, borderRadius: '50%', background: '#fff', color, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: inner * 0.42 }}>{(name || '?').charAt(0).toUpperCase()}</span>}
    </div>
  );
}

function RoundReveal({ game, round, qOpts, t }) {
  const reveal = game.reveal?.[round];
  if (!reveal) return null;
  const nameOf = (uid) => game.players?.[uid]?.name || 'Player';
  const avatarOf = (uid) => game.players?.[uid]?.avatar || '';
  const total = (reveal.counts?.[0] || 0) + (reveal.counts?.[1] || 0) || 1;
  const byOption = [[], []];
  Object.entries(reveal.picks || {}).forEach(([uid, opt]) => { if (byOption[opt]) byOption[opt].push(uid); });
  const noAnswer = (game.playerIds || []).filter((u) => reveal.picks?.[u] === undefined);
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {qOpts.map((opt, idx) => {
        const p = OPT[idx] || OPT[0];
        const count = reveal.counts?.[idx] || 0;
        const pct = Math.round((100 * count) / total);
        const isMaj = reveal.majority === idx;
        return (
          <div key={idx} className="gg-card" style={{ padding: 12, border: isMaj ? '2px solid var(--primary)' : '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, marginBottom: 8 }}>
              <span>{isMaj ? '👑 ' : ''}{opt}</span><span style={{ color: p.solid }}>{count}</span>
            </div>
            <div style={{ height: 8, borderRadius: 6, background: 'var(--border-color)', overflow: 'hidden', marginBottom: byOption[idx].length ? 10 : 0 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: p.grad, transition: 'width .6s ease' }} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {byOption[idx].map((u) => <PlayerTile key={u} avatar={avatarOf(u)} name={nameOf(u)} color={p.solid} />)}
            </div>
          </div>
        );
      })}
      {noAnswer.length ? (
        <div className="gg-card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8, color: 'var(--text-muted)' }}>⏱️ {t('group_game_no_answer', 'No answer')} · {noAnswer.length}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {noAnswer.map((u) => <PlayerTile key={u} avatar={avatarOf(u)} name={nameOf(u)} color="#94a3b8" />)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MiniLeaderboard({ ranking, t }) {
  const medal = ['🥇', '🥈', '🥉'];
  return (
    <div style={{ marginTop: 18 }}>
      <AppText as="div" style={{ fontWeight: 800, marginBottom: 8 }}>📊 {t('group_game_leaderboard', 'Standings')}</AppText>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ranking.map((p, i) => (
          <div key={p.uid} className="gg-card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px' }}>
            <span style={{ width: 24, textAlign: 'center', fontWeight: 800 }}>{medal[i] || i + 1}</span>
            <AppText as="span" style={{ flex: 1, fontWeight: 600 }}>{p.name}</AppText>
            <span style={{ fontWeight: 900, color: 'var(--primary)' }}>{p.score || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultScreen({ result, isHost, busy, onRestart, onExit, t }) {
  const top = (result.ranking || []).slice(0, 3);
  const order = [1, 0, 2]; // silver, gold, bronze podium layout
  const heights = { 0: 92, 1: 68, 2: 52 };
  const medal = ['🥇', '🥈', '🥉'];
  return (
    <div style={{ textAlign: 'center', paddingTop: 4 }}>
      <div style={{ fontSize: '2.6rem', animation: 'dbPop .5s ease' }}>🏆</div>
      <AppText as="div" style={{ fontWeight: 900, fontSize: '1.5rem' }}>{result.winnerName}</AppText>
      <AppText as="div" style={{ color: 'var(--text-muted)', marginBottom: 18 }}>{t('group_game_winner_sub', 'Most in sync with the group')}</AppText>

      {/* podium */}
      {top.length >= 2 ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
          {order.filter((i) => top[i]).map((i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 84 }}>
              <div style={{ fontSize: '1.1rem' }}>{medal[i]}</div>
              <Avatar src={top[i].avatar} name={top[i].name} size={i === 0 ? 54 : 44} ring={i === 0 ? 'var(--primary)' : 'var(--border-color)'} />
              <AppText as="div" style={{ fontSize: '0.78rem', fontWeight: 700, marginTop: 4, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{top[i].name}</AppText>
              <div style={{ width: '100%', height: heights[i], marginTop: 6, borderRadius: '10px 10px 0 0', background: i === 0 ? 'linear-gradient(180deg,var(--primary),#f0a24b)' : 'var(--bg-elevated)', border: '1px solid var(--border-color)', display: 'grid', placeItems: 'center', color: i === 0 ? '#fff' : 'var(--text-main)', fontWeight: 900 }}>{top[i].pct}%</div>
            </div>
          ))}
        </div>
      ) : null}

      {result.topPair ? (
        <div className="gg-card gg-pair" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 800, marginBottom: 6 }}>💞 {t('group_game_top_pair', 'Couple of the night')}</div>
          <AppText as="div" style={{ fontWeight: 900, fontSize: '1.05rem' }}>{result.topPair.aName} <span style={{ color: 'var(--primary)' }}>×</span> {result.topPair.bName}</AppText>
          <AppText as="div" style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--primary)' }}>{result.topPair.pct}%</AppText>
        </div>
      ) : null}

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 999, padding: '8px 18px', marginBottom: 18, fontWeight: 700 }}>
        💫 {t('group_game_group_pct', 'Group harmony')}: <b style={{ color: 'var(--primary)' }}>{result.groupPct}%</b>
      </div>

      {result.contrarianName && (result.ranking?.length || 0) > 2 ? (
        <AppText as="div" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 18 }}>🦄 {t('group_game_contrarian', 'The free spirit')}: <b>{result.contrarianName}</b></AppText>
      ) : null}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {isHost ? <button type="button" className="gg-btn gg-btn--primary" disabled={busy === 'restart'} onClick={onRestart}>🔄 {t('group_game_restart', 'Play again')}</button> : null}
        <button type="button" className="gg-btn gg-btn--soft" onClick={onExit}>{t('group_game_exit', 'Exit')}</button>
      </div>
    </div>
  );
}

const GAME_CSS = `
@keyframes dbBurst{0%{transform:translateY(0) rotate(0);opacity:0}15%{opacity:1}100%{transform:translateY(-130vh) rotate(320deg);opacity:0}}
@keyframes dbPop{0%{transform:scale(0.4);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
.gg-card{background:var(--bg-card);border:1px solid var(--border-color);border-radius:16px}
.gg-qcard{padding:22px 18px;text-align:center;box-shadow:0 6px 22px rgba(0,0,0,0.06)}
.gg-icon{width:38px;height:38px;border-radius:11px;border:1px solid var(--border-color);background:var(--bg-card);color:var(--text-main);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:filter .15s,transform .15s}
.gg-icon:hover{transform:translateY(-1px)}
.gg-icon--danger{color:#ef4444}
.gg-code{display:flex;align-items:center;gap:6px;padding:7px 11px;border-radius:11px;border:1px solid var(--border-color);background:var(--bg-elevated);color:var(--text-main);cursor:pointer;font-weight:800;letter-spacing:2px}
.gg-bigcode{background:none;border:none;cursor:pointer;color:var(--text-main);font-size:2.1rem;font-weight:900;letter-spacing:6px;display:inline-flex;align-items:center;gap:10px}
.gg-option{position:relative;display:flex;align-items:center;gap:14px;width:100%;padding:20px 18px;border:none;border-radius:18px;color:#fff;cursor:pointer;text-align:start;transition:transform .12s ease,box-shadow .2s ease,opacity .2s}
.gg-option:hover{transform:translateY(-2px)}
.gg-option:active{transform:scale(.98)}
.gg-option.is-selected{transform:translateY(-2px) scale(1.01)}
.gg-option__letter{flex-shrink:0;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:1.05rem}
.gg-option__text{font-weight:800;font-size:1.1rem}
.gg-tick{position:absolute;bottom:-2px;inset-inline-end:-2px;width:15px;height:15px;border-radius:50%;background:#16a34a;color:#fff;display:flex;align-items:center;justify-content:center;border:2px solid var(--bg-main)}
.gg-btn{border:none;border-radius:14px;padding:13px 20px;font-weight:800;font-size:1rem;cursor:pointer;transition:transform .12s ease,filter .15s;display:inline-flex;align-items:center;justify-content:center;gap:8px}
.gg-btn:hover{filter:brightness(1.05)}
.gg-btn:active{transform:scale(.98)}
.gg-btn:disabled{opacity:.55;cursor:default}
.gg-btn--primary{background:linear-gradient(135deg,var(--primary),#f0a24b);color:#fff;box-shadow:0 6px 18px rgba(232,110,46,0.35)}
.gg-btn--soft{background:var(--bg-elevated);color:var(--text-main);border:1px solid var(--border-color)}
.gg-btn--block{width:100%;padding:16px;font-size:1.05rem}
.gg-textbtn{width:100%;margin-top:10px;padding:12px;background:none;border:none;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;color:var(--text-muted)}
.gg-textbtn--danger{color:#ef4444}
.gg-pair{background:linear-gradient(135deg,rgba(232,110,46,0.14),rgba(232,110,46,0.03));border:1px solid var(--primary)}
`;
