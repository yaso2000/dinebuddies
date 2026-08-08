import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaLock, FaShieldAlt } from 'react-icons/fa';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
    GIFT_SHIELD_SEGMENT_CREDITS,
    GIFT_SHIELD_TIERS,
    computeGiftShieldProgress,
    getGiftShieldHeaderBadge,
} from '../../utils/giftShieldTiers';
import { getGiftShieldVisualTheme } from '../../constants/giftShieldVisualThemes';
import GiftShieldVisual from './GiftShieldVisual';
import { AppText } from '../base';
import './GiftShieldSection.css';

/**
 * Profile section — gift-credit shields (replaces legacy achievements).
 * @param {{ userId?: string | null, totalSavedCreditsEarned?: number | null }} props
 */
export default function GiftShieldSection({ userId, totalSavedCreditsEarned: totalProp = null }) {
    const { t } = useTranslation();
    const [fetchedTotal, setFetchedTotal] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        if (totalProp != null && Number.isFinite(Number(totalProp))) {
            setFetchedTotal(Math.max(0, Math.floor(Number(totalProp))));
            setLoading(false);
            return undefined;
        }

        if (!userId) {
            setFetchedTotal(0);
            setLoading(false);
            return undefined;
        }

        setLoading(true);
        getDoc(doc(db, 'users', userId))
            .then((snap) => {
                if (cancelled) return;
                const data = snap.exists() ? snap.data() : {};
                setFetchedTotal(Math.max(0, Math.floor(Number(data.totalSavedCreditsEarned) || 0)));
            })
            .catch(() => {
                if (!cancelled) setFetchedTotal(0);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [userId, totalProp]);

    const progress = useMemo(
        () => computeGiftShieldProgress(fetchedTotal ?? 0),
        [fetchedTotal]
    );

    const headerBadge = useMemo(() => getGiftShieldHeaderBadge(progress), [progress]);

    if (loading) {
        return <div className="gift-shield-section loading" aria-busy="true" />;
    }

    const activeVisualTheme = getGiftShieldVisualTheme(progress.activeTierId);
    const badgeTier = GIFT_SHIELD_TIERS.find((tier) => tier.labelKey === headerBadge.labelKey);
    const badgeLabel = t(headerBadge.labelKey, badgeTier?.defaultLabel || 'Shield');
    const badgeText = headerBadge.multiplier
        ? t('gift_shield_badge_multi', '{{tier}} ×{{count}}', {
              tier: badgeLabel,
              count: headerBadge.multiplier,
          })
        : t('gift_shield_badge_slot', '{{tier}} {{slot}}/2', {
              tier: badgeLabel,
              slot: headerBadge.slot,
          });

    return (
        <section className="gift-shield-section" aria-labelledby="gift-shield-section-title">
            <div className="gift-shield-section__header">
                <AppText as="h3" id="gift-shield-section-title" className="gift-shield-section__title">
                    <FaShieldAlt className="gift-shield-section__title-icon" aria-hidden />
                    {t('gift_shields_title', 'Gift shields')}
                </AppText>
                <AppText as="span" className="gift-shield-section__badge">
                    {badgeText}
                </AppText>
            </div>

            <AppText as="p" className="gift-shield-section__lead">
                {t(
                    'gift_shields_lead',
                    'Earn shields from gift credits in your savings wallet. Every {{amount}} credits fills one shield; two merge into the next tier.',
                    { amount: GIFT_SHIELD_SEGMENT_CREDITS }
                )}
            </AppText>

            <div
                className="gift-shield-section__progress-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={GIFT_SHIELD_SEGMENT_CREDITS}
                aria-valuenow={progress.progressInSegment}
                aria-label={t('gift_shield_progress_label', 'Current shield progress')}
            >
                <div
                    className="gift-shield-section__progress-fill"
                    style={{
                        width: `${progress.progressPct}%`,
                        background: `linear-gradient(90deg, ${activeVisualTheme.ringProgress}, ${activeVisualTheme.fillBottom})`,
                    }}
                />
            </div>
            <div className="gift-shield-section__progress-meta">
                <AppText as="span">
                    {t('gift_shield_progress_current', '{{current}} / {{total}} credits', {
                        current: progress.progressInSegment.toLocaleString(),
                        total: GIFT_SHIELD_SEGMENT_CREDITS.toLocaleString(),
                    })}
                </AppText>
                <AppText as="span">
                    {t('gift_shield_lifetime', 'Lifetime {{total}}', {
                        total: progress.totalSavedCreditsEarned.toLocaleString(),
                    })}
                </AppText>
            </div>

            <div className="gift-shield-section__grid">
                {GIFT_SHIELD_TIERS.map((tier, index) => {
                    const visualState = progress.tierVisualStates[index];
                    const isActive = visualState === 'active' || visualState === 'active-second';
                    const cardClass = `gift-shield-section__card gift-shield-section__card--${visualState}`;

                    return (
                        <div key={tier.id} className={cardClass}>
                            {visualState === 'locked' ? (
                                <FaLock className="gift-shield-section__lock" aria-hidden />
                            ) : null}
                            {visualState === 'active-second' ? (
                                <AppText as="span" className="gift-shield-section__slot-tag">
                                    {t('gift_shield_slot_two', '2/2')}
                                </AppText>
                            ) : null}
                            {visualState === 'active' && progress.slot === 1 ? (
                                <AppText as="span" className="gift-shield-section__slot-tag">
                                    {t('gift_shield_slot_one', '1/2')}
                                </AppText>
                            ) : null}
                            <div className="gift-shield-section__visual-wrap">
                                <GiftShieldVisual
                                    tierId={tier.id}
                                    state={visualState}
                                    progressPct={isActive ? progress.progressPct : visualState === 'completed' ? 100 : 0}
                                    size={76}
                                    showSecondGhost={visualState === 'active-second'}
                                />
                            </div>
                            <AppText as="span" className="gift-shield-section__card-label">
                                {t(tier.labelKey, tier.defaultLabel)}
                            </AppText>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
