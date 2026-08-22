import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    buildYoutubeBannerBackgroundSrc,
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
 * YouTube banner background — plain autoplay + loop, independent per viewer.
 * No cross-viewer playback sync: each viewer's own embed just plays. The only
 * shared behavior is local audio ducking (pausing while a banner voice message
 * is playing on THIS viewer's own screen), which needs no server round trip.
 */
export default function CommunityBannerYoutubeBackground({
    videoId,
    playlistId = '',
    isShort = false,
    isLive = false,
    preview = false,
    playbackEnabled = true,
    iframeRef,
}) {
    const localIframeRef = useRef(null);
    const [revealed, setRevealed] = useState(false);
    const [errored, setErrored] = useState(false);
    const mediaKey = youtubeMediaKey(videoId, playlistId, isLive);
    const lastMediaKeyRef = useRef(mediaKey);

    if (lastMediaKeyRef.current !== mediaKey) {
        lastMediaKeyRef.current = mediaKey;
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
                muted: !preview,
                controls: false,
                loop: true,
                startSec: 0,
                playlistId,
                isLive,
            }),
        [videoId, playlistId, isLive, preview, mediaKey]
    );

    const assignIframeRef = (node) => {
        localIframeRef.current = node;
        if (iframeRef) iframeRef.current = node;
    };

    useEffect(() => {
        setPosterIndex(0);
        setRevealed(false);
        setErrored(false);
    }, [mediaKey]);

    useEffect(() => {
        const revealTimer = window.setTimeout(() => setRevealed(true), 2200);
        return () => window.clearTimeout(revealTimer);
    }, [mediaKey]);

    useYoutubeEmbedPlayback({
        onPlaying: () => {
            setErrored(false);
            setRevealed(true);
        },
        onError: () => setErrored(true),
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
