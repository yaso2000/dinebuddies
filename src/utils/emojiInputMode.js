import { useEffect, useState } from 'react';

const DESKTOP_SHELL_MQ = '(min-width: 1024px)';

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
