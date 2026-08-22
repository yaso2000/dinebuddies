import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    buildYoutubeBannerBackgroundSrc,
    computeYoutubeSyncPositionSec,
    getYoutubeThumbnailCandidates,
    parseYoutubeEmbedMessage,
    postYoutubeEmbedCommand,
    postYoutubeEmbedListening,
    YOUTUBE_EMBED_ALLOW,
    YOUTUBE_PLAYER_STATE,
} from '../../utils/videoEmbedUtils';
import { BANNER_VOICE_AUDIO_PRIORITY_EVENT } from '../../utils/bannerVoiceAudioPriority';

/** Stable iframe identity — never include wall-clock start (remounts kill iOS playback). */
function youtubeMediaKey(videoId, playlistId, isLive) {
    return `${videoId || 'list'}|${playlistId || ''}|${isLive ? 'live' : 'vod'}`;
}

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

/**
 * YouTube banner background — autoplay + loop, independent per viewer. Each
 * viewer's own embed just plays; the only cross-viewer coordination is a
 * one-time seek anchor (see `syncAtMs`/`syncPositionSec`/`syncPaused`) so a
 * viewer joining mid-video lands near the host's position instead of
 * restarting at 0 — no continuous drift-correction or polling. Also handles
 * local audio ducking (pausing while a banner voice message is playing on
 * THIS viewer's own screen), which needs no server round trip.
 */
export default function CommunityBannerYoutubeBackground({
    videoId,
    playlistId = '',
    isShort = false,
    isLive = false,
    preview = false,
    playbackEnabled = true,
    syncPaused = false,
    syncPositionSec = 0,
    syncAtMs = 0,
    iframeRef,
}) {
    const localIframeRef = useRef(null);
    const [revealed, setRevealed] = useState(false);
    const [errored, setErrored] = useState(false);
    const mediaKey = youtubeMediaKey(videoId, playlistId, isLive);
    const lastMediaKeyRef = useRef(mediaKey);
    const retryCountRef = useRef(0);

    if (lastMediaKeyRef.current !== mediaKey) {
        lastMediaKeyRef.current = mediaKey;
    }

    const posterCandidates = useMemo(
        () => getYoutubeThumbnailCandidates(videoId, { isShort }),
        [videoId, isShort]
    );
    const [posterIndex, setPosterIndex] = useState(0);
    const posterUrl = posterCandidates[posterIndex] || '';

    // Sync anchor read once per mount (mediaKey change) so it seeds the
    // initial `start` param — later anchor updates re-seek via postMessage
    // instead of rebuilding `embedSrc` (never rewrite `src` after mount; see
    // the iOS note on `applyMemberYoutubeSound`).
    const initialSyncRef = useRef({ paused: syncPaused, positionSec: syncPositionSec, syncAtMs });
    initialSyncRef.current = { paused: syncPaused, positionSec: syncPositionSec, syncAtMs };
    const syncAtMsAtMountRef = useRef(syncAtMs);

    const embedSrc = useMemo(() => {
        const { paused, positionSec, syncAtMs: at } = initialSyncRef.current;
        syncAtMsAtMountRef.current = at;
        return buildYoutubeBannerBackgroundSrc(videoId, {
            muted: !preview,
            controls: false,
            loop: true,
            startSec: computeYoutubeSyncPositionSec({ isLive, paused, positionSec, syncAtMs: at }),
            playlistId,
            isLive,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only the media identity should rebuild the src; later sync updates re-seek via postMessage below.
    }, [videoId, playlistId, isLive, preview, mediaKey]);

    // Re-sync (host paused/resumed/seeked while this viewer was already
    // watching) — one-shot seek via the JS API, no iframe reload.
    useEffect(() => {
        if (isLive) return undefined;
        if (syncAtMs === syncAtMsAtMountRef.current) return undefined;
        syncAtMsAtMountRef.current = syncAtMs;
        const iframe = localIframeRef.current;
        if (!iframe) return undefined;
        const target = computeYoutubeSyncPositionSec({
            isLive,
            paused: syncPaused,
            positionSec: syncPositionSec,
            syncAtMs,
        });
        postYoutubeEmbedListening(iframe);
        postYoutubeEmbedCommand(iframe, 'seekTo', [target, true]);
        return undefined;
    }, [syncAtMs, isLive, syncPaused, syncPositionSec]);

    const assignIframeRef = (node) => {
        localIframeRef.current = node;
        if (iframeRef) iframeRef.current = node;
    };

    useEffect(() => {
        setPosterIndex(0);
        setRevealed(false);
        setErrored(false);
        retryCountRef.current = 0;
    }, [mediaKey]);

    useEffect(() => {
        const revealTimer = window.setTimeout(() => setRevealed(true), 2200);
        return () => window.clearTimeout(revealTimer);
    }, [mediaKey]);

    // Some Android WebViews/Chrome deliver a transient onError (or the player
    // silently stalls) a few seconds into playback even though the embed is
    // otherwise fine — reload the iframe a few times before giving up instead
    // of leaving the banner permanently stuck on the poster.
    useYoutubeEmbedPlayback({
        onPlaying: () => {
            retryCountRef.current = 0;
            setErrored(false);
            setRevealed(true);
        },
        onError: () => {
            const iframe = localIframeRef.current;
            if (iframe && retryCountRef.current < 3) {
                retryCountRef.current += 1;
                const attempt = retryCountRef.current;
                window.setTimeout(() => {
                    if (localIframeRef.current) {
                        localIframeRef.current.src = embedSrc;
                    }
                }, 1000 * attempt);
                return;
            }
            setErrored(true);
        },
    });

    // Local audio ducking — pause while a voice message plays on THIS viewer's
    // own screen (host or member alike), resume when it ends. No Firestore
    // round trip: every viewer's own iframe reacts to their own window event.
    useEffect(() => {
        const iframe = localIframeRef.current;
        const onVoicePriority = (event) => {
            const frame = localIframeRef.current;
            if (!frame) return;
            postYoutubeEmbedListening(frame);
            const active = Boolean(event?.detail?.active);
            postYoutubeEmbedCommand(frame, active ? 'pauseVideo' : 'playVideo');
        };
        window.addEventListener(BANNER_VOICE_AUDIO_PRIORITY_EVENT, onVoicePriority);
        return () => window.removeEventListener(BANNER_VOICE_AUDIO_PRIORITY_EVENT, onVoicePriority);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- iframe ref is stable across the media's lifetime
    }, [mediaKey]);

    useEffect(() => {
        const iframe = localIframeRef.current;
        if (!iframe) return;
        postYoutubeEmbedListening(iframe);
        postYoutubeEmbedCommand(iframe, playbackEnabled ? 'playVideo' : 'pauseVideo');
    }, [playbackEnabled]);

    const handleIframeLoad = () => {
        const iframe = localIframeRef.current;
        if (iframe) postYoutubeEmbedListening(iframe);
    };

    const showVideo = revealed && !errored && playbackEnabled;

    const rootClass = [
        'community-main-chat__banner-youtube',
        preview ? 'community-main-chat__banner-youtube--preview' : '',
        isShort ? 'community-main-chat__banner-youtube--member-short' : '',
        isLive ? 'community-main-chat__banner-youtube--live' : '',
        showVideo
            ? 'community-main-chat__banner-youtube--member-playing'
            : 'community-main-chat__banner-youtube--member-poster',
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
                        setPosterIndex((idx) => (idx + 1 < posterCandidates.length ? idx + 1 : idx));
                    }}
                />
            ) : (
                <div className="community-main-chat__banner-youtube-poster community-main-chat__banner-youtube-poster--fallback" />
            )}
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
            <div className="community-main-chat__banner-youtube-scrim" aria-hidden />
        </div>
    );
}
