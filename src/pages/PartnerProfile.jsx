import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowRight, FaStar, FaMapMarkerAlt, FaPhone, FaClock, FaEdit, FaSave, FaTimes, FaArrowLeft, FaUtensils, FaGlobe } from 'react-icons/fa';
import { useInvitations } from '../context/InvitationContext';
import { useTranslation } from 'react-i18next';
import ShareButtons from '../components/ShareButtons';

const PartnerProfile = () => {
    const { t, i18n } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();
    const context = useInvitations();

    const restaurants = context?.restaurants || [];
    const currentUser = context?.currentUser || {};
    const canEditRestaurant = context?.canEditRestaurant || (() => false);
    const isDemoMode = context?.isDemoMode || false;
    const switchUserAccount = context?.switchUserAccount || (() => { });

    const restaurant = restaurants.find(r => r && r.id === id);

    // Check if current user can edit this restaurant
    const canEdit = canEditRestaurant(id);

    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        type: '',
        description: '',
        menuDescription: '',
        phone: '',
        website: '',
        workingHours: {
            sunday: { open: '12:00', close: '23:00', isOpen: true },
            monday: { open: '12:00', close: '23:00', isOpen: true },
            tuesday: { open: '12:00', close: '23:00', isOpen: true },
            wednesday: { open: '12:00', close: '23:00', isOpen: true },
            thursday: { open: '12:00', close: '23:00', isOpen: true },
            friday: { open: '14:00', close: '02:00', isOpen: true },
            saturday: { open: '14:00', close: '02:00', isOpen: true }
        }
    });

    useEffect(() => {
        if (restaurant) {
            setFormData({
                name: restaurant.name || '',
                type: restaurant.type || '',
                description: restaurant.description || restaurant.promoText || '',
                menuDescription: restaurant.menuDescription || '',
                phone: restaurant.phone || '+966 50 123 4567',
                website: restaurant.website || 'www.example.com',
                workingHours: restaurant.workingHours || formData.workingHours
            });
        }
    }, [restaurant]);

    if (!restaurant) {
        return (
            <div className="page-container" style={{ textAlign: 'center', padding: '5rem 2rem', color: 'white' }}>
                <h2>{i18n.language === 'ar' ? 'المطعم غير موجود' : 'Restaurant not found'}</h2>
                <button onClick={() => navigate('/')} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                    {i18n.language === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}
                </button>
            </div>
        );
    }

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleWorkingHoursChange = (day, field, value) => {
        setFormData(prev => ({
            ...prev,
            workingHours: {
                ...prev.workingHours,
                [day]: {
                    ...prev.workingHours[day],
                    [field]: value
                }
            }
        }));
    };

    // Validate for external links
    const containsExternalLinks = (text) => {
        const urlPattern = /(https?:\/\/|www\.|@[a-zA-Z0-9_]+|instagram\.com|facebook\.com|twitter\.com|tiktok\.com|snapchat\.com)/gi;
        return urlPattern.test(text);
    };

    const handleSave = () => {
        // Check for external links in description and menu
        if (containsExternalLinks(formData.description) || containsExternalLinks(formData.menuDescription)) {
            alert(i18n.language === 'ar'
                ? '⚠️ ممنوع نشر روابط خارجية أو حسابات تواصل اجتماعي في البروفايل'
                : '⚠️ External links and social media accounts are not allowed in profile');
            return;
        }

        // Here you would save to context/backend
        console.log('Saving partner profile:', formData);
        setIsEditing(false);
        alert(i18n.language === 'ar' ? '✓ تم حفظ التغييرات بنجاح' : '✓ Changes saved successfully');
    };

    const handleCancel = () => {
        setIsEditing(false);
        // Reset to original data
        setFormData({
            name: restaurant.name || '',
            type: restaurant.type || '',
            description: restaurant.description || restaurant.promoText || '',
            menuDescription: restaurant.menuDescription || '',
            phone: restaurant.phone || '+966 50 123 4567',
            website: restaurant.website || 'www.example.com',
            workingHours: restaurant.workingHours || formData.workingHours
        });
    };

    const daysOfWeek = i18n.language === 'ar'
        ? ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        : ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    const dayNames = {
        ar: {
            sunday: 'الأحد',
            monday: 'الإثنين',
            tuesday: 'الثلاثاء',
            wednesday: 'الأربعاء',
            thursday: 'الخميس',
            friday: 'الجمعة',
            saturday: 'السبت'
        },
        en: {
            sunday: 'Sunday',
            monday: 'Monday',
            tuesday: 'Tuesday',
            wednesday: 'Wednesday',
            thursday: 'Thursday',
            friday: 'Friday',
            saturday: 'Saturday'
        }
    };

    return (
        <div className="partner-profile-page" style={{
            paddingBottom: '100px',
            animation: 'fadeIn 0.5s ease-out',
            minHeight: '100vh',
            background: 'var(--bg-body)',
            color: 'white'
        }}>
            {/* Hero Section */}
            <div style={{ position: 'relative', height: '280px', width: '100%' }}>
                <img
                    src={restaurant.image}
                    alt={formData.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, var(--bg-body) 0%, transparent 70%)'
                }}></div>

                {/* Back Button */}
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        position: 'absolute',
                        top: '20px',
                        [i18n.language === 'ar' ? 'right' : 'left']: '20px',
                        zIndex: 10,
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(10px)',
                        border: 'none',
                        color: 'white',
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                    }}
                >
                    {i18n.language === 'ar' ? <FaArrowRight /> : <FaArrowLeft />}
                </button>

                {/* Edit/Save Button - Only show if user has permission */}
                {canEdit && (
                    <button
                        onClick={isEditing ? handleSave : () => setIsEditing(true)}
                        style={{
                            position: 'absolute',
                            top: '20px',
                            [i18n.language === 'ar' ? 'left' : 'right']: '20px',
                            zIndex: 10,
                            background: isEditing
                                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                            border: 'none',
                            color: 'white',
                            padding: '10px 20px',
                            borderRadius: '25px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            fontWeight: '700',
                            fontSize: '0.9rem',
                            boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        {isEditing ? (
                            <>
                                <FaSave /> {i18n.language === 'ar' ? 'حفظ' : 'Save'}
                            </>
                        ) : (
                            <>
                                <FaEdit /> {i18n.language === 'ar' ? 'تعديل' : 'Edit'}
                            </>
                        )}
                    </button>
                )}

                {/* Cancel Button (when editing) */}
                {isEditing && canEdit && (
                    <button
                        onClick={handleCancel}
                        style={{
                            position: 'absolute',
                            top: '75px',
                            [i18n.language === 'ar' ? 'left' : 'right']: '20px',
                            zIndex: 10,
                            background: 'rgba(239, 68, 68, 0.9)',
                            border: 'none',
                            color: 'white',
                            padding: '10px 20px',
                            borderRadius: '25px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            fontWeight: '700',
                            fontSize: '0.9rem',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <FaTimes /> {i18n.language === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                )}
            </div>

            {/* Demo Mode Banner - Only show in demo mode */}
            {isDemoMode && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.15) 100%)',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                    borderRadius: '15px',
                    padding: '12px 16px',
                    margin: '1rem 1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.2rem' }}>🔓</span>
                            <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--luxury-gold)' }}>
                                    {i18n.language === 'ar' ? 'وضع التجربة مفعّل' : 'Demo Mode Active'}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    {i18n.language === 'ar'
                                        ? `الحساب الحالي: ${currentUser.name} (${currentUser.userRole})`
                                        : `Current: ${currentUser.name} (${currentUser.userRole})`}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Account Switcher */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => switchUserAccount('user')}
                            style={{
                                background: currentUser.userRole === 'user' ? 'var(--luxury-gold)' : 'rgba(255,255,255,0.1)',
                                color: currentUser.userRole === 'user' ? 'black' : 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '0.7rem',
                                fontWeight: '700',
                                cursor: 'pointer'
                            }}
                        >
                            👤 {i18n.language === 'ar' ? 'مستخدم عادي' : 'Regular User'}
                        </button>
                        <button
                            onClick={() => switchUserAccount('partner')}
                            style={{
                                background: currentUser.userRole === 'partner_owner' ? 'var(--luxury-gold)' : 'rgba(255,255,255,0.1)',
                                color: currentUser.userRole === 'partner_owner' ? 'black' : 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '0.7rem',
                                fontWeight: '700',
                                cursor: 'pointer'
                            }}
                        >
                            🏢 {i18n.language === 'ar' ? 'مالك منشأة' : 'Partner Owner'}
                        </button>
                        <button
                            onClick={() => switchUserAccount('admin')}
                            style={{
                                background: currentUser.userRole === 'admin' ? 'var(--luxury-gold)' : 'rgba(255,255,255,0.1)',
                                color: currentUser.userRole === 'admin' ? 'black' : 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '0.7rem',
                                fontWeight: '700',
                                cursor: 'pointer'
                            }}
                        >
                            👑 {i18n.language === 'ar' ? 'مدير' : 'Admin'}
                        </button>
                    </div>
                </div>
            )}

            {/* Content */}
            <div style={{ padding: '0 1.5rem', marginTop: '-40px', position: 'relative' }}>
                {/* Header Section */}
                <div style={{ marginBottom: '2rem' }}>
                    {isEditing ? (
                        <div style={{ marginBottom: '1rem' }}>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                style={{
                                    width: '100%',
                                    fontSize: '1.8rem',
                                    fontWeight: '900',
                                    background: 'var(--bg-card)',
                                    border: '2px solid var(--primary)',
                                    borderRadius: '12px',
                                    padding: '12px',
                                    color: 'white',
                                    marginBottom: '10px'
                                }}
                                placeholder={i18n.language === 'ar' ? 'اسم المنشأة' : 'Business Name'}
                            />
                            <input
                                type="text"
                                value={formData.type}
                                onChange={(e) => handleInputChange('type', e.target.value)}
                                style={{
                                    width: '100%',
                                    fontSize: '1rem',
                                    fontWeight: '700',
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--luxury-gold)',
                                    borderRadius: '10px',
                                    padding: '10px',
                                    color: 'var(--luxury-gold)'
                                }}
                                placeholder={i18n.language === 'ar' ? 'نوع المنشأة' : 'Business Type'}
                            />
                        </div>
                    ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h1 style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '8px' }}>
                                    {formData.name}
                                </h1>
                                <span style={{
                                    color: 'var(--luxury-gold)',
                                    fontWeight: '800',
                                    fontSize: '1rem'
                                }}>
                                    {formData.type}
                                </span>
                            </div>
                            <div style={{
                                background: 'rgba(251, 191, 36, 0.15)',
                                padding: '10px 16px',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                border: '1px solid var(--luxury-gold)'
                            }}>
                                <FaStar style={{ color: 'var(--luxury-gold)' }} />
                                <span style={{ color: 'var(--luxury-gold)', fontWeight: '900' }}>
                                    {restaurant.rating}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Description Section */}
                <div style={{
                    background: 'var(--bg-card)',
                    padding: '1.5rem',
                    borderRadius: '20px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '1.5rem'
                }}>
                    <h3 style={{
                        fontSize: '1rem',
                        fontWeight: '800',
                        marginBottom: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        📝 {i18n.language === 'ar' ? 'نبذة عن المنشأة' : 'About'}
                    </h3>
                    {isEditing ? (
                        <textarea
                            value={formData.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            style={{
                                width: '100%',
                                minHeight: '100px',
                                background: 'var(--bg-body)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                padding: '12px',
                                color: 'white',
                                fontSize: '0.95rem',
                                lineHeight: '1.6',
                                resize: 'vertical',
                                fontFamily: 'inherit'
                            }}
                            placeholder={i18n.language === 'ar' ? 'أضف وصفاً للمنشأة...' : 'Add description...'}
                        />
                    ) : (
                        <p style={{
                            fontSize: '0.95rem',
                            lineHeight: '1.7',
                            color: 'var(--text-muted)'
                        }}>
                            {formData.description || (i18n.language === 'ar' ? 'لا يوجد وصف' : 'No description available')}
                        </p>
                    )}
                </div>

                {/* Menu/Services Description */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(244, 63, 94, 0.08) 100%)',
                    padding: '1.5rem',
                    borderRadius: '20px',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    marginBottom: '1.5rem'
                }}>
                    <h3 style={{
                        fontSize: '1rem',
                        fontWeight: '800',
                        marginBottom: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <FaUtensils style={{ color: 'var(--primary)' }} />
                        {i18n.language === 'ar' ? 'المنيو / الخدمات المقدمة' : 'Menu / Services Offered'}
                    </h3>
                    {isEditing ? (
                        <textarea
                            value={formData.menuDescription}
                            onChange={(e) => handleInputChange('menuDescription', e.target.value)}
                            style={{
                                width: '100%',
                                minHeight: '120px',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--primary)',
                                borderRadius: '12px',
                                padding: '12px',
                                color: 'white',
                                fontSize: '0.95rem',
                                lineHeight: '1.6',
                                resize: 'vertical',
                                fontFamily: 'inherit'
                            }}
                            placeholder={i18n.language === 'ar'
                                ? 'مثال: برجر كلاسيك، برجر حار، سلطات، مشروبات...'
                                : 'Example: Classic Burger, Spicy Burger, Salads, Drinks...'}
                        />
                    ) : (
                        <p style={{
                            fontSize: '0.95rem',
                            lineHeight: '1.7',
                            color: 'rgba(255, 255, 255, 0.85)',
                            whiteSpace: 'pre-line'
                        }}>
                            {formData.menuDescription || (i18n.language === 'ar'
                                ? 'لم يتم إضافة وصف للمنيو أو الخدمات بعد'
                                : 'No menu or services description added yet')}
                        </p>
                    )}
                </div>

                {/* Working Hours Section */}
                <div style={{
                    background: 'var(--bg-card)',
                    padding: '1.5rem',
                    borderRadius: '20px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '1.5rem'
                }}>
                    <h3 style={{
                        fontSize: '1rem',
                        fontWeight: '800',
                        marginBottom: '1.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <FaClock style={{ color: 'var(--accent)' }} />
                        {i18n.language === 'ar' ? 'أوقات الدوام' : 'Working Hours'}
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {daysOfWeek.map(day => (
                            <div
                                key={day}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px',
                                    background: formData.workingHours[day].isOpen
                                        ? 'rgba(139, 92, 246, 0.05)'
                                        : 'rgba(100, 100, 100, 0.05)',
                                    borderRadius: '12px',
                                    border: '1px solid',
                                    borderColor: formData.workingHours[day].isOpen
                                        ? 'rgba(139, 92, 246, 0.2)'
                                        : 'rgba(100, 100, 100, 0.2)'
                                }}
                            >
                                {isEditing && (
                                    <input
                                        type="checkbox"
                                        checked={formData.workingHours[day].isOpen}
                                        onChange={(e) => handleWorkingHoursChange(day, 'isOpen', e.target.checked)}
                                        style={{
                                            width: '18px',
                                            height: '18px',
                                            cursor: 'pointer',
                                            accentColor: 'var(--primary)'
                                        }}
                                    />
                                )}

                                <div style={{
                                    flex: '0 0 90px',
                                    fontWeight: '700',
                                    fontSize: '0.9rem',
                                    color: formData.workingHours[day].isOpen ? 'white' : 'var(--text-muted)'
                                }}>
                                    {dayNames[i18n.language][day]}
                                </div>

                                {formData.workingHours[day].isOpen ? (
                                    isEditing ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                            <input
                                                type="time"
                                                value={formData.workingHours[day].open}
                                                onChange={(e) => handleWorkingHoursChange(day, 'open', e.target.value)}
                                                style={{
                                                    background: 'var(--bg-body)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '8px',
                                                    padding: '6px 10px',
                                                    color: 'white',
                                                    fontSize: '0.85rem',
                                                    flex: 1
                                                }}
                                            />
                                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                                            <input
                                                type="time"
                                                value={formData.workingHours[day].close}
                                                onChange={(e) => handleWorkingHoursChange(day, 'close', e.target.value)}
                                                style={{
                                                    background: 'var(--bg-body)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '8px',
                                                    padding: '6px 10px',
                                                    color: 'white',
                                                    fontSize: '0.85rem',
                                                    flex: 1
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div style={{
                                            fontSize: '0.85rem',
                                            color: 'var(--text-muted)',
                                            fontWeight: '600'
                                        }}>
                                            {formData.workingHours[day].open} - {formData.workingHours[day].close}
                                        </div>
                                    )
                                ) : (
                                    <div style={{
                                        fontSize: '0.85rem',
                                        color: 'var(--text-muted)',
                                        fontStyle: 'italic'
                                    }}>
                                        {i18n.language === 'ar' ? 'مغلق' : 'Closed'}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Contact Information */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1rem',
                    marginBottom: '2rem'
                }}>
                    <div style={{
                        background: 'var(--bg-card)',
                        padding: '1.2rem',
                        borderRadius: '15px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <FaPhone style={{ color: 'var(--primary)', marginBottom: '8px', fontSize: '1.2rem' }} />
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            {i18n.language === 'ar' ? 'الهاتف' : 'Phone'}
                        </div>
                        {isEditing ? (
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => handleInputChange('phone', e.target.value)}
                                style={{
                                    width: '100%',
                                    background: 'var(--bg-body)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    padding: '6px',
                                    color: 'white',
                                    fontSize: '0.8rem',
                                    fontWeight: '600'
                                }}
                            />
                        ) : (
                            <div style={{ fontSize: '0.8rem', fontWeight: '700' }}>
                                {formData.phone}
                            </div>
                        )}
                    </div>

                    <div style={{
                        background: 'var(--bg-card)',
                        padding: '1.2rem',
                        borderRadius: '15px',
                        border: '1px solid var(--border-color)'
                    }}>
                        <FaGlobe style={{ color: 'var(--accent)', marginBottom: '8px', fontSize: '1.2rem' }} />
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            {i18n.language === 'ar' ? 'الموقع الإلكتروني' : 'Website'}
                        </div>
                        {isEditing ? (
                            <input
                                type="text"
                                value={formData.website}
                                onChange={(e) => handleInputChange('website', e.target.value)}
                                style={{
                                    width: '100%',
                                    background: 'var(--bg-body)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    padding: '6px',
                                    color: 'white',
                                    fontSize: '0.8rem',
                                    fontWeight: '600'
                                }}
                            />
                        ) : (
                            <div style={{ fontSize: '0.8rem', fontWeight: '700', wordBreak: 'break-all' }}>
                                {formData.website}
                            </div>
                        )}
                    </div>
                </div>

                {/* Location */}
                <div style={{
                    background: 'var(--bg-card)',
                    padding: '1.2rem',
                    borderRadius: '15px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '2rem'
                }}>
                    <FaMapMarkerAlt style={{ color: 'var(--primary)', marginBottom: '8px', fontSize: '1.2rem' }} />
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                        {i18n.language === 'ar' ? 'الموقع' : 'Location'}
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>
                        {restaurant.location}
                    </div>

                    {/* Share Buttons - at bottom of card */}
                    <ShareButtons
                        title={formData.name}
                        description={formData.description}
                        url={window.location.href}
                        type="restaurant"
                    />
                </div>

                {/* Action Button */}
                {!isEditing && (
                    <button
                        onClick={() => navigate('/create', {
                            state: {
                                fromRestaurant: true,
                                restaurantData: {
                                    name: restaurant.name,
                                    location: restaurant.location,
                                    image: restaurant.image,
                                    lat: restaurant.lat,
                                    lng: restaurant.lng,
                                    type: restaurant.type
                                }
                            }
                        })}
                        className="btn btn-primary"
                        style={{ width: '100%', height: '55px', fontSize: '1.1rem' }}
                    >
                        {t('book_venue_btn')}
                    </button>
                )}
            </div>
        </div>
    );
};

export default PartnerProfile;
