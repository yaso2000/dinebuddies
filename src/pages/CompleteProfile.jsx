import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { doc, setDoc, getDoc } from 'firebase/firestore'; // keep setDoc for fallback
import { db } from '../firebase/config';
import { IoMale, IoFemale, IoMaleFemale } from 'react-icons/io5';
import { HiUser } from 'react-icons/hi2';
import { FaUser, FaCheckCircle, FaVenusMars, FaBirthdayCake, FaCamera } from 'react-icons/fa';
import { updateProfile as updateAuthProfile } from 'firebase/auth';
import ImageUpload from '../components/ImageUpload';
import { uploadProfilePicture, validateImageFile } from '../utils/imageUpload';

const CompleteProfile = () => {
    const { t } = useTranslation();
    // Destructure updateProfile from context
    const { currentUser, userProfile, loading, updateProfile } = useAuth();
    const { isDark } = useTheme();
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        displayName: '',
        ageCategory: '',
        gender: '',
        photoURL: ''
    });
    const [uploadProgress, setUploadProgress] = useState(0);

    // Load existing data if available
    useEffect(() => {
        // SAFEGUARD: If user is a business account, redirect to their dashboard
        if (userProfile?.isBusiness) {
            console.log('🏢 Business user detected on /complete-profile. Redirecting...');
            navigate(window.innerWidth >= 1024 ? '/business-pro' : '/business-dashboard');
            return;
        }

        if (userProfile) {
            setFormData(prev => ({
                displayName: userProfile.displayName || userProfile.nickname || prev.displayName || '',
                ageCategory: userProfile.ageCategory || prev.ageCategory || '',
                gender: userProfile.gender || prev.gender || '',
                photoURL: userProfile.photoURL || prev.photoURL || ''
            }));
        } else if (currentUser?.displayName) {
            setFormData(prev => ({
                ...prev,
                displayName: currentUser.displayName
            }));
        }
    }, [userProfile, currentUser, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        console.log("Submitting profile form...", formData);

        // Photo is optional — only name, age category, and gender are required
        if (!formData.displayName || !formData.ageCategory || !formData.gender) {
            alert(t('fill_required_fields', 'Please fill in your name, age group, and gender.'));
            return;
        }

        if (!currentUser?.uid) {
            alert("User authentication error. Please try logging in again.");
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

            // Prepare complete data payload
            const updateData = {
                displayName: formData.displayName,
                display_name: formData.displayName, // Normalize to display_name
                nickname: formData.displayName, // Store as nickname too
                ageCategory: formData.ageCategory,
                gender: formData.gender,
                age: derivedAge, // Save legacy age field
                isProfileComplete: true,
                updatedAt: new Date(),
                email: currentUser.email || '',
                photoURL: formData.photoURL || currentUser.photoURL || '',
                photo_url: formData.photoURL || currentUser.photoURL || '',
            };

            console.log("Saving profile data (robust mode)...", updateData);

            // 1. ALWAYS use setDoc with merge: true for robustness (handles both create and update)
            const userRef = doc(db, 'users', currentUser.uid);
            await setDoc(userRef, updateData, { merge: true });

            // 2. ALSO Update Firebase Auth Profile (Critical Fallback)
            if (currentUser) {
                try {
                    await updateAuthProfile(currentUser, {
                        displayName: formData.displayName,
                        photoURL: formData.photoURL || currentUser.photoURL
                    });
                    console.log("✅ Auth Profile updated (displayName & photoURL synced)");
                } catch (authError) {
                    console.warn("⚠️ Auth Profile update failed (non-critical):", authError);
                }
            }

            // 3. VERIFY the write immediately
            const verifySnap = await getDoc(userRef);
            if (!verifySnap.exists()) throw new Error("Document write failed (not found after write).");

            const verifyData = verifySnap.data();
            console.log("🔍 Verification Data:", verifyData);

            if (!verifyData.ageCategory && !verifyData.age) {
                throw new Error(`Fields missing after save. Age: ${verifyData.age}, Cat: ${verifyData.ageCategory}`);
            }

            // 3. Force HARD RELOAD or Redirect
            console.log("✅ Verification passed. Redirecting...");
            const from = location.state?.from?.pathname || '/';
            window.location.href = from;

        } catch (error) {
            console.error("❌ Error updating profile:", error);
            alert(`Failed to save profile: ${error.message}`);
            setIsSubmitting(false);
        }
    };

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

    const handleImageSelect = async (file) => {
        const validation = validateImageFile(file);
        if (!validation.valid) {
            alert(validation.error);
            return;
        }

        try {
            setUploadProgress(1); // Start
            const url = await uploadProfilePicture(file, currentUser.uid, (progress) => {
                setUploadProgress(progress);
            });
            setFormData(prev => ({ ...prev, photoURL: url }));
            setUploadProgress(0); // Reset
            console.log("📸 Photo uploaded:", url);
        } catch (error) {
            console.error("❌ Photo upload failed:", error);
            alert("Failed to upload photo. Please try again.");
            setUploadProgress(0);
        }
    };

    if (loading) {
        return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)' }}>Loading...</div>;
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--bg-body)',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            zIndex: 1000, // Ensure it's above other elements but below major overlays
            padding: '2rem 1rem'
        }}>
            <div style={{
                margin: '0 auto 4rem auto', // Extra bottom margin for space
                width: '100%',
                maxWidth: '500px',
                background: 'var(--card-bg)', // Dark card background
                borderRadius: '24px',
                padding: '2rem',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                border: '1px solid var(--border-color)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem auto',
                        fontSize: '2rem',
                        color: '#fff',
                        boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)'
                    }}>
                        <FaUser />
                    </div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                        {t('complete_profile', 'Complete Your Profile')}
                    </h2>
                    <p style={{ color: 'var(--text-muted)' }}>
                        {t('complete_profile_desc', 'Please provide a few details to get the best experience.')}
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Photo Upload Section */}
                    <div className="form-group" style={{ marginBottom: '2rem', textAlign: 'center' }}>
                        <label className="elegant-label" style={{ justifyContent: 'center', color: isDark ? 'var(--text-main)' : '#0f172a' }}>
                            <span className="label-icon" style={{ color: 'var(--primary)' }}><FaCamera /></span>
                            {t('profile_photo', 'Profile Photo (Required)')}
                        </label>
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem', position: 'relative' }}>
                            <ImageUpload
                                onImageSelect={handleImageSelect}
                                currentImage={formData.photoURL || currentUser?.photoURL}
                            />
                            {uploadProgress > 0 && uploadProgress < 100 && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '-20px',
                                    width: '100px',
                                    height: '4px',
                                    background: 'rgba(255,255,255,0.1)',
                                    borderRadius: '2px',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        width: `${uploadProgress}%`,
                                        height: '100%',
                                        background: 'var(--primary)',
                                        transition: 'width 0.3s ease'
                                    }} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Display Name */}
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label className="elegant-label" style={{ color: isDark ? 'var(--text-main)' : '#0f172a' }}>
                            <span className="label-icon" style={{ color: 'var(--primary)' }}><FaUser /></span>
                            {t('display_name', 'Display Name / Nickname')}
                        </label>
                        <input
                            type="text"
                            value={formData.displayName}
                            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                            className="input-field"
                            placeholder={t('enter_name', 'Enter your name or nickname')}
                            required
                            style={{
                                width: '100%',
                                padding: '14px',
                                borderRadius: '12px',
                                background: 'var(--bg-input)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-main)',
                                fontSize: '1rem'
                            }}
                        />
                    </div>

                    {/* Gender Selection */}
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label className="elegant-label" style={{ color: isDark ? 'var(--text-main)' : '#0f172a' }}>
                            <span className="label-icon" style={{ color: 'var(--primary)' }}><FaVenusMars /></span>
                            {t('select_gender', 'Select Gender')}
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            {genderOptions.map((option) => {
                                const isSelected = formData.gender === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, gender: option.value })}
                                        style={{
                                            position: 'relative',
                                            padding: '16px 12px',
                                            borderRadius: '16px',
                                            border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                            background: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'var(--bg-input)',
                                            color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '8px',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            transform: isSelected ? 'translateY(-2px)' : 'none',
                                            boxShadow: isSelected ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none'
                                        }}
                                    >
                                        {isSelected && (
                                            <div style={{ position: 'absolute', top: '8px', right: '8px', color: 'var(--primary)', fontSize: '0.8rem' }}>
                                                <FaCheckCircle />
                                            </div>
                                        )}
                                        <option.icon style={{ fontSize: '1.8rem', color: isSelected ? 'var(--primary)' : 'inherit', filter: isSelected ? 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.5))' : 'none' }} />
                                        <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? '800' : '600' }}>
                                            {option.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Age Category Selection */}
                    <div className="form-group" style={{ marginBottom: '2rem' }}>
                        <label className="elegant-label" style={{ color: isDark ? 'var(--text-main)' : '#0f172a' }}>
                            <span className="label-icon" style={{ color: 'var(--primary)' }}><FaBirthdayCake /></span>
                            {t('select_age_category', 'Select Age Category')}
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            {ageOptions.map((option) => {
                                const isSelected = formData.ageCategory === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, ageCategory: option.value })}
                                        style={{
                                            position: 'relative',
                                            padding: '16px 12px',
                                            borderRadius: '16px',
                                            border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                            background: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'var(--bg-input)',
                                            color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '4px',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            transform: isSelected ? 'translateY(-2px)' : 'none',
                                            boxShadow: isSelected ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none',
                                            minHeight: '80px'
                                        }}
                                    >
                                        {isSelected && (
                                            <div style={{ position: 'absolute', top: '6px', right: '6px', color: 'var(--primary)', fontSize: '0.7rem' }}>
                                                <FaCheckCircle />
                                            </div>
                                        )}
                                        <HiUser style={{
                                            fontSize: '1.6rem',
                                            color: isSelected ? 'var(--primary)' : 'inherit',
                                            marginBottom: '4px',
                                            filter: isSelected ? 'drop-shadow(0 0 5px rgba(139, 92, 246, 0.5))' : 'none'
                                        }} />
                                        <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? '800' : '600' }}>
                                            {option.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn btn-primary btn-block"
                        style={{
                            height: '56px',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            borderRadius: '16px',
                            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                            boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
                            width: '100%',
                            border: 'none',
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            opacity: isSubmitting ? 0.7 : 1
                        }}
                    >
                        {isSubmitting ? t('saving', 'Saving...') : t('save_and_continue', 'Save & Continue')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CompleteProfile;
