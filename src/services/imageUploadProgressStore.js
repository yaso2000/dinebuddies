/** @typedef {'preparing' | 'uploading' | 'checking' | 'done'} ImageUploadPhase */

const INITIAL = Object.freeze({ active: false, progress: 0, phase: /** @type {ImageUploadPhase} */ ('preparing') });

let state = { ...INITIAL };
let depth = 0;
/** @type {Set<(s: typeof state) => void>} */
const listeners = new Set();
/** @type {ReturnType<typeof setInterval> | null} */
let checkingPulseId = null;

function notify() {
    const snapshot = { ...state };
    listeners.forEach((fn) => {
        try {
            fn(snapshot);
        } catch (e) {
            console.warn('[imageUploadProgress]', e);
        }
    });
}

export function subscribeImageUploadProgress(listener) {
    listeners.add(listener);
    listener({ ...state });
    return () => listeners.delete(listener);
}

export function beginImageUploadSession(phase = 'preparing') {
    depth += 1;
    if (depth === 1) {
        state = { active: true, progress: 0, phase };
        notify();
    }
}

export function updateImageUploadSession(progress, phase) {
    if (depth <= 0 && !state.active) return;
    const next = Math.min(100, Math.max(0, Math.round(progress)));
    state = {
        active: true,
        progress: next,
        phase: phase || state.phase,
    };
    notify();
}

export function finishImageUploadSession() {
    if (depth <= 0) return;
    depth -= 1;
    if (depth > 0) return;
    stopCheckingPulse();
    updateImageUploadSession(100, 'done');
    setTimeout(() => {
        if (depth === 0) {
            state = { ...INITIAL };
            notify();
        }
    }, 450);
}

/**
 * Smooth progress while Vision moderation runs (no byte events).
 * @param {(pct: number) => void} onTick
 */
export function startCheckingPulse(onTick) {
    stopCheckingPulse();
    let pct = 42;
    onTick(pct);
    checkingPulseId = setInterval(() => {
        pct = Math.min(92, pct + 2);
        onTick(pct);
    }, 350);
    return stopCheckingPulse;
}

export function stopCheckingPulse() {
    if (checkingPulseId) {
        clearInterval(checkingPulseId);
        checkingPulseId = null;
    }
}

/**
 * @template T
 * @param {(report: (pct: number, phase?: ImageUploadPhase) => void) => Promise<T>} fn
 * @param {ImageUploadPhase} [initialPhase]
 * @returns {Promise<T>}
 */
export async function withImageUploadProgress(fn, initialPhase = 'preparing') {
    beginImageUploadSession(initialPhase);
    try {
        const report = (pct, phase) => {
            updateImageUploadSession(pct, phase);
        };
        return await fn(report);
    } finally {
        finishImageUploadSession();
    }
}
