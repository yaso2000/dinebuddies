import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { FaPercentage, FaFire, FaStar, FaTag, FaGem } from 'react-icons/fa';
import PremiumOfferCard from './PremiumOfferCard';
import './OffersBanner.css';

const OffersBanner = () => {
    const { t } = useTranslation();
    const [offers, setOffers] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    // 1. Fetch active premium offers from the new `active_offers` collection
    useEffect(() => {
        const q = query(
            collection(db, "active_offers"),
            where("status", "==", "active")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedOffers = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }));

            setOffers(fetchedOffers);
        }, (error) => {
            console.error("❌ Error fetching special offers:", error);
        });

        return () => unsubscribe();
    }, []);

    // 2. منطق الحركي (Auto-play In-place)
    useEffect(() => {
        if (offers.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % offers.length);
        }, 5000); // تغيير العرض كل 5 ثوانٍ

        return () => clearInterval(interval);
    }, [offers]);

    const badgePresets = {
        discount: { icon: <FaPercentage />, className: 'badge-pulse', label: t('badge_discount', 'Discount') },
        hot: { icon: <FaFire />, className: 'badge-flicker', label: t('badge_hot', 'Hot') },
        special: { icon: <FaStar />, className: 'badge-spin', label: t('badge_special', 'Special') },
        sale: { icon: <FaTag />, className: 'badge-shake', label: t('badge_sale', 'Sale') },
        premium: { icon: <FaGem />, className: 'badge-flicker', label: t('badge_premium', 'Premium') }
    };

    if (offers.length === 0) return null; // لا يظهر الشريط إذا لم توجد عروض

    return (
        <div className="offers-container fade-container">
            <div className="offers-track fade-track">
                {offers.map((offer, index) => {
                    let positionClass = 'next';
                    if (index === currentIndex) {
                        positionClass = 'active';
                    } else if (index === (currentIndex - 1 + offers.length) % offers.length) {
                        positionClass = 'prev';
                    }

                    return (
                        <div
                            key={offer.id}
                            className={`fade-slide ${positionClass}`}
                        >
                            <PremiumOfferCard
                                offer={offer}
                                compactHeight={true}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default OffersBanner;
