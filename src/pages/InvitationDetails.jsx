import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowRight, FaPaperPlane, FaCheck, FaTimes, FaUsers, FaMapMarkerAlt, FaCalendarAlt, FaClock, FaShareAlt, FaEdit, FaCheckCircle, FaStar, FaComments } from 'react-icons/fa';

import { useInvitations } from '../context/InvitationContext';
import { useTranslation } from 'react-i18next';
import ShareButtons from '../components/ShareButtons';
import { getInvitationGroupChat } from '../utils/groupChatHelpers';
import { updateInvitationDateTime, getInvitationEditStatus } from '../utils/invitationValidation';

const InvitationDetails = () => {
    const { t, i18n } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: title,
                text: description,
                url: window.location.href,
            }).catch(console.error);
        } else {
            // Fallback: Copy to clipboard
            navigator.clipboard.writeText(window.location.href);
            alert(i18n.language === 'ar' ? 'تم نسخ الرابط!' : 'Link copied!');
        }
    };

    const { invitations, currentUser, approveUser, rejectUser, sendChatMessage, updateMeetingStatus, approveNewTime, rejectNewTime, toggleFollow, submitRating, requestToJoin, cancelRequest } = useInvitations();
    const [message, setMessage] = useState('');
    const [groupChatId, setGroupChatId] = useState(null);
    const [loadingGroupChat, setLoadingGroupChat] = useState(false);
    const chatEndRef = useRef(null);

    const invitation = invitations.find(inv => inv.id === id);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [invitation?.chat]);

    if (!invitation) {
        return (
            <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}>
                <h2 style={{ marginBottom: '1rem' }}>{t('invitation_not_found')}</h2>
                <button onClick={() => navigate('/')} className="btn btn-primary">{t('nav_home')}</button>
            </div>
        );
    }

    const { author = {}, title, requests = [], joined = [], chat = [], image, location, date, time, description, guestsNeeded, meetingStatus = 'planning' } = invitation;
    const isHost = author?.id === currentUser?.id;
    const isAccepted = joined.includes(currentUser.id);
    const isPending = requests.includes(currentUser.id);
    const spotsLeft = guestsNeeded - joined.length;

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!message.trim()) return;
        sendChatMessage(id, message);
        setMessage('');
    };

    // Load group chat ID if user is participant
    useEffect(() => {
        const loadGroupChat = async () => {
            if (!invitation?.id || !isAccepted) {
                setGroupChatId(null);
                return;
            }

            try {
                setLoadingGroupChat(true);
                const chatId = await getInvitationGroupChat(invitation.id);
                setGroupChatId(chatId);
            } catch (error) {
                console.error('Error loading group chat:', error);
            } finally {
                setLoadingGroupChat(false);
            }
        };

        loadGroupChat();
    }, [invitation?.id, isAccepted]);

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
                        {isHost ? t('manage_invitation') : (isAccepted ? t('comments_title') : 'تفاصيل الدعوة')}
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
                                                ? (i18n.language === 'ar' ? '✓ نتابع' : '✓ Following')
                                                : (i18n.language === 'ar' ? '+ متابعة' : '+ Follow')}
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
                                            <p style={{ fontSize: '0.8rem', fontWeight: '800', color: 'white', marginBottom: '8px' }}>⚠️ قام المنظم بتغيير الموعد. هل يناسبك الوقت الجديد؟</p>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={() => approveNewTime(id)} style={{ flex: 1, padding: '6px', background: 'white', color: 'var(--primary)', border: 'none', borderRadius: '6px', fontWeight: '800', fontSize: '0.75rem' }}>موافق ✔️</button>
                                                <button onClick={() => rejectNewTime(id)} style={{ flex: 1, padding: '6px', background: 'rgba(0,0,0,0.2)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', fontSize: '0.75rem' }}>انسحاب ✖️</button>
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
                                            <span style={{ fontSize: '0.6rem', fontWeight: '800', color: 'white' }}>تخطيط</span>
                                        </div>
                                        <div style={{ textAlign: 'center', zIndex: 5, flex: 1 }}>
                                            <div style={{
                                                width: '28px', height: '28px', borderRadius: '50%', margin: '0 auto 5px',
                                                background: meetingStatus === 'on_way' || meetingStatus === 'arrived' || meetingStatus === 'completed' ? 'var(--primary)' : 'var(--bg-card)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', fontSize: '1rem'
                                            }}>🚗</div>
                                            <span style={{ fontSize: '0.6rem', fontWeight: '800', color: meetingStatus === 'on_way' ? 'var(--primary)' : 'var(--text-muted)' }}>في الطريق</span>
                                        </div>
                                        <div style={{ textAlign: 'center', zIndex: 5, flex: 1 }}>
                                            <div style={{
                                                width: '28px', height: '28px', borderRadius: '50%', margin: '0 auto 5px',
                                                background: meetingStatus === 'arrived' || meetingStatus === 'completed' ? 'var(--primary)' : 'var(--bg-card)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', fontSize: '1rem'
                                            }}>📍</div>
                                            <span style={{ fontSize: '0.6rem', fontWeight: '800', color: meetingStatus === 'arrived' ? 'var(--primary)' : 'var(--text-muted)' }}>وصلنا</span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '1rem', flexWrap: 'wrap' }}>
                                        {isAccepted && meetingStatus === 'planning' && (
                                            <button onClick={() => updateMeetingStatus(id, 'on_way')} className="btn btn-primary" style={{ flex: 1, padding: '8px', fontSize: '0.75rem', borderRadius: '8px' }}>
                                                🚀 أنا في الطريق
                                            </button>
                                        )}
                                        {isAccepted && meetingStatus === 'on_way' && (
                                            <button onClick={() => updateMeetingStatus(id, 'arrived')} className="btn btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '0.75rem', borderRadius: '8px' }}>
                                                📍 لقد وصلت
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
                                                                i18n.language === 'ar'
                                                                    ? 'أدخل التاريخ الجديد (YYYY-MM-DD):'
                                                                    : 'Enter new date (YYYY-MM-DD):',
                                                                date.split('T')[0]
                                                            );

                                                            if (!newDate) return;

                                                            const newTime = prompt(
                                                                i18n.language === 'ar'
                                                                    ? 'أدخل الوقت الجديد (HH:MM):'
                                                                    : 'Enter new time (HH:MM):',
                                                                time
                                                            );

                                                            if (!newTime) return;

                                                            const confirmMessage = i18n.language === 'ar'
                                                                ? `⚠️ تنبيه مهم:\n\nسيتم:\n1. تغيير الموعد من ${date} ${time} إلى ${newDate} ${newTime}\n2. إرسال إشعار لجميع المشاركين (${joined.length} شخص)\n3. تحويل حالتهم من "مقبول" إلى "تحت النظر"\n4. لن تتمكن من تعديل الموعد مرة أخرى\n\nهل أنت متأكد؟`
                                                                : `⚠️ Important:\n\nThis will:\n1. Change time from ${date} ${time} to ${newDate} ${newTime}\n2. Notify all participants (${joined.length} people)\n3. Move them from "Accepted" to "Pending"\n4. You won't be able to edit again\n\nAre you sure?`;

                                                            if (!window.confirm(confirmMessage)) return;

                                                            const result = await updateInvitationDateTime(
                                                                id,
                                                                newDate,
                                                                newTime,
                                                                currentUser
                                                            );

                                                            if (result.success) {
                                                                alert(
                                                                    i18n.language === 'ar'
                                                                        ? `✅ تم تعديل الموعد بنجاح!\n\nتم إرسال إشعارات لـ ${result.affectedUsers} مشارك.`
                                                                        : `✅ Time updated successfully!\n\nNotified ${result.affectedUsers} participants.`
                                                                );
                                                                window.location.reload();
                                                            } else {
                                                                alert(
                                                                    i18n.language === 'ar'
                                                                        ? `❌ فشل التعديل: ${result.error}`
                                                                        : `❌ Update failed: ${result.error}`
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
                                                        <FaEdit /> {i18n.language === 'ar' ? 'تغيير الموعد (مرة واحدة)' : 'Change Time (Once)'}
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
                                                        🔒 {i18n.language === 'ar' ? 'تم التعديل مسبقاً' : 'Already Edited'}
                                                    </div>
                                                )}
                                                {meetingStatus !== 'completed' && (
                                                    <button onClick={() => updateMeetingStatus(id, 'completed')} className="btn btn-primary" style={{ flex: 1, padding: '8px', fontSize: '0.75rem', borderRadius: '8px', background: 'var(--luxury-gold)', border: 'none', color: 'black' }}>
                                                        <FaCheckCircle /> إنهاء اللقاء
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
                                                    {i18n.language === 'ar' ? 'كيف كانت تجربتك؟ ✨' : 'How was your experience? ✨'}
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
                                                    {i18n.language === 'ar' ? 'بتقييمك تكسب 10+ نقاط سمعة' : 'Earn +10 Rep Points by rating'}
                                                </p>
                                            </div>
                                        )}

                                        {meetingStatus === 'completed' && invitation.rating && (
                                            <div style={{ flex: 1, textAlign: 'center', color: 'var(--luxury-gold)', fontWeight: '800', fontSize: '0.8rem', padding: '15px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '12px', width: '100%' }}>
                                                ✨ تم اللقاء والتقييم بنجاح! شكراً لمساهمتك في مجتمعنا.
                                            </div>
                                        )}
                                        {meetingStatus === 'completed' && !invitation.rating && isHost && (
                                            <div style={{ flex: 1, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '10px' }}>
                                                بانتظار تقييمات المشاركين...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                                {description || 'لا يوجد وصف متاح لهذه الدعوة.'}
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                    <FaMapMarkerAlt style={{ color: 'var(--luxury-gold)' }} />
                                    <span>{location}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                    <FaCalendarAlt style={{ color: 'var(--primary)' }} />
                                    <span>{date ? new Date(date).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US') : (i18n.language === 'ar' ? 'قريباً' : 'Soon')}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                    <FaClock style={{ color: 'var(--accent)' }} />
                                    <span>{time || '20:30'}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                    <FaUsers style={{ color: 'var(--secondary)' }} />
                                    <span>{i18n.language === 'ar' ? `مطلوب ${guestsNeeded} أشخاص` : `${guestsNeeded} guests needed`}</span>
                                </div>
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
                                className={`btn btn-block ${isPending ? 'btn-outline' : 'btn-primary'}`}
                                onClick={() => {
                                    if (isPending) {
                                        cancelRequest(id);
                                    } else {
                                        requestToJoin(id);
                                        alert(i18n.language === 'ar' ? 'تم إرسال طلب الانضمام بنجاح!' : 'Join request sent successfully!');
                                        // Force a full page reload to ensure the home page renders correctly
                                        window.location.href = '/';
                                    }
                                }}
                                style={{ height: '60px', fontSize: '1.1rem' }}
                            >
                                {isPending ? t('joined_btn') : t('join_btn')}
                            </button>
                            <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.8rem' }}>
                                {isPending ? 'لقد تم إرسال طلبك، بانتظار موافقة صاحب الدعوة.' : 'بمجرد قبولك، ستتمكن من الدخول إلى الدردشة الجماعية.'}
                            </p>
                        </div>
                    )}

                    {/* Group Chat Button - For Participants */}
                    {(isHost || isAccepted) && groupChatId && (
                        <div style={{ marginTop: '1.5rem' }}>
                            <button
                                className="btn btn-block"
                                onClick={() => navigate(`/group/${groupChatId}`)}
                                style={{
                                    height: '60px',
                                    fontSize: '1.1rem',
                                    background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '12px',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                            >
                                <FaComments size={20} />
                                <span>{i18n.language === 'ar' ? 'فتح الدردشة الجماعية' : 'Open Group Chat'}</span>
                                <span style={{
                                    background: 'rgba(255,255,255,0.25)',
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    fontSize: '0.85rem',
                                    fontWeight: '700'
                                }}>
                                    {joined.length + 1} {i18n.language === 'ar' ? 'عضو' : 'members'}
                                </span>
                            </button>
                            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <span>💬</span>
                                <span>{i18n.language === 'ar' ? 'تواصل مع الأعضاء قبل اللقاء' : 'Chat with members before the meetup'}</span>
                            </p>
                        </div>
                    )}

                    {/* Loading indicator */}
                    {(isHost || isAccepted) && loadingGroupChat && !groupChatId && (
                        <div style={{ marginTop: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            <span>⏳ {i18n.language === 'ar' ? 'جاري تحميل الدردشة...' : 'Loading chat...'}</span>
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
                                {joined.map(userId => (
                                    <div key={userId} style={{ textAlign: 'center' }}>
                                        <div style={{ width: '50px', height: '50px', borderRadius: '50%', border: '2px solid var(--primary)', padding: '2px' }}>
                                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`} alt="Member" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                                        </div>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>ياسر</span>
                                    </div>
                                ))}
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

                        {/* Host Management */}
                        {isHost && requests.length > 0 && (
                            <div style={{ padding: '0 1.25rem', marginBottom: '2rem' }}>
                                <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800' }}>
                                    <FaUsers /> طلبات معلقة ({requests.length})
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {requests.map(userId => (
                                        <div key={userId} style={{ padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                                            <span style={{ fontWeight: '700' }}>مستخدم جديد</span>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button onClick={() => approveUser(id, userId)} className="btn btn-primary btn-sm">قبول</button>
                                                <button onClick={() => rejectUser(id, userId)} className="btn btn-outline btn-sm">رفض</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Chat */}
                        <div style={{ padding: '0 1.25rem' }}>
                            <div style={{ textAlign: 'center', margin: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: '800' }}>
                                {t('comments_title')}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {chat.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        {i18n.language === 'ar' ? 'لا توجد رسائل بعد. ابدأ المحادثة!' : 'No messages yet. Start the conversation!'}
                                    </div>
                                ) : (
                                    chat.map((msg) => (
                                        <div key={msg.id} style={{ alignSelf: msg.senderId === currentUser.id ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                                            <div style={{
                                                background: msg.senderId === currentUser.id ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)' : 'var(--bg-input)',
                                                padding: '0.8rem 1.2rem',
                                                borderRadius: msg.senderId === currentUser.id ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                                                color: 'white',
                                                fontSize: '0.95rem'
                                            }}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={chatEndRef} />
                            </div>
                        </div>
                    </>
                ) : (
                    /* Locked Chat Message for non-members */
                    <div style={{ padding: '2rem 1.25rem', textAlign: 'center' }}>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-color)' }}>
                            <FaPaperPlane style={{ fontSize: '2rem', color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.2 }} />
                            <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>الدردشة مغلقة</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>يجب أن تكون عضواً مقلوباً لتتمكن من رؤية المحادثة والمشاركة فيها.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Message Input - Only for members */}
            {(isHost || isAccepted) && (
                <div className="chat-footer-glass" style={{ padding: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
                    <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.75rem' }}>
                        <input
                            type="text"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={t('comment_placeholder')}
                            className="input-field"
                            style={{ borderRadius: 'var(--radius-full)', background: 'var(--bg-body)', flex: 1 }}
                        />
                        <button type="submit" disabled={!message.trim()} className="btn btn-primary" style={{ width: '55px', height: '55px', minWidth: '55px', padding: 0, borderRadius: '50%' }}>
                            <FaPaperPlane />
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default InvitationDetails;
