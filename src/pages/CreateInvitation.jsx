import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { FaCalendarAlt, FaMapMarkerAlt, FaUsers, FaImage, FaTimes, FaCheckCircle } from 'react-icons/fa';
import { useInvitations } from '../context/InvitationContext';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';

const CreateInvitation = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { addInvitation } = useInvitations();

    const restaurantData = location.state?.restaurantData;
    const fromRestaurant = location.state?.fromRestaurant;

    const [formData, setFormData] = useState({
        title: restaurantData ? `${i18n.language === 'ar' ? 'دعوة في' : 'Dinner at'} ${restaurantData.name}` : '',
        type: restaurantData?.type || 'Restaurant',
        date: '',
        time: '',
        location: restaurantData?.location || '',
        guestsNeeded: 3,
        genderPreference: 'any', // 'male', 'female', 'any'
        ageRange: 'any', // '18-25', '26-35', '36-45', '46+', 'any'
        paymentType: 'Split',
        description: '',
        image: restaurantData?.image || null,
        lat: restaurantData?.lat,
        lng: restaurantData?.lng
    });

    // Update title when language changes if from restaurant
    useEffect(() => {
        if (restaurantData) {
            setFormData(prev => ({
                ...prev,
                title: `${i18n.language === 'ar' ? 'دعوة في' : 'Dinner at'} ${restaurantData.name}`
            }));
        }
    }, [i18n.language, restaurantData]);

    const onDrop = React.useCallback(acceptedFiles => {
        const file = acceptedFiles[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                setFormData(prev => ({ ...prev, image: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] }, maxFiles: 1 });

    const removeImage = (e) => {
        e.stopPropagation();
        setFormData(prev => ({ ...prev, image: null }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const newId = addInvitation(formData);
        if (newId) {
            navigate(`/invitation/${newId}`);
        }
    };

    return (
        <div className="page-container">
            <h2 style={{ marginBottom: '2rem', fontSize: '1.8rem', fontWeight: '900' }}>{t('create_invitation_title')}</h2>

            {fromRestaurant && restaurantData && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(244, 63, 94, 0.15))',
                    border: '1px solid var(--primary)',
                    borderRadius: '15px',
                    padding: '1rem 1.25rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <FaCheckCircle style={{ color: 'var(--primary)', fontSize: '1.2rem' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                            {t('venue_selected')}
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'white' }}>
                            {restaurantData.name}
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="create-form">
                <div className="form-group">
                    <label>{t('form_title_label')}</label>
                    <input
                        type="text"
                        name="title"
                        placeholder={t('form_title_placeholder')}
                        value={formData.title}
                        onChange={handleChange}
                        required
                        className="input-field"
                    />
                </div>

                <div className="form-grid">
                    <div className="form-group">
                        <label>{t('form_type_label')}</label>
                        <select name="type" value={formData.type} onChange={handleChange} className="input-field">
                            <option value="Restaurant">{t('type_restaurant')}</option>
                            <option value="Cafe">{t('type_cafe')}</option>
                            <option value="Cinema">{t('type_cinema')}</option>
                            <option value="Sports">{t('type_sports')}</option>
                            <option value="Entertainment">{t('type_entertainment')}</option>
                            <option value="Other">{t('type_other')}</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>{t('form_payment_label')}</label>
                        <select name="paymentType" value={formData.paymentType} onChange={handleChange} className="input-field">
                            <option value="Split">{t('payment_split')}</option>
                            <option value="Host Pays">{t('payment_host')}</option>
                            <option value="Each pays their own">{t('payment_own')}</option>
                        </select>
                    </div>
                </div>

                <div className="form-grid">
                    <div className="form-group">
                        <label><FaCalendarAlt style={{ color: 'var(--primary)' }} /> {t('form_date_label')}</label>
                        <input
                            type="date"
                            name="date"
                            value={formData.date}
                            onChange={handleChange}
                            required
                            className="input-field"
                        />
                    </div>
                    <div className="form-group">
                        <label>{t('form_time_label')}</label>
                        <input
                            type="time"
                            name="time"
                            value={formData.time}
                            onChange={handleChange}
                            required
                            className="input-field"
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label><FaMapMarkerAlt style={{ color: 'var(--secondary)' }} /> {t('form_location_label')}</label>
                    <input
                        type="text"
                        name="location"
                        placeholder={t('form_location_placeholder')}
                        value={formData.location}
                        onChange={handleChange}
                        required
                        className="input-field"
                    />
                </div>

                <div className="form-group">
                    <label><FaUsers style={{ color: 'var(--accent)' }} /> {t('form_guests_label')}</label>
                    <input
                        type="number"
                        name="guestsNeeded"
                        min="1"
                        max="20"
                        value={formData.guestsNeeded}
                        onChange={handleChange}
                        required
                        className="input-field"
                    />
                </div>

                {/* Gender Preference */}
                <div className="form-group">
                    <label>{i18n.language === 'ar' ? 'جنس المدعوين' : 'Guest Gender Preference'}</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, genderPreference: 'male' })}
                            style={{
                                padding: '12px',
                                borderRadius: '12px',
                                border: formData.genderPreference === 'male' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                background: formData.genderPreference === 'male' ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-card)',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <span style={{ fontSize: '1.5rem' }}>👨</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                                {i18n.language === 'ar' ? 'ذكور' : 'Male'}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, genderPreference: 'female' })}
                            style={{
                                padding: '12px',
                                borderRadius: '12px',
                                border: formData.genderPreference === 'female' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                background: formData.genderPreference === 'female' ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-card)',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <span style={{ fontSize: '1.5rem' }}>👩</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                                {i18n.language === 'ar' ? 'إناث' : 'Female'}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, genderPreference: 'any' })}
                            style={{
                                padding: '12px',
                                borderRadius: '12px',
                                border: formData.genderPreference === 'any' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                background: formData.genderPreference === 'any' ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-card)',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <span style={{ fontSize: '1.5rem' }}>👥</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                                {i18n.language === 'ar' ? 'لا يهم' : 'Any'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Age Range Preference */}
                <div className="form-group">
                    <label>{i18n.language === 'ar' ? 'الفئة العمرية' : 'Age Range Preference'}</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        {[
                            { value: '18-25', label: '18-25', icon: '🧒' },
                            { value: '26-35', label: '26-35', icon: '👨' },
                            { value: '36-45', label: '36-45', icon: '🧔' },
                            { value: '46+', label: '46+', icon: '👴' },
                            { value: 'any', label: i18n.language === 'ar' ? 'لا يهم' : 'Any', icon: '👥' }
                        ].map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setFormData({ ...formData, ageRange: option.value })}
                                style={{
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: formData.ageRange === option.value ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                    background: formData.ageRange === option.value ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-card)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s',
                                    gridColumn: option.value === 'any' ? 'span 3' : 'span 1'
                                }}
                            >
                                <span style={{ fontSize: '1.5rem' }}>{option.icon}</span>
                                <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                                    {option.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '1.25rem', borderRadius: '15px', border: '1px solid rgba(139, 92, 246, 0.2)', marginBottom: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', margin: 0 }}>
                        <input
                            type="checkbox"
                            name="isFollowersOnly"
                            checked={formData.isFollowersOnly || false}
                            onChange={(e) => setFormData({ ...formData, isFollowersOnly: e.target.checked })}
                            style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
                        />
                        <div>
                            <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'white' }}>
                                {i18n.language === 'ar' ? 'للمتابعين فقط' : 'Followers Only'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {i18n.language === 'ar' ? 'لن يظهر هذا اللقاء إلا للأصدقاء الذين يتابعونك' : 'Only people you follow will see this on the main map'}
                            </div>
                        </div>
                    </label>
                </div>

                <div className="form-group">
                    <label><FaImage style={{ color: 'var(--luxury-gold)' }} /> {t('form_image_label')}</label>
                    <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`} style={{ padding: '2.5rem 1rem', cursor: 'pointer', textAlign: 'center' }}>
                        <input {...getInputProps()} />
                        {formData.image ? (
                            <div style={{ position: 'relative', height: '220px' }}>
                                <img src={formData.image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-md)' }} />
                                <button
                                    type="button"
                                    onClick={removeImage}
                                    style={{
                                        position: 'absolute',
                                        top: '12px',
                                        right: '12px',
                                        background: 'rgba(0,0,0,0.7)',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: '32px',
                                        height: '32px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-muted)' }}>
                                <FaImage style={{ fontSize: '2rem', margin: '0 auto', opacity: 0.5 }} />
                                <p style={{ fontSize: '0.9rem' }}>{t('form_image_placeholder')}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="form-group">
                    <label>{t('form_details_label')}</label>
                    <textarea
                        name="description"
                        rows="4"
                        placeholder={t('form_details_placeholder')}
                        value={formData.description}
                        onChange={handleChange}
                        className="input-field text-area"
                    ></textarea>
                </div>

                <button type="submit" className="btn btn-primary btn-block" style={{ height: '60px', marginTop: '1rem', fontSize: '1.1rem' }}>
                    {t('submit_btn')}
                </button>
            </form>
        </div>
    );
};

export default CreateInvitation;
