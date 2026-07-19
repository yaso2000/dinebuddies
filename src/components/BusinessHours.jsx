import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaClock, FaEdit, FaSave, FaTimes, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useToast } from '../context/ToastContext';
import { syncBusinessPublicProfile } from '../services/businessPublicProfileSync';
import {
  getBusinessLocalClock,
  isOpenFromBusinessHours,
  resolveBusinessTimeZone,
} from '../utils/businessLocalTime';
import './BusinessHours.css';
import { AppText } from "./base";

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function minutesUntilClose(timeHm, closeHm) {
  const [h, m] = String(timeHm || '00:00').split(':').map(Number);
  const [ch, cm] = String(closeHm || '00:00').split(':').map(Number);
  let nowM = h * 60 + m;
  let closeM = ch * 60 + cm;
  // Overnight: close is after midnight relative to now
  if (closeM <= nowM) closeM += 24 * 60;
  return closeM - nowM;
}

const BusinessHours = ({ businessId, businessInfo, isOwner, theme }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const tc = theme?.colors || null;
  const th = (themed, fallback) => tc ? themed : fallback;
  const [isEditing, setIsEditing] = useState(false);
  const [hours, setHours] = useState(businessInfo?.hours || getDefaultHours());
  const [saving, setSaving] = useState(false);

  const locationOpts = {
    lat: businessInfo?.lat,
    lng: businessInfo?.lng,
    countryCode: businessInfo?.countryCode,
    country: businessInfo?.country,
    timeZone: businessInfo?.timeZone || businessInfo?.timezone,
  };
  const businessTimeZone = resolveBusinessTimeZone(locationOpts);
  const localClock = getBusinessLocalClock(new Date(), businessTimeZone);
  const todayKey = localClock.dayKey;

  // Get current status — same overnight + timezone rules as directory cards
  const getCurrentStatus = () => {
    if (!hours) return { isOpen: false, message: '' };

    const dayName = localClock.dayKey;
    const currentTime = localClock.timeHm;
    const todayHours = hours[dayName];
    const closesAtMessage = (time) => `${t('closes_at', 'Closes at')} ${time}`.trim();
    const opensAtMessage = (time) => `${t('opens_at', 'Opens at')} ${time}`.trim();

    const openNow = isOpenFromBusinessHours(hours, locationOpts);

    if (!todayHours || todayHours.closed) {
      return {
        isOpen: false,
        message: t('closed_today', 'Closed today'),
        nextOpen: getNextOpenTime()
      };
    }

    const { open, close } = todayHours;

    if (openNow === true) {
      const minsLeft = minutesUntilClose(currentTime, close);
      if (minsLeft <= 30 && minsLeft > 0) {
        return {
          isOpen: true,
          closingSoon: true,
          message: closesAtMessage(close)
        };
      }
      return {
        isOpen: true,
        message: closesAtMessage(close)
      };
    }

    // Not open now — if still before today's open (same calendar day, non-overnight window)
    if (close > open && currentTime < open) {
      return {
        isOpen: false,
        message: opensAtMessage(open)
      };
    }

    return {
      isOpen: false,
      message: t('closed_now', 'Closed'),
      nextOpen: getNextOpenTime()
    };
  };

  const getNextOpenTime = () => {
    const dayNames = {
      sunday: t('sunday', 'Sunday'),
      monday: t('monday', 'Monday'),
      tuesday: t('tuesday', 'Tuesday'),
      wednesday: t('wednesday', 'Wednesday'),
      thursday: t('thursday', 'Thursday'),
      friday: t('friday', 'Friday'),
      saturday: t('saturday', 'Saturday')
    };

    const startIdx = DAY_KEYS.indexOf(localClock.dayKey);
    for (let i = 1; i <= 7; i++) {
      const dayName = DAY_KEYS[(startIdx + i) % 7];
      const dayHours = hours[dayName];
      if (dayHours && !dayHours.closed && dayHours.open) {
        return `${dayNames[dayName]} ${dayHours.open}`;
      }
    }
    return null;
  };

  const status = getCurrentStatus();

  // Visitor: do not show section at all if hours were never set
  if (!isOwner && !businessInfo?.hours) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const businessRef = doc(db, 'users', businessId);
      await updateDoc(businessRef, {
        'businessInfo.hours': hours
      });
      // Mirror into public_profiles so directory cards use the same schedule.
      try {
        await syncBusinessPublicProfile(businessId);
      } catch (syncErr) {
        console.warn('[BusinessHours] public profile sync after hours save', syncErr);
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving hours:', error);
      showToast(t('save_error', 'Failed to save hours'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setHours(businessInfo?.hours || getDefaultHours());
    setIsEditing(false);
  };

  const handleDayChange = (day, field, value) => {
    setHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const toggleDayClosed = (day) => {
    setHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        closed: !prev[day]?.closed
      }
    }));
  };

  return (
    <div className="business-hours-section" style={{ background: 'var(--bg-card)' }}>
            <div className="section-header">
                <AppText as="h3" style={{ color: 'var(--text-main)' }}>
                    <FaClock style={{ color: 'var(--primary)', marginRight: '0.5rem' }} />
                    {t('business_hours', 'Business Hours')}
                </AppText>
                {isOwner && !isEditing &&
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <AppText as="span" title="Free Feature" style={{
            fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px',
            borderRadius: 20, border: '1px solid #22c55e',
            color: '#4ade80', background: 'rgba(34,197,94,0.12)',
            display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap'
          }}>🆓 Free</AppText>
                        <button
            className="edit-hours-btn"
            onClick={() => setIsEditing(true)}
            style={tc ? {
              background: tc.footerBg,
              border: `1px solid ${tc.border}`,
              color: tc.accentText || '#fff',
              boxShadow: tc.btnShadow,
              borderRadius: tc.btnBorderRadius
            } : {}}>
            
                            <FaEdit /> {t('edit', 'Edit')}
                        </button>
                    </div>
        }
            </div>

            {/* Live Status Badge */}
            <div
        className={`status-badge ${status.isOpen ? 'open' : 'closed'} ${status.closingSoon ? 'closing-soon' : ''}`}
        style={tc ? {
          border: `1px solid ${status.isOpen ? tc.accent : tc.border}`,
          background: status.isOpen ? tc.badgeBg : 'rgba(239,68,68,0.1)',
          color: status.isOpen ? tc.accent : '#ef4444',
          boxShadow: status.isOpen ? `0 0 12px ${tc.accent}44` : undefined
        } : {}}>
        
                {status.isOpen ?
        <>
                        <FaCheckCircle />
                        <AppText as="span" className="status-text">{t('open_now', 'OPEN NOW')}</AppText>
                    </> :

        <>
                        <FaTimesCircle />
                        <AppText as="span" className="status-text">{t('closed', 'CLOSED')}</AppText>
                    </>
        }
                <AppText as="span" className="status-message">{status.message}</AppText>
            </div>

            {status.nextOpen && !status.isOpen &&
      <div className="next-open-info">
                    {t('opens_next', 'Opens next:')} {status.nextOpen}
                </div>
      }

            {/* Hours Display/Edit */}
            {isEditing ?
      <div className="hours-edit-form">
                    {Object.entries(hours).map(([day, dayHours]) =>
        <div key={day} className="day-row">
                            <div className="day-name">
                                {t(day, day.charAt(0).toUpperCase() + day.slice(1))}
                            </div>
                            <div className="day-controls">
                                <label className="closed-checkbox">
                                    <input
                type="checkbox"
                checked={dayHours?.closed || false}
                onChange={() => toggleDayClosed(day)} />
              
                                    {t('closed', 'Closed')}
                                </label>
                                {!dayHours?.closed &&
            <>
                                        <input
                type="time"
                value={dayHours?.open || '09:00'}
                onChange={(e) => handleDayChange(day, 'open', e.target.value)}
                className="time-input" />
              
                                        <AppText as="span">-</AppText>
                                        <input
                type="time"
                value={dayHours?.close || '22:00'}
                onChange={(e) => handleDayChange(day, 'close', e.target.value)}
                className="time-input" />
              
                                    </>
            }
                            </div>
                        </div>
        )}
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
            } : {}}>
            
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
            } : {}}>
            
                            <FaTimes /> {t('cancel', 'Cancel')}
                        </button>
                    </div>
                </div> :

      <div className="hours-display">
                    {Object.entries(hours).map(([day, dayHours]) => {
          const isToday = day === todayKey;
          return (
            <div
              key={day}
              className="day-row"
              style={isToday && tc ? {
                background: tc.badgeBg || 'var(--hover-overlay)',
                borderLeft: `3px solid ${tc.accent || 'var(--primary)'}`,
                borderRadius: '8px',
                paddingLeft: '8px'
              } : {}}>
              
                                <div className="day-name" style={{ color: 'var(--text-main)', fontWeight: isToday ? '800' : '600' }}>
                                    {t(day, day.charAt(0).toUpperCase() + day.slice(1))}
                                </div>
                                <div className="day-hours" style={{ color: 'var(--text-secondary)' }}>
                                    {dayHours?.closed ?
                <AppText as="span" className="closed-text">{t('closed', 'Closed')}</AppText> :

                <AppText as="span" style={{ color: 'var(--text-main)' }}>{dayHours?.open || '09:00'} - {dayHours?.close || '22:00'}</AppText>
                }
                                </div>
                            </div>);

        })}
                </div>
      }
        </div>);

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