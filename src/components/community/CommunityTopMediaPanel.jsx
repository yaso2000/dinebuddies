import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaImage, FaTimes } from 'react-icons/fa';
import { AppText } from '../base';
import CommunityHostBannerComposerTools from './CommunityHostBannerComposerTools';
import CommunityBannerDraggableTitle from './CommunityBannerDraggableTitle';
import CommunityBannerDraggableBody from './CommunityBannerDraggableBody';
import { isBannerBgTransparent, resolveBannerBackgroundStyle, hasAnyBannerBodyText, bannerBodySlotIsVisible } from '../../utils/communityChatBanner';
import CommunityBannerYoutubeBackground from './CommunityBannerYoutubeBackground';
import CommunityBannerYoutubeMemberSound from './CommunityBannerYoutubeMemberSound';
import CommunityBannerYoutubeHostControls from './CommunityBannerYoutubeHostControls';
import CommunityHostBannerMessages from './CommunityHostBannerMessages';
import { buildBannerSpotlightViews } from '../../utils/communityHostSpotlightPins';

/** Top media strip — 16:9 banner + host tools. */
export default function CommunityTopMediaPanel({ room, bannerExpanded = false, bannerMediaActive = true }) {
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
    unpinHostMessage,
    hideMessageFromBanner,
    updateHostSpotlightPosition,
  } = room;

  const spotlightViews = useMemo(
    () =>
      buildBannerSpotlightViews(messages, room.partnerId, {
        pendingReplyTo,
        isHost,
        spotlightDismissed: banner.hostSpotlightDismissed,
        spotlightAuto: banner.hostSpotlightAuto,
      }),
    [messages, room.partnerId, pendingReplyTo, isHost, banner.hostSpotlightDismissed, banner.hostSpotlightAuto]
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

  const hasCustomBannerImage = Boolean(String(banner.url || '').trim()) && !banner.youtubeId;
  const showCornerDelete =
    isHost && bannerMediaActive && (Boolean(banner.youtubeId) || hasCustomBannerImage);

  const handleMemberVideoReady = useCallback((ready) => {
    setMemberYtReady(Boolean(ready));
  }, []);

  const handleDeleteBannerMedia = useCallback(() => {
    if (banner.youtubeId) {
      void setBannerYoutube('');
      return;
    }
    if (hasCustomBannerImage) {
      void clearBannerImage();
    }
  }, [banner.youtubeId, clearBannerImage, hasCustomBannerImage, setBannerYoutube]);

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
              isShort={bannerDisplay.youtubeShort}
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
      <div
        className={`community-main-chat__banner-wrap${reserveLowerForHost ? ' community-main-chat__banner-wrap--host-lower' : ''}${isTransparent && hasImage ? ' community-main-chat__banner-wrap--text-overlay' : ''}${isYoutube ? ' community-main-chat__banner-wrap--youtube' : ''}${isHost && isYoutube ? ' community-main-chat__banner-wrap--youtube-host' : ''}`}
      >
        {showCornerDelete ? (
          <button
            type="button"
            className="community-banner-corner-delete"
            aria-label={
              banner.youtubeId
                ? t('community_banner_delete_youtube', 'Remove video')
                : t('community_banner_delete_image', 'Remove banner image')
            }
            title={
              banner.youtubeId
                ? t('community_banner_delete_youtube', 'Remove video')
                : t('community_banner_delete_image', 'Remove banner image')
            }
            onClick={handleDeleteBannerMedia}
          >
            <FaTimes size={14} aria-hidden />
          </button>
        ) : null}
        <div className="community-main-chat__banner">{bannerInner}</div>

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

        {isHost && bannerMediaActive ? (
          <CommunityHostBannerComposerTools room={room} layout="banner-rail" />
        ) : null}
        {isHost && isYoutube && bannerMediaActive ? (
          <CommunityBannerYoutubeHostControls
            iframeRef={hostYtIframeRef}
            syncAtMs={banner.youtubeSyncAt}
            onPlaybackSync={room.syncYoutubePlayback}
            visible
          />
        ) : null}
        {!isHost && isYoutube && bannerMediaActive ? (
          <CommunityBannerYoutubeMemberSound
            iframeRef={memberYtIframeRef}
            videoId={bannerDisplay.youtubeId}
            syncAtMs={banner.youtubeSyncAt}
            visible={memberYtReady}
          />
        ) : null}
      </div>
    </section>
  );
}
