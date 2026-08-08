import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPause, FaPlay, FaStop } from 'react-icons/fa';
import {
    computeYoutubeMemberStartSec,
    normalizeYoutubePositionSec,
    pickTrustedYoutubePauseSec,
    postYoutubeEmbedCommand,
    postYoutubeEmbedListening,
    requestYoutubeEmbedCurrentTime,
    syncYoutubeEmbedPlayback,
} from '../../utils/videoEmbedUtils';

const HIDE_AFTER_MS = 3200;

/**
 * Host YouTube controls (2 buttons, bottom; auto-hide while playing):
 * - ▶ / ⏸  Play resumes from pause point (synced). Pause freezes at current point (synced).
 * - ■      Hard stop to 0 + synced. Next play starts from the beginning.
 *
 * Host iframe playback is driven only from here — not from Firestore echoes.
 */
export default function CommunityBannerYoutubeHostControls({
    iframeRef,
    syncAtMs = 0,
    positionSec = 0,
    paused = false,
    isLive = false,
    onPlaybackSync,
    visible = false,
}) {
    const { t } = useTranslation();
    const [isPaused, setIsPaused] = useState(Boolean(paused));
    const [chromeOpen, setChromeOpen] = useState(Boolean(paused));
    const hideTimerRef = useRef(null);
    const clockRef = useRef({
        syncAtMs: Number(syncAtMs) || 0,
        positionSec: normalizeYoutubePositionSec(positionSec),
        paused: Boolean(paused),
    });
    const pauseBusyRef = useRef(false);
    const prevPausedRef = useRef(Boolean(paused));

    // Adopt remote banner clock only when we are not mid local pause/play.
    useEffect(() => {
        const nextPaused = Boolean(paused);
        const nextPos = normalizeYoutubePositionSec(positionSec);
        const nextSync = Number(syncAtMs) || 0;
        if (pauseBusyRef.current) return;

        const local = clockRef.current;
        // Never let a stale remote snapshot rewind a fresher local pause point.
        if (nextSync + 50 < (local.syncAtMs || 0)) return;

        clockRef.current = {
            syncAtMs: nextSync || local.syncAtMs,
            positionSec: nextPos,
            paused: nextPaused,
        };

        setIsPaused((prev) => (prev === nextPaused ? prev : nextPaused));
        if (nextPaused) setChromeOpen(true);
    }, [paused, positionSec, syncAtMs]);

    const clearHideTimer = useCallback(() => {
        if (hideTimerRef.current) {
            window.clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    }, []);

    const scheduleHideWhilePlaying = useCallback(() => {
        clearHideTimer();
        setChromeOpen(true);
        hideTimerRef.current = window.setTimeout(() => {
            setChromeOpen(false);
            hideTimerRef.current = null;
        }, HIDE_AFTER_MS);
    }, [clearHideTimer]);

    useEffect(() => () => clearHideTimer(), [clearHideTimer]);

    // Open chrome only on pause / resume transitions — never on unrelated prop ticks.
    useEffect(() => {
        const wasPaused = prevPausedRef.current;
        prevPausedRef.current = isPaused;
        if (isPaused) {
            clearHideTimer();
            setChromeOpen(true);
            return;
        }
        if (wasPaused) {
            scheduleHideWhilePlaying();
        }
    }, [clearHideTimer, isPaused, scheduleHideWhilePlaying]);

    const withIframe = useCallback(
        (runner) => {
            const iframe = iframeRef?.current;
            if (!iframe) return;
            postYoutubeEmbedListening(iframe);
            runner(iframe);
        },
        [iframeRef]
    );

    const publishSync = useCallback(
        (next) => {
            const at = normalizeYoutubePositionSec(next.positionSec);
            const now = Date.now();
            clockRef.current = {
                syncAtMs: now,
                positionSec: at,
                paused: Boolean(next.paused),
            };
            onPlaybackSync?.({ paused: Boolean(next.paused), positionSec: at });
        },
        [onPlaybackSync]
    );

    const wallClockSec = useCallback(() => {
        if (isLive) return 0;
        const clock = clockRef.current;
        return computeYoutubeMemberStartSec(clock.syncAtMs || syncAtMs, {
            positionSec: clock.positionSec,
            paused: clock.paused,
            isLive: false,
        });
    }, [isLive, syncAtMs]);

    // Host refresh / re-enter: re-anchor Firestore clock to the real playhead so late joiners
    // get a sane start= (stale sync_at + position 0 made guest embeds fail after long play).
    useEffect(() => {
        if (!visible || isLive || typeof onPlaybackSync !== 'function') return undefined;
        let cancelled = false;
        const timer = window.setTimeout(async () => {
            if (cancelled || pauseBusyRef.current) return;
            if (clockRef.current.paused) return;
            const wall = wallClockSec();
            let at = wall;
            const iframe = iframeRef?.current;
            if (iframe) {
                const playerAt = await requestYoutubeEmbedCurrentTime(iframe);
                at = pickTrustedYoutubePauseSec(wall, playerAt);
            }
            if (cancelled || pauseBusyRef.current || clockRef.current.paused) return;
            publishSync({ paused: false, positionSec: at });
        }, 1400);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
        // Intentionally once when host controls mount / become visible after refresh.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, isLive]);

    /** ▶ Resume from frozen pause point — do not seek (seekTo can restart some embeds at 0). */
    const handlePlay = useCallback(() => {
        const clock = clockRef.current;
        const at = isLive ? 0 : normalizeYoutubePositionSec(clock.positionSec);
        withIframe((iframe) => {
            postYoutubeEmbedCommand(iframe, 'playVideo');
        });
        setIsPaused(false);
        publishSync({ paused: false, positionSec: at });
        scheduleHideWhilePlaying();
    }, [isLive, publishSync, scheduleHideWhilePlaying, withIframe]);

    /** ⏸ Freeze at trusted playhead. Sync everyone. */
    const handlePause = useCallback(async () => {
        if (pauseBusyRef.current) return;
        pauseBusyRef.current = true;
        try {
            const wall = wallClockSec();
            let at = wall;
            const iframe = iframeRef?.current;
            if (iframe && !isLive) {
                const playerAt = await requestYoutubeEmbedCurrentTime(iframe);
                at = pickTrustedYoutubePauseSec(wall, playerAt);
            }
            withIframe((frame) => {
                // Seek+pause so guests and host share the same freeze frame.
                syncYoutubeEmbedPlayback(frame, at, { paused: true });
            });
            setIsPaused(true);
            setChromeOpen(true);
            clearHideTimer();
            publishSync({ paused: true, positionSec: at });
        } finally {
            pauseBusyRef.current = false;
        }
    }, [clearHideTimer, iframeRef, isLive, publishSync, wallClockSec, withIframe]);

    const handleTogglePlayPause = useCallback(
        (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (isPaused) handlePlay();
            else void handlePause();
        },
        [handlePause, handlePlay, isPaused]
    );

    const handleHardStop = useCallback(
        (event) => {
            event.preventDefault();
            event.stopPropagation();
            withIframe((iframe) => {
                syncYoutubeEmbedPlayback(iframe, 0, { paused: true });
            });
            setIsPaused(true);
            setChromeOpen(true);
            clearHideTimer();
            publishSync({ paused: true, positionSec: 0 });
        },
        [clearHideTimer, publishSync, withIframe]
    );

    const handleReveal = useCallback(
        (event) => {
            event.preventDefault();
            event.stopPropagation();
            setChromeOpen(true);
            if (!isPaused) scheduleHideWhilePlaying();
        },
        [isPaused, scheduleHideWhilePlaying]
    );

    if (!visible) return null;

    const showChrome = chromeOpen || isPaused;

    return (
        <>
            {!showChrome ? (
                <button
                    type="button"
                    className="community-main-chat__banner-youtube-host-hit"
                    aria-label={t('community_banner_youtube_show_controls', 'Show video controls')}
                    onClick={handleReveal}
                    onPointerDown={(event) => event.stopPropagation()}
                />
            ) : null}

            <div
                className={`community-main-chat__banner-youtube-host-controls${showChrome ? ' is-open' : ' is-hidden'}`}
                role="toolbar"
                aria-label={t('community_banner_youtube_host_controls', 'Video controls')}
                aria-hidden={showChrome ? undefined : true}
            >
                <button
                    type="button"
                    className={`community-main-chat__banner-youtube-host-controls__btn community-main-chat__banner-youtube-host-controls__btn--toggle${isPaused ? ' is-paused' : ' is-playing'}`}
                    onClick={handleTogglePlayPause}
                    onPointerDown={(event) => event.stopPropagation()}
                    aria-label={
                        isPaused
                            ? t('community_banner_youtube_play', 'Play from here (sync everyone)')
                            : t('community_banner_youtube_pause', 'Pause here (sync everyone)')
                    }
                    title={
                        isPaused
                            ? t('community_banner_youtube_play', 'Play from here (sync everyone)')
                            : t('community_banner_youtube_pause', 'Pause here (sync everyone)')
                    }
                >
                    {isPaused ? <FaPlay size={20} aria-hidden /> : <FaPause size={20} aria-hidden />}
                </button>

                <button
                    type="button"
                    className="community-main-chat__banner-youtube-host-controls__btn community-main-chat__banner-youtube-host-controls__btn--stop"
                    onClick={handleHardStop}
                    onPointerDown={(event) => event.stopPropagation()}
                    aria-label={t('community_banner_youtube_hard_stop', 'Stop and restart from beginning')}
                    title={t('community_banner_youtube_hard_stop', 'Stop and restart from beginning')}
                >
                    <FaStop size={17} aria-hidden />
                </button>
            </div>
        </>
    );
}
