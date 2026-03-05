import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaClock, FaEdit, FaSave, FaTimes, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import './BusinessHours.css';

const BusinessHours = ({ partnerId, businessInfo, isOwner, theme }) => {
    const { t } = useTranslation();
    const tc = theme?.colors || null;
    const th = (themed, fallback) => tc ? themed : fallback;
    const [isEditing, setIsEditing] = useState(false);
    const [hours, setHours] = useState(businessInfo?.hours || getDefaultHours());
    const [saving, setSaving] = useState(false);

    // Get today's day name for highlighting
    const todayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];

    // Get current status
    const getCurrentStatus = () => {
        if (!hours) return { isOpen: false, message: '' };

        const now = new Date();
        const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const todayHours = hours[dayName];

        if (!todayHours || todayHours.closed) {
            return {
                isOpen: false,
                message: t('closed_today', 'Closed today'),
                nextOpen: getNextOpenTime()
            };
        }

        const { open, close } = todayHours;

        // Check if currently open
        if (currentTime >= open && currentTime < close) {
            // Check if closing soon (within 30 minutes)
            const closeTime = new Date();
            const [closeHour, closeMin] = close.split(':');
            closeTime.setHours(parseInt(closeHour), parseInt(closeMin), 0);

            const timeDiff = (closeTime - now) / 1000 / 60; // minutes

            if (timeDiff <= 30 && timeDiff > 0) {
                return {
                    isOpen: true,
                    closingSoon: true,
                    message: t('closes_soon', `Closes at ${close}`)
                };
            }

            return {
                isOpen: true,
                message: t('closes_at', `Closes at ${close}`)
            };
        }

        // Check if will open today
        if (currentTime < open) {
            return {
                isOpen: false,
                message: t('opens_at', `Opens at ${open}`)
            };
        }

        // Closed for today, find next opening
        return {
            isOpen: false,
            message: t('closed_now', 'Closed'),
            nextOpen: getNextOpenTime()
        };
    };

    const getNextOpenTime = () => {
        const now = new Date();
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

        for (let i = 1; i <= 7; i++) {
            const nextDay = new Date(now);
            nextDay.setDate(now.getDate() + i);
            const dayName = days[nextDay.getDay()];
            const dayHours = hours[dayName];

            if (dayHours && !dayHours.closed) {
                const dayNames = {
                    sunday: t('sunday', 'Sunday'),
                    monday: t('monday', 'Monday'),
                    tuesday: t('tuesday', 'Tuesday'),
                    wednesday: t('wednesday', 'Wednesday'),
                    thursday: t('thursday', 'Thursday'),
                    friday: t('friday', 'Friday'),
                    saturday: t('saturday', 'Saturday')
                };

                return `${dayNames[dayName]} ${dayHours.open}`;
            }
        }
        return null;
    };

    const status = getCurrentStatus();

    const handleSave = async () => {
        setSaving(true);
        try {
            const partnerRef = doc(db, 'users', partnerId);
            await updateDoc(partnerRef, {
                'businessInfo.hours': hours
            });
            setIsEditing(false);
        } catch (error) {
            console.error('Error saving hours:', error);
            alert(t('save_error', 'Failed to save hours'));
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setHours(businessInfo?.hours || getDefaultHours());
        setIsEditing(false);
    };

    const handleDayChange = (day, field, value) => {
        setHours(prev => ({
            ...prev,
            [day]: {
                ...prev[day],
                [field]: value
            }
        }));
    };

    const toggleDayClosed = (day) => {
        setHours(prev => ({
            ...prev,
            [day]: {
                ...prev[day],
                closed: !prev[day]?.closed
            }
        }));
    };

    return (
        <div className="business-hours-section" style={{ background: th(tc?.cardBg, undefined) }}>
            <div className="section-header">
                <h3 style={{ color: th(tc?.accent, undefined) }}>
                    <FaClock style={{ color: th(tc?.accent, '#3b82f6'), marginRight: '0.5rem' }} />
                    {t('business_hours', 'Business Hours')}
                </h3>
                {isOwner && !isEditing && (
                    <button
                        className="edit-hours-btn"
                        onClick={() => setIsEditing(true)}
                        style={tc ? {
                            background: tc.footerBg,
                            border: `1px solid ${tc.border}`,
                            color: tc.accentText || '#fff',
                            boxShadow: tc.btnShadow,
                            borderRadius: tc.btnBorderRadius
                        } : {}}
                    >
                        <FaEdit /> {t('edit', 'Edit')}
                    </button>
                )}
            </div>

            {/* Live Status Badge */}
            <div
                className={`status-badge ${status.isOpen ? 'open' : 'closed'} ${status.closingSoon ? 'closing-soon' : ''}`}
                style={tc ? {
                    border: `1px solid ${status.isOpen ? tc.accent : tc.border}`,
                    background: status.isOpen ? tc.badgeBg : 'rgba(239,68,68,0.1)',
                    color: status.isOpen ? tc.accent : '#ef4444',
                    boxShadow: status.isOpen ? `0 0 12px ${tc.accent}44` : undefined
                } : {}}
            >
                {status.isOpen ? (
                    <>
                        <FaCheckCircle />
                        <span className="status-text">{t('open_now', 'OPEN NOW')}</span>
                    </>
                ) : (
                    <>
                        <FaTimesCircle />
                        <span className="status-text">{t('closed', 'CLOSED')}</span>
                    </>
                )}
                <span className="status-message">{status.message}</span>
            </div>

            {status.nextOpen && !status.isOpen && (
                <div className="next-open-info">
                    {t('opens_next', 'Opens next:')} {status.nextOpen}
                </div>
            )}

            {/* Hours Display/Edit */}
            {isEditing ? (
                <div className="hours-edit-form">
                    {Object.entries(hours).map(([day, dayHours]) => (
                        <div key={day} className="day-row">
                            <div className="day-name">
                                {t(day, day.charAt(0).toUpperCase() + day.slice(1))}
                            </div>
                            <div className="day-controls">
                                <label className="closed-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={dayHours?.closed || false}
                                        onChange={() => toggleDayClosed(day)}
                                    />
                                    {t('closed', 'Closed')}
                                </label>
                                {!dayHours?.closed && (
                                    <>
                                        <input
                                            type="time"
                                            value={dayHours?.open || '09:00'}
                                            onChange={(e) => handleDayChange(day, 'open', e.target.value)}
                                            className="time-input"
                                        />
                                        <span>-</span>
                                        <input
                                            type="time"
                                            value={dayHours?.close || '22:00'}
                                            onChange={(e) => handleDayChange(day, 'close', e.target.value)}
                                            className="time-input"
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                    <div className="edit-actions">
                        <button
                            onClick={handleSave}
                            className="save-btn"
                            disabled={saving}
                            style={tc ? {
                                background: tc.footerBg,
                                border: `1px solid ${tc.border}`,
                                color: tc.accentText || '#fff',
                                boxShadow: tc.btnShadow,
                                borderRadius: tc.btnBorderRadius
                            } : {}}
                        >
                            <FaSave /> {saving ? t('saving', 'Saving...') : t('save', 'Save')}
                        </button>
                        <button
                            onClick={handleCancel}
                            className="cancel-btn"
                            disabled={saving}
                            style={tc ? {
                                background: tc.badgeBg,
                                border: `1px solid ${tc.border}`,
                                color: tc.accent
                            } : {}}
                        >
                            <FaTimes /> {t('cancel', 'Cancel')}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="hours-display">
                    {Object.entries(hours).map(([day, dayHours]) => {
                        const isToday = day === todayKey;
                        return (
                            <div
                                key={day}
                                className="day-row"
                                style={tc ? {
                                    background: isToday ? tc.badgeBg : 'transparent',
                                    borderLeft: isToday ? `3px solid ${tc.accent}` : '3px solid transparent',
                                    borderRadius: isToday ? '8px' : undefined,
                                    paddingLeft: '8px'
                                } : {}}
                            >
                                <div className="day-name" style={isToday && tc ? { color: tc.accent, fontWeight: '800' } : {}}>
                                    {t(day, day.charAt(0).toUpperCase() + day.slice(1))}
                                </div>
                                <div className="day-hours">
                                    {dayHours?.closed ? (
                                        <span className="closed-text">{t('closed', 'Closed')}</span>
                                    ) : (
                                        <span style={{ color: th(tc?.accent, undefined) }}>{dayHours?.open || '09:00'} - {dayHours?.close || '22:00'}</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// Default hours helper
function getDefaultHours() {
    return {
        monday: { open: '09:00', close: '22:00', closed: false },
        tuesday: { open: '09:00', close: '22:00', closed: false },
        wednesday: { open: '09:00', close: '22:00', closed: false },
        thursday: { open: '09:00', close: '22:00', closed: false },
        friday: { open: '09:00', close: '23:00', closed: false },
        saturday: { open: '09:00', close: '23:00', closed: false },
        sunday: { open: '10:00', close: '22:00', closed: false }
    };
}

export default BusinessHours;
