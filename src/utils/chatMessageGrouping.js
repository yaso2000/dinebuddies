import { formatAppDate } from './localeFormat';

/** Same sender within this window → one visual cluster. */
export const CHAT_CLUSTER_GAP_MS = 5 * 60 * 1000;

export function messageCreatedAtMs(message) {
  const ts = message?.createdAt;
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') {
    const d = ts.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : null;
  }
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (ts instanceof Date) return Number.isNaN(ts.getTime()) ? null : ts.getTime();
  const parsed = new Date(ts).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function getChatDayKey(ms) {
  if (ms == null) return null;
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function isSystemMessage(message) {
  return Boolean(message?.type === 'system' || message?.isSystemMessage);
}

export function messagesInSameCluster(prev, next, senderKey = 'senderId') {
  if (!prev || !next) return false;
  if (isSystemMessage(prev) || isSystemMessage(next)) return false;
  if (prev[senderKey] !== next[senderKey]) return false;
  const prevMs = messageCreatedAtMs(prev);
  const nextMs = messageCreatedAtMs(next);
  if (prevMs == null || nextMs == null) return true;
  return Math.abs(nextMs - prevMs) <= CHAT_CLUSTER_GAP_MS;
}

/**
 * @returns {'single' | 'first' | 'middle' | 'last'}
 */
export function getMessageGroupPosition(messages, index, senderKey = 'senderId') {
  if (!Array.isArray(messages) || index < 0 || index >= messages.length) {
    return 'single';
  }

  const current = messages[index];
  if (isSystemMessage(current)) return 'single';

  const prev = index > 0 ? messages[index - 1] : null;
  const next = index < messages.length - 1 ? messages[index + 1] : null;

  const startsGroup = !prev || !messagesInSameCluster(prev, current, senderKey);
  const endsGroup = !next || !messagesInSameCluster(current, next, senderKey);

  if (startsGroup && endsGroup) return 'single';
  if (startsGroup) return 'first';
  if (endsGroup) return 'last';
  return 'middle';
}

export function shouldShowChatDaySeparator(messages, index) {
  if (!Array.isArray(messages) || index < 0 || index >= messages.length) return false;
  const ms = messageCreatedAtMs(messages[index]);
  if (ms == null) return false;
  if (index === 0) return true;
  const prevMs = messageCreatedAtMs(messages[index - 1]);
  if (prevMs == null) return true;
  return getChatDayKey(ms) !== getChatDayKey(prevMs);
}

/**
 * @param {number} ms
 * @param {string | undefined} language
 * @param {(key: string, fallback?: string) => string} t
 */
export function formatChatDaySeparator(ms, language, t) {
  if (ms == null) return '';
  const date = new Date(ms);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startMsg = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startToday - startMsg) / 86400000);
  if (diffDays === 0) return t('today', 'Today');
  if (diffDays === 1) return t('yesterday', 'Yesterday');
  return formatAppDate(date, language, { day: 'numeric', month: 'long', year: 'numeric' });
}
