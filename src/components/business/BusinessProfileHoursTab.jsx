import React from 'react';
import BusinessHours from '../BusinessHours';

export default function BusinessProfileHoursTab({ profile }) {
  const { activeTab, profileId, business, isOwner, tc } = profile;

  if (activeTab !== 'hours') return null;

  return (
    <div className="profile-section-content">
            <BusinessHours
        businessId={profileId}
        businessInfo={business.businessInfo}
        isOwner={isOwner}
        theme={{ colors: tc }} />

        </div>);

}
