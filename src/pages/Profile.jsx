import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useDropzone } from 'react-dropzone';
import { FaCamera, FaChevronRight, FaPlus, FaTimes, FaUser, FaStore, FaChartLine, FaGifts, FaEdit, FaSave, FaStar, FaCheckCircle } from 'react-icons/fa';

const Profile = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { currentUser, updateProfile, invitations, restaurants, updateRestaurant, restoreDefaults, toggleFollow } = useInvitations();
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState('posted');
    const [newInterest, setNewInterest] = useState('');

    const [formData, setFormData] = useState({
        name: currentUser.name,
        bio: currentUser.bio || '',
        avatar: currentUser.avatar,
        interests: currentUser.interests || [],
        gender: currentUser.gender || 'male', // Required: 'male' or 'female'
        age: currentUser.age || 18 // Required: minimum 18
    });

    // Business specific state
    const myRestaurant = restaurants.find(r => r.id === 'res_1') || restaurants[0];
    const [bizFormData, setBizFormData] = useState({ ...myRestaurant });

    const myPostedInvitations = invitations.filter(inv => inv.author?.id === currentUser.id);
    const myJoinedInvitations = invitations.filter(inv => inv.joined?.includes(currentUser.id));

    const onDrop = React.useCallback(acceptedFiles => {
        const file = acceptedFiles[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => setFormData(prev => ({ ...prev, avatar: reader.result }));
            reader.readAsDataURL(file);
        }
    }, []);

    const { getRootProps, getInputProps } = useDropzone({ onDrop, accept: { 'image/*': [] }, maxFiles: 1 });

    // Validate for external links
    const containsExternalLinks = (text) => {
        const urlPattern = /(https?:\/\/|www\.|@[a-zA-Z0-9_]+|instagram\.com|facebook\.com|twitter\.com|tiktok\.com|snapchat\.com)/gi;
        return urlPattern.test(text);
    };

    const handleSave = () => {
        // Validate mandatory fields
        if (!formData.gender) {
            alert(i18n.language === 'ar'
                ? '⚠️ الرجاء تحديد الجنس'
                : '⚠️ Please select your gender');
            return;
        }

        if (!formData.age || formData.age < 18) {
            alert(i18n.language === 'ar'
                ? '⚠️ الرجاء إدخال عمرك (الحد الأدنى 18 سنة)'
                : '⚠️ Please enter your age (minimum 18 years)');
            return;
        }

        // Check for external links in bio
        if (containsExternalLinks(formData.bio)) {
            alert(i18n.language === 'ar'
                ? '⚠️ ممنوع نشر روابط خارجية أو حسابات تواصل اجتماعي في البروفايل'
                : '⚠️ External links and social media accounts are not allowed in profile');
            return;
        }

        updateProfile(formData);
        setIsEditing(false);
    };

    const handleBizSave = () => {
        updateRestaurant(myRestaurant.id, bizFormData);
        setIsEditing(false);
        alert(i18n.language === 'ar' ? 'تم تحديث بيانات المطعم بنجاح!' : 'Restaurant updated successfully!');
    };

    const switchToDemoAccount = (type) => {
        if (type === 'business') {
            updateProfile({
                name: 'Le Bistro Premium',
                accountType: 'business',
                managedRestaurantId: 'res_1',
                avatar: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400'
            });
        } else {
            updateProfile({
                name: 'ياسر',
                accountType: 'individual',
                managedRestaurantId: null,
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Yaser'
            });
        }
    };


    return (
        <div className="profile-page" style={{ paddingBottom: '100px', animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ padding: '2rem 1.5rem' }}>
                {currentUser.accountType === 'business' ? (
                    <div className="business-view">
                        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                            <div style={{ width: '120px', height: '120px', borderRadius: '25px', margin: '0 auto 1.5rem', border: '4px solid var(--luxury-gold)', overflow: 'hidden', boxShadow: '0 10px 30px rgba(251, 191, 36, 0.3)' }}>
                                <img src={bizFormData.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                            </div>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: '900' }}>{bizFormData.name}</h1>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--luxury-gold)', fontWeight: '800', marginBottom: '0.5rem' }}>
                                <FaStore /> {i18n.language === 'ar' ? 'حساب شريك موثق' : 'Verified Partner Account'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '1rem' }}>
                                <div style={{ background: 'rgba(251, 191, 36, 0.15)', padding: '6px 14px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--luxury-gold)' }}>
                                    <FaStar style={{ color: 'var(--luxury-gold)', fontSize: '0.9rem' }} />
                                    <span style={{ color: 'var(--luxury-gold)', fontWeight: '900', fontSize: '0.9rem' }}>{bizFormData.rating || '4.8'}</span>
                                </div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>•</span>
                                <span style={{ color: 'var(--luxury-gold)', fontSize: '0.85rem', fontWeight: '700' }}>{bizFormData.type || 'French Cuisine'}</span>
                            </div>
                        </div>

                        {/* Business Info Cards */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                            {/* Basic Info */}
                            <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', fontWeight: '800' }}>
                                    <FaEdit style={{ color: 'var(--luxury-gold)' }} />
                                    {i18n.language === 'ar' ? 'المعلومات الأساسية' : 'Basic Information'}
                                </h3>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <div className="form-group">
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
                                            {i18n.language === 'ar' ? 'اسم المنشأة' : 'Business Name'}
                                        </label>
                                        <input type="text" className="input-field" value={bizFormData.name} onChange={e => setBizFormData({ ...bizFormData, name: e.target.value })} style={{ borderRadius: '12px' }} />
                                    </div>

                                    <div className="form-group">
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
                                            {i18n.language === 'ar' ? 'نوع المطبخ / النشاط' : 'Cuisine Type / Activity'}
                                        </label>
                                        <select className="input-field" value={bizFormData.type} onChange={e => setBizFormData({ ...bizFormData, type: e.target.value })} style={{ borderRadius: '12px' }}>
                                            <option value="French Cuisine">French Cuisine</option>
                                            <option value="Japanese">Japanese</option>
                                            <option value="Italian">Italian</option>
                                            <option value="Fast Casual Burger">Burger</option>
                                            <option value="Specialty Coffee">Specialty Coffee</option>
                                            <option value="Grill">Grill & BBQ</option>
                                            <option value="Cinema">Cinema</option>
                                            <option value="Entertainment">Entertainment</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
                                            {i18n.language === 'ar' ? 'الموقع' : 'Location'}
                                        </label>
                                        <input type="text" className="input-field" value={bizFormData.location} onChange={e => setBizFormData({ ...bizFormData, location: e.target.value })} style={{ borderRadius: '12px' }} />
                                    </div>
                                </div>
                            </div>

                            {/* Promo & Offers */}
                            <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', fontWeight: '800' }}>
                                    <FaGifts style={{ color: 'var(--secondary)' }} />
                                    {i18n.language === 'ar' ? 'العروض والترويج' : 'Offers & Promotions'}
                                </h3>

                                <div className="form-group">
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
                                        {i18n.language === 'ar' ? 'نص العرض الترويجي' : 'Promotional Text'}
                                    </label>
                                    <textarea className="input-field" rows="3" value={bizFormData.promoText} onChange={e => setBizFormData({ ...bizFormData, promoText: e.target.value })} style={{ borderRadius: '12px', height: 'auto', padding: '10px' }} placeholder={i18n.language === 'ar' ? 'مثال: خصم 20% لمجموعات DineBuddies المكونة من 4 أشخاص' : 'Example: 20% off for DineBuddies groups of 4+'} />
                                </div>
                            </div>

                            {/* Working Hours */}
                            <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', fontWeight: '800' }}>
                                    <FaChartLine style={{ color: 'var(--accent)' }} />
                                    {i18n.language === 'ar' ? 'ساعات العمل' : 'Working Hours'}
                                </h3>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
                                            {i18n.language === 'ar' ? 'من' : 'From'}
                                        </label>
                                        <input type="time" className="input-field" value={bizFormData.openTime || '12:00'} onChange={e => setBizFormData({ ...bizFormData, openTime: e.target.value })} style={{ borderRadius: '12px' }} />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
                                            {i18n.language === 'ar' ? 'إلى' : 'To'}
                                        </label>
                                        <input type="time" className="input-field" value={bizFormData.closeTime || '02:00'} onChange={e => setBizFormData({ ...bizFormData, closeTime: e.target.value })} style={{ borderRadius: '12px' }} />
                                    </div>
                                </div>
                            </div>

                            {/* Save Button */}
                            <button className="btn btn-primary" onClick={handleBizSave} style={{ height: '55px', background: 'var(--luxury-gold)', color: 'black', fontWeight: '900' }}>
                                <FaSave style={{ marginInlineEnd: '8px' }} /> {t('save_btn')}
                            </button>

                            {/* Demo Account Switcher for Business */}
                            <div style={{ padding: '1rem', background: 'rgba(139, 92, 246, 0.05)', borderRadius: '15px', border: '1px dashed rgba(139, 92, 246, 0.3)' }}>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '10px', textAlign: 'center' }}>
                                    🧪 {i18n.language === 'ar' ? 'حسابات تجريبية للاختبار' : 'Demo Accounts for Testing'}
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <button
                                        onClick={() => switchToDemoAccount('individual')}
                                        style={{
                                            background: 'var(--primary)',
                                            border: '1px solid var(--primary)',
                                            color: 'white',
                                            padding: '10px',
                                            borderRadius: '10px',
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        👤 {i18n.language === 'ar' ? 'حساب عادي' : 'Personal'}
                                    </button>
                                    <button
                                        onClick={() => switchToDemoAccount('business')}
                                        style={{
                                            background: 'var(--luxury-gold)',
                                            border: '1px solid var(--luxury-gold)',
                                            color: 'black',
                                            padding: '10px',
                                            borderRadius: '10px',
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        🏢 {i18n.language === 'ar' ? 'حساب شريك' : 'Business'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="personal-view">
                        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                <div
                                    {...(isEditing ? getRootProps() : {})}
                                    className="host-avatar-container"
                                    style={{
                                        width: '130px',
                                        height: '130px',
                                        margin: '0 auto',
                                        border: `4px solid var(--primary)`,
                                        cursor: isEditing ? 'pointer' : 'default',
                                        position: 'relative'
                                    }}
                                >
                                    {isEditing && <input {...getInputProps()} />}
                                    <img src={formData.avatar} alt={formData.name} className="host-avatar" />
                                    {isEditing && (
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: 'rgba(0,0,0,0.5)',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexDirection: 'column',
                                            gap: '5px'
                                        }}>
                                            <FaCamera style={{ color: 'white', fontSize: '1.5rem' }} />
                                            <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: '700' }}>
                                                {i18n.language === 'ar' ? 'تغيير الصورة' : 'Change Photo'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {!isEditing && (
                                    <button onClick={() => setIsEditing(true)} style={{ position: 'absolute', bottom: '0', right: '0', background: 'var(--primary)', color: 'white', width: '35px', height: '35px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid var(--bg-body)', cursor: 'pointer' }}>
                                        <FaEdit size={14} style={{ margin: 'auto' }} />
                                    </button>
                                )}
                            </div>

                            {isEditing ? (
                                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', textAlign: 'center' }}>{t('profile_name')}</label>
                                        <input type="text" className="input-field" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: '900' }} />
                                    </div>

                                    {/* Gender Selection - Required */}
                                    <div className="form-group">
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', textAlign: 'center' }}>
                                            {i18n.language === 'ar' ? 'الجنس' : 'Gender'} <span style={{ color: 'var(--secondary)' }}>*</span>
                                        </label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, gender: 'male' })}
                                                style={{
                                                    padding: '12px',
                                                    borderRadius: '12px',
                                                    border: formData.gender === 'male' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                                    background: formData.gender === 'male' ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-card)',
                                                    color: 'white',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px',
                                                    transition: 'all 0.2s',
                                                    fontWeight: '700'
                                                }}
                                            >
                                                <span>👨</span>
                                                <span>{i18n.language === 'ar' ? 'ذكر' : 'Male'}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, gender: 'female' })}
                                                style={{
                                                    padding: '12px',
                                                    borderRadius: '12px',
                                                    border: formData.gender === 'female' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                                    background: formData.gender === 'female' ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-card)',
                                                    color: 'white',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px',
                                                    transition: 'all 0.2s',
                                                    fontWeight: '700'
                                                }}
                                            >
                                                <span>👩</span>
                                                <span>{i18n.language === 'ar' ? 'أنثى' : 'Female'}</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Age Input - Required */}
                                    <div className="form-group">
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', textAlign: 'center' }}>
                                            {i18n.language === 'ar' ? 'العمر' : 'Age'} <span style={{ color: 'var(--secondary)' }}>*</span>
                                        </label>
                                        <input
                                            type="number"
                                            className="input-field"
                                            value={formData.age}
                                            onChange={e => setFormData({ ...formData, age: parseInt(e.target.value) || 18 })}
                                            min="18"
                                            max="100"
                                            style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: '700' }}
                                            placeholder="18"
                                        />
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '5px' }}>
                                            {i18n.language === 'ar' ? 'الحد الأدنى 18 سنة' : 'Minimum age 18'}
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', textAlign: 'center' }}>{t('profile_bio')}</label>
                                        <textarea className="input-field" value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} placeholder={t('profile_bio_placeholder')} style={{ textAlign: 'center', fontSize: '0.9rem', minHeight: '80px' }} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={handleSave} className="btn btn-primary" style={{ flex: 1 }}>{t('save_btn')}</button>
                                        <button onClick={() => setIsEditing(false)} className="btn btn-outline" style={{ flex: 1 }}>{t('cancel_btn')}</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <h1 style={{ fontSize: '2rem', fontWeight: '900', marginTop: '1rem', marginBottom: '0.25rem' }}>{currentUser.name}</h1>
                                    <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{currentUser.bio || (i18n.language === 'ar' ? 'عضو DineBuddies نشط' : 'Active DineBuddies member')}</p>
                                    {/* Display Gender and Age */}
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                                        <div style={{
                                            background: 'rgba(139, 92, 246, 0.15)',
                                            padding: '6px 12px',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(139, 92, 246, 0.3)',
                                            fontSize: '0.85rem',
                                            fontWeight: '700',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            <span>{currentUser.gender === 'male' ? '👨' : '👩'}</span>
                                            <span>{i18n.language === 'ar' ? (currentUser.gender === 'male' ? 'ذكر' : 'أنثى') : (currentUser.gender === 'male' ? 'Male' : 'Female')}</span>
                                        </div>
                                        <div style={{
                                            background: 'rgba(251, 191, 36, 0.15)',
                                            padding: '6px 12px',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(251, 191, 36, 0.3)',
                                            fontSize: '0.85rem',
                                            fontWeight: '700',
                                            color: 'var(--luxury-gold)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            <span>🎂</span>
                                            <span>{currentUser.age} {i18n.language === 'ar' ? 'سنة' : 'years'}</span>
                                        </div>
                                    </div>
                                </>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '2rem', marginTop: '1.5rem' }}>
                                <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate('/followers')}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--primary)' }}>{currentUser.followersCount || 124}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('followers')}</div>
                                </div>
                                <div style={{ borderRight: '1px solid var(--border-color)' }}></div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--luxury-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                        <FaStar style={{ fontSize: '0.9rem' }} /> {currentUser.reputation || 450}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('reputation_points')}</div>
                                </div>
                                <div style={{ borderRight: '1px solid var(--border-color)' }}></div>
                                <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate('/followers')}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--primary)' }}>{currentUser.following?.length || 2}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('following')}</div>
                                </div>
                            </div>
                        </div>

                        {/* Plan & Subscription Card */}
                        <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '60px', height: '60px', background: 'var(--luxury-gold)', borderRadius: '50%', filter: 'blur(30px)', opacity: 0.2 }}></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span>💳</span> {i18n.language === 'ar' ? 'خطتي الحالية' : 'My Plan'}
                                </h3>
                                <span style={{ background: 'rgba(251, 191, 36, 0.2)', color: 'var(--luxury-gold)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '900', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                                    PREMIUM
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                                    <FaCheckCircle style={{ color: 'var(--primary)' }} />
                                    <span>{i18n.language === 'ar' ? 'دعوات غير محدودة' : 'Unlimited Invitations'}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                                    <FaCheckCircle style={{ color: 'var(--primary)' }} />
                                    <span>{i18n.language === 'ar' ? 'خصم 20% في المطاعم الشريكة' : '20% Off at Partner Restaurants'}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                                    <FaCheckCircle style={{ color: 'var(--primary)' }} />
                                    <span>{i18n.language === 'ar' ? 'شارة العضو المميز' : 'Premium Member Badge'}</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', overflowX: 'auto' }}>
                                <button onClick={() => setActiveTab('posted')} style={{ flex: 1, padding: '15px', border: 'none', background: 'transparent', color: activeTab === 'posted' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'posted' ? '3px solid var(--primary)' : 'none', fontWeight: '800', whiteSpace: 'nowrap' }}>
                                    {t('stats_posted')} ({myPostedInvitations.length})
                                </button>
                                <button onClick={() => setActiveTab('joined')} style={{ flex: 1, padding: '15px', border: 'none', background: 'transparent', color: activeTab === 'joined' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'joined' ? '3px solid var(--primary)' : 'none', fontWeight: '800', whiteSpace: 'nowrap' }}>
                                    {t('stats_joined')} ({myJoinedInvitations.length})
                                </button>
                            </div>

                            <div style={{ minHeight: '100px' }}>
                                {/* Posted/Joined Invitations */}
                                {(activeTab === 'posted' || activeTab === 'joined') && (activeTab === 'posted' ? myPostedInvitations : myJoinedInvitations).map(inv => (
                                    <div key={inv.id} onClick={() => navigate(`/invitation/${inv.id}`)} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '15px', marginBottom: '10px', cursor: 'pointer', transition: 'all 0.2s', ':hover': { background: 'rgba(139, 92, 246, 0.1)' } }}>
                                        <img
                                            src={inv.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'}
                                            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'; }}
                                            style={{ width: '50px', height: '50px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
                                            alt={inv.title}
                                        />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <h4 style={{ fontSize: '0.9rem', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.title}</h4>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{inv.date ? inv.date.split('T')[0] : 'Today'}</span>
                                        </div>
                                        <FaChevronRight style={{ opacity: 0.3, flexShrink: 0 }} />
                                    </div>
                                ))}

                                {(activeTab === 'posted' ? myPostedInvitations : myJoinedInvitations).length === 0 && (activeTab === 'posted' || activeTab === 'joined') && (
                                    <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        {i18n.language === 'ar' ? 'لا يوجد بيانات حالياً' : 'Nothing to show yet'}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Language Selector */}
                        <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginTop: '2rem' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '1.3rem' }}>🌍</span>
                                {t('language_selector')}
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                                {[
                                    { code: 'ar', name: 'العربية', flag: '🇸🇦', dir: 'rtl' },
                                    { code: 'en', name: 'English', flag: '🇬🇧', dir: 'ltr' },
                                    { code: 'fr', name: 'Français', flag: '🇫🇷', dir: 'ltr' },
                                    { code: 'es', name: 'Español', flag: '🇪🇸', dir: 'ltr' },
                                    { code: 'ur', name: 'اردو', flag: '🇵🇰', dir: 'rtl' },
                                    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳', dir: 'ltr' }
                                ].map(lang => (
                                    <button
                                        key={lang.code}
                                        onClick={() => i18n.changeLanguage(lang.code)}
                                        style={{
                                            padding: '12px',
                                            background: i18n.language === lang.code ? 'var(--primary)' : 'transparent',
                                            border: `2px solid ${i18n.language === lang.code ? 'var(--primary)' : 'var(--border-color)'}`,
                                            borderRadius: '12px',
                                            color: i18n.language === lang.code ? 'white' : 'var(--text-white)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            fontWeight: '700',
                                            fontSize: '0.9rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <span style={{ fontSize: '1.2rem' }}>{lang.flag}</span>
                                        <span>{lang.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button onClick={restoreDefaults} style={{ marginTop: '1rem', width: '100%', background: 'transparent', border: '1px solid rgba(244, 63, 94, 0.4)', color: '#f43f5e', padding: '15px', borderRadius: '15px', fontSize: '0.85rem', fontWeight: '700' }}>
                            {t('reset_data_btn')}
                        </button>

                        {/* Demo Account Switcher - For Testing Only */}
                        <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(139, 92, 246, 0.05)', borderRadius: '15px', border: '1px dashed rgba(139, 92, 246, 0.3)' }}>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '10px', textAlign: 'center' }}>
                                🧪 {i18n.language === 'ar' ? 'حسابات تجريبية للاختبار' : 'Demo Accounts for Testing'}
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <button
                                    onClick={() => switchToDemoAccount('individual')}
                                    style={{
                                        background: currentUser.accountType === 'individual' ? 'var(--primary)' : 'transparent',
                                        border: '1px solid var(--primary)',
                                        color: 'white',
                                        padding: '10px',
                                        borderRadius: '10px',
                                        fontSize: '0.75rem',
                                        fontWeight: '700',
                                        cursor: 'pointer'
                                    }}
                                >
                                    👤 {i18n.language === 'ar' ? 'حساب عادي' : 'Personal'}
                                </button>
                                <button
                                    onClick={() => switchToDemoAccount('business')}
                                    style={{
                                        background: currentUser.accountType === 'business' ? 'var(--luxury-gold)' : 'transparent',
                                        border: '1px solid var(--luxury-gold)',
                                        color: currentUser.accountType === 'business' ? 'black' : 'var(--luxury-gold)',
                                        padding: '10px',
                                        borderRadius: '10px',
                                        fontSize: '0.75rem',
                                        fontWeight: '700',
                                        cursor: 'pointer'
                                    }}
                                >
                                    🏢 {i18n.language === 'ar' ? 'حساب شريك' : 'Business'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
};

export default Profile;
