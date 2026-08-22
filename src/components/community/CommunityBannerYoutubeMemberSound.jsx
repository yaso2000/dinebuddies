import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaVolumeMute, FaVolumeUp } from 'react-icons/fa';
import {
    applyMemberYoutubeSound,
    isIosLikeDevice,
    reinforceMemberYoutubeSound,
} from '../../utils/videoEmbedUtils';

/** Sound toggle for the YouTube banner — rendered above overlays for reliable taps. */
export default function CommunityBannerYoutubeMemberSound({
    iframeRef,
    videoId,
    playlistId = '',
    isLive = false,
    visible = false,
}) {
    const { t } = useTranslation();
    const [soundOn, setSoundOn] = useState(false);
    const mountedAtRef = useRef(Date.now());

    // Reset sound + elapsed-time anchor only when the media identity changes.
    useEffect(() => {
        setSoundOn(false);
        mountedAtRef.current = Date.now();
    }, [videoId, playlistId]);

    const toggleSound = useCallback(
        (event) => {
            event.preventDefault();
            event.stopPropagation();
            const iframe = iframeRef?.current;
            if (!iframe || (!videoId && !playlistId)) return;

            const elapsedSec = isLive
                ? 0
                : Math.max(0, Math.floor((Date.now() - mountedAtRef.current) / 1000));
            const next = !soundOn;
            applyMemberYoutubeSound(iframe, videoId, next, { playlistId, isLive, elapsedSec });
            setSoundOn(next);

            if (!next) return;

            reinforceMemberYoutubeSound(iframe);

            window.setTimeout(
                () => {
                    if (iframeRef?.current) reinforceMemberYoutubeSound(iframeRef.current);
                },
                isIosLikeDevice() ? 220 : 400
            );
        },
        [iframeRef, isLive, playlistId, soundOn, videoId]
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
