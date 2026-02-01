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
        lat: null,
        lng: null,
        instagram: '',
        twitter: '',
        facebook: ''
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
        'Restaurant', 'Cafe', 'Hotel', 'Activity Center',
        'Salon', 'Gym', 'Event Hall', 'Other'
    ];

    // Load existing data
    useEffect(() => {
        const info = userProfile?.businessInfo || userProfile?.businessInfoDraft;
        if (info) {
            setFormData({
                businessName: info.businessName || '',
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
                facebook: info.socialMedia?.facebook || ''
            });

            setCoverPreviewUrl(info.coverImage || '');
            setLogoPreviewUrl(info.logoImage || '');
            setServices(info.services || []);
            setWorkingHours(info.workingHours || workingHours);
        }
    }, [userProfile]);

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const currentInfo = userProfile?.businessInfo || {};
            let coverImageUrl = currentInfo.coverImage || '';
            let logoImageUrl = currentInfo.logoImage || '';

            if (coverImage) {
                setUploading(true);
                coverImageUrl = await uploadImage(coverImage, `cover_${Date.now()}.jpg`);
            }

            if (logoImage) {
                setUploading(true);
                logoImageUrl = await uploadImage(logoImage, `logo_${Date.now()}.jpg`);
            }

            setUploading(false);

            const updates = {
                businessInfo: {
                    ...currentInfo,
                    businessName: formData.businessName,
                    tagline: formData.tagline,
                    businessType: formData.businessType,
                    description: formData.description,
                    phone: formData.phone,
                    email: formData.email,
                    website: formData.website,
                    address: formData.address,
                    city: formData.city,
                    lat: parseFloat(formData.lat),
                    lng: parseFloat(formData.lng),
                    coverImage: coverImageUrl,
                    logoImage: logoImageUrl,
                    socialMedia: {
                        instagram: formData.instagram,
                        twitter: formData.twitter,
                        facebook: formData.facebook
                    },
                    services: services,
                    workingHours: workingHours,
                    updatedAt: serverTimestamp(),
                    isPublished: true
                },
                updatedAt: serverTimestamp()
            };

            await updateUserProfile(updates);
            navigate('/business-profile');
        } catch (err) {
            console.error('Error updating profile:', err);
            setError(`Failed to update profile: ${err.message}`);
        } finally {
            setLoading(false);
            setUploading(false);
        }
    };

    const addService = (service) => {
        if (editingService !== null) {
            const updated = [...services];
            updated[editingService] = service;
            setServices(updated);
        } else {
            setServices([...services, { ...service, id: Date.now().toString() }]);
        }
        setShowServiceModal(false);
        setEditingService(null);
    };

    const sections = [
        { id: 'basic', label: 'Basic Info', icon: '📝' },
        { id: 'contact', label: 'Contact & Location', icon: '📍' },
        { id: 'hours', label: 'Working Hours', icon: '🕐' },
        { id: 'services', label: 'Services & Menu', icon: '🍽️' }
    ];

    return (
        <div className="page-container" style={{ paddingBottom: '150px', background: 'var(--bg-body)' }}>
            {/* Header */}
            <header className="app-header sticky-header-glass">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <FaArrowLeft style={{ transform: 'rotate(180deg)' }} />
                </button>
                <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>
                    Edit Business Profile
                </h3>
                <div style={{ width: '40px' }}></div>
            </header>

            {error && (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '12px',
                    padding: '1rem',
                    margin: '1rem',
                    color: '#ef4444'
                }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {/* Cover & Logo Images */}
                <div style={{ position: 'relative', marginBottom: '4rem' }}>
                    {/* Cover Image */}
                    <div style={{
                        position: 'relative',
                        height: '200px',
                        overflow: 'hidden',
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(236, 72, 153, 0.3))'
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
                        <label style={{
                            position: 'absolute',
                            bottom: '1rem',
                            right: '1rem',
                            background: 'rgba(0,0,0,0.8)',
                            backdropFilter: 'blur(10px)',
                            padding: '8px 14px',
                            borderRadius: '10px',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            border: '1px solid rgba(255,255,255,0.2)',
                            transition: 'all 0.2s'
                        }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.9)';
                                e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(0,0,0,0.8)';
                                e.currentTarget.style.transform = 'scale(1)';
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

                    {/* Logo Image */}
                    <div style={{
                        position: 'absolute',
                        bottom: '-40px',
                        left: '1.5rem',
                        width: '100px',
                        height: '100px',
                        borderRadius: '20px',
                        border: '4px solid var(--bg-body)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        overflow: 'hidden',
                        background: 'linear-gradient(135deg, var(--primary), #f97316)'
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
                                fontSize: '2.5rem'
                            }}>
                                🏪
                            </div>
                        )}
                        <label style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(0,0,0,0.6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0,
                            cursor: 'pointer',
                            transition: 'opacity 0.2s'
                        }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
                        >
                            <FaCamera style={{ color: 'white', fontSize: '1.5rem' }} />
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageChange(e, 'logo')}
                                style={{ display: 'none' }}
                            />
                        </label>
                    </div>
                </div>

                {/* Section Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '6px',
                    padding: '0 1rem',
                    marginBottom: '1.5rem',
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch'
                }}>
                    {sections.map(section => (
                        <button
                            key={section.id}
                            type="button"
                            onClick={() => setActiveSection(section.id)}
                            style={{
                                padding: '10px 16px',
                                background: activeSection === section.id
                                    ? 'linear-gradient(135deg, var(--primary), #f97316)'
                                    : 'var(--bg-card)',
                                border: activeSection === section.id
                                    ? '1px solid var(--primary)'
                                    : '1px solid var(--border-color)',
                                borderRadius: '12px',
                                color: 'white',
                                cursor: 'pointer',
                                fontWeight: activeSection === section.id ? '700' : '600',
                                fontSize: '0.8rem',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.3s ease',
                                boxShadow: activeSection === section.id
                                    ? '0 4px 12px rgba(139, 92, 246, 0.3)'
                                    : 'none',
                                transform: activeSection === section.id ? 'translateY(-2px)' : 'none'
                            }}
                            onMouseEnter={(e) => {
                                if (activeSection !== section.id) {
                                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                                    e.currentTarget.style.borderColor = 'var(--primary)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (activeSection !== section.id) {
                                    e.currentTarget.style.background = 'var(--bg-card)';
                                    e.currentTarget.style.borderColor = 'var(--border-color)';
                                }
                            }}
                        >
                            {section.icon} {section.label}
                        </button>
                    ))}
                </div>

                {/* Section Content */}
                <div style={{ padding: '0 1rem' }}>
                    {/* Basic Info Section */}
                    {activeSection === 'basic' && (
                        <div className="form-section">
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1.5rem' }}>
                                📝 Basic Information
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
                        <div className="form-section">
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1.5rem' }}>
                                📍 Contact & Location
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

                            <div className="form-group">
                                <label>Address</label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Street address"
                                />
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>City</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowLocationModal(true)}
                                        className="btn btn-outline"
                                        style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                                    >
                                        <FaMapMarkerAlt /> Set Location on Map
                                    </button>
                                </label>
                                <input
                                    type="text"
                                    value={formData.city}
                                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                    placeholder="City name"
                                />
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
                        <div className="form-section">
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1.5rem' }}>
                                🕐 Working Hours
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
                        <div className="form-section">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0 }}>
                                    🍽️ Services & Menu
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
                                    <FaPlus /> Add Service
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
                                            alignItems: 'start'
                                        }}>
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
                                    <p>No services added yet</p>
                                    <button
                                        type="button"
                                        onClick={() => setShowServiceModal(true)}
                                        className="btn btn-primary"
                                        style={{ marginTop: '1rem' }}
                                    >
                                        <FaPlus /> Add Your First Service
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Submit Buttons - Fixed at bottom */}
                <div style={{
                    position: 'fixed',
                    bottom: '70px', // Above navigation bar
                    left: 0,
                    right: 0,
                    background: 'var(--bg-card)',
                    borderTop: '1px solid var(--border-color)',
                    padding: '12px 16px',
                    display: 'flex',
                    gap: '12px',
                    zIndex: 1001, // Above navigation bar
                    boxShadow: '0 -4px 12px rgba(0,0,0,0.2)'
                }}>
                    <button
                        type="button"
                        onClick={() => navigate('/business-profile')}
                        className="btn btn-outline"
                        style={{
                            flex: 1,
                            padding: '12px',
                            fontSize: '0.9rem',
                            fontWeight: '700',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                            background: 'transparent',
                            transition: 'all 0.2s'
                        }}
                        disabled={loading}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                            e.currentTarget.style.borderColor = 'var(--primary)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{
                            flex: 1,
                            padding: '12px',
                            fontSize: '0.9rem',
                            fontWeight: '700',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, var(--primary), #f97316)',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
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
                        {uploading ? '⏳ Uploading...' : loading ? '💾 Saving...' : <><FaSave /> Save Changes</>}
                    </button>
                </div>
            </form>

            {/* Location Picker Modal */}
            {showLocationModal && (
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
            )}

            {/* Service Modal */}
            {showServiceModal && (
                <ServiceModal
                    service={editingService !== null ? services[editingService] : null}
                    onSave={addService}
                    onClose={() => {
                        setShowServiceModal(false);
                        setEditingService(null);
                    }}
                />
            )}
        </div>
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
        available: service?.available !== false,
        icon: service?.icon || null,
        image: service?.image || null
    });
    const [showMediaPicker, setShowMediaPicker] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    const handleMediaChange = (media) => {
        if (media) {
            if (media.type === 'icon') {
                setFormData({ ...formData, icon: media.iconId, image: null });
            } else if (media.type === 'image') {
                setFormData({ ...formData, image: media.imageUrl, icon: null });
            }
        } else {
            setFormData({ ...formData, icon: null, image: null });
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
            <div style={{
                background: 'var(--bg-card)', borderRadius: '24px', padding: '1.5rem',
                width: '90%', maxWidth: '500px', border: '1px solid var(--border-color)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0 }}>{service ? 'Edit Service' : 'Add Service'}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}><FaTimes /></button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Service Name *</label>
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
                                <option value="SAR">SAR</option>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Category</label>
                        <input
                            type="text"
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            placeholder="e.g., Main Course, Dessert"
                        />
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

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                        <button type="button" onClick={onClose} className="btn btn-outline" style={{ flex: 1 }}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                            {service ? 'Update' : 'Add'} Service
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
