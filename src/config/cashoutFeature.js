/**
 * Shield cash-out (real-money payout) — off by default for store launch.
 * Set VITE_CASHOUT_ENABLED=true only when intentionally reopening the program.
 * Keep in sync with functions/cashout.js CASHOUT_ENABLED (default false).
 */

function parseEnabledFlag(raw) {
    const v = String(raw ?? '').trim().toLowerCase();
    if (!v) return false;
    return v === '1' || v === 'true' || v === 'on' || v === 'yes';
}

/** @returns {boolean} */
export function isCashoutFeatureEnabled() {
    return parseEnabledFlag(import.meta.env.VITE_CASHOUT_ENABLED);
}
