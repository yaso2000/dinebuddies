import React from 'react';
import BusinessProfileAboutTab from './BusinessProfileAboutTab';
import BusinessProfileHoursTab from './BusinessProfileHoursTab';
import BusinessProfileContactTab from './BusinessProfileContactTab';
import BusinessProfileDeliveryTab from './BusinessProfileDeliveryTab';

/**
 * Always-visible header block below the hero: about, working hours (open-now),
 * contact actions, and delivery links — shown for EVERY business type. Each
 * existing tab component self-hides when it has nothing (visitors), so empty
 * sections don't appear. Rendered with a forced active id so the reused tab
 * components display outside the tab system (which now only holds menu/services/
 * events). Owner edit controls inside each component keep working.
 */
export default function BusinessProfileHeaderInfo({ profile }) {
  return (
    <div
      className="business-profile-header-info"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--profile-stack-gap)' }}
    >
      <BusinessProfileAboutTab profile={{ ...profile, activeTab: 'about' }} />
      <BusinessProfileHoursTab profile={{ ...profile, activeTab: 'hours' }} />
      <BusinessProfileContactTab profile={{ ...profile, activeTab: 'contact' }} />
      <BusinessProfileDeliveryTab profile={{ ...profile, activeTab: 'delivery' }} />
    </div>
  );
}
