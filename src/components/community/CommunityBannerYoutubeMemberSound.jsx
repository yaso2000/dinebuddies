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
    syncAtMs = 0,
    visible = false,
}) {
    const { t } = useTranslation();
    const [soundOn, setSoundOn] = useState(false);

    useEffect(() => {
        setSoundOn(false);
    }, [videoId, syncAtMs]);

    const toggleSound = useCallback(
        (event) => {
            event.preventDefault();
            event.stopPropagation();
            const iframe = iframeRef?.current;
            if (!iframe || !videoId) return;

            const next = !soundOn;
            applyMemberYoutubeSound(iframe, videoId, syncAtMs, next);
            setSoundOn(next);

            if (!next) return;

            reinforceMemberYoutubeSound(iframe, syncAtMs);

            if (isIosLikeDevice()) {
                [200, 550, 1000].forEach((ms) => {
                    window.setTimeout(() => {
                        if (iframeRef?.current) {
                            reinforceMemberYoutubeSound(iframeRef.current, syncAtMs);
                        }
                    }, ms);
                });
                return;
            }

            window.setTimeout(() => {
                if (iframeRef?.current) {
                    reinforceMemberYoutubeSound(iframeRef.current, syncAtMs);
                }
            }, 400);
            window.setTimeout(() => {
                if (iframeRef?.current) {
                    reinforceMemberYoutubeSound(iframeRef.current, syncAtMs);
                }
            }, 1200);
        },
        [iframeRef, soundOn, syncAtMs, videoId]
    );

    if (!visible || !videoId) return null;

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
                    ? t('community_banner_youtube_mute', 'Mute video sound')
                    : t('community_banner_youtube_unmute', 'Play video sound')
            }
            title={
                soundOn
                    ? t('community_banner_youtube_mute', 'Mute video sound')
                    : t('community_banner_youtube_unmute', 'Play video sound')
            }
        >
            {soundOn ? <FaVolumeUp size={16} aria-hidden /> : <FaVolumeMute size={16} aria-hidden />}
        </button>
    );
}
