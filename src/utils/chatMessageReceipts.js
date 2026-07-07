import { arrayUnion, writeBatch } from 'firebase/firestore';

function asUidList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()) : [];
}

function withoutViewer(values, viewerId) {
  return asUidList(values).filter((uid) => uid !== viewerId);
}

export function getMessageReceiptState(message, viewerId) {
  if (!message || !viewerId || message.senderId !== viewerId) {
    return null;
  }

  const readByOthers = withoutViewer(message.readBy, viewerId);
  if (readByOthers.length > 0) {
    return 'read';
  }

  const deliveredToOthers = withoutViewer(message.deliveredTo, viewerId);
  if (deliveredToOthers.length > 0) {
    return 'delivered';
  }

  if (message.status === 'read' || message.status === 'delivered') {
    return message.status;
  }

  return 'sent';
}

export function getMessageReceiptDisplay(message, viewerId) {
  const state = getMessageReceiptState(message, viewerId);
  if (!state) {
    return null;
  }

  return {
    state,
    ticks: state === 'sent' ? '✓' : '✓✓',
  };
}

export async function syncMessageReceiptDocs({
  db,
  messageDocs,
  viewerId,
  markRead = false,
}) {
  if (!db || !viewerId || !Array.isArray(messageDocs) || messageDocs.length === 0) {
    return 0;
  }

  const batch = writeBatch(db);
  let updates = 0;

  for (const messageDoc of messageDocs) {
    if (!messageDoc?.ref || typeof messageDoc.data !== 'function') {
      continue;
    }

    const data = messageDoc.data() || {};
    if (!data.senderId || data.senderId === viewerId || data.isSystemMessage) {
      continue;
    }

    const deliveredTo = asUidList(data.deliveredTo);
    const readBy = asUidList(data.readBy);
    const patch = {};

    if (!deliveredTo.includes(viewerId)) {
      patch.deliveredTo = arrayUnion(viewerId);
    }

    if (markRead && !readBy.includes(viewerId)) {
      patch.readBy = arrayUnion(viewerId);
    }

    if (Object.keys(patch).length > 0) {
      batch.update(messageDoc.ref, patch);
      updates += 1;
    }
  }

  if (updates > 0) {
    await batch.commit();
  }

  return updates;
}
