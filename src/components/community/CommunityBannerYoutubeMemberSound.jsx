import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaVolumeMute, FaVolumeUp } from 'react-icons/fa';
import {
    applyMemberYoutubeSound,
    isIosLikeDevice,
    reinforceMemberYoutubeSound,
} from '../../utils/videoEmbedUtils';

/** Member sound toggle — rendered above banner overlays for reliable taps. */
export default function CommunityBannerYoutubeMemberSound({
    iframeRef,
    videoId,
    playlistId = '',
    syncAtMs = 0,
    positionSec = 0,
    paused = false,
    isLive = false,
    visible = false,
}) {
    const { t } = useTranslation();
    const [soundOn, setSoundOn] = useState(false);

    // Reset sound only when the media identity changes — not on every host sync tick.
    useEffect(() => {
        setSoundOn(false);
    }, [videoId, playlistId]);

    const toggleSound = useCallback(
        (event) => {
            event.preventDefault();
            event.stopPropagation();
            const iframe = iframeRef?.current;
            if (!iframe || (!videoId && !playlistId)) return;

            const media = {
                playlistId,
                isLive,
                paused,
                positionSec,
            };

            const next = !soundOn;
            applyMemberYoutubeSound(iframe, videoId, syncAtMs, next, media);
            setSoundOn(next);

            if (!next) return;

            reinforceMemberYoutubeSound(iframe, syncAtMs, media);

            if (isIosLikeDevice()) {
                // One light follow-up only — avoid seek/reload storms on Safari.
                window.setTimeout(() => {
                    if (iframeRef?.current) {
                        reinforceMemberYoutubeSound(iframeRef.current, syncAtMs, media);
                    }
                }, 220);
                return;
            }

            window.setTimeout(() => {
                if (iframeRef?.current) {
                    reinforceMemberYoutubeSound(iframeRef.current, syncAtMs, media);
                }
            }, 400);
        },
        [iframeRef, isLive, paused, playlistId, positionSec, soundOn, syncAtMs, videoId]
    );

    if (!visible || (!videoId && !playlistId)) return null;

    const soundBtnClass = [
        'community-main-chat__banner-youtube-sound-btn',
        soundOn ? 'community-main-chat__banner-youtube-sound-btn--on' : '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <button
            type="button"
            className={soundBtnClass}
            onClick={toggleSound}
            onPointerDown={(event) => event.stopPropagation()}
            aria-pressed={soundOn}
            aria-label={
                soundOn
                    ? t('community_banner_youtube_mute', 'Mute video')
                    : t('community_banner_youtube_unmute', 'Play video sound')
            }
        >
            {soundOn ? <FaVolumeUp size={16} aria-hidden /> : <FaVolumeMute size={16} aria-hidden />}
        </button>
    );
}
