import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getPlanById } from '../config/subscriptionPlans';

/**
 * Hook to get effective limits for a business
 * Combines default plan limits with custom admin overrides
 */
export const useEffectiveLimits = (businessId, userProfile = null) => {
    const [limits, setLimits] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const calculateEffectiveLimits = async () => {
            try {
                setLoading(true);

                // Get business data
                let businessData = null;

                if (userProfile?.businessInfo) {
                    businessData = userProfile.businessInfo;
                } else if (businessId) {
                    const businessDoc = await getDoc(doc(db, 'users', businessId));
                    if (businessDoc.exists()) {
                        businessData = businessDoc.data().businessInfo;
                    }
                }

                if (!businessData) {
                    throw new Error('Business data not found');
                }

                // Get plan and default limits
                const planId = businessData.subscriptionPlan || 'free';
                const defaultLimits = getPlanById(planId);

                // Get custom limits and expiry dates
                const customLimits = businessData.customLimits || {};
                const customLimitsExpiry = businessData.customLimitsExpiry || {};

                // Calculate effective limits
                const now = new Date();
                const effectiveLimits = { ...defaultLimits };

                // Override with custom limits if they exist and haven't expired
                Object.keys(customLimits).forEach(key => {
                    const expiryDate = customLimitsExpiry[key];

                    // Check if custom limit is still valid
                    if (!expiryDate || new Date(expiryDate) > now) {
                        effectiveLimits[key] = customLimits[key];
                    }
                });

                // Add metadata
                effectiveLimits._meta = {
                    planId,
                    planName: defaultLimits.name,
                    hasCustomLimits: Object.keys(customLimits).length > 0,
                    customLimits,
                    customLimitsExpiry,
                    adminNotes: businessData.adminNotes || null
                };

                setLimits(effectiveLimits);
                setError(null);
            } catch (err) {
                console.error('Error calculating effective limits:', err);
                setError(err.message);

                // Fallback to free plan
                const freePlan = getPlanById('free');
                setLimits({
                    ...freePlan,
                    _meta: {
                        planId: 'free',
                        planName: 'Free',
                        hasCustomLimits: false,
                        error: err.message
                    }
                });
            } finally {
                setLoading(false);
            }
        };

        if (businessId || userProfile) {
            calculateEffectiveLimits();
        } else {
            setLoading(false);
        }
    }, [businessId, userProfile]);

    return { limits, loading, error };
};

/**
 * Hook to check if a specific limit has been reached
 */
export const useCheckLimit = (businessId, limitKey, currentValue) => {
    const { limits, loading } = useEffectiveLimits(businessId);
    const [isLimitReached, setIsLimitReached] = useState(false);
    const [remaining, setRemaining] = useState(null);

    useEffect(() => {
        if (!loading && limits) {
            const limitValue = limits[limitKey];

            if (limitValue === Infinity) {
                setIsLimitReached(false);
                setRemaining(Infinity);
            } else {
                setIsLimitReached(currentValue >= limitValue);
                setRemaining(Math.max(0, limitValue - currentValue));
            }
        }
    }, [limits, loading, limitKey, currentValue]);

    return {
        isLimitReached,
        remaining,
        limit: limits?.[limitKey],
        loading
    };
};

/**
 * Hook to check if a feature is available
 */
export const useHasFeature = (businessId, featureKey) => {
    const { limits, loading } = useEffectiveLimits(businessId);
    const [hasFeature, setHasFeature] = useState(false);

    useEffect(() => {
        if (!loading && limits) {
            setHasFeature(!!limits[featureKey]);
        }
    }, [limits, loading, featureKey]);

    return { hasFeature, loading };
};

export default useEffectiveLimits;
