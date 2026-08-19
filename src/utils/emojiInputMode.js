import { useEffect, useState } from 'react';

const DESKTOP_SHELL_MQ = '(min-width: 1024px)';

/**
 * Fallback in-app emoji sheet height on mobile when no real keyboard height
 * has been observed yet in this session (e.g. the emoji button is tapped
 * before the composer was ever focused). Matches a typical phone keyboard
 * height closely enough that the shell pins correctly on first open instead
 * of leaving a gap between the composer and the sheet.
 */
export const DEFAULT_MOBILE_EMOJI_PANEL_HEIGHT = 320;

/**
 * Height-transition duration (ms) for the mobile emoji sheet growing/shrinking
 * in and out of the composer's flex flow. Shared with callers that need to
 * re-settle scroll position once the transition finishes.
 */
export const MOBILE_EMOJI_SHEET_ANIM_MS = 260;

/** Touch / coarse pointer — use OS emoji keyboard instead of in-app picker. */
export function isTouchOrCoarsePointer() {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || window.matchMedia('(pointer: coarse)').matches;
}

/** In-app emoji picker — desktop shell only (≥1024px, fine pointer). */
export function shouldUseAppEmojiPicker() {
  if (typeof window === 'undefined') return false;
  if (isTouchOrCoarsePointer()) return false;
  return window.matchMedia(DESKTOP_SHELL_MQ).matches;
}

/** Show the composer emoji button (same rule as in-app picker). */
export function showComposerEmojiButton() {
  return shouldUseAppEmojiPicker();
}

export function useShouldUseAppEmojiPicker() {
  const [enabled, setEnabled] = useState(() => shouldUseAppEmojiPicker());

  useEffect(() => {
    const sync = () => setEnabled(shouldUseAppEmojiPicker());
    sync();
    const mq = window.matchMedia(DESKTOP_SHELL_MQ);
    mq.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    return () => {
      mq.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);

  return enabled;
}

/** Focus a text field so the user can switch to the OS emoji keyboard. */
export function focusForNativeEmojiKeyboard(inputEl) {
  if (!inputEl || typeof inputEl.focus !== 'function') return;
  try {
    inputEl.focus({ preventScroll: false });
  } catch {
    inputEl.focus();
  }
  const len = inputEl.value?.length ?? 0;
  if (typeof inputEl.setSelectionRange === 'function') {
    try {
      inputEl.setSelectionRange(len, len);
    } catch {
      /* read-only or unsupported */
    }
  }
}

/** Desktop: toggle in-app picker. Mobile: focus field for system emoji keyboard. */
export function handleEmojiButtonClick({ inputRef, setPickerOpen }) {
  if (shouldUseAppEmojiPicker()) {
    setPickerOpen?.((open) => !open);
    return;
  }
  setPickerOpen?.(false);
  focusForNativeEmojiKeyboard(inputRef?.current);
}

// Covers Android's typical native keyboard show animation (~200-250ms).
// Keeping the emoji panel mounted until this elapses means the panel is
// still covering its slot when the keyboard finishes rising underneath it —
// the two surfaces are never both mid-collapse at once, which is what
// produced the blank-gap flash between "picker gone" and "keyboard risen".
const KEYBOARD_RISE_FALLBACK_MS = 260;

/**
 * 1:1 + invitation chat composers only (not the generic picker used by posts,
 * stories, profile fields, or the business community composer — those keep
 * the desktop-only behavior above unchanged). Always shows the in-app picker,
 * mobile included, matching WhatsApp/Telegram: tapping the emoji button
 * blurs the field (closes the OS keyboard) and opens the picker in its place;
 * tapping it again (now a keyboard icon) closes the picker and refocuses the
 * field so the OS keyboard reopens at the same height.
 *
 * Both directions are ordered so the surface that's about to disappear
 * (keyboard or panel) only starts disappearing after its replacement has
 * already claimed the same space — see EmojiPickerPortal, which snaps to
 * height instead of animating it, so opening the panel is atomic with the
 * state flip instead of racing the keyboard's own close animation.
 */
export function handleChatEmojiToggle({ inputRef, pickerOpen, setPickerOpen }) {
  if (pickerOpen) {
    // Must run synchronously inside this click handler — mobile browsers only honor
    // .focus() as a keyboard-raising trigger while still inside the original user
    // gesture's call stack. A setTimeout (even 0ms) defers past that window on many
    // WebViews, so the field becomes focused but the OS keyboard doesn't appear
    // until a second tap.
    const el = inputRef?.current;
    if (el && typeof el.focus === 'function') {
      el.focus();
    }
    // Keep the panel visible (still occupying the same slot) until the real
    // keyboard has had time to fully rise, then hand the slot back to it.
    window.setTimeout(() => setPickerOpen?.(false), KEYBOARD_RISE_FALLBACK_MS);
    return;
  }
  // Show the panel first, already at its known full height (no grow-from-0
  // animation — see EmojiPickerPortal), before closing the real keyboard —
  // so the panel has already claimed the space before the keyboard starts
  // collapsing.
  setPickerOpen?.(true);
  inputRef?.current?.blur?.();
}

const KEYBOARD_HEIGHT_STORAGE_KEY = 'db-last-keyboard-height-px';
const MIN_PLAUSIBLE_KEYBOARD_HEIGHT = 150;
const MAX_PLAUSIBLE_KEYBOARD_HEIGHT = 700;

/**
 * The real OS keyboard height is only known once the keyboard has actually been
 * shown at least once in this session (observed via visualViewport). Until then,
 * the in-app emoji sheet has nothing to size itself against and falls back to
 * DEFAULT_MOBILE_EMOJI_PANEL_HEIGHT — which rarely matches the device's real
 * keyboard height, producing a visible size jump the moment the real height is
 * later learned. Persisting the last real height per-device means every session
 * after the very first has an accurate value from the start.
 */
export function getPersistedKeyboardHeightPx() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEYBOARD_HEIGHT_STORAGE_KEY);
    const px = Number(raw);
    if (Number.isFinite(px) && px >= MIN_PLAUSIBLE_KEYBOARD_HEIGHT && px <= MAX_PLAUSIBLE_KEYBOARD_HEIGHT) {
      return px;
    }
  } catch {
    /* storage unavailable */
  }
  return null;
}

export function setPersistedKeyboardHeightPx(px) {
  if (typeof window === 'undefined') return;
  const rounded = Math.round(px);
  if (!Number.isFinite(rounded) || rounded < MIN_PLAUSIBLE_KEYBOARD_HEIGHT || rounded > MAX_PLAUSIBLE_KEYBOARD_HEIGHT) {
    return;
  }
  try {
    window.localStorage.setItem(KEYBOARD_HEIGHT_STORAGE_KEY, String(rounded));
  } catch {
    /* storage unavailable */
  }
}

/**
 * Android manifest sets `windowSoftInputMode="adjustResize"`, which makes the
 * OS resize the WebView's own window to fit above the keyboard — so
 * `window.innerHeight` shrinks by roughly the same amount as
 * `visualViewport.height`, and the `window.innerHeight - vv.height > 100`
 * heuristic used elsewhere never trips. That left the emoji sheet stuck on
 * DEFAULT_MOBILE_EMOJI_PANEL_HEIGHT forever on Android, visibly shorter than
 * the real keyboard, so the composer jumped position every time the two were
 * swapped. `@capacitor/keyboard` reports the real native height directly,
 * bypassing the viewport-diff guesswork entirely. Native Android only —
 * iOS's viewport diffing already works (it never resizes window.innerHeight),
 * and the web build has no native keyboard to listen to.
 */
export function subscribeNativeKeyboardHeight(onHeight) {
  if (typeof window === 'undefined' || typeof onHeight !== 'function') {
    return () => {};
  }

  let cancelled = false;
  let handles = [];

  import('../platform/runtime')
    .then(({ isNativeAndroid }) => {
      if (cancelled || !isNativeAndroid()) return null;
      return import('@capacitor/keyboard');
    })
    .then((mod) => {
      if (cancelled || !mod) return;
      const { Keyboard } = mod;
      const handleShow = (info) => {
        const height = info?.keyboardHeight;
        if (Number.isFinite(height) && height > 0) onHeight(height);
      };
      Promise.all([
        Keyboard.addListener('keyboardWillShow', handleShow),
        Keyboard.addListener('keyboardDidShow', handleShow),
      ]).then((subs) => {
        if (cancelled) {
          subs.forEach((s) => s.remove());
        } else {
          handles = subs;
        }
      });
    })
    .catch(() => {
      /* native plugin unavailable — visualViewport fallback still applies */
    });

  return () => {
    cancelled = true;
    handles.forEach((s) => s.remove());
  };
}

const PICKER_WIDTH = 300;
const PICKER_HEIGHT = 420;

/** Position desktop emoji picker anchored above (or below) the trigger button. */
export function getEmojiPickerAnchorStyle(anchorEl) {
  if (!anchorEl || typeof window === 'undefined') {
    return { position: 'fixed', left: 8, bottom: 70, zIndex: 999999 };
  }

  const rect = anchorEl.getBoundingClientRect();
  const margin = 8;
  let left = rect.left;
  left = Math.max(margin, Math.min(left, window.innerWidth - PICKER_WIDTH - margin));

  const spaceAbove = rect.top;
  const spaceBelow = window.innerHeight - rect.bottom;

  if (spaceAbove >= PICKER_HEIGHT + margin || spaceAbove >= spaceBelow) {
    const bottom = Math.max(margin, window.innerHeight - rect.top + margin);
    return { position: 'fixed', left, bottom, zIndex: 999999 };
  }

  const top = Math.min(window.innerHeight - PICKER_HEIGHT - margin, rect.bottom + margin);
  return { position: 'fixed', left, top, zIndex: 999999 };
}
