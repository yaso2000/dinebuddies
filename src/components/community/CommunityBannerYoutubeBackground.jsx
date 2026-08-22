import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    buildYoutubeBannerBackgroundSrc,
    computeYoutubeMemberStartSec,
    getYoutubeThumbnailCandidates,
    isIosLikeDevice,
    parseYoutubeEmbedMessage,
    postYoutubeEmbedCommand,
    postYoutubeEmbedListening,
    requestYoutubeEmbedCurrentTime,
    softSeekYoutubeEmbed,
    syncMemberYoutubeToHost,
    syncYoutubeEmbedPlayback,
    YOUTUBE_DRIFT_RESYNC_MS,
    YOUTUBE_DRIFT_TOLERANCE_SEC,
    YOUTUBE_EMBED_ALLOW,
    YOUTUBE_PLAYER_STATE,
} from '../../utils/videoEmbedUtils';

function useYoutubeEmbedPlayback({ onPlaying, onError, enabled = true }) {
    const playingRef = useRef(false);

    useEffect(() => {
        if (!enabled) return undefined;

        const onMessage = (event) => {
            const parsed = parseYoutubeEmbedMessage(event);
            if (!parsed) return;

            if (parsed.type === 'error') {
                playingRef.current = false;
                onError?.(parsed.code);
                return;
            }

            if (parsed.type !== 'state') return;

            const isPlaying = parsed.state === YOUTUBE_PLAYER_STATE.PLAYING;
            const wasPlaying = playingRef.current;
            playingRef.current = isPlaying;

            if (isPlaying && !wasPlaying) {
                onPlaying?.();
            }
        };

        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [enabled, onError, onPlaying]);
}

/** Stable iframe identity — never include wall-clock startSec (remounts kill iOS playback). */
function youtubeMediaKey(videoId, playlistId, isLive) {
    return `${videoId || 'list'}|${playlistId || ''}|${isLive ? 'live' : 'vod'}`;
}

/** Host / preview — iframe with YouTube controls; sync only via explicit host actions. */
function HostYoutubeEmbed({
    videoId,
    playlistId = '',
    preview,
    playbackEnabled = true,
    isShort = false,
    isLive = false,
    paused = false,
    positionSec = 0,
    syncAtMs = 0,
    hostIframeRef,
}) {
    const localIframeRef = useRef(null);
    const mediaKey = youtubeMediaKey(videoId, playlistId, isLive);
    const initialStartRef = useRef(null);
    const lastMediaKeyRef = useRef(mediaKey);
    const lastPlaybackEnabledRef = useRef(playbackEnabled);

    if (lastMediaKeyRef.current !== mediaKey) {
        lastMediaKeyRef.current = mediaKey;
        initialStartRef.current = null;
        lastPlaybackEnabledRef.current = playbackEnabled;
    }
    if (initialStartRef.current == null) {
        initialStartRef.current = computeYoutubeMemberStartSec(syncAtMs, {
            positionSec,
            paused,
            isLive,
        });
    }

    const assignIframeRef = (node) => {
        localIframeRef.current = node;
        if (hostIframeRef) {
            hostIframeRef.current = node;
        }
    };

    // iOS Safari often rejects unmuted iframe autoplay — start muted; host can unmute via controls.
    const hostMuted = isIosLikeDevice();

    const embedSrc = useMemo(
        () =>
            buildYoutubeBannerBackgroundSrc(videoId, {
                muted: hostMuted,
                // Hide native YT controls — host uses our centered play/pause + stop.
                controls: false,
                loop: false,
                startSec: isLive ? 0 : initialStartRef.current || 0,
                playlistId,
                isLive,
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- start locked at media identity
        [videoId, playlistId, isLive, hostMuted, mediaKey]
    );

    const handleIframeLoad = () => {
        if (localIframeRef.current) {
            postYoutubeEmbedListening(localIframeRef.current);
        }
    };

    // Host playhead is owned by HostControls. Only react to voice/media playbackEnabled here.
    // Re-seeking from Firestore pause/play was restarting the host video at 0.
    useEffect(() => {
        const iframe = localIframeRef.current;
        if (!iframe || preview) return;
        postYoutubeEmbedListening(iframe);
        const wasEnabled = lastPlaybackEnabledRef.current;
        lastPlaybackEnabledRef.current = playbackEnabled;

        if (!playbackEnabled) {
            postYoutubeEmbedCommand(iframe, 'pauseVideo');
            return;
        }
        // Voice finished / media re-enabled — resume without seek (keep current frame).
        if (!wasEnabled && playbackEnabled && !(paused && !isLive)) {
            postYoutubeEmbedCommand(iframe, 'playVideo');
        }
    }, [playbackEnabled, preview, paused, isLive]);

    const posterCandidates = useMemo(
        () => getYoutubeThumbnailCandidates(videoId, { isShort }),
        [videoId, isShort]
    );
    const posterUrl = posterCandidates[0] || '';

    const rootClass = [
        'community-main-chat__banner-youtube',
        preview ? 'community-main-chat__banner-youtube--preview' : 'community-main-chat__banner-youtube--host',
        !playbackEnabled ? 'community-main-chat__banner-youtube--paused' : '',
        isLive ? 'community-main-chat__banner-youtube--live' : '',
    ].join(' ');

    return (
        <div className={rootClass}>
            {!playbackEnabled && posterUrl ? (
                <img
                    src={posterUrl}
                    alt=""
                    className="community-main-chat__banner-youtube-poster"
                    referrerPolicy="no-referrer"
                />
            ) : null}
            <iframe
                ref={assignIframeRef}
                key={mediaKey}
                src={embedSrc}
                title="YouTube banner"
                className="community-main-chat__banner-youtube-frame"
                allow={`${YOUTUBE_EMBED_ALLOW}; fullscreen`}
                allowFullScreen
                playsInline
                loading="eager"
                onLoad={handleIframeLoad}
                style={playbackEnabled || preview ? undefined : { visibility: 'hidden' }}
            />
        </div>
    );
}

/** Members — muted autoplay; soft-seek on host sync (no iframe remount). */
function MemberYoutubeEmbed({
    videoId,
    playlistId = '',
    isShort = false,
    isLive = false,
    paused = false,
    positionSec = 0,
    syncAtMs = 0,
    memberIframeRef,
    onMemberVideoReady,
    playbackEnabled = true,
}) {
    const { t } = useTranslation();
    const localIframeRef = useRef(null);
    const [revealed, setRevealed] = useState(false);
    const [errored, setErrored] = useState(false);
    const [syncFlash, setSyncFlash] = useState(false);
    const mediaKey = youtubeMediaKey(videoId, playlistId, isLive);
    const initialStartRef = useRef(null);
    const lastMediaKeyRef = useRef(mediaKey);
    const lastSoftSyncRef = useRef({ syncAtMs: 0, positionSec: 0, paused: false });
    const guestSyncBusyRef = useRef(false);
    const syncFlashTimerRef = useRef(null);

    if (lastMediaKeyRef.current !== mediaKey) {
        lastMediaKeyRef.current = mediaKey;
        initialStartRef.current = null;
        lastSoftSyncRef.current = { syncAtMs: 0, positionSec: 0, paused: false };
    }
    if (initialStartRef.current == null) {
        initialStartRef.current = computeYoutubeMemberStartSec(syncAtMs, {
            positionSec,
            paused,
            isLive,
        });
    }

    const posterCandidates = useMemo(
        () => getYoutubeThumbnailCandidates(videoId, { isShort }),
        [videoId, isShort]
    );
    const [posterIndex, setPosterIndex] = useState(0);
    const posterUrl = posterCandidates[posterIndex] || '';

    const embedSrc = useMemo(
        () =>
            buildYoutubeBannerBackgroundSrc(videoId, {
                muted: true,
                controls: false,
                loop: false,
                startSec: isLive ? 0 : initialStartRef.current || 0,
                playlistId,
                isLive,
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- start locked at media identity
        [videoId, playlistId, isLive, mediaKey]
    );

    // Stagger member embed loads — several guests opening the same banner at
    // once all hit YouTube for the identical video within the same instant,
    // which can trip its own anti-abuse throttling on that video (shown as a
    // misleading "too many devices streaming" message, unrelated to any real
    // account/device limit). The host's own embed (HostYoutubeEmbed) loads
    // immediately since it's the sync anchor; members can afford a short
    // random delay before their embed actually requests the video — the
    // periodic drift-correction below catches up within a few seconds.
    const [activeSrc, setActiveSrc] = useState('');
    useEffect(() => {
        setActiveSrc('');
        const jitterMs = Math.floor(Math.random() * 4000);
        const jitterTimer = window.setTimeout(() => setActiveSrc(embedSrc), jitterMs);
        return () => window.clearTimeout(jitterTimer);
    }, [embedSrc]);

    const iframeId = `community-yt-member-${videoId || playlistId || 'media'}`;

    const assignIframeRef = (node) => {
        localIframeRef.current = node;
        if (memberIframeRef) {
            memberIframeRef.current = node;
        }
    };

    useEffect(() => {
        setPosterIndex(0);
        setRevealed(false);
        setErrored(false);
    }, [mediaKey]);

    useEffect(() => {
        const revealTimer = window.setTimeout(() => {
            setRevealed(true);
        }, isIosLikeDevice() ? 1200 : 2200);

        return () => {
            window.clearTimeout(revealTimer);
        };
    }, [mediaKey]);

    const startErrorRetryRef = useRef(false);

    useYoutubeEmbedPlayback({
        onPlaying: () => {
            setErrored(false);
            setRevealed(true);
            startErrorRetryRef.current = false;
        },
        onError: () => {
            // Bad start= (stale sync) often hard-fails the embed — recover via JS seek.
            const iframe = localIframeRef.current;
            if (iframe && playbackEnabled && !startErrorRetryRef.current) {
                startErrorRetryRef.current = true;
                syncMemberYoutubeToHost(iframe, syncAtMs, {
                    positionSec,
                    paused,
                    isLive,
                });
                setErrored(false);
                setRevealed(true);
                return;
            }
            setErrored(true);
            setRevealed(false);
        },
    });

    const applyHostSync = (force = false) => {
        const iframe = localIframeRef.current;
        if (!iframe || !playbackEnabled) return;

        const prev = lastSoftSyncRef.current;
        const pauseChanged = prev.paused !== paused;
        const changed =
            prev.syncAtMs !== syncAtMs ||
            prev.positionSec !== positionSec ||
            pauseChanged;

        if (!force && !changed) return;

        // Playing continuity: soft-seek only when host re-anchored far from local clock.
        if (!force && !pauseChanged && !paused && !prev.paused && prev.syncAtMs) {
            const prevAt = computeYoutubeMemberStartSec(prev.syncAtMs, {
                positionSec: prev.positionSec,
                paused: false,
                isLive,
            });
            const nextAt = computeYoutubeMemberStartSec(syncAtMs, {
                positionSec,
                paused: false,
                isLive,
            });
            lastSoftSyncRef.current = { syncAtMs, positionSec, paused };
            if (Math.abs(nextAt - prevAt) > YOUTUBE_DRIFT_TOLERANCE_SEC) {
                postYoutubeEmbedListening(iframe);
                softSeekYoutubeEmbed(iframe, nextAt);
            }
            return;
        }

        // Ignore tiny playing jitter unless pause flipped or join/load force-sync.
        if (
            !force &&
            !pauseChanged &&
            Math.abs((syncAtMs || 0) - (prev.syncAtMs || 0)) < 900 &&
            Math.abs((positionSec || 0) - (prev.positionSec || 0)) < 1
        ) {
            return;
        }

        lastSoftSyncRef.current = { syncAtMs, positionSec, paused };
        syncMemberYoutubeToHost(iframe, syncAtMs, {
            positionSec,
            paused,
            isLive,
        });
    };

    // Soft sync — seek/pause via JS API. Never remount on sync ticks (iOS critical).
    useEffect(() => {
        applyHostSync(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- apply on host clock fields only
    }, [syncAtMs, positionSec, paused, isLive, playbackEnabled]);

    // Periodic drift check while playing: applyHostSync above only reacts to
    // the host's anchor changing, so a member whose local playhead quietly
    // falls behind (tab throttling, a buffering hiccup) between host actions
    // never gets corrected without this. Poll the real player position and
    // soft-seek if it strays past tolerance. Live streams self-manage the
    // live edge — nothing to correct there.
    useEffect(() => {
        if (!playbackEnabled || paused || isLive) return undefined;
        const interval = window.setInterval(async () => {
            const iframe = localIframeRef.current;
            if (!iframe) return;
            const actualSec = await requestYoutubeEmbedCurrentTime(iframe);
            if (actualSec == null) return;
            const expectedSec = computeYoutubeMemberStartSec(syncAtMs, {
                positionSec,
                paused,
                isLive,
            });
            if (Math.abs(actualSec - expectedSec) > YOUTUBE_DRIFT_TOLERANCE_SEC) {
                softSeekYoutubeEmbed(iframe, expectedSec);
            }
        }, YOUTUBE_DRIFT_RESYNC_MS);
        return () => window.clearInterval(interval);
    }, [playbackEnabled, paused, isLive, syncAtMs, positionSec]);

    useEffect(() => {
        const iframe = localIframeRef.current;
        if (!iframe) return;
        postYoutubeEmbedListening(iframe);
        if (!playbackEnabled) {
            postYoutubeEmbedCommand(iframe, 'pauseVideo');
            return;
        }
        if (paused && !isLive) {
            syncYoutubeEmbedPlayback(
                iframe,
                computeYoutubeMemberStartSec(syncAtMs, { positionSec, paused: true, isLive }),
                { paused: true }
            );
            return;
        }
        postYoutubeEmbedCommand(iframe, 'playVideo');
    }, [playbackEnabled, paused, isLive]);

    const showVideo = revealed && !errored && playbackEnabled;

    useEffect(() => {
        onMemberVideoReady?.(showVideo);
        return () => onMemberVideoReady?.(false);
    }, [onMemberVideoReady, showVideo]);

    const handleIframeLoad = () => {
        const iframe = localIframeRef.current;
        if (!iframe) return;
        postYoutubeEmbedListening(iframe);
        // Re-enter / late join: apply current host clock immediately (not only start=).
        applyHostSync(true);
    };

    useEffect(
        () => () => {
            if (syncFlashTimerRef.current) {
                window.clearTimeout(syncFlashTimerRef.current);
            }
        },
        []
    );

    /** Guest tap — re-apply host clock locally (no Firestore write). */
    const handleGuestResync = useCallback(
        (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!playbackEnabled || guestSyncBusyRef.current) return;
            guestSyncBusyRef.current = true;
            applyHostSync(true);
            setSyncFlash(true);
            if (syncFlashTimerRef.current) window.clearTimeout(syncFlashTimerRef.current);
            syncFlashTimerRef.current = window.setTimeout(() => {
                setSyncFlash(false);
                syncFlashTimerRef.current = null;
            }, 1200);
            window.setTimeout(() => {
                guestSyncBusyRef.current = false;
            }, 350);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps -- applyHostSync closes over latest host clock
        [playbackEnabled, syncAtMs, positionSec, paused, isLive]
    );

    const rootClass = [
        'community-main-chat__banner-youtube',
        'community-main-chat__banner-youtube--member',
        isShort ? 'community-main-chat__banner-youtube--member-short' : '',
        isLive ? 'community-main-chat__banner-youtube--live' : '',
        showVideo
            ? 'community-main-chat__banner-youtube--member-playing'
            : 'community-main-chat__banner-youtube--member-poster',
        syncFlash ? 'community-main-chat__banner-youtube--member-synced' : '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={rootClass}>
            {posterUrl ? (
                <img
                    src={posterUrl}
                    alt=""
                    className="community-main-chat__banner-youtube-poster"
                    referrerPolicy="no-referrer"
                    onError={() => {
                        setPosterIndex((idx) =>
                            idx + 1 < posterCandidates.length ? idx + 1 : idx
                        );
                    }}
                />
            ) : (
                <div className="community-main-chat__banner-youtube-poster community-main-chat__banner-youtube-poster--fallback" />
            )}
            {activeSrc ? (
                <iframe
                    ref={assignIframeRef}
                    id={iframeId}
                    key={mediaKey}
                    src={activeSrc}
                    title="YouTube banner"
                    className="community-main-chat__banner-youtube-frame"
                    allow={`${YOUTUBE_EMBED_ALLOW}; fullscreen`}
                    playsInline
                    loading="eager"
                    onLoad={handleIframeLoad}
                    style={playbackEnabled ? undefined : { visibility: 'hidden' }}
                />
            ) : null}
            <div className="community-main-chat__banner-youtube-scrim" aria-hidden />
            {playbackEnabled ? (
                <button
                    type="button"
                    className="community-main-chat__banner-youtube-member-sync-hit"
                    aria-label={t(
                        'community_banner_youtube_guest_sync',
                        'Tap to sync with the host'
                    )}
                    title={t(
                        'community_banner_youtube_guest_sync',
                        'Tap to sync with the host'
                    )}
                    onClick={handleGuestResync}
                    onPointerDown={(event) => event.stopPropagation()}
                />
            ) : null}
            {syncFlash ? (
                <span className="community-main-chat__banner-youtube-member-sync-toast" aria-live="polite">
                    {t('community_banner_youtube_guest_synced', 'Synced')}
                </span>
            ) : null}
        </div>
    );
}

/**
 * YouTube banner background.
 * Host / preview: full player controls + play sync for members.
 * Members: autoplay muted; per-user sound toggle in TopMediaPanel.
 */
export default function CommunityBannerYoutubeBackground({
    videoId,
    playlistId = '',
    isShort = false,
    isLive = false,
    paused = false,
    positionSec = 0,
    preview = false,
    isHost = false,
    syncAtMs = 0,
    playbackEnabled = true,
    onPlaybackSync: _onPlaybackSync,
    memberIframeRef,
    hostIframeRef,
    onMemberVideoReady,
}) {
    if (!videoId && !playlistId) return null;

    if (!preview && !isHost) {
        return (
            <MemberYoutubeEmbed
                videoId={videoId}
                playlistId={playlistId}
                isShort={isShort}
                isLive={isLive}
                paused={paused}
                positionSec={positionSec}
                syncAtMs={syncAtMs}
                memberIframeRef={memberIframeRef}
                onMemberVideoReady={onMemberVideoReady}
                playbackEnabled={playbackEnabled}
            />
        );
    }

    return (
        <HostYoutubeEmbed
            videoId={videoId}
            playlistId={playlistId}
            preview={preview}
            isShort={isShort}
            isLive={isLive}
            paused={paused}
            positionSec={positionSec}
            syncAtMs={syncAtMs}
            playbackEnabled={playbackEnabled}
            hostIframeRef={hostIframeRef}
        />
    );
}
