import { setBannerVoiceAudioPriority } from './bannerVoiceAudioPriority';

/** Host plays the just-recorded blob immediately (still inside the stop-tap gesture). */
export const BANNER_VOICE_LOCAL_PLAY_EVENT = 'db-banner-voice-local-play';

export function dispatchBannerVoiceLocalPlay(previewUrl, durationSec = 0) {
  if (typeof window === 'undefined') return;
  const url = String(previewUrl || '').trim();
  if (!url) return;
  // Keep YouTube paused across stop→local play (recording reason may drop first).
  setBannerVoiceAudioPriority('playback', true);
  window.dispatchEvent(
    new CustomEvent(BANNER_VOICE_LOCAL_PLAY_EVENT, {
      detail: {
        previewUrl: url,
        durationSec: Math.max(0, Math.floor(Number(durationSec) || 0)),
      },
    })
  );
}
