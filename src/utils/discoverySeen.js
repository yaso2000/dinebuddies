/**
 * Remember which discovery profiles a viewer has already swiped past, so
 * returning to the swipe deck continues from where they stopped instead of
 * re-showing the same faces. Per-viewer, capped FIFO in localStorage; when the
 * whole deck has been seen it resets (small communities never dead-end).
 */
const KEY = (uid) => `discovery.seen.${uid || 'guest'}`;
const CAP = 500;

function readArr(uid) {
  try {
    const raw = localStorage.getItem(KEY(uid));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function getSeenSet(uid) {
  return new Set(readArr(uid));
}

export function markSeen(uid, id) {
  if (!id) return;
  try {
    let arr = readArr(uid);
    if (arr.includes(id)) return;
    arr.push(id);
    if (arr.length > CAP) arr = arr.slice(arr.length - CAP);
    localStorage.setItem(KEY(uid), JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

export function clearSeen(uid) {
  try {
    localStorage.removeItem(KEY(uid));
  } catch {
    /* ignore */
  }
}

/** Index of the first profile the viewer has NOT seen; -1 if every one is seen. */
export function firstUnseenIndex(uid, profiles) {
  const seen = getSeenSet(uid);
  for (let i = 0; i < profiles.length; i += 1) {
    if (!seen.has(profiles[i]?.id)) return i;
  }
  return -1;
}
