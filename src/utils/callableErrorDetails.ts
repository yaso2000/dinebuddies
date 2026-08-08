/** Extract structured `reason` from Firebase callable HttpsError details. */
export function getCallableErrorReason(error: unknown): string | null {
    if (!error || typeof error !== 'object') return null;
    const details = (error as { details?: unknown }).details;
    if (details && typeof details === 'object' && 'reason' in details) {
        const reason = (details as { reason?: unknown }).reason;
        return typeof reason === 'string' ? reason : null;
    }
    return null;
}
