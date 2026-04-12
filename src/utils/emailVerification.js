import { isBusinessUser } from './accountRole';

/**
 * Consumer (non-business) accounts with an email must verify before using the app.
 * Phone-only / anonymous users have no email — no gate.
 */
export function needsConsumerEmailVerification(currentUser, userProfile) {
    if (!currentUser) return false;
    // Don't gate while loading/transitioning — if userProfile is missing, we don't know the role yet.
    // If we trigger /verify-email for a business owner, they get stuck in a loop.
    if (!userProfile) return false; 
    
    const email = currentUser.email;
    if (!email || typeof email !== 'string') return false;
    if (currentUser.emailVerified === true) return false;
    
    // Businesses have their own verification banners/logic
    if (isBusinessUser(userProfile)) return false;
    
    return true;
}
