import React from 'react';
import { FaMapMarkerAlt } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import VenueLocationPicker from './VenueLocationPicker';
import { AppText } from './base';

/**
 * Visually distinct venue/location block for social & private invitation forms.
 */
export default function InvitationVenueLocationSection({
  city,
  className = '',
  ...pickerProps
}) {
  const { t } = useTranslation();
  const cityLabel = String(city || '').trim();

  return (
    <section
      className={`invitation-venue-location-section venue-search-stack${className ? ` ${className}` : ''}`}
      aria-labelledby="invitation-venue-location-heading"
    >
      <header className="invitation-venue-location-section__header">
        <div className="invitation-venue-location-section__icon" aria-hidden>
          <FaMapMarkerAlt />
        </div>
        <div className="invitation-venue-location-section__heading">
          <AppText as="h3" id="invitation-venue-location-heading" className="invitation-venue-location-section__title">
            {t('invitation_venue_location_title', 'Where are you meeting?')}
          </AppText>
          <AppText as="p" className="invitation-venue-location-section__subtitle">
            {cityLabel
              ? t('invitation_venue_location_subtitle_city', {
                  city: cityLabel,
                  defaultValue: 'Search venues in {{city}} — DineBuddies listings first, then Google.',
                })
              : t('invitation_venue_location_subtitle', {
                  defaultValue: 'Search and pick a venue. DineBuddies listings appear first.',
                })}
          </AppText>
        </div>
        <AppText as="span" className="invitation-venue-location-section__required">
          {t('invitation_venue_location_required', 'Required')}
        </AppText>
      </header>

      <div className="invitation-venue-location-section__body">
        <VenueLocationPicker compact city={city} {...pickerProps} />
      </div>
    </section>
  );
}
