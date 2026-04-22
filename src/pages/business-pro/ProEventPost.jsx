import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { collection, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useToast } from '../../context/ToastContext';
import { FaSave, FaEye, FaImage, FaMapMarkerAlt, FaCalendarAlt, FaLink, FaAlignLeft, FaClock } from 'react-icons/fa';
import { uploadImage } from '../../utils/imageUpload';
import { getSafeAvatar } from '../../utils/avatarUtils';
import LocationAutocomplete from '../../components/LocationAutocomplete';

export default function ProEventPost({ editingEvent, onBack, onSuccess }) {
    const { currentUser, userProfile } = useAuth();
    const { showToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const imageInputRef = useRef(null);
    const [previewKey, setPreviewKey] = useState(0);

    const [eventData, setEventData] = useState({
        title: '',
        description: '',
        location: '',
        coordinates: null,
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        actionLink: '',
        imageUrl: null
    });

    useEffect(() => {
        if (editingEvent?.eventDetails) {
            setEventData({
                title: editingEvent.eventDetails.title || '',
                description: editingEvent.eventDetails.description || '',
                location: editingEvent.eventDetails.location || '',
                coordinates: editingEvent.eventDetails.coordinates || null,
                startDate: editingEvent.eventDetails.startDate || '',
                startTime: editingEvent.eventDetails.startTime || '',
                endDate: editingEvent.eventDetails.endDate || '',
                endTime: editingEvent.eventDetails.endTime || '',
                actionLink: editingEvent.eventDetails.actionLink || '',
                imageUrl: editingEvent.eventDetails.imageUrl || null
            });
        }
    }, [editingEvent]);

    const updateField = (field, value) => {
        setEventData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async (status) => {
        if (!currentUser?.uid) { showToast('Please sign in', 'error'); return; }
        if (!eventData.title || !eventData.startDate || !eventData.description) {
            showToast('Please fill in the title, date, and description.', 'error');
            return;
        }

        setSaving(true);
        try {
            const businessName = userProfile?.businessInfo?.businessName || userProfile?.display_name || 'Business';
            const businessLogoUrl = userProfile?.businessInfo?.logoImage || userProfile?.photo_url || null;

            const payload = {
                type: 'event',
                partnerId: currentUser.uid,
                businessName,
                businessLogoUrl,
                status,
                eventDetails: {
                    title: eventData.title,
                    description: eventData.description,
                    location: eventData.location,
                    coordinates: eventData.coordinates,
                    startDate: eventData.startDate,
                    startTime: eventData.startTime,
                    endDate: eventData.endDate,
                    endTime: eventData.endTime,
                    actionLink: eventData.actionLink,
                    imageUrl: eventData.imageUrl
                },
                updatedAt: serverTimestamp(),
            };

            if (editingEvent?.id) {
                if (status === 'published' && editingEvent.status !== 'published') {
                    payload.publishedAt = serverTimestamp();
                }
                await updateDoc(doc(db, 'communityPosts', editingEvent.id), payload);
            } else {
                payload.createdAt = serverTimestamp();
                payload.publishedAt = status === 'published' ? serverTimestamp() : null;
                payload.likes = [];
                payload.comments = 0;
                await addDoc(collection(db, 'communityPosts'), payload);
            }
            
            showToast(status === 'published' ? 'Event Published to Feed!' : 'Event Saved as draft', 'success');
            setEventData({ title: '', description: '', location: '', coordinates: null, startDate: '', startTime: '', endDate: '', endTime: '', actionLink: '', imageUrl: null });
            if (onSuccess) onSuccess();
        } catch (e) {
            console.error(e);
            showToast(e?.message || 'Failed to publish event', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target?.files?.[0];
        if (!file || !currentUser?.uid) return;
        setUploadingImage(true);
        try {
            const path = `community-posts/${currentUser.uid}/event_cover_${Date.now()}.jpg`;
            const url = await uploadImage(file, path, null, { maxSizeMB: 2, maxWidthOrHeight: 1200 });
            updateField('imageUrl', url);
        } catch (err) {
            console.error(err);
            showToast('Image upload failed', 'error');
        } finally {
            setUploadingImage(false);
            if (imageInputRef.current) imageInputRef.current.value = '';
        }
    };

    // Derived Preview Formats
    let previewDateStr = 'MMM DD, YYYY';
    let previewMonth = 'MON';
    let previewDay = 'DD';
    if (eventData.startDate) {
        try {
            const d = new Date(eventData.startDate);
            previewDateStr = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
            previewMonth = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
            previewDay = d.toLocaleDateString('en-US', { day: '2-digit' });
        } catch(e) {}
    }
    const previewTimeStr = eventData.startTime ? eventData.startTime : 'Time TBD';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            {/* Toolbar */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    {(onBack || onSuccess) && (
                        <button type="button" className="ui-btn ui-btn--secondary" style={{ padding: '6px 12px' }} onClick={onBack || onSuccess}>
                            ← Back
                        </button>
                    )}
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
                        📅 {editingEvent ? 'Edit Event Post' : 'New Event Post'}
                    </span>
                </div>
                <button type="button" className="ui-btn ui-btn--secondary" onClick={() => handleSave('draft')} disabled={saving} style={{ borderColor: 'rgba(167,139,250,0.4)', color: 'rgba(167,139,250,0.9)' }}>
                    <FaSave /> {saving ? '…' : 'Save draft'}
                </button>
                <button type="button" className="ui-btn ui-btn--primary" onClick={() => handleSave('published')} disabled={saving}>
                    <FaSave /> {saving ? 'Saving…' : 'Publish Event'}
                </button>
            </div>

            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexWrap: 'wrap' }}>
                {/* Editor Inputs (Left) */}
                <div style={{ flex: '1 1 380px', minWidth: 320, overflowY: 'auto', borderRight: '1px solid var(--border)', background: 'var(--bg-base)', padding: 24 }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1f5f9', marginBottom: 20 }}>Event Details</h3>
                    
                    {/* Cover Image */}
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: '#a78bfa', marginBottom: 8 }}>
                            <FaImage /> COVER IMAGE
                        </label>
                        <div 
                            style={{ width: '100%', height: 160, borderRadius: 12, border: '2px dashed var(--border)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}
                            onClick={() => !uploadingImage && imageInputRef.current?.click()}
                        >
                            {eventData.imageUrl ? (
                                <img src={eventData.imageUrl} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <>
                                    <FaImage style={{ fontSize: '2rem', color: 'rgba(255,255,255,0.2)', marginBottom: 8 }} />
                                    <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>Click to upload</span>
                                </>
                            )}
                            {uploadingImage && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>
                                    Uploading...
                                </div>
                            )}
                        </div>
                        <input type="file" ref={imageInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                    </div>

                    {/* Title */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Event Title *</label>
                        <input type="text" placeholder="e.g. Grand Opening Party" value={eventData.title} onChange={e => updateField('title', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text-main)', border: '1px solid var(--border)', boxSizing: 'border-box' }} />
                    </div>

                    {/* Description */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}><FaAlignLeft /> Description *</label>
                        <textarea placeholder="Tell people what the event is about..." value={eventData.description} onChange={e => updateField('description', e.target.value)} rows={4}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text-main)', border: '1px solid var(--border)', boxSizing: 'border-box', resize: 'vertical' }} />
                    </div>

                    {/* Date & Time */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}><FaCalendarAlt /> Date *</label>
                            <input type="date" value={eventData.startDate} onChange={e => updateField('startDate', e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text-main)', border: '1px solid var(--border)', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}><FaClock /> Time</label>
                            <input type="time" value={eventData.startTime} onChange={e => updateField('startTime', e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text-main)', border: '1px solid var(--border)', boxSizing: 'border-box' }} />
                        </div>
                    </div>

                    {/* Location */}
                    <div className="venue-search-stack" style={{ marginBottom: 16 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}><FaMapMarkerAlt /> Location</label>
                        <div style={{ position: 'relative' }}>
                            <LocationAutocomplete
                                value={eventData.location}
                                onChange={e => updateField('location', e.target.value)}
                                onSelect={place => {
                                    updateField('location', place.name || place.fullAddress);
                                    updateField('coordinates', { lat: place.lat, lng: place.lng });
                                }}
                                className="event-location-input"
                                // Note: we purposely do NOT pass city/countryCode to allow global search
                            />
                        </div>
                    </div>

                    {/* Action Link */}
                    <div style={{ marginBottom: 30 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}><FaLink /> Action Link (Optional)</label>
                        <input type="url" placeholder="e.g. Eventbrite or booking link" value={eventData.actionLink} onChange={e => updateField('actionLink', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text-main)', border: '1px solid var(--border)', boxSizing: 'border-box' }} />
                    </div>
                </div>

                {/* Live Preview (Right) */}
                <div style={{ flex: '0 0 400px', minWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', background: '#0f0f13', overflowY: 'auto' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Live App Preview</div>
                    
                    {/* Mockup Feed Card */}
                    <div style={{ width: '100%', maxWidth: 360, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderBottom: '1px solid var(--border)' }}>
                            <img src={getSafeAvatar(userProfile)} alt="avatar" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>{userProfile?.businessInfo?.businessName || userProfile?.display_name || 'Business'}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Just now</div>
                            </div>
                        </div>

                        {/* Event Photo with overlay */}
                        <div style={{ position: 'relative', width: '100%', height: 200, background: '#1a1a24' }}>
                            {eventData.imageUrl ? (
                                <img src={eventData.imageUrl} alt="Event" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.1)' }}>
                                    <FaImage size={48} />
                                </div>
                            )}
                            
                            {/* Date Badge Overlay */}
                            <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', borderRadius: 12, padding: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase' }}>
                                    {previewMonth}
                                </div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                                    {previewDay}
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div style={{ padding: 16 }}>
                            <div style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 6, background: 'rgba(167,139,250,0.15)', color: '#a78bfa', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                                🎟️ UPCOMING EVENT
                            </div>
                            <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px 0', lineHeight: 1.3 }}>
                                {eventData.title || 'Event Title Goes Here'}
                            </h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {eventData.description || 'Description of the event will be displayed here...'}
                            </p>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-main)' }}>
                                    <FaCalendarAlt style={{ color: '#a78bfa' }} />
                                    <span>{previewDateStr} • {previewTimeStr}</span>
                                </div>
                                {eventData.location && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-main)' }}>
                                        <FaMapMarkerAlt style={{ color: '#a78bfa' }} />
                                        <span>{eventData.location}</span>
                                    </div>
                                )}
                            </div>

                            {eventData.actionLink && (
                                <button style={{ width: '100%', marginTop: 12, padding: 12, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
                                    View Event Details
                                </button>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
