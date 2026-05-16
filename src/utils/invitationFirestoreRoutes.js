/**
 * Route-based flags for InvitationProvider Firestore listeners.
 * Keeps heavy snapshots off auth shells, admin, and settings-only screens.
 *
 * `publicInvitations` vs `restaurants` are split so we do not pay for directory/review
 * aggregation on routes that only need invitation lists (or vice versa).
 */
export function getInvitationFirestoreFlags(pathname = '') {
    const p = pathname || '';

    const authOrMarketingShell =
        p.startsWith('/login') ||
        p.startsWith('/welcome') ||
        p.startsWith('/join') ||
        p.startsWith('/affiliate') ||
        p.startsWith('/complete-profile') ||
        p.startsWith('/verify-email') ||
        p.startsWith('/auth/action') ||
        p.startsWith('/__/auth') ||
        p.startsWith('/business/login');

    if (authOrMarketingShell || p.startsWith('/admin')) {
        return {
            publicInvitations: false,
            restaurants: false,
            privateInvitations: false,
        };
    }

    const publicInvitationFeed =
        p.startsWith('/posts-feed') ||
        p.startsWith('/invitations') ||
        (p.startsWith('/invitation/') && !p.startsWith('/invitation/private/')) ||
        p.startsWith('/post/');

    const createFlow = p.startsWith('/create');

    const socialProfiles =
        p === '/profile' ||
        p.startsWith('/profile/') ||
        p.startsWith('/followers');

    const messagingShell =
        p.startsWith('/notifications') ||
        p.startsWith('/messages') ||
        p.startsWith('/chat/');

    const communityShell =
        p.startsWith('/my-community') ||
        p.startsWith('/my-communities') ||
        p.startsWith('/communities') ||
        p.startsWith('/community/');

    const businessApp = p.startsWith('/business-dashboard');

    /** Global public invitation snapshot (feed + detail + social surfaces that filter invites). */
    const publicInvitations =
        publicInvitationFeed ||
        createFlow ||
        socialProfiles ||
        messagingShell ||
        communityShell ||
        businessApp;

    /**
     * `public_profiles` + review aggregation — feed, directory, discovery, own profile, create flows only.
     * Intentionally OFF on chat, notifications, community threads, and business dashboard to avoid “ghost” sync.
     */
    const restaurants =
        p.startsWith('/posts-feed') ||
        p.startsWith('/invitations') ||
        p.startsWith('/restaurants') ||
        p.startsWith('/restaurant/') ||
        p.startsWith('/rankings') ||
        p.startsWith('/search') ||
        p === '/profile' ||
        createFlow;

    const privateInvitations =
        p === '/profile' ||
        p.startsWith('/profile/') ||
        p.startsWith('/invitation/private') ||
        p.startsWith('/create-private') ||
        p.startsWith('/create-dating');

    return { publicInvitations, restaurants, privateInvitations };
}
