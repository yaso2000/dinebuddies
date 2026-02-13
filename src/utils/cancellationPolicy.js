import { doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Cancellation Policy Configuration
 * Progressive penalty system based on cancellation frequency
 */
export const CANCELLATION_POLICY = {
    // Tracking period in days
    trackingPeriod: 90, // 3 months

    // Progressive limits and penalties
    limits: [
        {
            cancellations: 1,
            penalty: 'warning',
            duration: 0, // days
            level: 1,
            message: 'First cancellation - please be mindful of your commitments',
            icon: '⚠️'
        },
        {
            cancellations: 2,
            penalty: 'restriction',
            duration: 14, // 2 weeks
            level: 2,
            message: 'Account restricted for 2 weeks due to repeated cancellations',
            icon: '🔒'
        },
        {
            cancellations: 3,
            penalty: 'ban',
            duration: 30, // 1 month
            level: 3,
            message: 'Account banned for 1 month due to frequent cancellations',
            icon: '🚫'
        },
        {
            cancellations: 4,
            penalty: 'long_ban',
            duration: 90, // 3 months
            level: 4,
            message: 'Account banned for 3 months due to excessive cancellations',
            icon: '⛔'
        }
    ]
};

/**
 * Get user's cancellation history within tracking period
 */
export const getUserCancellationHistory = async (userId) => {
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            return {
                cancellations: [],
                count: 0,
                oldestCancellation: null
            };
        }

        const userData = userDoc.data();
        const cancellationHistory = userData.cancellationHistory || [];

        // Filter cancellations within tracking period
        const trackingPeriodMs = CANCELLATION_POLICY.trackingPeriod * 24 * 60 * 60 * 1000;
        const cutoffDate = Date.now() - trackingPeriodMs;

        const recentCancellations = cancellationHistory.filter(cancellation => {
            const cancellationDate = cancellation.timestamp?.toDate?.() || new Date(cancellation.timestamp);
            return cancellationDate.getTime() > cutoffDate;
        });

        return {
            cancellations: recentCancellations,
            count: recentCancellations.length,
            oldestCancellation: recentCancellations.length > 0
                ? recentCancellations[0].timestamp
                : null
        };
    } catch (error) {
        console.error('Error getting cancellation history:', error);
        return {
            cancellations: [],
            count: 0,
            oldestCancellation: null
        };
    }
};

/**
 * Check if user can create invitations
 */
export const canCreateInvitation = async (userId) => {
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            return {
                canCreate: true,
                reason: null
            };
        }

        const userData = userDoc.data();
        const restriction = userData.invitationRestriction;

        // Check if user has active restriction
        if (restriction && restriction.until) {
            const restrictionEnd = restriction.until.toDate?.() || new Date(restriction.until);
            const now = new Date();

            if (now < restrictionEnd) {
                // Still restricted
                const daysLeft = Math.ceil((restrictionEnd - now) / (1000 * 60 * 60 * 24));

                return {
                    canCreate: false,
                    reason: restriction.reason || 'Account restricted',
                    until: restrictionEnd,
                    daysLeft,
                    level: restriction.level || 0
                };
            } else {
                // Restriction expired, clear it
                await updateDoc(userRef, {
                    invitationRestriction: null
                });
            }
        }

        return {
            canCreate: true,
            reason: null
        };
    } catch (error) {
        console.error('Error checking invitation permission:', error);
        return {
            canCreate: true,
            reason: null
        };
    }
};

/**
 * Record a cancellation and apply penalty if needed
 * Exempts cancellations with no participants (no joined members and no pending requests)
 */
export const recordCancellation = async (userId, invitationId, reason, invitationData) => {
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            return {
                success: false,
                error: 'User not found'
            };
        }

        // Check for exemption: no participants affected
        const joined = invitationData?.joined || [];
        const requests = invitationData?.requests || [];

        // EXEMPTION: No penalty if no one joined and no pending requests
        if (joined.length === 0 && requests.length === 0) {
            console.log('✅ Cancellation exempted - no participants affected');
            return {
                success: true,
                penalty: {
                    level: 0,
                    penalty: 'exempt',
                    duration: 0,
                    message: 'No penalty applied - no participants were affected',
                    icon: '✅'
                },
                cancellationCount: 0,
                isRestricted: false,
                isExempt: true
            };
        }

        const userData = userDoc.data();
        const cancellationHistory = userData.cancellationHistory || [];

        // Add new cancellation
        const newCancellation = {
            invitationId,
            reason,
            timestamp: serverTimestamp(),
            participantsAffected: joined.length + requests.length
        };

        const updatedHistory = [...cancellationHistory, newCancellation];

        // Get recent cancellations count
        const history = await getUserCancellationHistory(userId);
        const newCount = history.count + 1; // +1 for the current cancellation

        // Determine penalty based on count
        let penalty = null;
        for (const limit of CANCELLATION_POLICY.limits) {
            if (newCount >= limit.cancellations) {
                penalty = limit;
            }
        }

        const updateData = {
            cancellationHistory: updatedHistory
        };

        // Apply penalty if applicable
        if (penalty && penalty.duration > 0) {
            const restrictionEnd = new Date();
            restrictionEnd.setDate(restrictionEnd.getDate() + penalty.duration);

            updateData.invitationRestriction = {
                level: penalty.level,
                penalty: penalty.penalty,
                reason: penalty.message,
                until: restrictionEnd,
                appliedAt: new Date(),
                cancellationCount: newCount
            };
        }

        await updateDoc(userRef, updateData);

        return {
            success: true,
            penalty: penalty || CANCELLATION_POLICY.limits[0], // At least warning
            cancellationCount: newCount,
            isRestricted: penalty && penalty.duration > 0
        };
    } catch (error) {
        console.error('Error recording cancellation:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Get penalty information for display
 */
export const getPenaltyInfo = (cancellationCount) => {
    let penalty = CANCELLATION_POLICY.limits[0]; // Default to warning

    for (const limit of CANCELLATION_POLICY.limits) {
        if (cancellationCount >= limit.cancellations) {
            penalty = limit;
        }
    }

    return penalty;
};

/**
 * Clear old cancellations (cleanup function)
 */
export const cleanupOldCancellations = async (userId) => {
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) return;

        const userData = userDoc.data();
        const cancellationHistory = userData.cancellationHistory || [];

        // Keep only recent cancellations
        const trackingPeriodMs = CANCELLATION_POLICY.trackingPeriod * 24 * 60 * 60 * 1000;
        const cutoffDate = Date.now() - trackingPeriodMs;

        const recentCancellations = cancellationHistory.filter(cancellation => {
            const cancellationDate = cancellation.timestamp?.toDate?.() || new Date(cancellation.timestamp);
            return cancellationDate.getTime() > cutoffDate;
        });

        if (recentCancellations.length < cancellationHistory.length) {
            await updateDoc(userRef, {
                cancellationHistory: recentCancellations
            });
        }
    } catch (error) {
        console.error('Error cleaning up cancellations:', error);
    }
};
