import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { IoMale, IoFemale, IoMaleFemale } from 'react-icons/io5';
import { HiUser } from 'react-icons/hi2';
import { FaUser, FaCheckCircle, FaVenusMars, FaBirthdayCake, FaCamera } from 'react-icons/fa';
import { updateProfile as updateAuthProfile } from 'firebase/auth';
import ImageUpload from '../components/ImageUpload';
import { uploadProfilePicture, validateImageFile } from '../utils/imageUpload';
import { resolveSignedInHomePath } from '../utils/accountKind';
import { buildDefaultProfileMediaPatch } from '../constants/defaultProfileMedia';
import { AppText, AppTextInput } from "../components/base";

const CompleteProfile = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { currentUser, userProfile, updateProfile } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    displayName: '',
    ageCategory: '',
    gender: '',
    photoURL: ''
  });
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (userProfile) {
      setFormData((prev) => ({
        displayName: userProfile.displayName || userProfile.nickname || prev.displayName || '',
        ageCategory: userProfile.ageCategory || prev.ageCategory || '',
        gender: userProfile.gender || prev.gender || '',
        photoURL: userProfile.photoURL || prev.photoURL || ''
      }));
    } else if (currentUser?.displayName) {
      setFormData((prev) => ({
        ...prev,
        displayName: currentUser.displayName
      }));
    }
  }, [userProfile, currentUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log("Submitting profile form...", formData);

    // Photo is optional — only name, age category, and gender are required
    if (!formData.displayName || !formData.ageCategory || !formData.gender) {
      showToast(t('fill_required_fields', 'Please fill in your name, age group, and gender.'), 'error');
      return;
    }

    if (!currentUser?.uid) {
      showToast("User authentication error. Please try logging in again.", 'error');
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
        photo_url: formData.photoURL || currentUser.photoURL || ''
      };

      Object.assign(
        updateData,
        buildDefaultProfileMediaPatch({
          uid: currentUser.uid,
          gender: formData.gender,
          email: currentUser.email,
          photo_url: updateData.photo_url,
          cover_photo: '',
        })
      );

      console.log("Saving profile data (robust mode)...", updateData);

      // 1. ALWAYS use setDoc with merge: true for robustness (handles both create and update)
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, updateData, { merge: true });

      // 2. ALSO Update Firebase Auth Profile (Critical Fallback)
      if (currentUser) {
        try {
          await updateAuthProfile(currentUser, {
            displayName: formData.displayName,
            photoURL: updateData.photoURL || currentUser.photoURL
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

      await updateProfile(updateData);

      const destination =
        location.state?.from?.pathname ||
        resolveSignedInHomePath(currentUser, { ...userProfile, ...updateData });
      navigate(destination, { replace: true });

    } catch (error) {
      console.error("❌ Error updating profile:", error);
      showToast(`Failed to save profile: ${error.message}`, 'error');
      setIsSubmitting(false);
    }
  };

  const ageOptions = [
  { value: '18-24', label: '18-24' },
  { value: '25-34', label: '25-34' },
  { value: '35-44', label: '35-44' },
  { value: '45-54', label: '45-54' },
  { value: '55+', label: '55+' }];


  const genderOptions = [
  { value: 'male', label: t('male'), icon: IoMale },
  { value: 'female', label: t('female'), icon: IoFemale },
  { value: 'unspecified', label: t('non_binary', 'Non-Binary'), icon: IoMaleFemale }];


  const handleImageSelect = async (file) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      showToast(validation.error, 'error');
      return;
    }

    try {
      setUploadProgress(1); // Start
      const url = await uploadProfilePicture(file, currentUser.uid, (progress) => {
        setUploadProgress(progress);
      });
      setFormData((prev) => ({ ...prev, photoURL: url }));
      setUploadProgress(0); // Reset
      console.log("📸 Photo uploaded:", url);
    } catch (error) {
      console.error("❌ Photo upload failed:", error);
      showToast("Failed to upload photo. Please try again.", 'error');
      setUploadProgress(0);
    }
  };

  const reqStar = <AppText as="span" style={{ color: 'var(--accent)', fontWeight: 800 }} aria-hidden="true"> *</AppText>;

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
      padding: 'max(12px, env(safe-area-inset-top)) 1rem max(28px, calc(12px + env(safe-area-inset-bottom)))'
    }}>
            <div style={{
        margin: '0 auto',
        width: '100%',
        maxWidth: '500px',
        background: 'var(--card-bg)', // Dark card background
        borderRadius: '20px',
        padding: '1.35rem 1.15rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        border: '1px solid var(--border-color)'
      }}>
                <div style={{ textAlign: 'center', marginBottom: '1.15rem' }}>
                    <div style={{
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 0.65rem auto',
            fontSize: '1.6rem',
            color: '#fff',
            boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)'
          }}>
                        <FaUser />
                    </div>
                    <AppText as="h2" style={{ fontSize: '1.35rem', fontWeight: 'bold', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                        {t('complete_profile', 'Complete Your Profile')}
                    </AppText>
                    <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.4, marginBottom: '0.35rem' }}>
                        {t('complete_profile_desc', 'Please provide a few details to get the best experience.')}
                    </AppText>
                    <AppText as="p" style={{ color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 700, margin: '0 0 0.35rem' }}>
                        {t('required_fields_note', 'Fields marked with * are required.')}
                    </AppText>
                    <AppText as="p" style={{ color: 'var(--text-muted)', fontSize: '0.7rem', lineHeight: 1.35, margin: 0, opacity: 0.95 }}>
                        {t('warning_permanent_demographics_short', 'Gender and age category cannot be changed after saving.')}
                    </AppText>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Photo Upload Section */}
                    <div className="form-group" style={{ marginBottom: '1.1rem', textAlign: 'center' }}>
                        <label className="elegant-label" style={{ justifyContent: 'center', color: isDark ? 'var(--text-main)' : '#0f172a' }}>
                            <AppText as="span" className="label-icon" style={{ color: 'var(--primary)' }}><FaCamera /></AppText>
                            {t('profile_photo_optional', 'Profile photo (optional)')}
                        </label>
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem', position: 'relative' }}>
                            <ImageUpload
                onImageSelect={handleImageSelect}
                currentImage={formData.photoURL || currentUser?.photoURL} />
              
                            {uploadProgress > 0 && uploadProgress < 100 &&
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
              }
                        </div>
                    </div>

                    {/* Display Name */}
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label className="elegant-label" style={{ color: isDark ? 'var(--text-main)' : '#0f172a' }}>
                            <AppText as="span" className="label-icon" style={{ color: 'var(--primary)' }}><FaUser /></AppText>
                            {t('display_name', 'Display Name / Nickname')}
                            {reqStar}
                        </label>
                        <AppTextInput
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
              }} />
            
                    </div>

                    {/* Gender Selection */}
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label className="elegant-label" style={{ color: isDark ? 'var(--text-main)' : '#0f172a' }}>
                            <AppText as="span" className="label-icon" style={{ color: 'var(--primary)' }}><FaVenusMars /></AppText>
                            {t('select_gender', 'Select Gender')}
                            {reqStar}
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
                      position: 'relative',
                      padding: '12px 10px',
                      borderRadius: '14px',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      background: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'var(--bg-input)',
                      color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      transform: isSelected ? 'translateY(-2px)' : 'none',
                      boxShadow: isSelected ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none'
                    }}>
                    
                                        {isSelected &&
                    <div style={{ position: 'absolute', top: '8px', right: '8px', color: 'var(--primary)', fontSize: '0.8rem' }}>
                                                <FaCheckCircle />
                                            </div>
                    }
                                        <option.icon style={{ fontSize: '1.8rem', color: isSelected ? 'var(--primary)' : 'inherit', filter: isSelected ? 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.5))' : 'none' }} />
                                        <AppText as="span" style={{ fontSize: '0.85rem', fontWeight: isSelected ? '800' : '600' }}>
                                            {option.label}
                                        </AppText>
                                    </button>);

              })}
                        </div>
                    </div>

                    {/* Age Category Selection */}
                    <div className="form-group" style={{ marginBottom: '1.1rem' }}>
                        <label className="elegant-label" style={{ color: isDark ? 'var(--text-main)' : '#0f172a' }}>
                            <AppText as="span" className="label-icon" style={{ color: 'var(--primary)' }}><FaBirthdayCake /></AppText>
                            {t('select_age_category', 'Select Age Category')}
                            {reqStar}
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
                      padding: '12px 10px',
                      borderRadius: '14px',
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
                      minHeight: '64px'
                    }}>
                    
                                        {isSelected &&
                    <div style={{ position: 'absolute', top: '6px', right: '6px', color: 'var(--primary)', fontSize: '0.7rem' }}>
                                                <FaCheckCircle />
                                            </div>
                    }
                                        <HiUser style={{
                      fontSize: '1.6rem',
                      color: isSelected ? 'var(--primary)' : 'inherit',
                      marginBottom: '4px',
                      filter: isSelected ? 'drop-shadow(0 0 5px rgba(139, 92, 246, 0.5))' : 'none'
                    }} />
                                        <AppText as="span" style={{ fontSize: '0.85rem', fontWeight: isSelected ? '800' : '600' }}>
                                            {option.label}
                                        </AppText>
                                    </button>);

              })}
                        </div>
                    </div>

                    <button
            type="submit"
            disabled={isSubmitting}
            className="ui-btn ui-btn--primary"
            style={{
              height: '50px',
              fontSize: '1rem',
              fontWeight: 'bold',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, var(--primary), var(--accent))',
              boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
              width: '100%',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1
            }}>
            
                        {isSubmitting ? t('saving', 'Saving...') : t('save_and_continue', 'Save & Continue')}
                    </button>
                </form>
            </div>
        </div>);

};

export default CompleteProfile;