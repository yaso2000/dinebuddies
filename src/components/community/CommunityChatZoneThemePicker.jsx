import React from 'react';
import CommunityGuestFrameBackgroundPicker from './CommunityGuestFrameBackgroundPicker';
import './CommunityChatZoneThemePicker.css';

export default function CommunityChatZoneThemePicker({
  guestFrameBackground,
  onSelectTransparent,
  onSelectGradientPreset,
  onChangeGuestFrameColors,
  onChangeGuestFrameDensity,
  onSelectImageNone,
  onSelectGuestFramePreset,
  onUploadGuestFrameBackground,
  onGenerateGuestFrameBackgroundAi,
  guestFrameBackgroundUploading = false,
  guestFrameBackgroundGenerating = false,
  saving = false,
}) {
  return (
    <div className="community-zone-theme-picker">
      <CommunityGuestFrameBackgroundPicker
        background={guestFrameBackground}
        saving={saving}
        uploading={guestFrameBackgroundUploading}
        generating={guestFrameBackgroundGenerating}
        onSelectTransparent={onSelectTransparent}
        onSelectGradientPreset={onSelectGradientPreset}
        onChangeColors={onChangeGuestFrameColors}
        onChangeDensity={onChangeGuestFrameDensity}
        onSelectImageNone={onSelectImageNone}
        onSelectPreset={onSelectGuestFramePreset}
        onUploadFile={onUploadGuestFrameBackground}
        onGenerateAi={onGenerateGuestFrameBackgroundAi}
      />
    </div>
  );
}
