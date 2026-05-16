import React, { memo } from 'react';
import { StatisticsCards, Achievements } from '../ProfileEnhancements';
import { FavoritePlaces } from '../ProfileEnhancementsExtended';

function ProfileEnhancementsSection({ userId }) {
    return (
        <>
            <StatisticsCards userId={userId} />
            <Achievements userId={userId} />
            <FavoritePlaces userId={userId} readOnly />
        </>
    );
}

export default memo(ProfileEnhancementsSection);
