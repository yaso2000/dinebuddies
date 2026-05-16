import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { convertFromUSD } from '../utils/currencyConverter';
import { fetchIpLocation } from '../utils/locationUtils';
import { BASE_SUBSCRIPTION_PLANS, BASE_CREDIT_PACKS } from '../config/planDefaults';

const PricingDataContext = createContext(null);

export const usePricingData = () => {
    const ctx = useContext(PricingDataContext);
    if (!ctx) {
        throw new Error('usePricingData must be used within PricingDataProvider');
    }
    return ctx;
};

/**
 * Live subscription plan + credit pack rows from Firestore, merged with local defaults and
 * currency-converted for display. Mount only on pricing surfaces to avoid global reads.
 */
export function PricingDataProvider({ children }) {
    const { userProfile: firebaseProfile } = useAuth();
    const [detectedCountry, setDetectedCountry] = useState(null);
    const [dbPlans, setDbPlans] = useState([]);
    const [dbCreditPacks, setDbCreditPacks] = useState([]);

    useEffect(() => {
        const detectCountry = async () => {
            try {
                if (firebaseProfile?.country) {
                    setDetectedCountry(firebaseProfile.country);
                    return;
                }
                const data = await fetchIpLocation();
                if (data.success) {
                    setDetectedCountry(data.country || 'United States');
                }
            } catch {
                setDetectedCountry('United States');
            }
        };
        detectCountry();
    }, [firebaseProfile?.country]);

    useEffect(() => {
        const q = query(collection(db, 'subscriptionPlans'), where('active', '==', true));
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const plansData = snapshot.docs.map((d) => {
                    const data = d.data();
                    return {
                        id: d.id,
                        ...data,
                        stripePriceId: data.stripe?.priceId || data.stripePriceId,
                        features: data.features?.map((f) => (typeof f === 'object' ? f.text : (f.text || f))) || [],
                    };
                });
                setDbPlans(plansData);
            },
            (error) => {
                console.error('Error syncing dynamic plans:', error);
            }
        );
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const q = query(collection(db, 'creditPacks'), where('active', '==', true));
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const packsData = snapshot.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                }));
                setDbCreditPacks(packsData);
            },
            (error) => {
                console.error('Error syncing credit packs:', error);
            }
        );
        return () => unsubscribe();
    }, []);

    const baseSubscriptionPlans = BASE_SUBSCRIPTION_PLANS;
    const baseCreditPacks = BASE_CREDIT_PACKS;
    const hasArabic = (text) => /[\u0600-\u06FF]/.test(text);

    const allPlans = useMemo(() => {
        const mergedMap = {};
        baseSubscriptionPlans.forEach((plan) => {
            const key = plan.stripePriceId || plan.id;
            mergedMap[key] = { ...plan };
        });

        dbPlans.forEach((dbPlan) => {
            if (hasArabic(dbPlan.name || '') || hasArabic(dbPlan.title || '')) return;

            const key = dbPlan.stripePriceId || dbPlan.id;

            if (mergedMap[key]) {
                mergedMap[key] = {
                    ...mergedMap[key],
                    ...dbPlan,
                    name: mergedMap[key].name,
                    description: mergedMap[key].description,
                    features: mergedMap[key].features,
                    title: mergedMap[key].title || mergedMap[key].name,
                    price: dbPlan.price !== undefined ? dbPlan.price : mergedMap[key].price,
                    currency: dbPlan.currency || mergedMap[key].currency,
                    id: dbPlan.id,
                };
            } else {
                const isDuplicateFree =
                    dbPlan.price === 0 &&
                    Object.values(mergedMap).some((p) => p.price === 0 && p.type === dbPlan.type);
                if (!isDuplicateFree) {
                    mergedMap[dbPlan.id] = { ...dbPlan };
                }
            }
        });

        return Object.values(mergedMap).filter((p) => p.type !== 'user');
    }, [dbPlans, baseSubscriptionPlans]);

    const allCreditPacks = useMemo(() => {
        const mergedMap = {};
        baseCreditPacks.forEach((pack) => {
            mergedMap[pack.stripePriceId || pack.id] = { ...pack };
        });

        dbCreditPacks.forEach((dbPack) => {
            if (hasArabic(dbPack.name || '')) return;
            const key = dbPack.stripePriceId || dbPack.id;
            if (mergedMap[key]) {
                mergedMap[key] = {
                    ...mergedMap[key],
                    ...dbPack,
                    name: mergedMap[key].name,
                };
            } else {
                mergedMap[dbPack.id] = { ...dbPack };
            }
        });

        return Object.values(mergedMap);
    }, [dbCreditPacks, baseCreditPacks]);

    const countryToUse = firebaseProfile?.country || detectedCountry || 'Australia';

    const subscriptionPlans = useMemo(() => {
        return allPlans.map((plan) => {
            if (plan.price === 0) return plan;
            const converted = convertFromUSD(plan.price, countryToUse);
            const originalConverted = plan.originalPrice
                ? convertFromUSD(plan.originalPrice, countryToUse)
                : null;
            return {
                ...plan,
                price: converted.price,
                currency: converted.code,
                currencySymbol: converted.symbol,
                originalPrice: originalConverted ? originalConverted.price : null,
            };
        });
    }, [allPlans, countryToUse]);

    const creditPacks = useMemo(() => {
        return allCreditPacks.map((pack) => {
            const converted = convertFromUSD(pack.price, countryToUse);
            return {
                ...pack,
                price: converted.price,
                currency: converted.code,
                currencySymbol: converted.symbol,
            };
        });
    }, [allCreditPacks, countryToUse]);

    const updatePlan = useCallback((planId, newData) => {
        setDbPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, ...newData } : p)));
    }, []);

    const value = useMemo(
        () => ({
            subscriptionPlans,
            creditPacks,
            updatePlan,
        }),
        [subscriptionPlans, creditPacks, updatePlan]
    );

    return <PricingDataContext.Provider value={value}>{children}</PricingDataContext.Provider>;
}
