/**
 * Banner voice has audio priority over YouTube.
 * Reasons stack so recording + playback overlap cleanly (no YouTube resume between stop→play).
 */
export const BANNER_VOICE_AUDIO_PRIORITY_EVENT = 'db-banner-voice-audio-priority';

const activeReasons = new Set();

export function setBannerVoiceAudioPriority(reason, active) {
  const key = String(reason || '').trim();
  if (!key || typeof window === 'undefined') return;
  if (active) activeReasons.add(key);
  else activeReasons.delete(key);

  window.dispatchEvent(
    new CustomEvent(BANNER_VOICE_AUDIO_PRIORITY_EVENT, {
      detail: {
        active: activeReasons.size > 0,
        reason: key,
        reasons: Array.from(activeReasons),
      },
    })
  );
}

export function clearBannerVoiceAudioPriority() {
  if (typeof window === 'undefined') return;
  if (activeReasons.size === 0) return;
  activeReasons.clear();
  window.dispatchEvent(
    new CustomEvent(BANNER_VOICE_AUDIO_PRIORITY_EVENT, {
      detail: { active: false, reason: 'clear', reasons: [] },
    })
  );
}
