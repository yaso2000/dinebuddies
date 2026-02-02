import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowRight, FaPaperPlane, FaCheck, FaTimes, FaUsers, FaMapMarkerAlt, FaCalendarAlt, FaClock, FaShareAlt, FaEdit, FaCheckCircle, FaStar } from 'react-icons/fa';

import { useInvitations } from '../context/InvitationContext';
import { useTranslation } from 'react-i18next';
import ShareButtons from '../components/ShareButtons';
import { updateInvitationDateTime, getInvitationEditStatus } from '../utils/invitationValidation';
import { db } from '../firebase/config';
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';

const InvitationDetails = () => {
    const { t, i18n } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();

    const { invitations, currentUser, loadingInvitations, approveUser, rejectUser, sendChatMessage, updateMeetingStatus, approveNewTime, rejectNewTime, toggleFollow, submitRating, requestToJoin, cancelRequest } = useInvitations();
    const [message, setMessage] = useState('');
    const [groupChatMessages, setGroupChatMessages] = useState([]);
    const [userLocation, setUserLocation] = useState(null);
    const [requestersData, setRequestersData] = useState({});
    const chatEndRef = useRef(null);

    const invitation = invitations.find(inv => inv.id === id);

    // Calculate distance between two points (Haversine formula)
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    };

    // Get user location
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    console.log('Location access denied:', error);
                }
            );
        }
    }, []);

    // Calculate distance and travel time
    const distance = userLocation && invitation?.lat && invitation?.lng
        ? calculateDistance(userLocation.lat, userLocation.lng, invitation.lat, invitation.lng)
        : null;
    const travelTime = distance ? Math.round((distance / 40) * 60) : null;

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [invitation?.chat]);

    // Fetch requesters data
    useEffect(() => {
        const fetchRequestersData = async () => {
            if (!invitation?.requests || invitation.requests.length === 0) {
                setRequestersData({});
                return;
            }

            const data = {};
            for (const userId of invitation.requests) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', userId));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        data[userId] = {
                            name: userData.display_name || userData.name || 'User',
                            avatar: userData.photo_url || userData.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + userId
                        };
                    }
                } catch (error) {
                    console.error('Error fetching requester data:', error);
                }
            }
            setRequestersData(data);
        };

        fetchRequestersData();
    }, [invitation?.requests]);

    // Fetch joined members data
    const [joinedMembersData, setJoinedMembersData] = useState({});

    useEffect(() => {
        const fetchJoinedMembersData = async () => {
            if (!invitation?.joined || invitation.joined.length === 0) {
                setJoinedMembersData({});
                return;
            }

            const data = {};
            for (const userId of invitation.joined) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', userId));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        data[userId] = {
                            name: userData.display_name || userData.name || 'User',
                            avatar: userData.photo_url || userData.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + userId
                        };
                    }
                } catch (error) {
                    console.error('Error fetching joined member data:', error);
                }
            }
            setJoinedMembersData(data);
        };

        fetchJoinedMembersData();
    }, [invitation?.joined]);

    // Real-time listener for group chat messages
    useEffect(() => {
        if (!id) return;

        const messagesRef = collection(db, 'invitations', id, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const messages = [];
            snapshot.forEach((doc) => {
                messages.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            setGroupChatMessages(messages);
        }, (error) => {
            console.error('Error listening to messages:', error);
        });

        return () => unsubscribe();
    }, [id]);

    // Scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom();
    }, [groupChatMessages]);

    // Handle sending group chat message
    const handleSendGroupMessage = async (e) => {
        e.preventDefault();

        console.log('Sending message...', { message, currentUser });

        if (!message.trim()) {
            console.log('Message is empty');
            return;
        }

        if (!currentUser?.id) {
            console.log('No current user');
            return;
        }

        try {
            const messagesRef = collection(db, 'invitations', id, 'messages');
            const newMessage = {
                text: message.trim(),
                senderId: currentUser.id,
                senderName: currentUser.display_name || currentUser.name || 'User',
                senderAvatar: currentUser.photo_url || currentUser.avatar || '',
                createdAt: serverTimestamp()
            };

            console.log('Adding message to Firestore:', newMessage);
            await addDoc(messagesRef, newMessage);
            console.log('Message sent successfully!');
            setMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message: ' + error.message);
        }
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: invitation?.title || '',
                text: invitation?.description || '',
                url: window.location.href,
            }).catch(console.error);
        } else {
            // Fallback: Copy to clipboard
            navigator.clipboard.writeText(window.location.href);
            alert(t('link_copied'));
        }
    };

    // Show loading while invitations are being fetched from Firebase
    if (loadingInvitations) {
        return (
            <div className="page-container" style={{
                padding: '2rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh'
            }}>
                <div style={{
                    width: '50px',
                    height: '50px',
                    border: '4px solid var(--border-color)',
                    borderTop: '4px solid var(--primary)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }}></div>
                <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
                    {t('loading')}
                </p>
            </div>
        );
    }

    // After loading, if invitation is not found, show error
    if (!invitation) {
        return (
            <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}>
                <h2 style={{ marginBottom: '1rem' }}>{t('invitation_not_found')}</h2>
                <button onClick={() => navigate('/')} className="btn btn-primary">{t('nav_home')}</button>
            </div>
        );
    }

    const { author = {}, title, requests = [], joined = [], chat = [], image, location, date, time, description, guestsNeeded, meetingStatus = 'planning', genderPreference, ageRange } = invitation;
    const isHost = author?.id === currentUser?.id;
    const isAccepted = joined.includes(currentUser.id);
    const isPending = requests.includes(currentUser.id);
    const spotsLeft = guestsNeeded - joined.length;

    // Check eligibility based on gender and age
    const checkEligibility = () => {
        // Check gender preference
        if (genderPreference && genderPreference !== 'any' && currentUser.gender !== genderPreference) {
            return { eligible: false, reason: t('gender_mismatch') };
        }

        // Check age range preference
        if (ageRange && currentUser.age) {
            const [minAge, maxAge] = ageRange.split('-').map(Number);
            const userAge = currentUser.age;
            if (userAge < minAge || userAge > maxAge) {
                return { eligible: false, reason: `${t('age_range_preference')}: ${ageRange}` };
            }
        }

        return { eligible: true };
    };
    const eligibility = checkEligibility();

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!message.trim()) return;
        sendChatMessage(id, message);
        setMessage('');
    };


    return (
        <div className="page-container details-page" style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
            {/* Elegant Header */}
            <header className="app-header sticky-header-glass" style={{ position: 'sticky', top: 0, zIndex: 100, padding: '0 1rem', flexShrink: 0 }}>
                <button className="back-btn" onClick={() => navigate('/')} aria-label="Go back">
                    <FaArrowRight style={i18n.language === 'ar' ? {} : { transform: 'rotate(180deg)' }} />
                </button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px', margin: '0 auto' }}>{title}</h3>
                    <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '700' }}>
                        {isHost ? t('manage_invitation') : (isAccepted ? t('comments_title') : t('invitation_details'))}
                    </span>
                </div>
                <button className="back-btn" onClick={handleShare} aria-label="Share" style={{ background: 'transparent', border: 'none' }}>
                    <FaShareAlt style={{ color: 'var(--text-white)', opacity: 0.8 }} />
                </button>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '100px' }} className="details-scroll-area">
                {/* Invitation Summary Section - PUBLIC */}
                <div style={{ padding: '1.25rem' }}>
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                        border: '1px solid var(--border-color)',
                        boxShadow: 'var(--shadow-premium)'
                    }}>
                        <div style={{ height: '180px', position: 'relative' }}>
                            <img src={image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, var(--bg-card))' }}></div>
                        </div>
                        <div style={{ padding: '1.25rem', marginTop: '-50px', position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: '900' }}>{title}</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                    <div style={{ background: 'var(--primary)', color: 'white', padding: '4px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.7rem', fontWeight: '800' }}>
                                        {t(`type_${invitation.type?.toLowerCase().replace(/ /g, '_')}`, { defaultValue: invitation.type || 'Other' })}
                                    </div>
                                    {!isHost && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleFollow(author.id); }}
                                            style={{
                                                background: currentUser.following.includes(author.id) ? 'transparent' : 'rgba(255,255,255,0.1)',
                                                border: `1px solid ${currentUser.following.includes(author.id) ? 'var(--primary)' : 'rgba(255,255,255,0.3)'}`,
                                                color: 'white',
                                                padding: '4px 10px',
                                                borderRadius: '8px',
                                                fontSize: '0.65rem',
                                                fontWeight: '800',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {currentUser.following.includes(author.id)
                                                ? t('following_user')
                                                : t('follow_user')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Meeting Journey Timeline */}
                            {(isHost || isAccepted || (invitation.pendingChangeApproval && invitation.pendingChangeApproval.includes(currentUser.id))) && (
                                <div style={{
                                    background: 'rgba(30, 41, 59, 0.4)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '1rem',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    marginBottom: '1.5rem',
                                    position: 'relative'
                                }}>
                                    {/* NEW: Time Change Approval Bar */}
                                    {invitation.pendingChangeApproval && invitation.pendingChangeApproval.includes(currentUser.id) && (
                                        <div style={{ background: 'var(--primary)', padding: '12px', borderRadius: '12px', marginBottom: '1rem', animation: 'pulse 2s infinite' }}>
                                            <p style={{ fontSize: '0.8rem', fontWeight: '800', color: 'white', marginBottom: '8px' }}>{t('time_change_warning')}</p>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={() => approveNewTime(id)} style={{ flex: 1, padding: '6px', background: 'white', color: 'var(--primary)', border: 'none', borderRadius: '6px', fontWeight: '800', fontSize: '0.75rem' }}>{t('approve_time')}</button>
                                                <button onClick={() => rejectNewTime(id)} style={{ flex: 1, padding: '6px', background: 'rgba(0,0,0,0.2)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', fontSize: '0.75rem' }}>{t('withdraw')}</button>
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', paddingBottom: '5px' }}>
                                        {/* Horizontal Background Line */}
                                        <div style={{ position: 'absolute', top: '15px', left: '10%', right: '10%', height: '2px', background: 'rgba(255,255,255,0.1)', zIndex: 1 }}></div>
                                        {/* Active Progress Line */}
                                        <div style={{
                                            position: 'absolute', top: '15px', left: '10%',
                                            width: meetingStatus === 'planning' ? '0%' : (meetingStatus === 'on_way' ? '40%' : '80%'),
                                            height: '2px', background: 'var(--primary)', boxShadow: '0 0 8px var(--primary)', zIndex: 2, transition: 'width 0.8s ease'
                                        }}></div>

                                        <div style={{ textAlign: 'center', zIndex: 5, flex: 1 }}>
                                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', margin: '0 auto 5px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🖊️</div>
                                            <span style={{ fontSize: '0.6rem', fontWeight: '800', color: 'white' }}>{t('status_planning')}</span>
                                        </div>
                                        <div style={{ textAlign: 'center', zIndex: 5, flex: 1 }}>
                                            <div style={{
                                                width: '28px', height: '28px', borderRadius: '50%', margin: '0 auto 5px',
                                                background: meetingStatus === 'on_way' || meetingStatus === 'arrived' || meetingStatus === 'completed' ? 'var(--primary)' : 'var(--bg-card)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', fontSize: '1rem'
                                            }}>🚗</div>
                                            <span style={{ fontSize: '0.6rem', fontWeight: '800', color: meetingStatus === 'on_way' ? 'var(--primary)' : 'var(--text-muted)' }}>{t('status_on_way')}</span>
                                        </div>
                                        <div style={{ textAlign: 'center', zIndex: 5, flex: 1 }}>
                                            <div style={{
                                                width: '28px', height: '28px', borderRadius: '50%', margin: '0 auto 5px',
                                                background: meetingStatus === 'arrived' || meetingStatus === 'completed' ? 'var(--primary)' : 'var(--bg-card)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', fontSize: '1rem'
                                            }}>📍</div>
                                            <span style={{ fontSize: '0.6rem', fontWeight: '800', color: meetingStatus === 'arrived' ? 'var(--primary)' : 'var(--text-muted)' }}>{t('status_arrived')}</span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '1rem', flexWrap: 'wrap' }}>
                                        {isAccepted && meetingStatus === 'planning' && (
                                            <button onClick={() => updateMeetingStatus(id, 'on_way')} className="btn btn-primary" style={{ flex: 1, padding: '8px', fontSize: '0.75rem', borderRadius: '8px' }}>
                                                {t('im_on_way')}
                                            </button>
                                        )}
                                        {isAccepted && meetingStatus === 'on_way' && (
                                            <button onClick={() => updateMeetingStatus(id, 'arrived')} className="btn btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '0.75rem', borderRadius: '8px' }}>
                                                {t('ive_arrived')}
                                            </button>
                                        )}
                                        {isHost && (
                                            <>
                                                {(!invitation.editHistory || invitation.editHistory.length === 0) && (
                                                    <button
                                                        onClick={async () => {
                                                            const editStatus = getInvitationEditStatus(invitation);

                                                            if (!editStatus.canEdit) {
                                                                alert(editStatus.message);
                                                                return;
                                                            }

                                                            const newDate = prompt(
                                                                t('enter_new_date'),
                                                                date.split('T')[0]
                                                            );

                                                            if (!newDate) return;

                                                            const newTime = prompt(
                                                                t('enter_new_time'),
                                                                time
                                                            );

                                                            if (!newTime) return;

                                                            const confirmMessage = t('time_change_confirm', {
                                                                oldDate: date,
                                                                oldTime: time,
                                                                newDate: newDate,
                                                                newTime: newTime,
                                                                count: joined.length
                                                            });

                                                            if (!window.confirm(confirmMessage)) return;

                                                            const result = await updateInvitationDateTime(
                                                                id,
                                                                newDate,
                                                                newTime,
                                                                currentUser
                                                            );

                                                            if (result.success) {
                                                                alert(
                                                                    t('time_change_success', { count: result.affectedUsers })
                                                                );
                                                                window.location.reload();
                                                            } else {
                                                                alert(
                                                                    t('time_change_error', { error: result.error })
                                                                );
                                                            }
                                                        }}
                                                        className="btn btn-outline"
                                                        style={{
                                                            flex: 1,
                                                            padding: '8px',
                                                            fontSize: '0.75rem',
                                                            borderRadius: '8px',
                                                            borderColor: 'var(--primary)',
                                                            color: 'white'
                                                        }}
                                                    >
                                                        <FaEdit /> {t('change_time_once')}
                                                    </button>
                                                )}
                                                {invitation.editHistory && invitation.editHistory.length > 0 && (
                                                    <div style={{
                                                        flex: 1,
                                                        padding: '8px',
                                                        fontSize: '0.7rem',
                                                        borderRadius: '8px',
                                                        background: 'rgba(255,255,255,0.05)',
                                                        color: 'var(--text-muted)',
                                                        textAlign: 'center',
                                                        border: '1px solid var(--border-color)'
                                                    }}>
                                                        🔒 {t('already_edited')}
                                                    </div>
                                                )}
                                                {meetingStatus !== 'completed' && (
                                                    <button onClick={() => updateMeetingStatus(id, 'completed')} className="btn btn-primary" style={{ flex: 1, padding: '8px', fontSize: '0.75rem', borderRadius: '8px', background: 'var(--luxury-gold)', border: 'none', color: 'black' }}>
                                                        <FaCheckCircle /> {t('complete_meeting')}
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        {meetingStatus === 'completed' && !invitation.rating && (
                                            <div style={{
                                                width: '100%',
                                                background: 'rgba(255,255,255,0.03)',
                                                padding: '1.5rem',
                                                borderRadius: '15px',
                                                border: '1px solid var(--luxury-gold)',
                                                marginTop: '1rem'
                                            }}>
                                                <h4 style={{ color: 'var(--luxury-gold)', fontSize: '0.9rem', marginBottom: '1rem', textAlign: 'center' }}>
                                                    {t('rate_experience')}
                                                </h4>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                                                    {[1, 2, 3, 4, 5].map(star => (
                                                        <button
                                                            key={star}
                                                            onClick={() => submitRating(id, { stars: star })}
                                                            style={{ background: 'transparent', border: 'none', fontSize: '1.8rem', cursor: 'pointer', color: 'rgba(255,255,255,0.2)' }}
                                                            onMouseEnter={(e) => e.target.style.color = 'var(--luxury-gold)'}
                                                            onMouseLeave={(e) => e.target.style.color = 'rgba(255,255,255,0.2)'}
                                                        >
                                                            <FaStar />
                                                        </button>
                                                    ))}
                                                </div>
                                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                                    {t('earn_rep_points')}
                                                </p>
                                            </div>
                                        )}

                                        {meetingStatus === 'completed' && invitation.rating && (
                                            <div style={{ flex: 1, textAlign: 'center', color: 'var(--luxury-gold)', fontWeight: '800', fontSize: '0.8rem', padding: '15px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '12px', width: '100%' }}>
                                                {t('meeting_completed')}
                                            </div>
                                        )}
                                        {meetingStatus === 'completed' && !invitation.rating && isHost && (
                                            <div style={{ flex: 1, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '10px' }}>
                                                {t('waiting_ratings')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                                {description || t('no_description')}
                            </p>


                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                    <FaMapMarkerAlt style={{ color: 'var(--luxury-gold)' }} />
                                    <span>{location}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                    <FaCalendarAlt style={{ color: 'var(--primary)' }} />
                                    <span>{date ? new Date(date).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US') : t('soon')}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                    <FaClock style={{ color: 'var(--accent)' }} />
                                    <span>{time || '20:30'}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                    <FaUsers style={{ color: 'var(--secondary)' }} />
                                    <span>{t('guests_needed', { count: guestsNeeded })}</span>
                                </div>
                                {distance !== null && (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#10b981' }}>
                                            <span>📏</span>
                                            <span style={{ fontWeight: '700' }}>{distance.toFixed(1)} km</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#10b981' }}>
                                            <span>⏱️</span>
                                            <span style={{ fontWeight: '700' }}>~{travelTime} {t('minutes')}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Share Buttons - at bottom of card */}
                    <ShareButtons
                        title={title}
                        description={description}
                        url={window.location.href}
                        type="invitation"
                    />

                    {/* Join Button if NOT member */}
                    {!isHost && !isAccepted && (
                        <div style={{ marginTop: '1.5rem' }}>
                            <button
                                className={`btn btn-block ${!eligibility.eligible ? 'btn-disabled' : (isPending ? 'btn-outline' : 'btn-primary')}`}
                                onClick={async () => {
                                    if (!eligibility.eligible) return;
                                    if (isPending) {
                                        console.log('🔴 Canceling request for invitation:', id);
                                        cancelRequest(id);
                                    } else {
                                        console.log('🟢 Requesting to join invitation:', id);
                                        console.log('Current user:', currentUser);
                                        await requestToJoin(id);
                                        console.log('✅ Request sent successfully');
                                        alert(t('join_request_sent'));
                                        // Force a full page reload to ensure the home page renders correctly
                                        window.location.href = '/';
                                    }
                                }}
                                disabled={!eligibility.eligible}
                                style={{
                                    height: '60px',
                                    fontSize: '1.1rem',
                                    background: !eligibility.eligible ? 'rgba(55, 65, 81, 0.8)' : undefined,
                                    color: !eligibility.eligible ? '#d1d5db' : undefined,
                                    cursor: !eligibility.eligible ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {!eligibility.eligible ? (eligibility.reason || t('invite_unavailable')) : (isPending ? t('joined_btn') : t('join_btn'))}
                            </button>
                            <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.8rem' }}>
                                {!eligibility.eligible ? eligibility.reason : (isPending ? t('request_sent_waiting') : t('join_to_chat'))}
                            </p>
                        </div>
                    )}
                </div>

                {/* PRIVATE SECTION: Management & Chat */}
                {(isHost || isAccepted) ? (
                    <>
                        {/* Who's Coming - Social Trust Feature */}
                        <div style={{ padding: '0 1.25rem', marginBottom: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-white)', fontWeight: '800' }}>
                                {t('members_list_title')} ({joined.length + 1})
                            </h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                                {/* Host First */}
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ width: '50px', height: '50px', borderRadius: '50%', border: '2px solid var(--luxury-gold)', padding: '2px', position: 'relative' }}>
                                        <img src={author?.avatar} alt={author?.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                                        <div style={{ position: 'absolute', bottom: '-4px', right: '0', background: 'var(--luxury-gold)', color: 'black', fontSize: '0.6rem', fontWeight: '900', padding: '1px 5px', borderRadius: '4px' }}>HOST</div>
                                    </div>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px', maxWidth: '50px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{author?.name}</span>
                                </div>
                                {/* Joined Members */}
                                {joined.map(userId => {
                                    const member = joinedMembersData[userId] || { name: 'Loading...', avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}` };
                                    return (
                                        <div key={userId} style={{ textAlign: 'center' }}>
                                            <div style={{ width: '50px', height: '50px', borderRadius: '50%', border: '2px solid var(--primary)', padding: '2px' }}>
                                                <img src={member.avatar} alt={member.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                            </div>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px', maxWidth: '50px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.name}</span>
                                        </div>
                                    );
                                })}
                                {/* Empty Spots */}
                                {[...Array(Math.max(0, spotsLeft))].map((_, i) => (
                                    <div key={i} style={{
                                        width: '50px',
                                        height: '50px',
                                        borderRadius: '50%',
                                        border: '1px dashed var(--border-color)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--border-color)',
                                        fontSize: '1rem',
                                        opacity: 0.5
                                    }}>
                                        ?
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Group Chat Button - For Approved Members */}
                        {invitation.groupChatId && (
                            <div style={{ padding: '0 1.25rem', marginBottom: '1.5rem' }}>
                                <button
                                    onClick={() => navigate(`/group-chat/${invitation.groupChatId}`)}
                                    className="btn btn-primary btn-block"
                                    style={{
                                        height: '60px',
                                        fontSize: '1.1rem',
                                        fontWeight: '800',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '12px',
                                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                                        boxShadow: '0 8px 24px rgba(59, 130, 246, 0.3)',
                                        border: 'none',
                                        borderRadius: 'var(--radius-lg)',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <span style={{ fontSize: '1.5rem' }}>💬</span>
                                    <span>{t('open_group_chat', { defaultValue: 'Open Group Chat' })}</span>
                                    <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
                                        animation: 'shimmer 2s infinite'
                                    }}></div>
                                </button>
                                <p style={{
                                    textAlign: 'center',
                                    fontSize: '0.75rem',
                                    color: 'var(--text-muted)',
                                    marginTop: '0.5rem'
                                }}>
                                    {t('group_chat_description', { defaultValue: 'Chat with all members in real-time' })}
                                </p>
                            </div>
                        )}

                        {/* Host Management */}
                        {isHost && requests.length > 0 && (
                            <div style={{ padding: '0 1.25rem', marginBottom: '2rem' }}>
                                <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800' }}>
                                    <FaUsers /> {t('pending_requests', { count: requests.length })}
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {requests.map(userId => {
                                        const requester = requestersData[userId] || { name: t('loading'), avatar: '' };
                                        return (
                                            <div key={userId} style={{ padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <img
                                                        src={requester.avatar}
                                                        alt={requester.name}
                                                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                                                    />
                                                    <span style={{ fontWeight: '700' }}>{requester.name}</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button onClick={() => approveUser(id, userId)} className="btn btn-primary btn-sm">{t('accept')}</button>
                                                    <button onClick={() => rejectUser(id, userId)} className="btn btn-outline btn-sm">{t('reject')}</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Group Chat - For Host and Accepted Members */}
                        {(isHost || isAccepted) && (
                            <div style={{ padding: '0 1.25rem', marginBottom: '2rem' }}>
                                <h4 style={{
                                    fontSize: '0.9rem',
                                    marginBottom: '1rem',
                                    color: 'var(--primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontWeight: '800'
                                }}>
                                    💬 {t('group_chat', { defaultValue: 'Group Chat' })}
                                </h4>

                                <div style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--border-color)',
                                    minHeight: '300px',
                                    maxHeight: '500px',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}>
                                    <div style={{
                                        flex: 1,
                                        overflowY: 'auto',
                                        padding: '1rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '1rem'
                                    }}>
                                        {groupChatMessages.length === 0 ? (
                                            <div style={{
                                                textAlign: 'center',
                                                padding: '3rem 1rem',
                                                color: 'var(--text-muted)'
                                            }}>
                                                <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }}>💬</div>
                                                <p style={{ fontSize: '0.9rem' }}>
                                                    {t('no_messages_yet', { defaultValue: 'No messages yet. Start the conversation!' })}
                                                </p>
                                            </div>
                                        ) : (
                                            groupChatMessages.map((msg) => {
                                                const isOwnMessage = msg.senderId === currentUser?.id;
                                                return (
                                                    <div
                                                        key={msg.id}
                                                        style={{
                                                            alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
                                                            maxWidth: '75%',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '0.25rem'
                                                        }}
                                                    >
                                                        {!isOwnMessage && (
                                                            <div style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.5rem',
                                                                marginBottom: '0.25rem'
                                                            }}>
                                                                <img
                                                                    src={msg.senderAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderId}`}
                                                                    alt={msg.senderName}
                                                                    style={{
                                                                        width: '24px',
                                                                        height: '24px',
                                                                        borderRadius: '50%',
                                                                        objectFit: 'cover'
                                                                    }}
                                                                />
                                                                <span style={{
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: '600',
                                                                    color: 'var(--text-muted)'
                                                                }}>
                                                                    {msg.senderName}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div style={{
                                                            background: isOwnMessage
                                                                ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)'
                                                                : 'var(--bg-input)',
                                                            padding: '0.75rem 1rem',
                                                            borderRadius: isOwnMessage
                                                                ? '18px 18px 4px 18px'
                                                                : '18px 18px 18px 4px',
                                                            color: 'white',
                                                            fontSize: '0.95rem',
                                                            wordWrap: 'break-word'
                                                        }}>
                                                            {msg.text}
                                                        </div>
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            color: 'var(--text-muted)',
                                                            alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
                                                            paddingLeft: isOwnMessage ? '0' : '0.5rem',
                                                            paddingRight: isOwnMessage ? '0.5rem' : '0'
                                                        }}>
                                                            {msg.createdAt?.toDate ?
                                                                new Date(msg.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                                : 'Sending...'
                                                            }
                                                        </span>
                                                    </div>
                                                );
                                            })
                                        )}
                                        <div ref={chatEndRef} />
                                    </div>

                                    <div style={{
                                        padding: '1rem',
                                        borderTop: '1px solid var(--border-color)',
                                        background: 'var(--bg-body)'
                                    }}>
                                        <form onSubmit={handleSendGroupMessage} style={{ display: 'flex', gap: '0.75rem' }}>
                                            <input
                                                type="text"
                                                value={message}
                                                onChange={(e) => setMessage(e.target.value)}
                                                placeholder={t('type_message', { defaultValue: 'Type a message...' })}
                                                className="input-field"
                                                style={{
                                                    borderRadius: 'var(--radius-full)',
                                                    background: 'var(--bg-input)',
                                                    flex: 1,
                                                    border: '1px solid var(--border-color)'
                                                }}
                                            />
                                            <button
                                                type="submit"
                                                disabled={!message.trim()}
                                                className="btn btn-primary"
                                                style={{
                                                    width: '50px',
                                                    height: '50px',
                                                    minWidth: '50px',
                                                    padding: 0,
                                                    borderRadius: '50%',
                                                    opacity: message.trim() ? 1 : 0.5
                                                }}
                                            >
                                                <FaPaperPlane />
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        )}

                    </>
                ) : (
                    /* Locked Chat Message for non-members */
                    <div style={{ padding: '2rem 1.25rem', textAlign: 'center' }}>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-color)' }}>
                            <FaPaperPlane style={{ fontSize: '2rem', color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.2 }} />
                            <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t('chat_closed')}</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('members_only_chat')}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InvitationDetails;
