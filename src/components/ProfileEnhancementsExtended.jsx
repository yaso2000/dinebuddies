import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import {
  FaMapMarkerAlt,
  FaInstagram,
  FaTwitter,
  FaGlobe,
  FaPlus,
  FaTimes,
  FaStar,
  FaTrash,
  FaSearch } from
'react-icons/fa';
import { doc, getDoc, getDocFromServer, updateDoc, onSnapshot, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import './ProfileEnhancements.css';

import { pickCityFromReverseGeocode } from '../utils/locationUtils';
import { searchPublishedAppVenues, mapAppVenueToFavoritePlace } from '../utils/appVenueDirectory';
import { readFavoritePlaces, pickFavoritePlaces } from '../utils/favoritePlacesUtils';
import { pickSafeDisplayImageUrl } from '../utils/avatarUtils';
import { AppText, AppTextInput } from "./base";

function FavoritePlaceThumb({ image, name, className = 'place-item__thumb' }) {
  const [broken, setBroken] = useState(false);
  const safeUrl = pickSafeDisplayImageUrl(image);

  if (!safeUrl || broken) {
    return (
      <div className={`${className} ${className}--placeholder`} aria-hidden>
                <FaMapMarkerAlt />
            </div>);

  }

  return (
    <img
      src={safeUrl}
      alt={name || ''}
      className={className}
      onError={() => setBroken(true)} />);


}

// ================================
// 4. FAVORITE PLACES COMPONENT
// ================================
export const FavoritePlaces = ({ userId, readOnly = false, syncedPlaces = null }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [remotePlaces, setRemotePlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [venueQuery, setVenueQuery] = useState('');
  const [venueScope, setVenueScope] = useState('local');
  const [venueResults, setVenueResults] = useState([]);
  const [venueSearchLoading, setVenueSearchLoading] = useState(false);
  const [savingVenueId, setSavingVenueId] = useState(null);

  const [searchData, setSearchData] = useState({
    city: '',
    country: 'AU'
  });
  const [userLoc, setUserLoc] = useState({ lat: null, lng: null });

  // Auto-detect user location for local venue sorting
  useEffect(() => {
    if (!adding || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLoc({ lat: latitude, lng: longitude });

        try {
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          if (!response.ok) throw new Error('Geocoding failed');

          const data = await response.json();
          const detectedCity = pickCityFromReverseGeocode(data) || data.city || data.locality || '';
          const detectedCountryCode = (data.countryCode || 'AU').toUpperCase();

          if (detectedCity) {
            setSearchData((prev) => ({
              ...prev,
              country: detectedCountryCode,
              city: detectedCity
            }));
          }
        } catch (e) {
          console.warn('Auto-detect city failed:', e.message);
        }
      },
      (err) => {
        console.log('Location detection denied/failed', err);
      }
    );
  }, [adding]);

  const loadVenues = useCallback(async () => {
    if (!adding) return;
    if (venueScope === 'local' && !searchData.city) return;

    setVenueSearchLoading(true);
    try {
      const results = await searchPublishedAppVenues({
        queryText: venueQuery,
        city: searchData.city,
        countryCode: searchData.country,
        scope: venueScope,
        userLat: userLoc.lat,
        userLng: userLoc.lng,
        maxResults: 16
      });
      setVenueResults(results);
    } catch (e) {
      console.error('Venue search failed:', e);
      setVenueResults([]);
    } finally {
      setVenueSearchLoading(false);
    }
  }, [adding, venueQuery, venueScope, searchData.city, searchData.country, userLoc.lat, userLoc.lng]);

  useEffect(() => {
    if (!adding) {
      setVenueResults([]);
      return;
    }
    const timer = setTimeout(loadVenues, venueQuery ? 280 : 80);
    return () => clearTimeout(timer);
  }, [adding, loadVenues, venueQuery]);

  useEffect(() => {
    if (readOnly) {
      setAdding(false);
      setVenueQuery('');
      setVenueResults([]);
    }
  }, [readOnly]);

  const syncedList = Array.isArray(syncedPlaces) ? syncedPlaces : null;
  const places = pickFavoritePlaces(
    syncedList ? { favoritePlaces: syncedList } : null,
    { favoritePlaces: remotePlaces }
  );

  useEffect(() => {
    if (!userId) {
      setRemotePlaces([]);
      setLoading(false);
      return undefined;
    }

    if (syncedList?.length) {
      setLoading(false);
    }

    const userRef = doc(db, 'users', userId);

    const applyPlaces = (data) => {
      const next = readFavoritePlaces(data);
      setRemotePlaces(next);
      setLoading(false);
    };

    const unsub = onSnapshot(
      userRef,
      async (snap) => {
        let favoritePlaces = readFavoritePlaces(snap.data());

        if (snap.metadata.fromCache && favoritePlaces.length === 0) {
          try {
            const serverSnap = await getDocFromServer(userRef);
            if (serverSnap.exists()) {
              favoritePlaces = readFavoritePlaces(serverSnap.data());
            }
          } catch (e) {
            console.warn('Favorite places server refresh failed:', e?.message || e);
          }
        }

        applyPlaces({ favoritePlaces });
      },
      (error) => {
        console.error('Error listening to favorite places:', error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [userId, syncedList?.length]);

  const handleAddVenue = async (venue) => {
    if (places.some((p) => p.id === venue.id || p.businessId === venue.businessId)) {
      showToast(t('place_already_added', 'Place already in favorites'), 'error');
      return;
    }

    const venueId = venue.businessId || venue.id;
    setSavingVenueId(venueId);

    try {
      const newFavorite = mapAppVenueToFavoritePlace(venue);
      const updatedPlaces = [...places, newFavorite];

      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        favoritePlaces: updatedPlaces,
        favorite_places: updatedPlaces
      });

      setRemotePlaces(updatedPlaces);
      showToast(t('place_added', 'Place added to favorites'), 'success');
    } catch (error) {
      console.error('Error adding place:', error);
      showToast(t('place_add_failed', 'Failed to add place'), 'error');
    } finally {
      setSavingVenueId(null);
    }
  };

  const handleRemovePlace = async (placeId) => {
    if (readOnly) return;
    try {
      const updatedPlaces = places.filter((p) => p.id !== placeId);

      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        favoritePlaces: updatedPlaces,
        favorite_places: updatedPlaces
      });

      setRemotePlaces(updatedPlaces);
    } catch (error) {
      console.error('Error removing place:', error);
    }
  };

  const toggleAdding = () => {
    if (readOnly) return;
    if (adding) {
      setAdding(false);
      setVenueQuery('');
      setVenueResults([]);
      setVenueScope('local');
    } else {
      setAdding(true);
    }
  };

  const scopeOptions = [
  { value: 'local', label: t('venue_scope_local', 'Local') },
  { value: 'country', label: t('venue_scope_country', 'Country') },
  { value: 'all', label: t('venue_scope_all', 'All') }];


  if (loading && places.length === 0) {
    return <div className="favorite-places loading">Loading...</div>;
  }

  return (
    <div className="favorite-places-section">
            <div className="section-header">
                <AppText as="h3">
                    <FaMapMarkerAlt style={{ color: 'var(--secondary)', marginRight: '0.5rem' }} />
                    {t('favorite_places', 'Favorite Places')}
                </AppText>
                {!readOnly &&
        <button
          className="add-place-btn"
          onClick={toggleAdding}
          type="button">
          
                        {adding ? <FaTimes /> : <FaPlus />}
                    </button>
        }
            </div>

            {adding &&
      <div className="add-place-form venue-search-stack favorite-places-picker">
                    <div className="favorite-places-picker__location">
                        <AppText as="span" className="favorite-places-picker__location-icon" aria-hidden>📍</AppText>
                        <div className="favorite-places-picker__location-text">
                            <div className="favorite-places-picker__location-label">
                                {t('current_location', 'Location')}
                            </div>
                            <div className="favorite-places-picker__location-city">
                                {searchData.city ?
              searchData.city :
              t('detecting_location', 'Detecting location...')}
                            </div>
                        </div>
                    </div>

                    <div className="favorite-places-picker__scope-row">
                        {scopeOptions.map((opt) =>
          <button
            key={opt.value}
            type="button"
            className={`favorite-places-picker__scope-btn${venueScope === opt.value ? ' favorite-places-picker__scope-btn--active' : ''}`}
            onClick={() => setVenueScope(opt.value)}>
            
                                {opt.label}
                            </button>
          )}
                    </div>

                    <div className="favorite-places-picker__search-wrap">
                        <FaSearch className="favorite-places-picker__search-icon" aria-hidden />
                        <AppTextInput
            type="search"
            className="ui-form-field favorite-places-picker__search-input"
            value={venueQuery}
            onChange={(e) => setVenueQuery(e.target.value)}
            placeholder={t(
              'search_app_venues_placeholder',
              'Search DineBuddies venues…'
            )} />
          
                    </div>

                    <AppText as="p" className="favorite-places-picker__hint">
                        {venueScope === 'local' && searchData.city ?
          t('favorite_places_local_hint', {
            city: searchData.city,
            defaultValue: `Showing venues in ${searchData.city}`
          }) :
          t(
            'favorite_places_app_venues_hint',
            'Pick from venues listed on DineBuddies'
          )}
                    </AppText>

                    <div className="favorite-places-picker__results">
                        {venueSearchLoading ?
          <AppText as="p" className="favorite-places-picker__status">
                                {t('searching', 'Searching…')}
                            </AppText> :
          venueScope === 'local' && !searchData.city ?
          <AppText as="p" className="favorite-places-picker__status">
                                {t('waiting_for_location', 'Waiting for your city…')}
                            </AppText> :
          venueResults.length === 0 ?
          <AppText as="p" className="favorite-places-picker__status">
                                {t('no_venues_found', 'No venues found')}
                            </AppText> :

          venueResults.map((venue) => {
            const venueId = venue.businessId || venue.id;
            const alreadyAdded = places.some(
              (p) => p.id === venueId || p.businessId === venueId
            );
            return (
              <button
                key={venueId}
                type="button"
                className="favorite-places-picker__result"
                onClick={() => handleAddVenue(venue)}
                disabled={alreadyAdded || savingVenueId === venueId}>
                
                                        <FavoritePlaceThumb
                  image={venue.image}
                  name={venue.name}
                  className="favorite-places-picker__result-img" />
                
                                        <div className="favorite-places-picker__result-body">
                                            <div className="favorite-places-picker__result-name">
                                                {venue.name}
                                            </div>
                                            {(venue.address || venue.city) &&
                  <div className="favorite-places-picker__result-address">
                                                    {venue.address || venue.city}
                                                </div>
                  }
                                        </div>
                                        <AppText as="span" className="favorite-places-picker__result-action">
                                            {alreadyAdded ?
                  t('added', 'Added') :
                  savingVenueId === venueId ?
                  '…' :
                  '+'}
                                        </AppText>
                                    </button>);

          })
          }
                    </div>
                </div>
      }

            <div className="places-list">
                {places.length === 0 ?
        <div className="empty-state">
                        <FaMapMarkerAlt style={{ fontSize: '2rem', opacity: 0.3 }} />
                        <AppText as="p">{t('no_favorite_places', 'No favorite places yet')}</AppText>
                    </div> :

        places.map((place, idx) =>
        <div key={place.id || place.businessId || idx} className="place-item">
                            <FavoritePlaceThumb image={place.image} name={place.name} />
                            <div className="place-info">
                                <div className="place-name">{place.name}</div>
                                {place.address &&
            <div className="place-address">{place.address}</div>
            }
                                {place.source === 'business' &&
            <AppText as="span" className="place-partner-badge">PARTNER</AppText>
            }
                            </div>
                            {!readOnly &&
          <button
            type="button"
            className="remove-place-btn"
            onClick={() => handleRemovePlace(place.id)}
            title={t('remove', 'Remove')}>
            
                                    <FaTrash />
                                </button>
          }
                        </div>
        )
        }
            </div>
        </div>);

};

// ================================
// 5. REVIEWS SECTION COMPONENT
// ================================
export const ReviewsSection = ({ userId }) => {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const reviewsRef = collection(db, 'users', userId, 'reviews');
        const q = query(reviewsRef, orderBy('createdAt', 'desc'), limit(3));
        const snapshot = await getDocs(q);

        const reviewsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        }));

        setReviews(reviewsData);
      } catch (error) {
        console.error('Error fetching reviews:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchReviews();
    }
  }, [userId]);

  const renderStars = (rating) => {
    return Array(5).fill(0).map((_, idx) =>
    <FaStar
      key={idx}
      style={{
        color: idx < rating ? 'var(--luxury-gold)' : 'var(--text-muted)',
        fontSize: '0.9rem'
      }} />

    );
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return t('today', 'Today');
    if (days === 1) return t('yesterday', 'Yesterday');
    if (days < 7) return `${days} ${t('days_ago', 'days ago')}`;
    if (days < 30) return `${Math.floor(days / 7)} ${t('weeks_ago', 'weeks ago')}`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return <div className="reviews-section loading">Loading reviews...</div>;
  }

  return (
    <div className="reviews-section">
            <div className="section-header">
                <AppText as="h3">
                    <FaStar style={{ color: 'var(--luxury-gold)', marginRight: '0.5rem' }} />
                    {t('reviews', 'Reviews')} ({reviews.length})
                </AppText>
            </div>

            {reviews.length === 0 ?
      <div className="empty-state">
                    <FaStar style={{ fontSize: '2rem', opacity: 0.3 }} />
                    <AppText as="p">{t('no_reviews_yet', 'No reviews yet')}</AppText>
                </div> :

      <div className="reviews-list">
                    {reviews.map((review) =>
        <div key={review.id} className="review-item">
                            <div className="review-header">
                                <div className="reviewer-info">
                                    <img
                src={review.fromUserAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${review.fromUserId}`}
                alt={review.fromUserName}
                className="reviewer-avatar" />
              
                                    <div>
                                        <div className="reviewer-name">{review.fromUserName}</div>
                                        <div className="review-stars">{renderStars(review.rating)}</div>
                                    </div>
                                </div>
                                <div className="review-date">{formatTimeAgo(review.createdAt)}</div>
                            </div>
                            {review.comment &&
          <div className="review-comment">"{review.comment}"</div>
          }
                        </div>
        )}
                </div>
      }
        </div>);

};

// ================================
// 6. SOCIAL LINKS COMPONENT
// ================================
export const SocialLinks = ({ userId }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [links, setLinks] = useState({
    instagram: '',
    twitter: '',
    website: ''
  });
  const [editing, setEditing] = useState(false);
  const [tempLinks, setTempLinks] = useState(links);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLinks = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        const socialLinks = userDoc.data()?.social_links || {};
        setLinks(socialLinks);
        setTempLinks(socialLinks);
      } catch (error) {
        console.error('Error fetching social links:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchLinks();
    }
  }, [userId]);

  const validateLink = (type, value) => {
    if (!value.trim()) return true; // Empty is ok

    const patterns = {
      instagram: /^@?[a-zA-Z0-9._]{1,30}$/,
      twitter: /^@?[a-zA-Z0-9_]{1,15}$/,
      website: /^(https?:\/\/)?([\w\d-]+\.){1,}[\w]{2,}(\/.*)?$/
    };

    return patterns[type].test(value);
  };

  const handleSave = async () => {
    // Validate all links
    for (const [type, value] of Object.entries(tempLinks)) {
      if (value && !validateLink(type, value)) {
        showToast(`Invalid ${type} format`, 'error');
        return;
      }
    }

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        social_links: tempLinks
      });

      setLinks(tempLinks);
      setEditing(false);
    } catch (error) {
      console.error('Error saving social links:', error);
      showToast('Failed to save links', 'error');
    }
  };

  const handleCancel = () => {
    setTempLinks(links);
    setEditing(false);
  };

  if (loading) {
    return <div className="social-links loading">Loading...</div>;
  }

  const hasAnyLink = links.instagram || links.twitter || links.website;

  return (
    <div className="social-links-section">
            <div className="section-header">
                <AppText as="h3">
                    <FaGlobe style={{ color: '#3b82f6', marginRight: '0.5rem' }} />
                    {t('social_links', 'Social Links')}
                </AppText>
                {!editing &&
        <button className="edit-links-btn" onClick={() => setEditing(true)}>
                        {hasAnyLink ? t('edit', 'Edit') : t('add', 'Add')}
                    </button>
        }
            </div>

            {editing ?
      <div className="edit-links-form">
                    <div className="link-input">
                        <FaInstagram style={{ color: '#e4405f' }} />
                        <AppTextInput
            type="text"
            placeholder="@username"
            value={tempLinks.instagram || ''}
            onChange={(e) => setTempLinks({ ...tempLinks, instagram: e.target.value })} />
          
                    </div>
                    <div className="link-input">
                        <FaTwitter style={{ color: '#1da1f2' }} />
                        <AppTextInput
            type="text"
            placeholder="@username"
            value={tempLinks.twitter || ''}
            onChange={(e) => setTempLinks({ ...tempLinks, twitter: e.target.value })} />
          
                    </div>
                    <div className="link-input">
                        <FaGlobe style={{ color: '#3b82f6' }} />
                        <AppTextInput
            type="text"
            placeholder="yourwebsite.com"
            value={tempLinks.website || ''}
            onChange={(e) => setTempLinks({ ...tempLinks, website: e.target.value })} />
          
                    </div>
                    <div className="link-actions">
                        <button onClick={handleSave} className="save-btn">{t('save', 'Save')}</button>
                        <button onClick={handleCancel} className="cancel-btn">{t('cancel', 'Cancel')}</button>
                    </div>
                </div> :

      <div className="links-display">
                    {!hasAnyLink ?
        <div className="empty-state">
                            <FaGlobe style={{ fontSize: '2rem', opacity: 0.3 }} />
                            <AppText as="p">{t('no_social_links', 'No social links added')}</AppText>
                        </div> :

        <div className="links-list">
                            {links.instagram &&
          <a href={`https://instagram.com/${links.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="social-link">
                                    <FaInstagram style={{ color: '#e4405f' }} />
                                    <AppText as="span">{links.instagram}</AppText>
                                </a>
          }
                            {links.twitter &&
          <a href={`https://twitter.com/${links.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="social-link">
                                    <FaTwitter style={{ color: '#1da1f2' }} />
                                    <AppText as="span">{links.twitter}</AppText>
                                </a>
          }
                            {links.website &&
          <a href={links.website.startsWith('http') ? links.website : `https://${links.website}`} target="_blank" rel="noopener noreferrer" className="social-link">
                                    <FaGlobe style={{ color: '#3b82f6' }} />
                                    <AppText as="span">{links.website}</AppText>
                                </a>
          }
                        </div>
        }
                </div>
      }
        </div>);

};

export default { FavoritePlaces, ReviewsSection, SocialLinks };