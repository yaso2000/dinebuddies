import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    buildYoutubeBannerBackgroundSrc,
    computeYoutubeMemberStartSec,
    getYoutubeThumbnailCandidates,
    parseYoutubeEmbedMessage,
    postYoutubeEmbedListening,
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

/** Host / preview — iframe with YouTube controls; broadcasts play sync to members. */
function HostYoutubeEmbed({
    videoId,
    preview,
    onPlaybackSync,
    playbackEnabled = true,
    isShort = false,
    syncAtMs = 0,
    hostIframeRef,
}) {
    const localIframeRef = useRef(null);
    const lastSyncMsRef = useRef(0);

    const assignIframeRef = (node) => {
        localIframeRef.current = node;
        if (hostIframeRef) {
            hostIframeRef.current = node;
        }
    };

    const handlePlaybackSync = useMemo(() => {
        if (!onPlaybackSync) return undefined;
        return () => {
            const now = Date.now();
            if (now - lastSyncMsRef.current < 2500) return;
            lastSyncMsRef.current = now;
            onPlaybackSync();
        };
    }, [onPlaybackSync]);

    const startSec = useMemo(
        () => computeYoutubeMemberStartSec(syncAtMs),
        [syncAtMs, videoId]
    );

    const embedSrc = useMemo(
        () =>
            buildYoutubeBannerBackgroundSrc(videoId, {
                muted: false,
                controls: true,
                loop: false,
                startSec,
            }),
        [videoId, startSec]
    );

    useYoutubeEmbedPlayback({
        enabled: Boolean(handlePlaybackSync) && playbackEnabled,
        onPlaying: handlePlaybackSync,
    });

    const handleIframeLoad = () => {
        if (localIframeRef.current) {
            postYoutubeEmbedListening(localIframeRef.current);
        }
    };

    const posterCandidates = useMemo(
        () => getYoutubeThumbnailCandidates(videoId, { isShort }),
        [videoId, isShort]
    );
    const posterUrl = posterCandidates[0] || '';

    const rootClass = [
        'community-main-chat__banner-youtube',
        preview ? 'community-main-chat__banner-youtube--preview' : 'community-main-chat__banner-youtube--host',
        !playbackEnabled ? 'community-main-chat__banner-youtube--paused' : '',
    ].join(' ');

    if (!playbackEnabled && !preview) {
        return (
            <div className={rootClass}>
                {posterUrl ? (
                    <img
                        src={posterUrl}
                        alt=""
                        className="community-main-chat__banner-youtube-poster"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="community-main-chat__banner-youtube-poster community-main-chat__banner-youtube-poster--fallback" />
                )}
            </div>
        );
    }

    return (
        <div className={rootClass}>
            <iframe
                ref={assignIframeRef}
                key={`${videoId}-${startSec}`}
                src={embedSrc}
                title="YouTube banner"
                className="community-main-chat__banner-youtube-frame"
                allow={YOUTUBE_EMBED_ALLOW}
                allowFullScreen
                loading="eager"
                onLoad={handleIframeLoad}
            />
        </div>
    );
}

/** Members — muted autoplay; sound toggle lives in CommunityBannerYoutubeMemberSound. */
function MemberYoutubeEmbed({
    videoId,
    isShort = false,
    syncAtMs = 0,
    memberIframeRef,
    onMemberVideoReady,
    playbackEnabled = true,
}) {
    const localIframeRef = useRef(null);
    const [revealed, setRevealed] = useState(false);
    const [errored, setErrored] = useState(false);
    const posterCandidates = useMemo(
        () => getYoutubeThumbnailCandidates(videoId, { isShort }),
        [videoId, isShort]
    );
    const [posterIndex, setPosterIndex] = useState(0);
    const posterUrl = posterCandidates[posterIndex] || '';

    const startSec = useMemo(
        () => computeYoutubeMemberStartSec(syncAtMs),
        [syncAtMs, videoId]
    );

    const embedSrc = useMemo(
        () =>
            buildYoutubeBannerBackgroundSrc(videoId, {
                muted: true,
                controls: false,
                loop: false,
                startSec,
            }),
        [videoId, startSec]
    );

    const embedKey = `${videoId}-${syncAtMs || 0}-${startSec}`;
    const iframeId = `community-yt-member-${videoId}`;

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
    }, [embedKey]);

    useEffect(() => {
        const revealTimer = window.setTimeout(() => {
            setRevealed(true);
        }, 2200);

        return () => {
            window.clearTimeout(revealTimer);
        };
    }, [embedKey]);

    useYoutubeEmbedPlayback({
        onPlaying: () => {
            setErrored(false);
            setRevealed(true);
        },
        onError: () => {
            setErrored(true);
            setRevealed(false);
        },
    });

    const showVideo = revealed && !errored && playbackEnabled;

    useEffect(() => {
        onMemberVideoReady?.(showVideo);
        return () => onMemberVideoReady?.(false);
    }, [onMemberVideoReady, showVideo]);

    const handleIframeLoad = () => {
        if (localIframeRef.current) {
            postYoutubeEmbedListening(localIframeRef.current);
        }
    };

    const rootClass = [
        'community-main-chat__banner-youtube',
        'community-main-chat__banner-youtube--member',
        isShort ? 'community-main-chat__banner-youtube--member-short' : '',
        showVideo ? 'community-main-chat__banner-youtube--member-playing' : 'community-main-chat__banner-youtube--member-poster',
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
            {playbackEnabled ? (
                <iframe
                    ref={assignIframeRef}
                    id={iframeId}
                    key={embedKey}
                    src={embedSrc}
                    title="YouTube banner"
                    className="community-main-chat__banner-youtube-frame"
                    allow={YOUTUBE_EMBED_ALLOW}
                    loading="eager"
                    onLoad={handleIframeLoad}
                />
            ) : null}
            <div className="community-main-chat__banner-youtube-scrim" aria-hidden />
        </div>
    );
}

/**
 * YouTube banner background.
 * Host / preview: full player controls + play sync for members.
 * Members: autoplay muted loop; per-user sound toggle in TopMediaPanel.
 */
export default function CommunityBannerYoutubeBackground({
    videoId,
    isShort = false,
    preview = false,
    isHost = false,
    syncAtMs = 0,
    playbackEnabled = true,
    onPlaybackSync,
    memberIframeRef,
    hostIframeRef,
    onMemberVideoReady,
}) {
    if (!videoId) return null;

    if (!preview && !isHost) {
        return (
            <MemberYoutubeEmbed
                videoId={videoId}
                isShort={isShort}
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
            preview={preview}
            isShort={isShort}
            syncAtMs={syncAtMs}
            playbackEnabled={playbackEnabled}
            hostIframeRef={hostIframeRef}
            onPlaybackSync={preview ? undefined : onPlaybackSync}
        />
    );
}
