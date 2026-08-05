import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPause, FaPlay, FaSync } from 'react-icons/fa';
import {
    computeYoutubeMemberStartSec,
    postYoutubeEmbedCommand,
    postYoutubeEmbedListening,
    syncYoutubeEmbedPlayback,
} from '../../utils/videoEmbedUtils';

/** Host playback bar — play/pause + re-sync for members. */
export default function CommunityBannerYoutubeHostControls({
    iframeRef,
    syncAtMs = 0,
    onPlaybackSync,
    visible = false,
}) {
    const { t } = useTranslation();
    const [playing, setPlaying] = useState(true);

    const withIframe = useCallback(
        (runner) => {
            const iframe = iframeRef?.current;
            if (!iframe) return;
            postYoutubeEmbedListening(iframe);
            runner(iframe);
        },
        [iframeRef]
    );

    const handleTogglePlay = useCallback(
        (event) => {
            event.preventDefault();
            event.stopPropagation();
            withIframe((iframe) => {
                if (playing) {
                    postYoutubeEmbedCommand(iframe, 'pauseVideo');
                    setPlaying(false);
                    return;
                }
                const startSec = computeYoutubeMemberStartSec(syncAtMs);
                syncYoutubeEmbedPlayback(iframe, startSec);
                setPlaying(true);
                onPlaybackSync?.();
            });
        },
        [onPlaybackSync, playing, syncAtMs, withIframe]
    );

    const handleResync = useCallback(
        (event) => {
            event.preventDefault();
            event.stopPropagation();
            withIframe((iframe) => {
                const startSec = computeYoutubeMemberStartSec(syncAtMs);
                syncYoutubeEmbedPlayback(iframe, startSec);
            });
            onPlaybackSync?.();
        },
        [onPlaybackSync, syncAtMs, withIframe]
    );

    if (!visible) return null;

    return (
        <div
            className="community-main-chat__banner-youtube-host-controls"
            role="toolbar"
            aria-label={t('community_banner_youtube_host_controls', 'Video controls')}
        >
            <button
                type="button"
                className="community-main-chat__banner-youtube-host-controls__btn"
                onClick={handleTogglePlay}
                onPointerDown={(event) => event.stopPropagation()}
                aria-label={
                    playing
                        ? t('community_banner_youtube_pause', 'Pause video')
                        : t('community_banner_youtube_play', 'Play video')
                }
            >
                {playing ? <FaPause size={13} aria-hidden /> : <FaPlay size={13} aria-hidden />}
            </button>
            <button
                type="button"
                className="community-main-chat__banner-youtube-host-controls__btn"
                onClick={handleResync}
                onPointerDown={(event) => event.stopPropagation()}
                aria-label={t('community_banner_youtube_resync', 'Sync guests to this moment')}
                title={t('community_banner_youtube_resync', 'Sync guests to this moment')}
            >
                <FaSync size={13} aria-hidden />
            </button>
        </div>
    );
}
