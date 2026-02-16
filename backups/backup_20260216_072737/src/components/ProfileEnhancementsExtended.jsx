import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    FaMapMarkerAlt,
    FaInstagram,
    FaTwitter,
    FaGlobe,
    FaPlus,
    FaTimes,
    FaStar,
    FaTrash
} from 'react-icons/fa';
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import './ProfileEnhancements.css';

import SmartPlaceSearch from './SmartPlaceSearch';
import MediaSelector from './Invitations/MediaSelector';
import { uploadImage } from '../utils/imageUpload';
import LocationAutocomplete from './LocationAutocomplete';
import { Country } from 'country-state-city';

// ================================
// 4. FAVORITE PLACES COMPONENT
// ================================
export const FavoritePlaces = ({ userId }) => {
    const { t } = useTranslation();
    const [places, setPlaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [pendingPlace, setPendingPlace] = useState(null);
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    const [searchData, setSearchData] = useState({
        city: '',
        country: 'AU', // Default
        location: '',
        lat: null,
        lng: null
    });
    const [userLoc, setUserLoc] = useState({ lat: null, lng: null });

    // Auto-detect user location
    useEffect(() => {
        if (adding && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                const { latitude, longitude } = position.coords;
                setUserLoc({ lat: latitude, lng: longitude });

                try {
                    // Use BigDataCloud API - Free and CORS friendly for client-side
                    const response = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
                    );

                    if (!response.ok) throw new Error('Geocoding failed');

                    const data = await response.json();

                    if (data) {
                        // Priority order for city/locality
                        const detectedCity = data.city || data.locality || data.principalSubdivision || '';
                        const detectedCountryCode = (data.countryCode || 'AU').toUpperCase();

                        if (detectedCity) {
                            setSearchData(prev => ({
                                ...prev,
                                country: detectedCountryCode,
                                city: detectedCity
                            }));
                            console.log('📍 Location detected (Auto):', detectedCity, detectedCountryCode);
                        }
                    }
                } catch (e) {
                    console.warn("Auto-detect city failed:", e.message);
                }
            }, (err) => {
                console.log("Location detection denied/failed", err);
            });
        }
    }, [adding]);

    useEffect(() => {
        const fetchPlaces = async () => {
            try {
                const userDoc = await getDoc(doc(db, 'users', userId));
                const data = userDoc.data();
                // Support both camelCase (new standard) and snake_case (legacy)
                const favoritePlaces = data?.favoritePlaces || data?.favorite_places || [];
                setPlaces(favoritePlaces);
            } catch (error) {
                console.error('Error fetching favorite places:', error);
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            fetchPlaces();
        }
    }, [userId]);

    const handleSelectPlace = (place) => {
        // Check if already exists
        if (places.some(p => p.id === place.id || p.businessId === place.id)) {
            alert(t('place_already_added', 'Place already in favorites'));
            return;
        }
        setPendingPlace(place);
        setSelectedMedia(null);
    };

    const handleConfirmAdd = async () => {
        if (!pendingPlace) return;

        let finalImage = pendingPlace.image || '';

        try {
            if (selectedMedia) {
                if (selectedMedia.file) {
                    // Upload file (Custom Image)
                    const path = `users/${userId}/places/${Date.now()}_${selectedMedia.file.name}`;
                    finalImage = await uploadImage(selectedMedia.file, path, setUploadProgress);
                } else if (selectedMedia.url) {
                    // Handle Remote URL (Google Place or Venue)
                    if ((selectedMedia.source === 'google_place' || selectedMedia.source === 'venue') && !selectedMedia.url.includes('firebasestorage')) {
                        try {
                            setUploadProgress(10); // Start progress
                            const response = await fetch(selectedMedia.url);
                            if (response.ok) {
                                const blob = await response.blob();
                                const file = new File([blob], `place_${Date.now()}.jpg`, { type: 'image/jpeg' });
                                const path = `users/${userId}/places/${Date.now()}_place.jpg`;
                                finalImage = await uploadImage(file, path, setUploadProgress);
                            } else {
                                finalImage = selectedMedia.url; // Fallback
                            }
                        } catch (e) {
                            console.warn("Failed to upload remote image, using URL:", e);
                            finalImage = selectedMedia.url; // Fallback
                        }
                    } else {
                        finalImage = selectedMedia.url;
                    }
                }
            } else if (pendingPlace.photos && pendingPlace.photos.length > 0) {
                // If no explicit selection but photos exist, use the first one (or place.image which is already set to first one)
                // Try to upload the default image if it's external
                const defaultUrl = pendingPlace.image || pendingPlace.photos[0];
                if (defaultUrl && !defaultUrl.includes('firebasestorage')) {
                    try {
                        setUploadProgress(10);
                        const response = await fetch(defaultUrl);
                        if (response.ok) {
                            const blob = await response.blob();
                            const file = new File([blob], `place_default_${Date.now()}.jpg`, { type: 'image/jpeg' });
                            const path = `users/${userId}/places/${Date.now()}_default.jpg`;
                            finalImage = await uploadImage(file, path, setUploadProgress);
                        } else {
                            finalImage = defaultUrl;
                        }
                    } catch (e) {
                        finalImage = defaultUrl;
                    }
                } else {
                    finalImage = defaultUrl;
                }
            }

            const newFavorite = {
                id: pendingPlace.id || Date.now().toString(), // Use place_id for google, uid for partners
                businessId: pendingPlace.businessId || pendingPlace.id, // Ensure we have a reference ID
                name: pendingPlace.name,
                address: pendingPlace.address || '',
                image: finalImage,
                source: pendingPlace.source || 'manual',
                location: pendingPlace.location || null,
                visitCount: 0,
                addedAt: new Date().toISOString()
            };

            const updatedPlaces = [...places, newFavorite];

            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                favoritePlaces: updatedPlaces, // Write to new camelCase field
                favorite_places: updatedPlaces // Keep legacy sync for safety if needed
            });

            setPlaces(updatedPlaces);
            setAdding(false);
            setPendingPlace(null);
            setSelectedMedia(null);
            setUploadProgress(0);
        } catch (error) {
            console.error('Error adding place:', error);
            alert('Failed to add place');
            setUploadProgress(0);
        }
    };

    const handleVenueSelect = (placeData) => {
        // Adapt LocationAutocomplete result to pendingPlace structure
        const place = {
            id: placeData.placeId || Date.now().toString(),
            name: placeData.name,
            address: placeData.fullAddress,
            location: {
                lat: placeData.lat,
                lng: placeData.lng
            },
            photos: placeData.photos || [],
            image: (placeData.photos && placeData.photos.length > 0) ? placeData.photos[0] : null,
            source: placeData.types?.includes('restaurant') || placeData.types?.includes('food') ? 'google_restaurant' : 'google_place',
            businessId: placeData.placeId // Important for dupe check
        };
        handleSelectPlace(place);
    };

    const handleRemovePlace = async (placeId) => {
        try {
            const updatedPlaces = places.filter(p => p.id !== placeId);

            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                favoritePlaces: updatedPlaces,
                favorite_places: updatedPlaces
            });

            setPlaces(updatedPlaces);
        } catch (error) {
            console.error('Error removing place:', error);
        }
    };

    const toggleAdding = () => {
        if (adding) {
            setAdding(false);
            setPendingPlace(null);
            setSelectedMedia(null);
            setSearchData(prev => ({ ...prev, city: '', location: '' }));
        } else {
            setAdding(true);
        }
    };

    if (loading) {
        return <div className="favorite-places loading">Loading...</div>;
    }

    return (
        <div className="favorite-places-section">
            <div className="section-header">
                <h3>
                    <FaMapMarkerAlt style={{ color: 'var(--secondary)', marginRight: '0.5rem' }} />
                    {t('favorite_places', 'Favorite Places')}
                </h3>
                <button
                    className="add-place-btn"
                    onClick={toggleAdding}
                >
                    {adding ? <FaTimes /> : <FaPlus />}
                </button>
            </div>

            {adding && !pendingPlace && (
                <div className="add-place-form" style={{ padding: '0 0 1rem 0' }}>

                    {/* Location Context Header */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '12px',
                        padding: '8px 12px',
                        background: 'rgba(139, 92, 246, 0.1)',
                        borderRadius: '8px',
                        border: '1px solid rgba(139, 92, 246, 0.2)'
                    }}>
                        <span style={{ fontSize: '1.2rem' }}>📍</span>
                        <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('current_location', 'Location')}</div>
                            <div style={{ fontWeight: '700', color: 'var(--primary)' }}>
                                {searchData.city ? searchData.city : t('detecting_location', 'Detecting location...')}
                            </div>
                        </div>
                    </div>

                    {/* Venue Search */}
                    <div className="step-label" style={{ marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem' }}>
                        {t('find_place', 'Find Place')}
                    </div>
                    <LocationAutocomplete
                        value={searchData.location}
                        onChange={(e) => setSearchData(prev => ({ ...prev, location: e.target.value }))}
                        onSelect={handleVenueSelect}
                        city={searchData.city}
                        // Bias with city location if available, otherwise User Location
                        userLat={userLoc.lat}
                        userLng={userLoc.lng}
                        countryCode={searchData.country || 'AU'}
                    />
                    <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {searchData.city
                            ? t('search_place_in_city', { city: searchData.city })
                            : t('search_place_placeholder', 'Search for restaurants, cafes, or venues near you')
                        }
                    </div>
                </div>
            )}

            {adding && pendingPlace && (
                <div className="media-selection-form" style={{ padding: '1rem', background: 'var(--bg-body)', borderRadius: '12px', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '800' }}>
                        {t('select_photo_for', { name: pendingPlace.name }) || `Select Photo for ${pendingPlace.name}`}
                    </h4>

                    <MediaSelector
                        restaurant={pendingPlace}
                        suggestedImages={pendingPlace.photos || []}
                        onMediaSelect={setSelectedMedia}
                    />

                    {uploadProgress > 0 && uploadProgress < 100 && (
                        <div style={{ margin: '10px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Uploading... {Math.round(uploadProgress)}%
                        </div>
                    )}

                    <div className="actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '10px' }}>
                        <button
                            onClick={handleConfirmAdd}
                            style={{
                                flex: 2,
                                padding: '12px',
                                background: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                opacity: uploadProgress > 0 ? 0.7 : 1,
                                fontSize: '1rem'
                            }}
                            disabled={uploadProgress > 0}
                        >
                            {t('save_place', 'Save Place')}
                        </button>
                        <button
                            onClick={() => setPendingPlace(null)}
                            style={{
                                flex: 1,
                                padding: '12px',
                                background: 'transparent',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                color: 'var(--text-main)'
                            }}
                        >
                            {t('back', 'Back')}
                        </button>
                    </div>
                </div>
            )}

            <div className="places-list">
                {places.length === 0 ? (
                    <div className="empty-state">
                        <FaMapMarkerAlt style={{ fontSize: '2rem', opacity: 0.3 }} />
                        <p>{t('no_favorite_places', 'No favorite places yet')}</p>
                    </div>
                ) : (
                    places.map(place => (
                        <div key={place.id} className="place-item" style={{ alignItems: 'flex-start' }}>
                            <div className="place-icon" style={{ flexShrink: 0 }}>
                                {place.image ? (
                                    <img
                                        src={place.image}
                                        alt={place.name}
                                        style={{ width: '50px', height: '50px', borderRadius: '10px', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <div style={{ width: '50px', height: '50px', borderRadius: '10px', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <FaStar style={{ color: 'var(--luxury-gold)' }} />
                                    </div>
                                )}
                            </div>
                            <div className="place-info" style={{ marginLeft: '12px', flex: 1, minWidth: 0 }}>
                                <div className="place-name" style={{ fontWeight: '700', fontSize: '0.95rem' }}>{place.name}</div>
                                {place.address && (
                                    <div className="place-address" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {place.address}
                                    </div>
                                )}
                                {place.source === 'partner' && (
                                    <span style={{
                                        display: 'inline-block',
                                        marginTop: '4px',
                                        color: 'var(--luxury-gold)',
                                        fontSize: '0.65rem',
                                        border: '1px solid var(--luxury-gold)',
                                        borderRadius: '4px',
                                        padding: '1px 6px',
                                        fontWeight: '700'
                                    }}>
                                        PARTNER
                                    </span>
                                )}
                            </div>
                            <button
                                className="remove-place-btn"
                                onClick={() => handleRemovePlace(place.id)}
                                title={t('remove', 'Remove')}
                                style={{ alignSelf: 'center', marginLeft: '10px', background: 'rgba(239,68,68,0.1)', color: 'var(--secondary)', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}
                            >
                                <FaTrash />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
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

                const reviewsData = snapshot.docs.map(doc => ({
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
        return Array(5).fill(0).map((_, idx) => (
            <FaStar
                key={idx}
                style={{
                    color: idx < rating ? 'var(--luxury-gold)' : 'var(--text-muted)',
                    fontSize: '0.9rem'
                }}
            />
        ));
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
                <h3>
                    <FaStar style={{ color: 'var(--luxury-gold)', marginRight: '0.5rem' }} />
                    {t('reviews', 'Reviews')} ({reviews.length})
                </h3>
            </div>

            {reviews.length === 0 ? (
                <div className="empty-state">
                    <FaStar style={{ fontSize: '2rem', opacity: 0.3 }} />
                    <p>{t('no_reviews_yet', 'No reviews yet')}</p>
                </div>
            ) : (
                <div className="reviews-list">
                    {reviews.map(review => (
                        <div key={review.id} className="review-item">
                            <div className="review-header">
                                <div className="reviewer-info">
                                    <img
                                        src={review.fromUserAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${review.fromUserId}`}
                                        alt={review.fromUserName}
                                        className="reviewer-avatar"
                                    />
                                    <div>
                                        <div className="reviewer-name">{review.fromUserName}</div>
                                        <div className="review-stars">{renderStars(review.rating)}</div>
                                    </div>
                                </div>
                                <div className="review-date">{formatTimeAgo(review.createdAt)}</div>
                            </div>
                            {review.comment && (
                                <div className="review-comment">"{review.comment}"</div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ================================
// 6. SOCIAL LINKS COMPONENT
// ================================
export const SocialLinks = ({ userId }) => {
    const { t } = useTranslation();
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
                alert(`Invalid ${type} format`);
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
            alert('Failed to save links');
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
                <h3>
                    <FaGlobe style={{ color: '#3b82f6', marginRight: '0.5rem' }} />
                    {t('social_links', 'Social Links')}
                </h3>
                {!editing && (
                    <button className="edit-links-btn" onClick={() => setEditing(true)}>
                        {hasAnyLink ? t('edit', 'Edit') : t('add', 'Add')}
                    </button>
                )}
            </div>

            {editing ? (
                <div className="edit-links-form">
                    <div className="link-input">
                        <FaInstagram style={{ color: '#e4405f' }} />
                        <input
                            type="text"
                            placeholder="@username"
                            value={tempLinks.instagram || ''}
                            onChange={(e) => setTempLinks({ ...tempLinks, instagram: e.target.value })}
                        />
                    </div>
                    <div className="link-input">
                        <FaTwitter style={{ color: '#1da1f2' }} />
                        <input
                            type="text"
                            placeholder="@username"
                            value={tempLinks.twitter || ''}
                            onChange={(e) => setTempLinks({ ...tempLinks, twitter: e.target.value })}
                        />
                    </div>
                    <div className="link-input">
                        <FaGlobe style={{ color: '#3b82f6' }} />
                        <input
                            type="text"
                            placeholder="yourwebsite.com"
                            value={tempLinks.website || ''}
                            onChange={(e) => setTempLinks({ ...tempLinks, website: e.target.value })}
                        />
                    </div>
                    <div className="link-actions">
                        <button onClick={handleSave} className="save-btn">{t('save', 'Save')}</button>
                        <button onClick={handleCancel} className="cancel-btn">{t('cancel', 'Cancel')}</button>
                    </div>
                </div>
            ) : (
                <div className="links-display">
                    {!hasAnyLink ? (
                        <div className="empty-state">
                            <FaGlobe style={{ fontSize: '2rem', opacity: 0.3 }} />
                            <p>{t('no_social_links', 'No social links added')}</p>
                        </div>
                    ) : (
                        <div className="links-list">
                            {links.instagram && (
                                <a href={`https://instagram.com/${links.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="social-link">
                                    <FaInstagram style={{ color: '#e4405f' }} />
                                    <span>{links.instagram}</span>
                                </a>
                            )}
                            {links.twitter && (
                                <a href={`https://twitter.com/${links.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="social-link">
                                    <FaTwitter style={{ color: '#1da1f2' }} />
                                    <span>{links.twitter}</span>
                                </a>
                            )}
                            {links.website && (
                                <a href={links.website.startsWith('http') ? links.website : `https://${links.website}`} target="_blank" rel="noopener noreferrer" className="social-link">
                                    <FaGlobe style={{ color: '#3b82f6' }} />
                                    <span>{links.website}</span>
                                </a>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default { FavoritePlaces, ReviewsSection, SocialLinks };
