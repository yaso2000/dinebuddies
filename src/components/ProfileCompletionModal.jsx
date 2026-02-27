import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { IoMale, IoFemale, IoMaleFemale } from 'react-icons/io5';
import { FaUser, FaCheckCircle, FaVenusMars, FaBirthdayCake } from 'react-icons/fa';
import { updateProfile as updateAuthProfile } from 'firebase/auth';

const ProfileCompletionModal = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const { currentUser, userProfile, isGuest, loading } = useAuth();
    const { isDark } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        displayName: '',
        ageCategory: '',
        gender: ''
    });

    // Check for missing fields and open modal if necessary
    useEffect(() => {
        if (loading || !userProfile || isGuest || userProfile.accountType === 'business' || userProfile.accountType === 'guest') {
            setIsOpen(false);
            return;
        }

        // Don't show modal if already on completion page
        if (location.pathname === '/complete-profile') {
            setIsOpen(false);
            return;
        }

        const missing = [];
        // Check if fields are truly missing (undefined, null, or empty string)
        if (!userProfile.displayName && !userProfile.nickname) missing.push('displayName');
        if (!userProfile.ageCategory && !userProfile.age) missing.push('ageCategory');
        if (!userProfile.gender) missing.push('gender');

        if (missing.length > 0) {
            // Pre-fill existing data to avoid re-entering known fields
            setFormData(prev => ({
                displayName: userProfile.displayName || userProfile.nickname || prev.displayName || '',
                ageCategory: userProfile.ageCategory || prev.ageCategory || '',
                gender: userProfile.gender || prev.gender || ''
            }));

            // Short delay to ensure it's not a transient state
            const timer = setTimeout(() => setIsOpen(true), 1000);
            return () => clearTimeout(timer);
        } else {
            setIsOpen(false);
        }
    }, [userProfile, loading, isGuest]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.displayName || !formData.ageCategory || !formData.gender) {
            // Shake effect or simple alert
            alert(t('fill_all_fields', 'Please fill all required fields'));
            return;
        }

        setIsSubmitting(true);

        try {
            // Derive legacy age for compatibility
            let derivedAge = 18;
            if (formData.ageCategory) {
                const parts = formData.ageCategory.split('-');
                if (parts[0]) {
                    derivedAge = parseInt(parts[0].replace(/\D/g, '')) || 18;
                }
            }

            const updateData = {
                displayName: formData.displayName,
                display_name: formData.displayName, // Normalize to display_name
                nickname: formData.displayName,
                ageCategory: formData.ageCategory,
                gender: formData.gender,
                age: derivedAge,
                isProfileComplete: true,
                updatedAt: new Date(),
                // Ensure email/photo exist if missing
                email: currentUser.email || '',
                photoURL: currentUser.photoURL || userProfile.photoURL || '',
                photo_url: currentUser.photoURL || userProfile.photoURL || ''
            };

            const userRef = doc(db, 'users', currentUser.uid);
            await setDoc(userRef, updateData, { merge: true });

            // Update Auth Profile too
            if (currentUser) {
                try {
                    await updateAuthProfile(currentUser, {
                        displayName: formData.displayName,
                        photoURL: updateData.photoURL || currentUser.photoURL
                    });
                } catch (err) {
                    console.warn("Auth update warning:", err);
                }
            }

            // Verify
            const verifySnap = await getDoc(userRef);
            if (verifySnap.exists()) {
                const newData = verifySnap.data();
                if (newData.ageCategory && newData.gender && newData.displayName) {
                    setIsOpen(false);
                    // Optional: Force reload if needed, but onSnapshot in AuthContext should handle it
                }
            }

        } catch (error) {
            console.error("Error saving profile:", error);
            alert(t('error_saving_profile', 'Error saving profile. Please try again.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const ageOptions = [
        { value: '18-24', label: '18-24' },
        { value: '25-34', label: '25-34' },
        { value: '35-44', label: '35-44' },
        { value: '45-54', label: '45-54' },
        { value: '55+', label: '55+' }
    ];

    const genderOptions = [
        { value: 'male', label: t('male'), icon: IoMale },
        { value: 'female', label: t('female'), icon: IoFemale },
        { value: 'unspecified', label: t('non_binary', 'Non-Binary'), icon: IoMaleFemale }
    ];

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.3s ease-out'
        }}>
            <div style={{
                background: 'var(--bg-card)',
                borderRadius: '24px',
                padding: '2rem',
                width: '100%',
                maxWidth: '480px',
                boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' : '0 10px 30px rgba(0, 0, 0, 0.1)',
                border: '1px solid var(--border-color)',
                position: 'relative',
                animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{
                        width: '60px',
                        height: '60px',
                        background: 'linear-gradient(135deg, var(--premium-orange), #f97316)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem auto',
                        fontSize: '1.5rem',
                        color: '#fff',
                        boxShadow: '0 4px 15px rgba(249, 115, 22, 0.4)'
                    }}>
                        <FaUser />
                    </div>
                    <h2 style={{
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        marginBottom: '0.5rem',
                        color: 'var(--text-main)'
                    }}>
                        {t('complete_profile', 'Complete Your Profile')}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {t('complete_profile_desc', 'Please provide a few details to get the best experience.')}
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Display Name - Only show if missing or empty */}
                    {!userProfile?.displayName && (
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '0.9rem' }}>
                                {t('display_name', 'Display Name / Nickname')}
                            </label>
                            <input
                                type="text"
                                value={formData.displayName}
                                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                placeholder={t('enter_name', 'Enter your name')}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-main)',
                                    fontSize: '1rem'
                                }}
                            />
                        </div>
                    )}

                    {/* Gender */}
                    {!userProfile?.gender && (
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '0.9rem' }}>
                                {t('select_gender', 'Select Gender')}
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                {genderOptions.map((option) => {
                                    const isSelected = formData.gender === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, gender: option.value })}
                                            style={{
                                                padding: '10px',
                                                borderRadius: '12px',
                                                border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                                background: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'var(--bg-input)',
                                                color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '4px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <option.icon style={{ fontSize: '1.4rem' }} />
                                            <span style={{ fontSize: '0.75rem' }}>{option.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Age Category */}
                    {!userProfile?.ageCategory && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '0.9rem' }}>
                                {t('select_age_category', 'Select Age Category')}
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                {ageOptions.map((option) => {
                                    const isSelected = formData.ageCategory === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, ageCategory: option.value })}
                                            style={{
                                                padding: '10px',
                                                borderRadius: '12px',
                                                border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                                background: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'var(--bg-input)',
                                                color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                fontSize: '0.9rem'
                                            }}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        style={{
                            width: '100%',
                            padding: '14px',
                            borderRadius: '16px',
                            background: 'linear-gradient(135deg, var(--premium-orange), #fbbf24)',
                            color: 'white',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            border: 'none',
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            opacity: isSubmitting ? 0.7 : 1,
                            boxShadow: '0 4px 15px rgba(249, 115, 22, 0.3)'
                        }}
                    >
                        {isSubmitting ? t('saving', 'Saving...') : t('save_and_continue', 'Save & Continue')}
                    </button>
                </form>
            </div>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default ProfileCompletionModal;
