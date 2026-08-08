/**
 * @deprecated Invite cards are shown only on app entry (InviteLandingGate).
 * Kept as a no-op so older imports do not break.
 */
export const UNHANDLED_INVITATIONS_REMINDER_MS = 10 * 60 * 1000;

export function useUnhandledInvitationsReminder() {
    return { visible: false, counts: { total: 0, private: 0, dating: 0 }, dismiss: () => {} };
}
