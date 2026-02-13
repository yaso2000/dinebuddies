import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaSave, FaCamera, FaPlus, FaTimes, FaTrash, FaMapMarkerAlt, FaImage } from 'react-icons/fa';
import { HiBuildingStorefront } from 'react-icons/hi2';
import { useAuth } from '../context/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';
import { serverTimestamp } from 'firebase/firestore';
import LocationPicker from '../components/LocationPicker';
import ServiceMediaPicker from '../components/ServiceMediaPicker';
import LocationAutocomplete from '../components/LocationAutocomplete';
import './EditBusinessProfile.css';

const EditBusinessProfile = () => {
    const navigate = useNavigate();
    const { currentUser, userProfile, updateUserProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [activeSection, setActiveSection] = useState('basic'); // basic, contact, hours, services

    // Form data
    const [formData, setFormData] = useState({
        businessName: '',
        tagline: '',
        businessType: 'Restaurant',
        description: '',
        phone: '',
        email: '',
        website: '',
        address: '',
        city: '',
        country: 'AU', // Default to Australia for English results
        lat: null,
        lng: null,
        userLat: null, // User's current location for search bias
        userLng: null,
        instagram: '',
        twitter: '',
        facebook: '',
        servicesLabel: 'Menu' // 'Menu' or 'Services'
    });

    // Images
    const [coverImage, setCoverImage] = useState(null);
    const [logoImage, setLogoImage] = useState(null);
    const [coverPreviewUrl, setCoverPreviewUrl] = useState('');
    const [logoPreviewUrl, setLogoPreviewUrl] = useState('');

    // Services
    const [services, setServices] = useState([]);
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [showLocationModal, setShowLocationModal] = useState(false);

    // Location input for autocomplete
    const [locationInput, setLocationInput] = useState('');

    // Tabs scroll ref
    const tabsRef = React.useRef(null);

    // Working Hours
    const [workingHours, setWorkingHours] = useState({
        sunday: { isOpen: true, open: '09:00', close: '22:00' },
        monday: { isOpen: true, open: '09:00', close: '22:00' },
        tuesday: { isOpen: true, open: '09:00', close: '22:00' },
        wednesday: { isOpen: true, open: '09:00', close: '22:00' },
        thursday: { isOpen: true, open: '09:00', close: '22:00' },
        friday: { isOpen: true, open: '13:00', close: '23:00' },
        saturday: { isOpen: true, open: '09:00', close: '23:00' }
    });

    const days = [
        { key: 'sunday', label: 'Sunday' },
        { key: 'monday', label: 'Monday' },
        { key: 'tuesday', label: 'Tuesday' },
        { key: 'wednesday', label: 'Wednesday' },
        { key: 'thursday', label: 'Thursday' },
        { key: 'friday', label: 'Friday' },
        { key: 'saturday', label: 'Saturday' }
    ];

    const businessTypes = [
        'Restaurant', 'Cafe', 'Bar', 'Night Club',
        'BBQ Parties', 'Food Truck', 'Lounge', 'Other'
    ];

    // Load existing data
    useEffect(() => {
        const info = userProfile?.businessInfo || userProfile?.businessInfoDraft;
        if (info) {
            setFormData({
                businessName: userProfile?.display_name || '', // من display_name
                tagline: info.tagline || '',
                businessType: info.businessType || 'Restaurant',
                description: info.description || '',
                phone: info.phone || '',
                email: info.email || '',
                website: info.website || '',
                address: info.address || '',
                city: info.city || '',
                lat: info.lat || null,
                lng: info.lng || null,
                instagram: info.socialMedia?.instagram || '',
                twitter: info.socialMedia?.twitter || '',
                facebook: info.socialMedia?.facebook || '',
                servicesLabel: info.servicesLabel || 'Menu'
            });

            setCoverPreviewUrl(info.coverImage || '');
            setLogoPreviewUrl(userProfile?.photo_url || ''); // من photo_url
            setServices(info.services || []);
            setWorkingHours(info.workingHours || workingHours);

            // Set location input if address exists
            if (info.address) {
                setLocationInput(info.address);
            }
        }
    }, [userProfile]);

    // Helper function to get currency by country code
    const getCurrencyByCountry = (countryCode) => {
        const currencyMap = {
            'AU': 'AUD',
            'US': 'USD',
            'GB': 'GBP',
            'SA': 'SAR',
            'AE': 'AED',
            'KW': 'KWD',
            'QA': 'QAR',
            'BH': 'BHD',
            'OM': 'OMR',
            'EG': 'EGP',
            'JO': 'JOD',
            'LB': 'LBP',
            'EU': 'EUR',
            'DE': 'EUR',
            'FR': 'EUR',
            'IT': 'EUR',
            'ES': 'EUR',
            'CA': 'CAD',
            'IN': 'INR',
            'CN': 'CNY',
            'JP': 'JPY',
            'KR': 'KRW'
        };
        return currencyMap[countryCode] || 'USD';
    };

    // Auto-detect city on component mount - ALWAYS run once
    useEffect(() => {
        if (navigator.geolocation) {
            console.log('🔍 Requesting geolocation for city detection...');
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
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

                            // Get currency for this country
                            const detectedCurrency = getCurrencyByCountry(detectedCountryCode);

                            console.log('✅ Auto-detected location (BigDataCloud):', {
                                city: detectedCity,
                                country: detectedCountryCode,
                                currency: detectedCurrency,
                                lat: latitude,
                                lng: longitude
                            });

                            if (detectedCity) {
                                setFormData(prev => ({
                                    ...prev,
                                    city: detectedCity,
                                    country: detectedCountryCode,
                                    currency: detectedCurrency, // Assuming currency field exists or is used
                                    userLat: latitude,
                                    userLng: longitude,
                                    // If address is empty, maybe set city as address? No, keep it separate.
                                }));
                            }
                        }
                    } catch (error) {
                        console.error('❌ Error detecting city:', error);
                    }
                },
                (error) => {
                    console.error('❌ Geolocation error:', error);
                    alert('Please allow location access to detect your city automatically.');
                }
            );
        }
    }, []); // Run only once on mount

    // Enable drag scrolling for tabs
    React.useEffect(() => {
        const slider = tabsRef.current;
        if (!slider) return;

        let isDown = false;
        let startX;
        let scrollLeft;

        const handleMouseDown = (e) => {
            isDown = true;
            slider.style.cursor = 'grabbing';
            startX = e.pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
        };

        const handleMouseLeave = () => {
            isDown = false;
            slider.style.cursor = 'grab';
        };

        const handleMouseUp = () => {
            isDown = false;
            slider.style.cursor = 'grab';
        };

        const handleMouseMove = (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - slider.offsetLeft;
            const walk = (x - startX) * 2; // Scroll speed
            slider.scrollLeft = scrollLeft - walk;
        };

        slider.style.cursor = 'grab';
        slider.addEventListener('mousedown', handleMouseDown);
        slider.addEventListener('mouseleave', handleMouseLeave);
        slider.addEventListener('mouseup', handleMouseUp);
        slider.addEventListener('mousemove', handleMouseMove);

        return () => {
            slider.removeEventListener('mousedown', handleMouseDown);
            slider.removeEventListener('mouseleave', handleMouseLeave);
            slider.removeEventListener('mouseup', handleMouseUp);
            slider.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    const handleImageChange = (e, type) => {
        const file = e.target.files[0];
        if (file) {
            if (type === 'cover') {
                setCoverImage(file);
                setCoverPreviewUrl(URL.createObjectURL(file));
            } else {
                setLogoImage(file);
                setLogoPreviewUrl(URL.createObjectURL(file));
            }
        }
    };

    const uploadImage = async (file, filename) => {
        const storagePath = `businesses/${currentUser.uid}/${filename}`;
        const storageRef = ref(storage, storagePath);
        try {
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);
            return url;
        } catch (error) {
            throw new Error(`Image upload failed: ${error.message}`);
        }
    };

    const geocodeAddress = async (address) => {
        try {
            if (!address) return { lat: null, lng: null };

            // Use Google Geocoding API if available
            if (window.google && window.google.maps && window.google.maps.Geocoder) {
                const geocoder = new window.google.maps.Geocoder();

                return new Promise((resolve) => {
                    geocoder.geocode({ address }, (results, status) => {
                        if (status === 'OK' && results[0]) {
                            const location = results[0].geometry.location;
                            console.log('✅ Geocoded address:', address, '→', {
                                lat: location.lat(),
                                lng: location.lng()
                            });
                            resolve({
                                lat: location.lat(),
                                lng: location.lng()
                            });
                        } else {
                            console.warn('⚠️ Geocoding failed:', status);
                            resolve({ lat: null, lng: null });
                        }
                    });
                });
            }

            // Fallback to OpenStreetMap Nominatim
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
            );
            const data = await response.json();

            if (data && data.length > 0) {
                console.log('✅ Geocoded address (OSM):', address, '→', {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon)
                });
                return {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon)
                };
            }

            return { lat: null, lng: null };
        } catch (error) {
            console.error('❌ Geocoding error:', error);
            return { lat: null, lng: null };
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const currentInfo = userProfile?.businessInfo || {};
            let coverImageUrl = currentInfo.coverImage || '';
            let logoImageUrl = userProfile?.photo_url || ''; // من photo_url

            if (coverImage) {
                setUploading(true);
                coverImageUrl = await uploadImage(coverImage, `cover_${Date.now()}.jpg`);
            }

            if (logoImage) {
                setUploading(true);
                logoImageUrl = await uploadImage(logoImage, `logo_${Date.now()}.jpg`);
            }

            // Upload service images to Firebase
            console.log('📤 Processing service images...');
            const processedServices = await Promise.all(
                services.map(async (service) => {
                    if (service.image && service.image.startsWith('data:image')) {
                        console.log(`📤 Uploading image for "${service.name}"...`);
                        try {
                            // Convert base64 to blob
                            const response = await fetch(service.image);
                            const blob = await response.blob();

                            // Create a file from blob
                            const filename = `service_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
                            const file = new File([blob], filename, { type: 'image/jpeg' });

                            // Upload to Firebase
                            const imageUrl = await uploadImage(file, `services/${filename}`);
                            console.log(`✅ Image uploaded for "${service.name}":`, imageUrl);

                            return { ...service, image: imageUrl };
                        } catch (error) {
                            console.error(`❌ Failed to upload image for "${service.name}":`, error);
                            return service; // Keep original if upload fails
                        }
                    }
                    return service;
                })
            );

            setUploading(false);

            // Geocode address if lat/lng are missing or invalid
            let finalLat = formData.lat;
            let finalLng = formData.lng;

            if (!finalLat || !finalLng || isNaN(finalLat) || isNaN(finalLng)) {
                console.log('🔍 Coordinates missing or invalid, geocoding address...');
                const fullAddress = `${formData.address}${formData.city ? ', ' + formData.city : ''}`;
                const geocoded = await geocodeAddress(fullAddress);

                if (geocoded.lat && geocoded.lng) {
                    finalLat = geocoded.lat;
                    finalLng = geocoded.lng;
                    console.log('✅ Address geocoded successfully!');
                } else {
                    console.warn('⚠️ Could not geocode address. Map will not be displayed.');
                }
            }

            const updates = {
                // تحديث البيانات الأساسية للمطعم
                display_name: formData.businessName, // اسم المطعم
                photo_url: logoImageUrl, // لوجو المطعم

                businessInfo: {
                    ...currentInfo,
                    // NO businessName - موجود في display_name
                    // NO logoImage - موجود في photo_url
                    tagline: formData.tagline,
                    businessType: formData.businessType,
                    description: formData.description,
                    phone: formData.phone,
                    email: formData.email,
                    website: formData.website,
                    address: formData.address,
                    city: formData.city,
                    lat: finalLat ? parseFloat(finalLat) : null,
                    lng: finalLng ? parseFloat(finalLng) : null,
                    // Also save coordinates in a nested object for consistency
                    coordinates: {
                        lat: finalLat ? parseFloat(finalLat) : null,
                        lng: finalLng ? parseFloat(finalLng) : null
                    },
                    coverImage: coverImageUrl,
                    // NO logoImage - استخدم photo_url
                    socialMedia: {
                        instagram: formData.instagram,
                        twitter: formData.twitter,
                        facebook: formData.facebook
                    },
                    services: processedServices, // Use processed services with Firebase URLs
                    servicesLabel: formData.servicesLabel, // Save the chosen label
                    workingHours: workingHours,
                    updatedAt: serverTimestamp(),
                    isPublished: true
                },
                updatedAt: serverTimestamp()
            };

            await updateUserProfile(updates);
            navigate(`/partner/${currentUser.uid}`);
        } catch (err) {
            console.error('Error updating profile:', err);
            setError(`Failed to update profile: ${err.message}`);
        } finally {
            setLoading(false);
            setUploading(false);
        }
    };

    const addService = async (service) => {
        console.log('💾 Saving service:', service);

        try {
            let processedService = { ...service };

            // If service has a base64 image, upload it to Firebase
            if (service.image && service.image.startsWith('data:image')) {
                console.log('📤 Uploading service image to Firebase...');

                // Convert base64 to blob
                const response = await fetch(service.image);
                const blob = await response.blob();

                // Create a file from blob
                const filename = `service_${Date.now()}.jpg`;
                const file = new File([blob], filename, { type: 'image/jpeg' });

                // Upload to Firebase
                const imageUrl = await uploadImage(file, `services/${filename}`);
                processedService.image = imageUrl;

                console.log('✅ Service image uploaded:', imageUrl);
            }

            if (editingService !== null) {
                const updated = [...services];
                updated[editingService] = processedService;
                setServices(updated);
            } else {
                setServices([...services, { ...processedService, id: Date.now().toString() }]);
            }

            setShowServiceModal(false);
            setEditingService(null);
        } catch (error) {
            console.error('❌ Error saving service:', error);
            alert('Failed to upload service image. Please try again.');
        }
    };

    const sections = [
        { id: 'basic', label: 'Basic Info', icon: '📝' },
        { id: 'contact', label: 'Contact & Location', icon: '📍' },
        { id: 'hours', label: 'Working Hours', icon: '🕐' },
        { id: 'services', label: 'Menu', icon: '🍽️' }
    ];

    return (
        <div className="page-container" style={{ paddingBottom: '150px', background: 'var(--bg-body)' }}>
            {/* Enhanced Header */}
            <header style={{
                position: 'sticky',
                top: 0,
                zIndex: 1000,
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
                padding: '1rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 20px rgba(139, 92, 246, 0.1)'
            }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        background: 'rgba(139, 92, 246, 0.1)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: '12px',
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)',
                        cursor: 'pointer',
                        transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--primary)';
                        e.currentTarget.style.color = 'white';
                        e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                        e.currentTarget.style.color = 'var(--primary)';
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                >
                    <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                </button>

                <div style={{ textAlign: 'center', flex: 1 }}>
                    <h3 style={{
                        fontSize: '1.1rem',
                        fontWeight: '800',
                        margin: 0,
                        background: 'linear-gradient(135deg, #8b5cf6, #f97316)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                    }}>
                        ✨ Edit Business Profile
                    </h3>
                    <p style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        margin: '4px 0 0 0'
                    }}>
                        Make your business shine
                    </p>
                </div>

                <div style={{ width: '40px' }}></div>
            </header>

            {error && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.1))',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '16px',
                    padding: '1rem 1.25rem',
                    margin: '1rem',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '0.9rem',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)'
                }}>
                    <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {/* Enhanced Cover & Logo Images */}
                <div style={{ position: 'relative', marginBottom: '5rem' }}>
                    {/* Cover Image with Gradient Overlay */}
                    <div style={{
                        position: 'relative',
                        height: '220px',
                        overflow: 'hidden',
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.4), rgba(236, 72, 153, 0.4), rgba(249, 115, 22, 0.4))'
                    }}>
                        {coverPreviewUrl && (
                            <img
                                src={coverPreviewUrl}
                                alt="Cover"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    objectPosition: 'center'
                                }}
                            />
                        )}

                        {/* Gradient Overlay */}
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.3) 100%)'
                        }} />

                        {/* Enhanced Change Cover Button */}
                        <label style={{
                            position: 'absolute',
                            bottom: '1.5rem',
                            right: '1.5rem',
                            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.95), rgba(124, 58, 237, 0.95))',
                            backdropFilter: 'blur(10px)',
                            padding: '12px 20px',
                            borderRadius: '12px',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            border: '1px solid rgba(255,255,255,0.2)',
                            transition: 'all 0.3s',
                            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)'
                        }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
                                e.currentTarget.style.boxShadow = '0 8px 20px rgba(139, 92, 246, 0.6)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
                            }}
                        >
                            <FaCamera /> Change Cover
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageChange(e, 'cover')}
                                style={{ display: 'none' }}
                            />
                        </label>
                    </div>

                    {/* Enhanced Logo Image */}
                    <div style={{
                        position: 'absolute',
                        bottom: '-50px',
                        left: '1.5rem',
                        width: '120px',
                        height: '120px',
                        borderRadius: '24px',
                        border: '5px solid var(--bg-body)',
                        boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(139, 92, 246, 0.3)',
                        overflow: 'hidden',
                        background: 'linear-gradient(135deg, var(--primary), #f97316)',
                        transition: 'all 0.3s'
                    }}>
                        {logoPreviewUrl ? (
                            <img
                                src={logoPreviewUrl}
                                alt="Logo"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    objectPosition: 'center'
                                }}
                            />
                        ) : (
                            <div style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '3rem'
                            }}>
                                🏪
                            </div>
                        )}
                        <label style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.9), rgba(124, 58, 237, 0.9))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0,
                            cursor: 'pointer',
                            transition: 'opacity 0.3s',
                            flexDirection: 'column',
                            gap: '4px'
                        }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
                        >
                            <FaCamera style={{ color: 'white', fontSize: '1.8rem' }} />
                            <span style={{ color: 'white', fontSize: '0.75rem', fontWeight: '600' }}>Change</span>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageChange(e, 'logo')}
                                style={{ display: 'none' }}
                            />
                        </label>
                    </div>
                </div>

                {/* Section Tabs - Simple & Functional */}
                <div
                    ref={tabsRef}
                    style={{
                        display: 'flex',
                        gap: '6px',
                        padding: '0 1.5rem 0 1.5rem',
                        marginBottom: '1rem',
                        overflowX: 'auto',
                        WebkitOverflowScrolling: 'touch',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        userSelect: 'none' // Prevent text selection while dragging
                    }}>
                    <div style={{
                        display: 'flex',
                        gap: '6px',
                        paddingRight: '3rem' // Extra padding to show last button
                    }}>
                        {sections.map(section => (
                            <button
                                key={section.id}
                                type="button"
                                onClick={() => setActiveSection(section.id)}
                                style={{
                                    padding: '8px 12px',
                                    background: activeSection === section.id
                                        ? 'var(--primary)'
                                        : 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: activeSection === section.id ? '700' : '500',
                                    fontSize: '0.8rem',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.2s',
                                    opacity: activeSection === section.id ? 1 : 0.7
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.opacity = '1';
                                }}
                                onMouseLeave={(e) => {
                                    if (activeSection !== section.id) {
                                        e.currentTarget.style.opacity = '0.7';
                                    }
                                }}
                            >
                                {section.icon} {section.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Enhanced Section Content */}
                <div style={{ padding: '0 1.5rem 2rem 1.5rem' }}>
                    {/* Basic Info Section */}
                    {activeSection === 'basic' && (
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.6), rgba(30, 41, 59, 0.6))',
                            border: '1px solid rgba(139, 92, 246, 0.2)',
                            borderRadius: '20px',
                            padding: '2rem',
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)'
                        }}>
                            <h3 style={{
                                fontSize: '1.3rem',
                                fontWeight: '800',
                                marginBottom: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                background: 'linear-gradient(135deg, #8b5cf6, #f97316)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                            }}>
                                <span style={{
                                    background: 'linear-gradient(135deg, #8b5cf6, #f97316)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    fontSize: '1.5rem'
                                }}>📝</span>
                                Basic Information
                            </h3>

                            <div className="form-group">
                                <label>Business Name *</label>
                                <input
                                    type="text"
                                    value={formData.businessName}
                                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                                    required
                                    placeholder="Enter your business name"
                                />
                            </div>

                            <div className="form-group">
                                <label>Tagline</label>
                                <input
                                    type="text"
                                    value={formData.tagline}
                                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                                    placeholder="A short catchy phrase about your business"
                                />
                            </div>

                            <div className="form-group">
                                <label>Business Type *</label>
                                <select
                                    value={formData.businessType}
                                    onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                                    required
                                >
                                    {businessTypes.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows="5"
                                    placeholder="Tell customers about your business..."
                                />
                            </div>
                        </div>
                    )}

                    {/* Contact & Location Section */}
                    {activeSection === 'contact' && (
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.6), rgba(30, 41, 59, 0.6))',
                            border: '1px solid rgba(139, 92, 246, 0.2)',
                            borderRadius: '20px',
                            padding: '2rem',
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)'
                        }}>
                            <h3 style={{
                                fontSize: '1.3rem',
                                fontWeight: '800',
                                marginBottom: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                background: 'linear-gradient(135deg, #8b5cf6, #f97316)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                            }}>
                                <span style={{ fontSize: '1.5rem' }}>📍</span>
                                Contact & Location
                            </h3>

                            <div className="form-group">
                                <label>Phone Number</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="+966 50 123 4567"
                                />
                            </div>

                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="contact@business.com"
                                />
                            </div>

                            <div className="form-group">
                                <label>Website</label>
                                <input
                                    type="url"
                                    value={formData.website}
                                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                    placeholder="https://www.yourbusiness.com"
                                />
                            </div>


                            {/* Location Search - Same as CreateInvitation */}
                            <div style={{
                                background: 'var(--card-bg)',
                                padding: '1.25rem',
                                borderRadius: '16px',
                                border: '1px solid var(--border-color)',
                                marginBottom: '1.5rem'
                            }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    📍 Business Location
                                </h3>

                                {/* Current Location Badge */}
                                {formData.city && (
                                    <div style={{
                                        marginBottom: '1rem',
                                        padding: '0.75rem',
                                        background: 'rgba(139, 92, 246, 0.1)',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(139, 92, 246, 0.3)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontSize: '0.9rem'
                                    }}>
                                        <span style={{ fontSize: '1.2rem' }}>📍</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                                                Your Location
                                            </div>
                                            <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                                                {formData.city}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Venue Search */}
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ fontSize: '0.8rem' }}>Search for your business location</label>
                                    <LocationAutocomplete
                                        value={locationInput}
                                        onChange={(e) => setLocationInput(e.target.value)}
                                        onSelect={(location) => {
                                            console.log('📍 Location selected:', location);
                                            setFormData(prev => ({
                                                ...prev,
                                                address: location.fullAddress || location.name,
                                                lat: location.lat,
                                                lng: location.lng
                                            }));
                                            setLocationInput(location.name || location.fullAddress);
                                        }}
                                        city={formData.city}
                                        countryCode={formData.country}
                                        userLat={formData.userLat}
                                        userLng={formData.userLng}
                                    />
                                    <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '5px' }}>
                                        Search for restaurants, cafes, or venues near you
                                    </small>
                                </div>

                                {formData.address && (
                                    <div style={{
                                        marginTop: '1rem',
                                        padding: '8px 12px',
                                        background: 'rgba(139, 92, 246, 0.1)',
                                        border: '1px solid rgba(139, 92, 246, 0.2)',
                                        borderRadius: '8px',
                                        fontSize: '0.85rem',
                                        color: 'var(--text-secondary)'
                                    }}>
                                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>✅ Selected Address:</div>
                                        <div>{formData.address}</div>
                                    </div>
                                )}
                            </div>

                            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                <h4 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.75rem' }}>Social Media</h4>

                                <div className="form-group">
                                    <label>Instagram</label>
                                    <input
                                        type="text"
                                        value={formData.instagram}
                                        onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                                        placeholder="@yourbusiness"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Twitter</label>
                                    <input
                                        type="text"
                                        value={formData.twitter}
                                        onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                                        placeholder="@yourbusiness"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Facebook</label>
                                    <input
                                        type="text"
                                        value={formData.facebook}
                                        onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                                        placeholder="facebook.com/yourbusiness"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Working Hours Section */}
                    {activeSection === 'hours' && (
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.6), rgba(30, 41, 59, 0.6))',
                            border: '1px solid rgba(139, 92, 246, 0.2)',
                            borderRadius: '20px',
                            padding: '2rem',
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)'
                        }}>
                            <h3 style={{
                                fontSize: '1.3rem',
                                fontWeight: '800',
                                marginBottom: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                background: 'linear-gradient(135deg, #8b5cf6, #f97316)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                            }}>
                                <span style={{ fontSize: '1.5rem' }}>🕐</span>
                                Working Hours
                            </h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {days.map(day => (
                                    <div key={day.key} style={{
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        padding: '1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        flexWrap: 'wrap'
                                    }}>
                                        <div style={{ minWidth: '100px', fontWeight: '700' }}>
                                            {day.label}
                                        </div>

                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={workingHours[day.key].isOpen}
                                                onChange={(e) => setWorkingHours({
                                                    ...workingHours,
                                                    [day.key]: { ...workingHours[day.key], isOpen: e.target.checked }
                                                })}
                                            />
                                            <span>Open</span>
                                        </label>

                                        {workingHours[day.key].isOpen && (
                                            <>
                                                <input
                                                    type="time"
                                                    value={workingHours[day.key].open}
                                                    onChange={(e) => setWorkingHours({
                                                        ...workingHours,
                                                        [day.key]: { ...workingHours[day.key], open: e.target.value }
                                                    })}
                                                    style={{ flex: '0 0 auto', width: '120px' }}
                                                />
                                                <span>to</span>
                                                <input
                                                    type="time"
                                                    value={workingHours[day.key].close}
                                                    onChange={(e) => setWorkingHours({
                                                        ...workingHours,
                                                        [day.key]: { ...workingHours[day.key], close: e.target.value }
                                                    })}
                                                    style={{ flex: '0 0 auto', width: '120px' }}
                                                />
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Services Section */}
                    {activeSection === 'services' && (
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.6), rgba(30, 41, 59, 0.6))',
                            border: '1px solid rgba(139, 92, 246, 0.2)',
                            borderRadius: '20px',
                            padding: '2rem',
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)'
                        }}>
                            {/* Services Label Choice */}
                            <div className="form-group" style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                                    🏷️ Display Label for Your Offerings
                                </label>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '12px'
                                }}>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, servicesLabel: 'Menu' })}
                                        style={{
                                            padding: '1rem',
                                            background: formData.servicesLabel === 'Menu'
                                                ? 'linear-gradient(135deg, var(--primary), #f97316)'
                                                : 'var(--bg-card)',
                                            border: formData.servicesLabel === 'Menu'
                                                ? '2px solid var(--primary)'
                                                : '1px solid var(--border-color)',
                                            borderRadius: '12px',
                                            color: 'white',
                                            cursor: 'pointer',
                                            fontWeight: formData.servicesLabel === 'Menu' ? '800' : '600',
                                            fontSize: '0.95rem',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <span style={{ fontSize: '1.5rem' }}>🍽️</span>
                                        <span>Menu</span>
                                        <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>For restaurants & cafes</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, servicesLabel: 'Services' })}
                                        style={{
                                            padding: '1rem',
                                            background: formData.servicesLabel === 'Services'
                                                ? 'linear-gradient(135deg, var(--primary), #f97316)'
                                                : 'var(--bg-card)',
                                            border: formData.servicesLabel === 'Services'
                                                ? '2px solid var(--primary)'
                                                : '1px solid var(--border-color)',
                                            borderRadius: '12px',
                                            color: 'white',
                                            cursor: 'pointer',
                                            fontWeight: formData.servicesLabel === 'Services' ? '800' : '600',
                                            fontSize: '0.95rem',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <span style={{ fontSize: '1.5rem' }}>⚙️</span>
                                        <span>Services</span>
                                        <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>For service businesses</span>
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{
                                    fontSize: '1.3rem',
                                    fontWeight: '800',
                                    margin: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    background: 'linear-gradient(135deg, #8b5cf6, #f97316)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text'
                                }}>
                                    <span style={{ fontSize: '1.5rem' }}>🍽️</span>
                                    {formData.servicesLabel || 'Menu'}
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingService(null);
                                        setShowServiceModal(true);
                                    }}
                                    className="btn btn-primary"
                                    style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                                >
                                    <FaPlus /> Add Menu Item
                                </button>
                            </div>

                            {services.length > 0 ? (
                                <div style={{ display: 'grid', gap: '12px' }}>
                                    {services.map((service, index) => (
                                        <div key={service.id || index} style={{
                                            background: 'var(--bg-card)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '12px',
                                            padding: '1rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'start',
                                            gap: '1rem'
                                        }}>
                                            {/* Service Icon/Image - Always show */}
                                            <div style={{
                                                width: '60px',
                                                height: '60px',
                                                borderRadius: '12px',
                                                background: service.image ? 'transparent' : 'rgba(139, 92, 246, 0.1)',
                                                border: '1px solid var(--border-color)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                overflow: 'hidden'
                                            }}>
                                                {service.image ? (
                                                    <img
                                                        src={service.image}
                                                        alt={service.name}
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover'
                                                        }}
                                                        onError={(e) => {
                                                            console.log('❌ Image failed to load:', service.image);
                                                            e.target.style.display = 'none';
                                                        }}
                                                    />
                                                ) : service.icon ? (
                                                    <span style={{ fontSize: '2rem' }}>{service.icon}</span>
                                                ) : (
                                                    <span style={{ fontSize: '2rem', opacity: 0.5 }}>🍽️</span>
                                                )}
                                            </div>

                                            <div style={{ flex: 1 }}>
                                                <h4 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                                                    {service.name}
                                                </h4>
                                                {service.description && (
                                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                                        {service.description}
                                                    </p>
                                                )}
                                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary)' }}>
                                                        {service.price} {service.currency || 'SAR'}
                                                    </span>
                                                    {service.category && (
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            background: 'rgba(139, 92, 246, 0.1)',
                                                            border: '1px solid rgba(139, 92, 246, 0.3)',
                                                            borderRadius: '6px',
                                                            fontSize: '0.75rem',
                                                            color: 'var(--primary)'
                                                        }}>
                                                            {service.category}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingService(index);
                                                        setShowServiceModal(true);
                                                    }}
                                                    style={{
                                                        background: 'rgba(59, 130, 246, 0.1)',
                                                        border: '1px solid rgba(59, 130, 246, 0.3)',
                                                        borderRadius: '8px',
                                                        padding: '8px',
                                                        color: '#3b82f6',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setServices(services.filter((_, i) => i !== index))}
                                                    style={{
                                                        background: 'rgba(239, 68, 68, 0.1)',
                                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                                        borderRadius: '8px',
                                                        padding: '8px',
                                                        color: '#ef4444',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{
                                    background: 'var(--bg-card)',
                                    border: '1px dashed var(--border-color)',
                                    borderRadius: '12px',
                                    padding: '3rem 2rem',
                                    textAlign: 'center',
                                    color: 'var(--text-muted)'
                                }}>
                                    <p>No menu items added yet. Click "Add Menu Item" button above to get started.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Submit Buttons - Sticky at bottom */}
                <div style={{
                    position: 'sticky',
                    bottom: '70px',
                    marginTop: '2rem',
                    marginLeft: '-1.5rem',
                    marginRight: '-1.5rem',
                    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.98))',
                    backdropFilter: 'blur(20px)',
                    borderTop: '1px solid rgba(139, 92, 246, 0.3)',
                    padding: '10px 1.5rem',
                    display: 'flex',
                    gap: '10px',
                    zIndex: 1001,
                    boxShadow: '0 -4px 20px rgba(139, 92, 246, 0.2)',
                    borderRadius: '16px 16px 0 0'
                }}>
                    <button
                        type="button"
                        onClick={() => navigate(`/partner/${currentUser.uid}`)}
                        style={{
                            flex: 1,
                            padding: '10px 16px',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            borderRadius: '12px',
                            border: '2px solid rgba(139, 92, 246, 0.3)',
                            background: 'transparent',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        disabled={loading}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                            e.currentTarget.style.borderColor = 'var(--primary)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        style={{
                            flex: 1,
                            padding: '10px 16px',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, var(--primary), #f97316)',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                        disabled={loading || uploading}
                        onMouseEnter={(e) => {
                            if (!loading && !uploading) {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.5)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
                        }}
                    >
                        {uploading ? '⏳ Uploading...' : loading ? '💾 Saving...' : <><FaSave /> Save</>}
                    </button>
                </div>
            </form >

            {/* Location Picker Modal */}
            {
                showLocationModal && (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 2000,
                        background: 'rgba(0,0,0,0.8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                    }}>
                        <div style={{
                            background: 'var(--bg-card)', borderRadius: '24px', padding: '1.5rem',
                            width: '90%', maxWidth: '700px', border: '1px solid var(--border-color)',
                            maxHeight: '90vh', overflowY: 'auto'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <h3 style={{ margin: 0 }}>Set Business Location</h3>
                                <button onClick={() => setShowLocationModal(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}><FaTimes /></button>
                            </div>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Click or tap on the map to pin your exact location. You can also search for an address using the search box.</p>

                            <LocationPicker
                                initialLat={formData.lat}
                                initialLng={formData.lng}
                                onLocationSelect={(pos) => {
                                    setFormData(prev => ({ ...prev, lat: pos.lat, lng: pos.lng }));
                                }}
                                onAddressChange={(addressData) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        address: addressData.address || prev.address,
                                        city: addressData.city || prev.city
                                    }));
                                }}
                            />

                            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                                <button
                                    onClick={() => setShowLocationModal(false)}
                                    className="btn btn-primary"
                                >
                                    Confirm Location
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Service Modal */}
            {
                showServiceModal && (
                    <ServiceModal
                        service={editingService !== null ? services[editingService] : null}
                        onSave={addService}
                        onClose={() => {
                            setShowServiceModal(false);
                            setEditingService(null);
                        }}
                    />
                )
            }
        </div >
    );
};

// Service Modal Component
const ServiceModal = ({ service, onSave, onClose }) => {
    const [formData, setFormData] = useState({
        name: service?.name || '',
        description: service?.description || '',
        price: service?.price || '',
        currency: service?.currency || 'SAR',
        category: service?.category || '',
        customCategory: service?.customCategory || '',
        available: service?.available !== false,
        icon: service?.icon || null,
        image: service?.image || null
    });
    const [showMediaPicker, setShowMediaPicker] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        // If "Other" is selected, save the customCategory instead
        const dataToSave = {
            ...formData,
            category: formData.category === 'Other' ? formData.customCategory : formData.category
        };
        onSave(dataToSave);
    };

    const handleMediaChange = (media) => {
        console.log('🖼️ Media selected:', media);
        if (media) {
            if (media.type === 'icon') {
                setFormData({ ...formData, icon: media.iconId, image: null });
            } else if (media.type === 'image') {
                // Store base64 image temporarily (will be uploaded to Firebase on save)
                setFormData({ ...formData, image: media.imageUrl, icon: null });
            }
        } else {
            setFormData({ ...formData, icon: null, image: null });
        }
        setShowMediaPicker(false);
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
            overflowY: 'auto'
        }}>
            <div style={{
                background: 'var(--bg-card)', borderRadius: '24px', padding: '1.5rem',
                width: '90%', maxWidth: '500px', border: '1px solid var(--border-color)',
                maxHeight: '90vh',
                overflowY: 'auto',
                margin: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0 }}>{service ? 'Edit Menu Item' : 'Add Menu Item'}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}><FaTimes /></button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Item Name *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            placeholder="e.g., Margherita Pizza"
                        />
                    </div>

                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows="3"
                            placeholder="Brief description..."
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label>Price *</label>
                            <input
                                type="number"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                required
                                placeholder="0.00"
                                step="0.01"
                            />
                        </div>

                        <div className="form-group">
                            <label>Currency</label>
                            <select
                                value={formData.currency}
                                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                            >
                                <option value="AUD">AUD - Australian Dollar</option>
                                <option value="USD">USD - US Dollar</option>
                                <option value="EUR">EUR - Euro</option>
                                <option value="GBP">GBP - British Pound</option>
                                <option value="SAR">SAR - Saudi Riyal</option>
                                <option value="AED">AED - UAE Dirham</option>
                                <option value="KWD">KWD - Kuwaiti Dinar</option>
                                <option value="QAR">QAR - Qatari Riyal</option>
                                <option value="BHD">BHD - Bahraini Dinar</option>
                                <option value="OMR">OMR - Omani Rial</option>
                                <option value="EGP">EGP - Egyptian Pound</option>
                                <option value="JOD">JOD - Jordanian Dinar</option>
                                <option value="CAD">CAD - Canadian Dollar</option>
                                <option value="INR">INR - Indian Rupee</option>
                                <option value="CNY">CNY - Chinese Yuan</option>
                                <option value="JPY">JPY - Japanese Yen</option>
                                <option value="KRW">KRW - Korean Won</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Category</label>
                        <select
                            value={formData.category === '' ||
                                ['Pizza', 'Burgers', 'Pasta', 'Salads', 'Grilled', 'Seafood',
                                    'Soups', 'Sandwiches', 'Desserts', 'Hot Drinks', 'Cold Drinks',
                                    'Cocktails', 'Alcohol', 'BBQ', 'Mexican', 'Asian', 'Traditional',
                                    'Sides'].includes(formData.category)
                                ? formData.category
                                : 'Other'}
                            onChange={(e) => {
                                if (e.target.value === 'Other') {
                                    setFormData({ ...formData, category: 'Other', customCategory: '' });
                                } else {
                                    setFormData({ ...formData, category: e.target.value, customCategory: '' });
                                }
                            }}
                        >
                            <option value="">Select a category...</option>
                            <option value="Pizza">🍕 Pizza</option>
                            <option value="Burgers">🍔 Burgers</option>
                            <option value="Pasta">🍝 Pasta</option>
                            <option value="Salads">🥗 Salads</option>
                            <option value="Grilled">🍗 Grilled</option>
                            <option value="Seafood">🍤 Seafood</option>
                            <option value="Soups">🍜 Soups</option>
                            <option value="Sandwiches">🥙 Sandwiches</option>
                            <option value="Desserts">🍰 Desserts</option>
                            <option value="Hot Drinks">☕ Hot Drinks</option>
                            <option value="Cold Drinks">🥤 Cold Drinks</option>
                            <option value="Cocktails">🍹 Cocktails</option>
                            <option value="Alcohol">🍺 Alcohol</option>
                            <option value="BBQ">🔥 BBQ</option>
                            <option value="Mexican">🌮 Mexican</option>
                            <option value="Asian">🍱 Asian</option>
                            <option value="Traditional">🥘 Traditional</option>
                            <option value="Sides">🍟 Sides</option>
                            <option value="Other">📦 Other (Custom)</option>
                        </select>

                        {/* Custom Category Input - Shows ONLY when "Other" is selected */}
                        {formData.category === 'Other' && (
                            <input
                                type="text"
                                value={formData.customCategory}
                                onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                                placeholder="Enter custom category..."
                                style={{ marginTop: '0.75rem' }}
                                required
                            />
                        )}
                    </div>

                    {/* Icon/Image Picker */}
                    <div className="form-group">
                        <label>Icon or Image (Optional)</label>
                        <button
                            type="button"
                            onClick={() => setShowMediaPicker(true)}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'var(--bg-body)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                transition: 'all 0.2s'
                            }}
                        >
                            <FaImage />
                            {formData.icon ? `Icon: ${formData.icon}` : formData.image ? 'Image Selected' : 'Choose Icon or Upload Image'}
                        </button>
                    </div>

                    <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={formData.available}
                                onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                            />
                            <span>Available</span>
                        </label>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', paddingBottom: '2rem' }}>
                        <button type="button" onClick={onClose} className="btn btn-outline" style={{ flex: 1 }}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                            {service ? 'Update' : 'Add'} Item
                        </button>
                    </div>
                </form>

                {/* Media Picker Modal */}
                {showMediaPicker && (
                    <ServiceMediaPicker
                        value={formData.icon ? { type: 'icon', iconId: formData.icon } : formData.image ? { type: 'image', imageUrl: formData.image } : null}
                        onChange={handleMediaChange}
                        onClose={() => setShowMediaPicker(false)}
                    />
                )}
            </div>
        </div>
    );
};

export default EditBusinessProfile;
