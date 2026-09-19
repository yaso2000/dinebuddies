import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaPlay, FaPause } from 'react-icons/fa';
import { AppText } from '../base';
import './VoiceMessagePlayer.css';

const fmt = (secs) => {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Themed voice-message player — replaces the default <audio controls>. Play/pause,
 * a seekable progress bar and a live time readout, tinted to sit on the sender's
 * gradient bubble (`isOwn`) or a received light bubble.
 */
export default function VoiceMessagePlayer({ src, duration = 0, isOwn = false }) {
  const audioRef = useRef(null);
  const trackRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  // Prefer the file's real duration once known; fall back to the stored value.
  const [total, setTotal] = useState(Number(duration) || 0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;
    const onTime = () => setCurrent(el.currentTime || 0);
    const onMeta = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setTotal(el.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('ended', onEnd);
    el.addEventListener('pause', () => setPlaying(false));
    el.addEventListener('play', () => setPlaying(true));
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('ended', onEnd);
    };
  }, []);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, []);

  const seek = useCallback((clientX) => {
    const el = audioRef.current;
    const track = trackRef.current;
    if (!el || !track || !total) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    el.currentTime = ratio * total;
    setCurrent(el.currentTime);
  }, [total]);

  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  const timeLabel = playing || current > 0 ? fmt(current) : fmt(total);

  return (
    <div className={`voice-player${isOwn ? ' voice-player--own' : ' voice-player--other'}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        className="voice-player__btn"
        aria-label={playing ? 'Pause' : 'Play'}
        onClick={toggle}
      >
        {playing ? <FaPause size={13} /> : <FaPlay size={13} style={{ marginInlineStart: 2 }} />}
      </button>

      <div
        ref={trackRef}
        className="voice-player__track"
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.round(current)}
        tabIndex={0}
        onClick={(e) => seek(e.clientX)}
      >
        <span className="voice-player__fill" style={{ width: `${pct}%` }} />
        <span className="voice-player__thumb" style={{ insetInlineStart: `${pct}%` }} />
      </div>

      <AppText as="span" className="voice-player__time">{timeLabel}</AppText>
    </div>
  );
}
