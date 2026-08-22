import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaEye, FaEyeSlash, FaGift, FaImage, FaSync, FaTimes, FaUsers } from 'react-icons/fa';
import { AppText } from '../base';
import CommunityHostBannerComposerTools from './CommunityHostBannerComposerTools';
import CommunityBannerDraggableTitle from './CommunityBannerDraggableTitle';
import CommunityBannerDraggableBody from './CommunityBannerDraggableBody';
import { isBannerBgTransparent, resolveBannerBackgroundStyle, hasAnyBannerBodyText, bannerBodySlotIsVisible } from '../../utils/communityChatBanner';
import CommunityBannerYoutubeBackground from './CommunityBannerYoutubeBackground';
import CommunityBannerYoutubeMemberSound from './CommunityBannerYoutubeMemberSound';
import CommunityBannerYoutubeHostControls from './CommunityBannerYoutubeHostControls';
import CommunityHostBannerMessages from './CommunityHostBannerMessages';
import CommunityBannerVoiceBroadcast from './CommunityBannerVoiceBroadcast';
import { buildBannerSpotlightViews } from '../../utils/communityHostSpotlightPins';
import {
  computeYoutubeMemberStartSec,
  hasYoutubeBannerMedia,
  postYoutubeEmbedListening,
  syncMemberYoutubeToHost,
  syncYoutubeEmbedPlayback,
} from '../../utils/videoEmbedUtils';
import { BANNER_VOICE_AUDIO_PRIORITY_EVENT } from '../../utils/bannerVoiceAudioPriority';

/** Top media strip — 16:9 banner + host tools. */
export default function CommunityTopMediaPanel({ room, bannerExpanded = false, bannerMediaActive = true, onOpenMembers }) {
  const { t } = useTranslation();
  const {
    messages,
    banner,
    bannerDisplay,
    uploadingBanner,
    isHost,
    loading: partnerLoading,
    updateBanner,
    pendingReplyTo,
    setBannerYoutube,
    clearBannerImage,
    clearBannerVoice,
    setBannerVoiceLoop,
    unpinHostMessage,
    hideMessageFromBanner,
    updateHostSpotlightPosition,
    onSendGiftToHost,
  } = room;
  const canGiftHost = !isHost && typeof onSendGiftToHost === 'function';
  // Stage rooms: `partnerId` is the stage document id, not the host's user id
  // — `hostId` (only present on the Stage hook) is the correct id to match
  // `message.senderId` against. Community Chat has no `hostId`, where
  // `partnerId` already equals the host's uid.
  const hostMessageOwnerId = room.hostId || room.partnerId;

  const spotlightViews = useMemo(
    () =>
      buildBannerSpotlightViews(messages, hostMessageOwnerId, {
        pendingReplyTo,
        isHost,
        spotlightDismissed: banner.hostSpotlightDismissed,
        spotlightAuto: banner.hostSpotlightAuto,
      }),
    [messages, hostMessageOwnerId, pendingReplyTo, isHost, banner.hostSpotlightDismissed, banner.hostSpotlightAuto]
  );

  const pinnedBarActive = Boolean(spotlightViews.length > 0);

  const hasImage = bannerDisplay.hasMedia;
  const isYoutube = Boolean(bannerDisplay.isYoutube);
  const isTransparent = banner.transparent || isBannerBgTransparent(banner.bgColor);
  const hasTitle = Boolean(banner.title);
  const hasBody = hasAnyBannerBodyText(banner.texts);
  const showBodyOnBanner = hasBody && !pinnedBarActive;
  const showBgLayer = Boolean(banner.hasBackground && banner.bgGradientCss);
  const hasVisualContent = hasImage || showBgLayer || hasTitle || showBodyOnBanner || pinnedBarActive;
  const reserveLowerForHost =
    hasTitle && (!hasBody || pinnedBarActive);

  const memberYtIframeRef = useRef(null);
  const hostYtIframeRef = useRef(null);
  const [memberYtReady, setMemberYtReady] = useState(false);
  const bannerRef = useRef(banner);
  bannerRef.current = banner;

  const [hostToolsVisible, setHostToolsVisible] = useState(() => {
    try {
      return localStorage.getItem('db-host-banner-tools-visible') !== '0';
    } catch {
      return true;
    }
  });
  const toggleHostToolsVisible = useCallback(() => {
    setHostToolsVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('db-host-banner-tools-visible', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const hasYoutube = hasYoutubeBannerMedia(banner);
  const hasCustomBannerImage = Boolean(String(banner.url || '').trim()) && !hasYoutube;
  const showCornerDelete =
    isHost && bannerMediaActive && hostToolsVisible && (hasYoutube || hasCustomBannerImage);

  // Voice recording/playback auto-pauses YouTube for host + guests; host resumes manually (Sync).
  useEffect(() => {
    if (!isHost || typeof room.syncYoutubePlayback !== 'function') return undefined;

    const onVoicePriority = (event) => {
      const active = Boolean(event?.detail?.active);
      if (!active) return;
      const current = bannerRef.current;
      if (!hasYoutubeBannerMedia(current)) return;

      const at = current.youtubeLive
        ? 0
        : computeYoutubeMemberStartSec(current.youtubeSyncAt, {
            positionSec: current.youtubePositionSec,
            paused: Boolean(current.youtubePaused),
            isLive: Boolean(current.youtubeLive),
          });

      // Pause host iframe immediately (don't wait for Firestore round-trip).
      const iframe = hostYtIframeRef.current;
      if (iframe) {
        postYoutubeEmbedListening(iframe);
        syncYoutubeEmbedPlayback(iframe, at, { paused: true });
      }

      if (!current.youtubePaused || Number(current.youtubePositionSec) !== at) {
        void room.syncYoutubePlayback({ paused: true, positionSec: at });
      }
    };

    window.addEventListener(BANNER_VOICE_AUDIO_PRIORITY_EVENT, onVoicePriority);
    return () => {
      window.removeEventListener(BANNER_VOICE_AUDIO_PRIORITY_EVENT, onVoicePriority);
    };
  }, [isHost, room]);

  const handleMemberVideoReady = useCallback((ready) => {
    setMemberYtReady(Boolean(ready));
  }, []);

  const handleGuestYoutubeSync = useCallback(
    (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const iframe = memberYtIframeRef.current;
      if (!iframe || !hasYoutubeBannerMedia(banner)) return;
      syncMemberYoutubeToHost(iframe, banner.youtubeSyncAt, {
        positionSec: banner.youtubePositionSec,
        paused: Boolean(banner.youtubePaused),
        isLive: Boolean(banner.youtubeLive),
      });
    },
    [banner]
  );

  const handleDeleteBannerMedia = useCallback(() => {
    if (hasYoutube) {
      void setBannerYoutube('');
      return;
    }
    if (hasCustomBannerImage) {
      void clearBannerImage();
    }
  }, [clearBannerImage, hasCustomBannerImage, hasYoutube, setBannerYoutube]);

  const handleTitleMove = useCallback(
    (x, y) => updateBanner({ titleX: x, titleY: y }),
    [updateBanner]
  );

  const handleDeleteTitle = useCallback(
    () => updateBanner({ title: '' }, { clearSpotlight: true }),
    [updateBanner]
  );

  const handleDeleteBodySlot = useCallback(
    (slotIndex) => {
      const nextTexts = (banner.texts || []).map((slot, index) =>
        index === slotIndex ? { ...slot, text: '' } : slot
      );
      return updateBanner({ texts: nextTexts }, { clearSpotlight: true });
    },
    [banner.texts, updateBanner]
  );

  const handleBodySlotMove = useCallback(
    (slotIndex, x, y) => {
      const patch = {};
      patch[`text${slotIndex + 1}X`] = x;
      patch[`text${slotIndex + 1}Y`] = y;
      return updateBanner(patch);
    },
    [updateBanner]
  );

  let bannerInner = null;
  if (uploadingBanner) {
    bannerInner = (
      <div className="community-main-chat__banner-placeholder">
        <AppText as="span">{t('community_banner_uploading', 'Uploading banner…')}</AppText>
      </div>
    );
  } else if (!hasVisualContent) {
    if (isHost) {
      bannerInner = (
        <div className="community-main-chat__banner-placeholder">
          <FaImage size={28} aria-hidden />
          <AppText as="span">{t('community_banner_placeholder', 'Host Media Banner')}</AppText>
        </div>
      );
    } else {
      bannerInner = (
        <div
          className="community-main-chat__banner-theme-placeholder"
          aria-hidden={partnerLoading}
          aria-busy={partnerLoading || undefined}
        />
      );
    }
  } else {
    bannerInner = (
      <>
        {hasImage ? (
          isYoutube ? (
            <CommunityBannerYoutubeBackground
              videoId={bannerDisplay.youtubeId}
              playlistId={bannerDisplay.youtubePlaylistId}
              isShort={bannerDisplay.youtubeShort}
              isLive={bannerDisplay.youtubeLive}
              paused={banner.youtubePaused}
              positionSec={banner.youtubePositionSec}
              isHost={isHost}
              syncAtMs={banner.youtubeSyncAt}
              playbackEnabled={bannerMediaActive}
              onPlaybackSync={isHost ? room.syncYoutubePlayback : undefined}
              memberIframeRef={!isHost ? memberYtIframeRef : undefined}
              hostIframeRef={isHost ? hostYtIframeRef : undefined}
              onMemberVideoReady={!isHost ? handleMemberVideoReady : undefined}
            />
          ) : bannerDisplay.isVideo ? (
            <video
              key={bannerMediaActive ? 'active' : 'paused'}
              src={bannerDisplay.url}
              className="community-main-chat__banner-image"
              autoPlay={bannerMediaActive}
              loop
              muted
              playsInline
              aria-label={t('community_banner_image_alt', 'Community banner')}
            />
          ) : (
            <img
              src={bannerDisplay.url}
              alt={t('community_banner_image_alt', 'Community banner')}
              className="community-main-chat__banner-image"
            />
          )
        ) : null}
        {showBgLayer ? (
          <div
            className="community-main-chat__banner-text community-main-chat__banner-text--solid"
            style={resolveBannerBackgroundStyle({
              bgColor: banner.bgColor,
              bgColor2: banner.bgColor2,
              bgGradientCss: banner.bgGradientCss,
              bgDensity: banner.bgDensity,
              transparent: banner.transparent,
              hasBackground: banner.hasBackground,
            })}
          />
        ) : null}
      </>
    );
  }

  return (
    <section
      className={`community-top-media-panel${bannerExpanded ? ' community-top-media-panel--expanded' : ''}`}
      aria-label={t('community_banner_panel', 'Community media')}
    >
      {isHost && bannerMediaActive ? (
        <div className="community-top-media-panel__host-toolbar">
          <CommunityHostBannerComposerTools
            room={room}
            layout="above-banner"
            hostToolsVisible={hostToolsVisible}
          />
          {isYoutube ? (
            <CommunityBannerYoutubeHostControls
              iframeRef={hostYtIframeRef}
              syncAtMs={banner.youtubeSyncAt}
              positionSec={banner.youtubePositionSec}
              paused={banner.youtubePaused}
              isLive={banner.youtubeLive}
              onPlaybackSync={room.syncYoutubePlayback}
              visible={hostToolsVisible}
              layout="toolbar"
            />
          ) : null}
          {showCornerDelete ? (
            <button
              type="button"
              className="community-banner-corner-delete"
              aria-label={
                hasYoutube
                  ? t('community_banner_delete_youtube', 'Remove video')
                  : t('community_banner_delete_image', 'Remove banner image')
              }
              title={
                hasYoutube
                  ? t('community_banner_delete_youtube', 'Remove video')
                  : t('community_banner_delete_image', 'Remove banner image')
              }
              onClick={handleDeleteBannerMedia}
            >
              <FaTimes size={14} aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        className={`community-main-chat__banner-wrap${reserveLowerForHost ? ' community-main-chat__banner-wrap--host-lower' : ''}${isTransparent && hasImage ? ' community-main-chat__banner-wrap--text-overlay' : ''}${isYoutube ? ' community-main-chat__banner-wrap--youtube' : ''}${isHost && isYoutube ? ' community-main-chat__banner-wrap--youtube-host' : ''}`}
      >
        <div className="community-main-chat__banner">{bannerInner}</div>

        {isHost && bannerMediaActive ? (
          <button
            type="button"
            className={`community-banner-tools-toggle${hostToolsVisible ? '' : ' community-banner-tools-toggle--hidden-mode'}`}
            aria-label={
              hostToolsVisible
                ? t('community_banner_tools_hide', 'Hide banner tools')
                : t('community_banner_tools_show', 'Show banner tools')
            }
            title={
              hostToolsVisible
                ? t('community_banner_tools_hide', 'Hide banner tools')
                : t('community_banner_tools_show', 'Show banner tools')
            }
            aria-pressed={!hostToolsVisible}
            onClick={toggleHostToolsVisible}
          >
            {hostToolsVisible ? <FaEyeSlash size={14} aria-hidden /> : <FaEye size={14} aria-hidden />}
          </button>
        ) : null}

        {bannerMediaActive && typeof onOpenMembers === 'function' ? (
          <button
            type="button"
            className="community-main-chat__banner-members-btn"
            onClick={onOpenMembers}
            title={t('community_participants_title', 'Online Participants')}
            aria-label={t('community_participants_title', 'Online Participants')}
          >
            <FaUsers size={14} aria-hidden />
          </button>
        ) : null}

        {isHost && hasTitle ? (
          <div className="community-main-chat__banner-zones" aria-hidden>
            <div className="community-main-chat__banner-zone community-main-chat__banner-zone--title" />
            <div className="community-main-chat__banner-zone community-main-chat__banner-zone--text" />
          </div>
        ) : null}

        {hasTitle ? (
          <CommunityBannerDraggableTitle
            title={banner.title}
            titleStyle={banner.titleStyle}
            x={banner.titleX}
            y={banner.titleY}
            editable={isHost}
            onPositionChange={handleTitleMove}
            onDelete={handleDeleteTitle}
          />
        ) : null}

        {showBodyOnBanner
          ? (banner.texts || []).map((slot, index) =>
              bannerBodySlotIsVisible(slot) ? (
                <CommunityBannerDraggableBody
                  key={`banner-body-${index}`}
                  text={slot.text}
                  slotStyle={slot}
                  x={slot.x}
                  y={slot.y}
                  editable={isHost}
                  hasTitleZone={hasTitle}
                  onPositionChange={(x, y) => handleBodySlotMove(index, x, y)}
                  onDelete={() => handleDeleteBodySlot(index)}
                />
              ) : null
            )
          : null}

        {pinnedBarActive ? (
          <CommunityHostBannerMessages
            items={spotlightViews}
            hasTitle={hasTitle}
            editable={isHost && bannerMediaActive}
            onDelete={(messageId) => hideMessageFromBanner(messageId)}
            onPositionChange={(messageId, x, y) => updateHostSpotlightPosition(messageId, x, y)}
          />
        ) : null}

        {banner.voiceUrl || isHost ? (
          <CommunityBannerVoiceBroadcast
            voiceUrl={banner.voiceUrl}
            voiceUpdatedAt={banner.voiceUpdatedAt}
            voiceDurationSec={banner.voiceDurationSec}
            voiceLoop={Boolean(banner.voiceLoop)}
            isHost={isHost}
            playbackEnabled={bannerMediaActive}
            onClear={isHost ? () => clearBannerVoice?.() : undefined}
            onToggleLoop={
              isHost && typeof setBannerVoiceLoop === 'function'
                ? (loop) => setBannerVoiceLoop(loop)
                : undefined
            }
          />
        ) : null}

        {!isHost && isYoutube && bannerMediaActive ? (
          <>
            <CommunityBannerYoutubeMemberSound
              iframeRef={memberYtIframeRef}
              videoId={bannerDisplay.youtubeId}
              playlistId={bannerDisplay.youtubePlaylistId}
              syncAtMs={banner.youtubeSyncAt}
              positionSec={banner.youtubePositionSec}
              paused={banner.youtubePaused}
              isLive={banner.youtubeLive}
              visible={memberYtReady || hasYoutube}
            />
            <button
              type="button"
              className="community-main-chat__banner-youtube-guest-sync-btn"
              onClick={handleGuestYoutubeSync}
              onPointerDown={(event) => event.stopPropagation()}
              aria-label={t('community_banner_youtube_guest_sync', 'Tap to sync with the host')}
              title={t('community_banner_youtube_guest_sync', 'Tap to sync with the host')}
            >
              <FaSync size={14} aria-hidden />
              <AppText as="span">{t('community_banner_youtube_guest_sync_short', 'Sync')}</AppText>
            </button>
          </>
        ) : null}
        {canGiftHost ? (
          <button
            type="button"
            className="community-main-chat__banner-gift-btn"
            aria-label={t('stage_send_gift', 'Send a gift')}
            title={t('stage_send_gift_to_host', 'Send a gift to the host')}
            onClick={() => onSendGiftToHost()}
          >
            <FaGift size={16} aria-hidden />
            <AppText as="span">{t('stage_gift_short', 'Gift')}</AppText>
          </button>
        ) : null}
      </div>
    </section>
  );
}
