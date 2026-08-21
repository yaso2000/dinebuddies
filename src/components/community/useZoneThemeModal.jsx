import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BannerToolModal } from './CommunityHostBannerComposerTools';
import CommunityChatZoneThemePicker from './CommunityChatZoneThemePicker';
import InvitationEditorLeaveDialog from '../Invitations/socialCard/InvitationEditorLeaveDialog';
import { DEFAULT_BANNER_BG, DEFAULT_BANNER_BG2 } from '../../utils/communityChatBanner';
import {
  buildGuestFrameBackgroundFromDraft,
  createGuestFrameDraftFromResolved,
} from '../../constants/communityChatGuestFrameLook';

const DEFAULT_ZONE_THEME_DRAFT = {
  themeId: 'stage',
  guestFrame: {
    imageMode: 'none',
    colorOverlayEnabled: true,
    colorStart: DEFAULT_BANNER_BG,
    colorEnd: DEFAULT_BANNER_BG2,
    intensity: 100,
    presetId: null,
    customUrl: null,
  },
};

function createDefaultZoneThemeDraftSnapshot() {
  return {
    themeId: DEFAULT_ZONE_THEME_DRAFT.themeId,
    guestFrame: { ...DEFAULT_ZONE_THEME_DRAFT.guestFrame },
  };
}

function createZoneThemeDraftSnapshot(themeId, guestFrameBackground) {
  return {
    themeId: themeId || 'stage',
    guestFrame: createGuestFrameDraftFromResolved(guestFrameBackground),
  };
}

function zoneThemeDraftsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Shared "Chat look" (bubble/zone color) picker — used by the host banner toolbar
 * (CommunityHostBannerComposerTools) and by the Stage chat header menu, so either
 * entry point opens the exact same draft/save/discard flow against the same room data.
 */
export default function useZoneThemeModal(room) {
  const { t } = useTranslation();
  const {
    zoneThemeId,
    saveCommunityChatZoneThemeSettings,
    zoneThemeSaving,
    guestFrameBackground,
    generateCommunityChatGuestFrameBackgroundImage,
    guestFrameBackgroundGenerating,
  } = room || {};

  const [isOpen, setIsOpen] = useState(false);
  const [zoneThemeDraft, setZoneThemeDraft] = useState(null);
  const [zoneThemeSavedSnapshot, setZoneThemeSavedSnapshot] = useState(null);
  const [zoneThemeLeaveOpen, setZoneThemeLeaveOpen] = useState(false);

  const openModal = () => {
    const snapshot = createZoneThemeDraftSnapshot(zoneThemeId, guestFrameBackground);
    setZoneThemeDraft(snapshot);
    setZoneThemeSavedSnapshot(snapshot);
    setZoneThemeLeaveOpen(false);
    setIsOpen(true);
  };

  // Live-preview bubble colors on the room shell while the Chat look draft is open.
  useEffect(() => {
    if (!isOpen || !zoneThemeDraft?.themeId) return undefined;
    const root = document.querySelector('.community-chat-root');
    if (!root) return undefined;
    const previewId = String(zoneThemeDraft.themeId);
    root.setAttribute('data-cchat-zone-theme', previewId);
    return () => {
      root.setAttribute('data-cchat-zone-theme', zoneThemeId || 'stage');
    };
  }, [isOpen, zoneThemeDraft?.themeId, zoneThemeId]);

  const isDraftDirty =
    zoneThemeDraft &&
    zoneThemeSavedSnapshot &&
    !zoneThemeDraftsEqual(zoneThemeDraft, zoneThemeSavedSnapshot);

  const draftBusy = zoneThemeSaving || guestFrameBackgroundGenerating;

  const updateDraft = (patch) => {
    setZoneThemeDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const updateGuestFrameDraft = (patch) => {
    setZoneThemeDraft((prev) =>
      prev
        ? {
            ...prev,
            guestFrame: { ...prev.guestFrame, ...patch },
          }
        : prev
    );
  };

  const publishDraft = async () => {
    if (!zoneThemeDraft || draftBusy) return false;
    const ok = await saveCommunityChatZoneThemeSettings(zoneThemeDraft);
    if (ok) {
      setZoneThemeSavedSnapshot(zoneThemeDraft);
    }
    return ok;
  };

  const closeModal = () => {
    setZoneThemeLeaveOpen(false);
    setIsOpen(false);
  };

  const requestClose = () => {
    // Always allow close — never trap the host behind a busy AI/generate state.
    if (isDraftDirty) {
      setZoneThemeLeaveOpen(true);
      return;
    }
    closeModal();
  };

  const saveAndClose = async () => {
    const ok = await publishDraft();
    if (ok) closeModal();
  };

  const discardDraft = () => {
    closeModal();
  };

  const resetToDefaults = () => {
    if (draftBusy) return;
    setZoneThemeDraft(createDefaultZoneThemeDraftSnapshot());
  };

  const isDraftAtDefaults = zoneThemeDraft
    ? zoneThemeDraftsEqual(zoneThemeDraft, DEFAULT_ZONE_THEME_DRAFT)
    : true;

  const resetBtn = (label, disabled, onClick) => (
    <button
      type="button"
      className="community-banner-modal__reset community-banner-modal__reset--compact"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );

  const publishBtn = (label, disabled, onClick) => (
    <button
      type="button"
      className="community-main-chat__send-btn community-banner-modal__publish community-banner-modal__publish--compact"
      disabled={disabled}
      onClick={() => void onClick()}
    >
      {label}
    </button>
  );

  const modal =
    isOpen && zoneThemeDraft ? (
      <>
        <BannerToolModal
          title={t('community_guest_frame_bg_tool', 'Chat look')}
          titleId="community-chat-zone-theme-modal"
          onClose={requestClose}
          headerActions={
            <>
              {resetBtn(
                t('community_chat_zone_theme_reset', 'Reset to default'),
                draftBusy || isDraftAtDefaults,
                resetToDefaults
              )}
              {publishBtn(
                zoneThemeSaving ? t('saving', 'Saving…') : t('save', 'Save'),
                draftBusy || !isDraftDirty,
                saveAndClose
              )}
            </>
          }
        >
          <CommunityChatZoneThemePicker
            themeId={zoneThemeDraft.themeId}
            onSelectTheme={(nextThemeId) => updateDraft({ themeId: nextThemeId })}
            guestFrameBackground={buildGuestFrameBackgroundFromDraft(zoneThemeDraft.guestFrame)}
            saving={zoneThemeSaving}
            guestFrameBackgroundGenerating={guestFrameBackgroundGenerating}
            onSelectTransparent={() => {
              updateGuestFrameDraft({ colorOverlayEnabled: false });
            }}
            onSelectGradientPreset={(colorStart, colorEnd) =>
              updateGuestFrameDraft({
                colorOverlayEnabled: true,
                colorStart,
                colorEnd,
              })
            }
            onChangeGuestFrameColors={(colorStart, colorEnd) =>
              updateGuestFrameDraft({
                colorOverlayEnabled: true,
                colorStart,
                colorEnd,
              })
            }
            onChangeGuestFrameDensity={(intensity) =>
              updateGuestFrameDraft({
                colorOverlayEnabled: true,
                intensity,
              })
            }
            onSelectImageNone={() => {
              updateGuestFrameDraft({
                imageMode: 'none',
                presetId: null,
                customUrl: null,
              });
            }}
            onGenerateGuestFrameBackgroundAi={async (prompt) => {
              const url = await generateCommunityChatGuestFrameBackgroundImage(prompt);
              if (url) {
                updateGuestFrameDraft({
                  imageMode: 'custom',
                  customUrl: url,
                  presetId: null,
                });
              }
            }}
          />
        </BannerToolModal>
        <InvitationEditorLeaveDialog
          open={zoneThemeLeaveOpen}
          saving={zoneThemeSaving}
          onSave={saveAndClose}
          onDiscard={discardDraft}
          onCancel={() => setZoneThemeLeaveOpen(false)}
          questionKey="community_chat_zone_theme_unsaved_question"
          questionDefault="Save your chat color changes before closing?"
        />
      </>
    ) : null;

  return { open: openModal, isOpen, modal };
}
