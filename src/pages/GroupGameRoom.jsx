import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaCrown, FaHeart, FaShareAlt, FaSignOutAlt, FaTimes, FaVolumeUp, FaVolumeMute, FaCopy, FaLock, FaTrashAlt } from 'react-icons/fa';
import { useGroupGame, groupGameApi } from '../hooks/useGroupGame';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { goToLogin } from '../utils/goToLogin';
import { playWavePingSound } from '../utils/socialPingSound';
import { playMatchCelebrationSound } from '../utils/matchCelebrationSound';
import { AppText } from '../components/base';

const MUTE_KEY = 'db_group_game_muted';

function Avatar({ src, name, size = 40 }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return src
    ? <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.4 }}>{initial}</div>;
}

function EmojiBurst({ show, emojis }) {
  if (!show) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 5 }}>
      {Array.from({ length: 16 }).map((_, i) => (
        <span key={i} style={{
          position: 'absolute', left: `${(i * 6.5) % 100}%`, top: '110%', fontSize: `${18 + (i % 4) * 8}px`,
          animation: `dbBurst ${1.4 + (i % 5) * 0.25}s ease-out ${(i % 6) * 0.08}s forwards`,
        }}>{emojis[i % emojis.length]}</span>
      ))}
      <style>{`@keyframes dbBurst{0%{transform:translateY(0) rotate(0);opacity:0}15%{opacity:1}100%{transform:translateY(-130vh) rotate(320deg);opacity:0}}`}</style>
    </div>
  );
}

export default function GroupGameRoom() {
  const { gameId } = useParams();
  const [sp] = useSearchParams();
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

  // Reset my local pick when the round changes.
  useEffect(() => { setMyPick(null); }, [round]);

  const toggleMute = () => setMuted((m) => { const n = !m; try { localStorage.setItem(MUTE_KEY, n ? '1' : '0'); } catch { /* ignore */ } return n; });

  // Sound + emoji on phase transitions.
  useEffect(() => {
    const phase = `${status}:${roundStatus}:${round}`;
    if (prevPhase.current && prevPhase.current !== phase) {
      if (status === 'finished') {
        if (!muted) playMatchCelebrationSound();
        setBurst(true);
        const to = setTimeout(() => setBurst(false), 2600);
        prevPhase.current = phase;
        return () => clearTimeout(to);
      }
      if (roundStatus === 'revealed' && !muted) playWavePingSound();
    }
    prevPhase.current = phase;
    return undefined;
  }, [status, roundStatus, round, muted]);

  const doJoin = async () => {
    if (isGuest || !currentUser) { goToLogin(); return; }
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

  const pick = async (idx) => {
    setMyPick(idx);
    try { await answer(round, idx); }
    catch (e) { showToast(e?.message || t('group_game_answer_error', 'Could not submit.'), 'error'); setMyPick(null); }
  };

  const shareLink = useMemo(() => {
    if (typeof window === 'undefined' || !gameId) return '';
    return `${window.location.origin}/group-game/${gameId}`;
  }, [gameId]);

  const doShare = async () => {
    const text = t('group_game_share_text', 'Join my group game on DineBuddies!');
    try {
      if (navigator.share) { await navigator.share({ title: 'DineBuddies', text, url: shareLink }); return; }
      await navigator.clipboard.writeText(shareLink);
      showToast(t('group_game_link_copied', 'Link copied.'), 'success');
    } catch { /* user cancelled */ }
  };

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(game?.joinCode || ''); showToast(t('group_game_code_copied', 'Code copied.'), 'success'); } catch { /* ignore */ }
  };

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
          <AppText as="p" style={{ color: 'var(--text-muted)', marginBottom: 16 }}>{t('group_game_not_found', 'This game is not available.')}</AppText>
          <button className="db-btn db-btn--lime" onClick={() => navigate('/posts-feed')}>{t('close', 'Close')}</button>
        </div>
      </div>
    );
  }

  const isPrivate = game.visibility === 'invite_only';
  const headerBar = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
      <AppText as="div" style={{ fontWeight: 900, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <FaHeart color="var(--primary)" style={{ flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('group_game_taste_title', 'Group Compatibility')}</span>
      </AppText>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* Join code — always visible at the top so it can be shared/read any time. */}
        <button type="button" onClick={copyCode} title={t('group_game_code', 'Join code')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 800, letterSpacing: 2 }}>
          {isPrivate ? <FaLock size={11} color="var(--text-muted)" /> : null}
          {game.joinCode}
          <FaCopy size={12} color="var(--text-muted)" />
        </button>
        <button type="button" onClick={toggleMute} aria-label="mute" style={iconBtn}>{muted ? <FaVolumeMute /> : <FaVolumeUp />}</button>
        {isHost ? (
          <button type="button" onClick={doDelete} disabled={busy === 'delete'} aria-label="delete" style={{ ...iconBtn, color: '#ef4444' }} title={t('group_game_delete', 'Delete game')}><FaTrashAlt /></button>
        ) : null}
        <button type="button" onClick={wrap('leave', async () => { await leave(); navigate('/posts-feed'); })} aria-label="leave" style={iconBtn}><FaSignOutAlt /></button>
      </div>
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)', position: 'relative' }} dir={i18n.dir()}>
      <EmojiBurst show={burst} emojis={['💞', '🎉', '💘', '✨', '💫', '❤️']} />
      {headerBar}

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, maxWidth: 640, width: '100%', margin: '0 auto' }}>
        {/* ---------------- LOBBY ---------------- */}
        {status === 'lobby' ? (
          <>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 16, marginBottom: 16, textAlign: 'center' }}>
              <AppText as="div" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>{t('group_game_code', 'Join code')}</AppText>
              <button type="button" onClick={copyCode} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontSize: '2rem', fontWeight: 900, letterSpacing: 6, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                {game.joinCode} <FaCopy size={16} color="var(--text-muted)" />
              </button>
              <div style={{ marginTop: 12 }}>
                <button type="button" className="db-btn db-btn--ghost" onClick={doShare} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <FaShareAlt /> {t('group_game_share', 'Share invite')}
                </button>
              </div>
            </div>

            <AppText as="div" style={{ fontWeight: 800, marginBottom: 8 }}>{t('group_game_players', 'Players')} ({players.length})</AppText>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {players.map((p) => (
                <div key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '8px 12px' }}>
                  <Avatar src={p.avatar} name={p.name} />
                  <AppText as="span" style={{ flex: 1, fontWeight: 600 }}>{p.name}{p.uid === game.hostId ? <span style={{ color: 'var(--primary)', marginInlineStart: 6, fontSize: '0.8rem' }}>· {t('group_game_host', 'Host')}</span> : null}</AppText>
                  {isHost && p.uid !== uid ? (
                    <button type="button" onClick={wrap('kick', () => kick(p.uid))} aria-label="kick" style={{ ...iconBtn, color: 'var(--danger, #ef4444)' }}><FaTimes /></button>
                  ) : null}
                </div>
              ))}
            </div>

            {!isPlayer ? (
              <button type="button" className="db-btn db-btn--lime" style={bigBtn} disabled={joining} onClick={doJoin}>
                {joining ? t('group_game_joining', 'Joining…') : t('group_game_join', 'Join the game')}
              </button>
            ) : isHost ? (
              <>
                <button type="button" className="db-btn db-btn--lime" style={bigBtn} disabled={busy === 'start' || players.length < 2} onClick={wrap('start', start)}>
                  {players.length < 2 ? t('group_game_need_players', 'Waiting for players…') : t('group_game_start', 'Start game')}
                </button>
                <button type="button" onClick={doDelete} disabled={busy === 'delete'}
                  style={{ width: '100%', marginTop: 10, padding: 12, background: 'transparent', border: 'none', color: '#ef4444', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <FaTrashAlt /> {t('group_game_delete', 'Delete game')}
                </button>
              </>
            ) : (
              <AppText as="p" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{t('group_game_wait_host', 'Waiting for the host to start…')}</AppText>
            )}
          </>
        ) : null}

        {/* ---------------- ACTIVE ---------------- */}
        {status === 'active' && question ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 10 }}>
              <span>{t('group_game_round', 'Round')} {round + 1} / {game.roundCount}</span>
              <span>{answeredCount}/{players.length} {t('group_game_answered', 'answered')}</span>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '22px 16px', textAlign: 'center', marginBottom: 16 }}>
              <AppText as="div" style={{ fontSize: '1.25rem', fontWeight: 800 }}>{qText(question)}</AppText>
            </div>

            {roundStatus === 'answering' ? (
              <div style={{ display: 'grid', gap: 12 }}>
                {qOpts(question).map((opt, idx) => {
                  const selected = myPick === idx;
                  return (
                    <button key={idx} type="button" onClick={() => pick(idx)}
                      style={{ padding: '18px 16px', borderRadius: 14, fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer',
                        border: `2px solid ${selected ? 'var(--primary)' : 'var(--border-color)'}`,
                        background: selected ? 'var(--primary)' : 'var(--bg-card)', color: selected ? '#fff' : 'var(--text-main)', transition: 'all .15s' }}>
                      {opt}
                    </button>
                  );
                })}
                {isHost ? (
                  <button type="button" className="db-btn db-btn--lime" style={bigBtn} disabled={busy === 'advance'} onClick={wrap('advance', advance)}>
                    {t('group_game_reveal', 'Reveal answers')}
                  </button>
                ) : (
                  <AppText as="p" style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 4 }}>
                    {myPick !== null ? t('group_game_locked', 'Answer locked — you can change it until reveal.') : t('group_game_pick', 'Pick your answer.')}
                  </AppText>
                )}
              </div>
            ) : (
              /* revealed */
              <RoundReveal game={game} round={round} players={players} qOpts={qOpts(question)} t={t} />
            )}

            {roundStatus === 'revealed' && isHost ? (
              <button type="button" className="db-btn db-btn--lime" style={{ ...bigBtn, marginTop: 16 }} disabled={busy === 'advance'} onClick={wrap('advance', advance)}>
                {round + 1 < game.roundCount ? t('group_game_next', 'Next question') : t('group_game_finish', 'See results')}
              </button>
            ) : null}

            {roundStatus === 'revealed' ? <MiniLeaderboard ranking={ranking} game={game} t={t} /> : null}
          </>
        ) : null}

        {/* ---------------- FINISHED ---------------- */}
        {status === 'finished' && game.result ? (
          <ResultScreen result={game.result} game={game} isHost={isHost} busy={busy} onRestart={wrap('restart', restart)} onExit={() => navigate('/posts-feed')} t={t} />
        ) : null}
      </div>
    </div>
  );
}

function RoundReveal({ game, round, players, qOpts, t }) {
  const reveal = game.reveal?.[round];
  if (!reveal) return null;
  const nameOf = (uid) => game.players?.[uid]?.name || 'Player';
  const byOption = [[], []];
  Object.entries(reveal.picks || {}).forEach(([uid, opt]) => { if (byOption[opt]) byOption[opt].push(nameOf(uid)); });
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {qOpts.map((opt, idx) => {
        const count = reveal.counts?.[idx] || 0;
        const isMaj = reveal.majority === idx;
        return (
          <div key={idx} style={{ borderRadius: 14, padding: '14px 16px', border: `2px solid ${isMaj ? 'var(--primary)' : 'var(--border-color)'}`, background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginBottom: byOption[idx].length ? 6 : 0 }}>
              <span>{opt}</span><span style={{ color: 'var(--primary)' }}>{count}</span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{byOption[idx].join('، ')}</div>
          </div>
        );
      })}
    </div>
  );
}

function MiniLeaderboard({ ranking, game, t }) {
  return (
    <div style={{ marginTop: 18 }}>
      <AppText as="div" style={{ fontWeight: 800, marginBottom: 8 }}>{t('group_game_leaderboard', 'Standings')}</AppText>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ranking.map((p, i) => (
          <div key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '6px 12px' }}>
            <span style={{ width: 22, fontWeight: 800, color: 'var(--text-muted)' }}>{i + 1}</span>
            <AppText as="span" style={{ flex: 1 }}>{p.name}</AppText>
            <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{p.score || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultScreen({ result, game, isHost, busy, onRestart, onExit, t }) {
  const winner = result.ranking?.[0];
  return (
    <div style={{ textAlign: 'center', paddingTop: 8 }}>
      <div style={{ fontSize: '3rem' }}>🏆</div>
      <AppText as="div" style={{ fontWeight: 900, fontSize: '1.4rem', marginBottom: 4 }}>{result.winnerName}</AppText>
      <AppText as="div" style={{ color: 'var(--text-muted)', marginBottom: 18 }}>{t('group_game_winner_sub', 'Most in sync with the group')}</AppText>

      {result.topPair ? (
        <div style={{ background: 'linear-gradient(135deg, rgba(232,110,46,0.12), rgba(232,110,46,0.04))', border: '1px solid var(--primary)', borderRadius: 16, padding: 16, marginBottom: 18 }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 800, marginBottom: 6 }}>💞 {t('group_game_top_pair', 'Couple of the night')}</div>
          <AppText as="div" style={{ fontWeight: 800 }}>{result.topPair.aName} × {result.topPair.bName}</AppText>
          <AppText as="div" style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--primary)' }}>{result.topPair.pct}%</AppText>
        </div>
      ) : null}

      <div style={{ display: 'inline-block', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '8px 16px', marginBottom: 18 }}>
        {t('group_game_group_pct', 'Group harmony')}: <b style={{ color: 'var(--primary)' }}>{result.groupPct}%</b>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18, textAlign: 'start' }}>
        {result.ranking?.map((p, i) => (
          <div key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-card)', border: `1px solid ${i === 0 ? 'var(--primary)' : 'var(--border-color)'}`, borderRadius: 10, padding: '8px 12px' }}>
            <span style={{ width: 22 }}>{i === 0 ? <FaCrown color="var(--primary)" /> : i + 1}</span>
            <AppText as="span" style={{ flex: 1 }}>{p.name}</AppText>
            <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{p.score}</span>
          </div>
        ))}
      </div>

      {result.contrarianName && result.ranking?.length > 2 ? (
        <AppText as="div" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 18 }}>
          🦄 {t('group_game_contrarian', 'The free spirit')}: <b>{result.contrarianName}</b>
        </AppText>
      ) : null}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {isHost ? <button type="button" className="db-btn db-btn--lime" disabled={busy === 'restart'} onClick={onRestart}>{t('group_game_restart', 'Play again')}</button> : null}
        <button type="button" className="db-btn db-btn--ghost" onClick={onExit}>{t('group_game_exit', 'Exit')}</button>
      </div>
    </div>
  );
}

const iconBtn = { width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const bigBtn = { width: '100%', padding: '16px', fontSize: '1.05rem', fontWeight: 800, marginTop: 4 };
