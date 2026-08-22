import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlay } from 'react-icons/fa';
import { buildTwitchEmbedSrc } from '../../utils/videoEmbedUtils';
import { AppText } from '../base';

/**
 * Twitch banner background — live channel only. Unlike the YouTube banner,
 * there is no playback position to sync: Twitch's own CDN keeps every viewer
 * near the live edge, so host and members render the exact same iframe.
 *
 * The iframe only mounts after a real tap on our own overlay button (never
 * relying on a click landing inside Twitch's own nested UI) — some mobile
 * WebViews don't reliably forward touches into a third-party iframe's own
 * controls, and a genuine user gesture right before the iframe loads also
 * gives autoplay its best chance everywhere else.
 */
export default function CommunityBannerTwitchBackground({ channel, preview = false }) {
  const { t } = useTranslation();
  const [activated, setActivated] = useState(false);
  const lastChannelRef = useRef(channel);

  useEffect(() => {
    if (lastChannelRef.current !== channel) {
      lastChannelRef.current = channel;
      setActivated(false);
    }
  }, [channel]);

  const embedSrc = buildTwitchEmbedSrc(channel, { muted: !preview });
  if (!embedSrc) return null;

  const rootClass = [
    'community-main-chat__banner-twitch',
    preview ? 'community-main-chat__banner-twitch--preview' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass}>
      {activated ? (
        <iframe
          key={channel}
          src={embedSrc}
          title="Twitch banner"
          className="community-main-chat__banner-twitch-frame"
          allow="autoplay; fullscreen"
          allowFullScreen
          loading="eager"
        />
      ) : (
        <button
          type="button"
          className="community-main-chat__banner-twitch-tap"
          onClick={() => setActivated(true)}
        >
          <span className="community-main-chat__banner-twitch-tap-icon" aria-hidden>
            <FaPlay size={22} />
          </span>
          <AppText as="span" className="community-main-chat__banner-twitch-tap-label">
            {t('community_banner_twitch_tap_to_watch', 'Tap to watch live')}
          </AppText>
        </button>
      )}
    </div>
  );
}
