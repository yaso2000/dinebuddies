/** Credits from received gifts (after 50%) required to complete one shield segment. */
export const GIFT_SHIELD_SEGMENT_CREDITS = 1000;

export const GIFT_SHIELD_TIERS = [
    {
        id: 'bronze',
        labelKey: 'gift_shield_bronze',
        defaultLabel: 'Bronze',
        fill: '#b87333',
        rim: '#8b5a2b',
        glow: 'rgba(205, 127, 50, 0.45)',
    },
    {
        id: 'silver',
        labelKey: 'gift_shield_silver',
        defaultLabel: 'Silver',
        fill: '#c8ccd4',
        rim: '#8a9199',
        glow: 'rgba(192, 192, 192, 0.45)',
    },
    {
        id: 'gold',
        labelKey: 'gift_shield_gold',
        defaultLabel: 'Gold',
        fill: '#f4c542',
        rim: '#c9971a',
        glow: 'rgba(255, 215, 0, 0.4)',
    },
    {
        id: 'platinum',
        labelKey: 'gift_shield_platinum',
        defaultLabel: 'Platinum',
        fill: '#dfe8ef',
        rim: '#9eb4c8',
        glow: 'rgba(229, 228, 226, 0.5)',
    },
    {
        id: 'diamond',
        labelKey: 'gift_shield_diamond',
        defaultLabel: 'Diamond',
        fill: '#9ee7ff',
        rim: '#4fc3f7',
        glow: 'rgba(185, 242, 255, 0.5)',
    },
];

/**
 * @typedef {'locked' | 'completed' | 'active' | 'active-second'} GiftShieldTierVisualState
 */

/**
 * Derive shield tier progress from lifetime savings (`totalSavedCreditsEarned`).
 * Two shields at the same tier merge into one at the next tier (1000 credits per segment).
 *
 * @param {unknown} totalSavedCreditsEarned
 */
export function computeGiftShieldProgress(totalSavedCreditsEarned) {
    const total = Math.max(0, Math.floor(Number(totalSavedCreditsEarned) || 0));
    const completedSegments = Math.floor(total / GIFT_SHIELD_SEGMENT_CREDITS);
    const progressInSegment = total % GIFT_SHIELD_SEGMENT_CREDITS;

    let tier = 0;
    /** @type {1 | 2} */
    let slot = 1;
    let diamondCount = 0;

    for (let i = 0; i < completedSegments; i += 1) {
        if (tier === GIFT_SHIELD_TIERS.length - 1 && slot === 2) {
            diamondCount += 1;
            slot = 1;
            continue;
        }
        if (slot === 1) {
            slot = 2;
        } else {
            slot = 1;
            tier = Math.min(tier + 1, GIFT_SHIELD_TIERS.length - 1);
        }
    }

    /** @type {GiftShieldTierVisualState[]} */
    const tierVisualStates = GIFT_SHIELD_TIERS.map((_, idx) => {
        if (idx < tier) return 'completed';
        if (idx > tier) return 'locked';
        if (slot === 1) return 'active';
        return 'active-second';
    });

    const activeTier = GIFT_SHIELD_TIERS[tier];
    const creditsToNextSegment =
        progressInSegment === 0 && completedSegments > 0 && slot === 1
            ? GIFT_SHIELD_SEGMENT_CREDITS
            : GIFT_SHIELD_SEGMENT_CREDITS - progressInSegment;

    return {
        totalSavedCreditsEarned: total,
        activeTierIndex: tier,
        activeTierId: activeTier.id,
        activeTier,
        slot,
        diamondCount,
        progressInSegment,
        progressPct: (progressInSegment / GIFT_SHIELD_SEGMENT_CREDITS) * 100,
        creditsToNextSegment,
        completedSegments,
        tierVisualStates,
    };
}

/** @param {ReturnType<typeof computeGiftShieldProgress>} progress */
export function getGiftShieldHeaderBadge(progress) {
    if (progress.diamondCount > 0) {
        return {
            labelKey: 'gift_shield_diamond',
            slot: null,
            multiplier: progress.diamondCount + (progress.slot === 2 ? 1 : 0),
        };
    }
    return {
        labelKey: progress.activeTier.labelKey,
        slot: progress.slot,
        multiplier: null,
    };
}
