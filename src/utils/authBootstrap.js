/**
 * True while Firebase session or users/{uid} server sync is still in flight.
 * No login buttons, home, or complete-profile should render during this window.
 */
export function isAuthBootstrapPending({
    loading,
    currentUser,
    isGuest,
    profileServerSynced,
}) {
    return (
        Boolean(loading) ||
        (Boolean(currentUser) && !isGuest && !profileServerSynced)
    );
}
