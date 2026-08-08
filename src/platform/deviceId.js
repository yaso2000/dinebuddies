const STORAGE_KEY = 'dineb_device_id_v1';

function createUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function readCapacitorPreference() {
  try {
    const Preferences = window?.Capacitor?.Plugins?.Preferences;
    if (!Preferences?.get) return null;
    const result = await Preferences.get({ key: STORAGE_KEY });
    const value = String(result?.value || '').trim();
    return value || null;
  } catch {
    return null;
  }
}

async function writeCapacitorPreference(value) {
  try {
    const Preferences = window?.Capacitor?.Plugins?.Preferences;
    if (!Preferences?.set) return;
    await Preferences.set({ key: STORAGE_KEY, value });
  } catch {
    /* ignore */
  }
}

function readLocalStorage() {
  try {
    return String(localStorage.getItem(STORAGE_KEY) || '').trim() || null;
  } catch {
    return null;
  }
}

function writeLocalStorage(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

/**
 * Stable per-install device id for signup/device-ban enforcement.
 * Persisted in localStorage and Capacitor Preferences when available.
 */
export async function getOrCreateDeviceId() {
  const fromPrefs = await readCapacitorPreference();
  if (fromPrefs) {
    writeLocalStorage(fromPrefs);
    return fromPrefs;
  }

  const fromLocal = readLocalStorage();
  if (fromLocal) {
    await writeCapacitorPreference(fromLocal);
    return fromLocal;
  }

  const next = createUuid();
  writeLocalStorage(next);
  await writeCapacitorPreference(next);
  return next;
}
