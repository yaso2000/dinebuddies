import React from 'react';
import { buildTwitchEmbedSrc } from '../../utils/videoEmbedUtils';

/**
 * Twitch banner background — live channel only. Unlike the YouTube banner,
 * there is no playback position to sync: Twitch's own CDN keeps every viewer
 * near the live edge, so host and members render the exact same iframe.
 */
export default function CommunityBannerTwitchBackground({ channel, preview = false }) {
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
      <iframe
        key={channel}
        src={embedSrc}
        title="Twitch banner"
        className="community-main-chat__banner-twitch-frame"
        allow="autoplay; fullscreen"
        allowFullScreen
        loading="eager"
        // No allow-popups / allow-top-navigation: any link inside the Twitch
        // player (channel name, offline-screen recommendations, etc.) is
        // blocked from opening a new tab or navigating the app away.
        sandbox="allow-scripts allow-same-origin allow-forms allow-fullscreen"
      />
    </div>
  );
}
