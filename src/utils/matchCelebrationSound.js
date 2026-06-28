/** Short celebratory chime via Web Audio (no asset file). */
let audioCtx = null;

function getAudioContext() {
    if (typeof window === 'undefined') return null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    return audioCtx;
}

export function playMatchCelebrationSound() {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        if (ctx.state === 'suspended') {
            void ctx.resume();
        }

        const start = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5];

        notes.forEach((frequency, index) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const t0 = start + index * 0.11;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(frequency, t0);

            gain.gain.setValueAtTime(0.0001, t0);
            gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(t0);
            osc.stop(t0 + 0.45);
        });
    } catch (err) {
        console.warn('[matchCelebrationSound]', err);
    }
}
