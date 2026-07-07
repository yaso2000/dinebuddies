import { useEffect, useMemo, useState } from 'react';
import {
  buildChatThemeInlineStyle,
  CHAT_THEME_STORAGE_KEY,
  DEFAULT_CHAT_THEME_ID,
  normalizeChatThemeId,
} from '../constants/chatThemes';

function readStoredChatTheme() {
  if (typeof window === 'undefined') {
    return DEFAULT_CHAT_THEME_ID;
  }

  try {
    return normalizeChatThemeId(window.localStorage.getItem(CHAT_THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_CHAT_THEME_ID;
  }
}

export function useChatTheme() {
  const [themeId, setThemeId] = useState(readStoredChatTheme);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(CHAT_THEME_STORAGE_KEY, themeId);
    } catch {
      /* ignore storage failures */
    }
  }, [themeId]);

  const themeStyle = useMemo(() => buildChatThemeInlineStyle(themeId), [themeId]);

  return {
    themeId,
    setThemeId: (nextThemeId) => setThemeId(normalizeChatThemeId(nextThemeId)),
    themeStyle,
  };
}
