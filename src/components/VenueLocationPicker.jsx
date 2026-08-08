import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FaSearch, FaStore, FaGlobe, FaTimes, FaMapMarkerAlt } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { filterLoadedAppVenues, searchPublishedAppVenues } from '../utils/appVenueDirectory';
import { sortDineBuddiesVenues } from '../utils/invitationVenueSearch';
import { extractCityTokenFromAddress } from '../utils/locationUtils';
import { resolveAppVenueFromGoogleSelection } from '../utils/resolveAppVenueFromGoogleSelection';
import {
  fetchGooglePlaceDetails,
  fetchGoogleVenuePredictions,
  newPlacesSessionToken,
  resolveCitySearchBbox,
} from '../utils/unifiedVenueSearch';
import { PLACES_AUTOCOMPLETE_DEBOUNCE_MS } from '../utils/placesCostControl';
import { useToast } from '../context/ToastContext';
import { useInvitations } from '../context/InvitationContext';
import './venue-search.css';
import { AppText, AppTextInput } from './base';

/**
 * Unified venue search — one bar, DineBuddies results first (loaded + directory),
 * Google Places only when nothing matches in the app.
 */
const VenueLocationPicker = ({
  value,
  onChange,
  onSelect,
  city,
  countryCode,
  region,
  userLat,
  userLng,
  invitationType,
  className = '',
  compact = false,
}) => {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const invitationCtx = useInvitations();
  const restaurants = invitationCtx?.restaurants || [];
  const [dbResults, setDbResults] = useState([]);
  const [googleResults, setGoogleResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [googleResolving, setGoogleResolving] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);
  const searchRunRef = useRef(0);
  const sessionTokenRef = useRef(newPlacesSessionToken());
  const cityBboxRef = useRef(null);

  const lang = typeof i18n.language === 'string' ? i18n.language.split('-')[0] : 'en';
  const query = String(value ?? '');

  useEffect(() => {
    let cancelled = false;
    cityBboxRef.current = null;
    (async () => {
      const bbox = await resolveCitySearchBbox({
        city,
        countryCode,
        region,
        userLat,
        userLng,
      });
      if (!cancelled) cityBboxRef.current = bbox;
    })();
    return () => {
      cancelled = true;
    };
  }, [city, countryCode, region, userLat, userLng]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  const rotateSessionToken = useCallback(() => {
    sessionTokenRef.current = newPlacesSessionToken();
  }, []);

  const runUnifiedSearch = useCallback(
    async (q) => {
      const trimmed = String(q || '').trim();
      if (trimmed.length < 2) {
        setDbResults([]);
        setGoogleResults([]);
        setSearchError('');
        setShowDropdown(false);
        setLoading(false);
        return;
      }

      const runId = ++searchRunRef.current;
      const isStale = () => runId !== searchRunRef.current;

      setLoading(true);
      setShowDropdown(true);
      setSearchError('');
      setGoogleResults([]);

      try {
        // 1) Already-loaded directory in the app, 2) Firestore published venues by name.
        // City ranks results — do not hard-drop name matches (that forced Google-only).
        const loadedHits = filterLoadedAppVenues(restaurants, trimmed);
        const dbRows = await searchPublishedAppVenues({
          queryText: trimmed,
          city,
          countryCode,
          scope: 'country',
          softCityFilter: true,
          userLat,
          userLng,
          maxResults: 12,
        });
        if (isStale()) return;

        const byId = new Map();
        for (const row of [...loadedHits, ...dbRows]) {
          if (!row?.id) continue;
          if (!byId.has(row.id)) byId.set(row.id, row);
        }
        const ranked = sortDineBuddiesVenues(
          [...byId.values()],
          city,
          invitationType,
          userLat,
          userLng
        ).slice(0, 10);
        setDbResults(ranked);

        if (ranked.length === 0) {
          try {
            const google = await fetchGoogleVenuePredictions({
              input: trimmed,
              city,
              countryCode,
              region,
              userLat,
              userLng,
              invitationType,
              sessionToken: sessionTokenRef.current,
              lang,
              bbox: cityBboxRef.current,
            });
            if (isStale()) return;
            setGoogleResults(google);
            if (!google.length) {
              setSearchError(
                city
                  ? t('venue_no_results_in_city', {
                      city,
                      defaultValue: 'No venues found in {{city}}.',
                    })
                  : t('location_no_results', 'No matching places. Try a different name.')
              );
            }
          } catch (err) {
            if (isStale()) return;
            console.error('[VenueLocationPicker] Google search failed:', err);
            setGoogleResults([]);
            setSearchError(
              err instanceof Error ? err.message : t('location_search_failed', 'Search failed')
            );
          }
        } else {
          setGoogleResults([]);
        }
      } catch (err) {
        if (isStale()) return;
        console.error('[VenueLocationPicker] DB search failed:', err);
        setDbResults([]);
        setSearchError(t('location_search_failed', 'Search failed'));
      } finally {
        if (!isStale()) setLoading(false);
      }
    },
    [city, countryCode, region, userLat, userLng, invitationType, lang, t, restaurants]
  );

  const handleInput = (e) => {
    onChange(e);
    const val = e.target.value;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runUnifiedSearch(val), PLACES_AUTOCOMPLETE_DEBOUNCE_MS);
  };

  const handleDbSelect = (venue) => {
    setShowDropdown(false);
    setDbResults([]);
    setGoogleResults([]);
    onChange({ target: { value: venue.name, name: 'location' } });
    onSelect({
      name: venue.name,
      fullAddress: venue.address,
      lat: venue.lat,
      lng: venue.lng,
      city: venue.city || extractCityTokenFromAddress(venue.address) || city || '',
      countryCode: venue.countryCode || countryCode || '',
      restaurantId: venue.id,
      restaurantName: venue.name,
      image: venue.image,
      avatar: venue.image,
      isDineBuddiesVenue: true,
      photos: venue.image ? [venue.image] : [],
    });
  };

  const handleGoogleSelect = async (place) => {
    setShowDropdown(false);
    setGoogleResolving(true);
    try {
      const details = await fetchGooglePlaceDetails({
        placeId: place.placeId,
        sessionToken: sessionTokenRef.current,
        countryCode,
        lang,
      });
      rotateSessionToken();

      const label = details.name || details.fullAddress || place.name;
      onChange({ target: { value: label, name: 'location' } });

      const resolved = await resolveAppVenueFromGoogleSelection({
        ...details,
        name: details.name || place.name,
      });

      if (resolved?.isDineBuddiesVenue && resolved?.matchedFromGoogle) {
        showToast(
          t(
            'venue_resolved_to_dinebuddies',
            'This place is listed on DineBuddies — linked to the official venue.'
          ),
          'success'
        );
      }

      onSelect(resolved);
    } catch (err) {
      console.error('[VenueLocationPicker] Google select failed:', err);
      showToast(t('location_search_failed', 'Search failed'), 'error');
    } finally {
      setGoogleResolving(false);
      setDbResults([]);
      setGoogleResults([]);
    }
  };

  const clearSelection = () => {
    searchRunRef.current += 1;
    onChange({ target: { value: '', name: 'location' } });
    setDbResults([]);
    setGoogleResults([]);
    setSearchError('');
    setShowDropdown(false);
    rotateSessionToken();
  };

  const cityLabel = String(city || '').trim();
  const placeholder = cityLabel
    ? t('venue_unified_search_placeholder', {
        city: cityLabel,
        defaultValue: 'Search venues in {{city}}…',
      })
    : t('search_dineBuddies_venue', 'Search registered venues on DineBuddies...');

  const showGoogleSection = dbResults.length === 0 && googleResults.length > 0;
  const showEmpty =
    !loading &&
    query.trim().length >= 2 &&
    dbResults.length === 0 &&
    googleResults.length === 0;

  return (
    <div
      ref={wrapperRef}
      className={`venue-location-picker venue-location-picker--unified${compact ? ' venue-location-picker--compact' : ''}`}
    >
      {!compact && cityLabel ? (
        <AppText as="p" className="venue-search-hint">
          {t('venue_unified_search_hint', {
            city: cityLabel,
            defaultValue: 'DineBuddies venues in {{city}} first — Google if not listed.',
          })}
        </AppText>
      ) : null}

      <div style={{ position: 'relative' }}>
        <AppTextInput
          type="text"
          name="location"
          value={query}
          onChange={handleInput}
          onFocus={() => query.trim().length >= 2 && setShowDropdown(true)}
          placeholder={placeholder}
          className={`input-field ${className}`}
          autoComplete="off"
          required
          style={{ paddingRight: query ? '36px' : undefined }}
        />

        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
          {loading || googleResolving ? (
            <FaSearch
              style={{ opacity: 0.4, fontSize: '0.85rem', animation: 'spin 1s linear infinite' }}
            />
          ) : query ? (
            <FaTimes
              style={{ opacity: 0.5, cursor: 'pointer', fontSize: '0.85rem' }}
              onClick={clearSelection}
            />
          ) : null}
        </div>

        {showDropdown && (
          <div className="venue-search-dropdown venue-search-dropdown--tight">
            {loading && (
              <div className="venue-search-dropdown__message">
                {t('searching', 'Searching...')}
              </div>
            )}

            {!loading && dbResults.length > 0 && (
              <>
                <AppText as="div" className="venue-search-dropdown__section-title">
                  <FaStore aria-hidden /> {t('venue_search_section_dinebuddies', 'DineBuddies')}
                </AppText>
                {dbResults.map((venue) => (
                  <div
                    key={venue.id}
                    onClick={() => handleDbSelect(venue)}
                    className="venue-search-row"
                    role="option"
                  >
                    <div className="venue-search-partner-thumb">
                      {venue.image ? (
                        <img
                          src={venue.image}
                          alt={venue.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <FaStore style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }} />
                      )}
                    </div>
                    <div className="venue-search-row__body">
                      <div className="venue-search-row__title">{venue.name}</div>
                      <div className="venue-search-row__subtitle">
                        {venue.address || venue.city}
                      </div>
                    </div>
                    <div className="venue-search-badge">DB ✓</div>
                  </div>
                ))}
              </>
            )}

            {!loading && showGoogleSection && (
              <>
                <AppText as="div" className="venue-search-dropdown__section-title">
                  <FaGlobe aria-hidden /> {t('venue_search_section_google', 'Google Places')}
                </AppText>
                {googleResults.map((place) => (
                  <div
                    key={place.placeId}
                    onClick={() => handleGoogleSelect(place)}
                    className="venue-search-row venue-search-row--google"
                    role="option"
                  >
                    <div className="venue-search-icon">
                      <FaMapMarkerAlt style={{ color: '#0ea5e9' }} />
                    </div>
                    <div className="venue-search-row__body">
                      <div className="venue-search-row__title venue-search-row__title--google">
                        {place.name}
                      </div>
                      <div className="venue-search-row__subtitle venue-search-row__subtitle--google">
                        {place.address || place.full_description}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {showEmpty && (
              <div className="venue-search-dropdown__message">
                {searchError ||
                  t('no_venues_found', 'No registered venues found')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VenueLocationPicker;
