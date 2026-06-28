/** Short sounds for live gift / wave pings (Web Audio — no asset files). */
let audioCtx = null;

function getAudioContext() {
    if (typeof window === 'undefined') return null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    return audioCtx;
}

function playToneSequence(notes, { type = 'sine', gap = 0.09, volume = 0.2, duration = 0.34 } = {}) {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        if (ctx.state === 'suspended') {
            void ctx.resume();
        }

        const start = ctx.currentTime;
        notes.forEach((frequency, index) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const t0 = start + index * gap;

            osc.type = type;
            osc.frequency.setValueAtTime(frequency, t0);

            gain.gain.setValueAtTime(0.0001, t0);
            gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.025);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(t0);
            osc.stop(t0 + duration + 0.05);
        });
    } catch (err) {
        console.warn('[socialPingSound]', err);
    }
}

/** Gift received — bright ascending chime. */
export function playGiftPingSound() {
    playToneSequence([659.25, 783.99, 987.77, 1174.66], {
        type: 'triangle',
        gap: 0.1,
        volume: 0.24,
        duration: 0.38,
    });
}

/** Wave greeting — quick friendly pop. */
export function playWavePingSound() {
    playToneSequence([440, 554.37, 659.25], {
        type: 'sine',
        gap: 0.07,
        volume: 0.18,
        duration: 0.28,
    });
}
