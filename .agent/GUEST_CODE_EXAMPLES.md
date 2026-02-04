# 💻 أمثلة عملية للكود - بروفايل ومهام الضيف

## 📋 نظرة عامة
هذا المستند يحتوي على أمثلة عملية من الكود الفعلي للتطبيق توضح كيفية عمل وظائف الضيف.

---

## 1️⃣ التحقق من الأهلية (Eligibility Check)

### الكود من `InvitationCard.jsx`:
```javascript
const checkEligibility = () => {
    // التحقق من تفضيلات الجنس
    if (genderPreference && 
        genderPreference !== 'any' && 
        currentUser.gender !== genderPreference) {
        return { 
            eligible: false, 
            reason: t('gender_mismatch') 
        };
    }

    // التحقق من الفئة العمرية
    if (ageRange && currentUser.age) {
        const [minAge, maxAge] = ageRange.split('-').map(Number);
        const userAge = currentUser.age;
        
        if (userAge < minAge || userAge > maxAge) {
            return { 
                eligible: false, 
                reason: `${t('age_range_preference')}: ${ageRange}` 
            };
        }
    }

    return { eligible: true };
};

const eligibility = checkEligibility();
```

### مثال على الاستخدام:
```javascript
// مثال 1: ضيف ذكر، عمره 25، دعوة للذكور فقط، عمر 20-30
const guest1 = { gender: 'male', age: 25 };
const invitation1 = { genderPreference: 'male', ageRange: '20-30' };
// النتيجة: { eligible: true } ✅

// مثال 2: ضيف أنثى، عمرها 25، دعوة للذكور فقط
const guest2 = { gender: 'female', age: 25 };
const invitation2 = { genderPreference: 'male', ageRange: '20-30' };
// النتيجة: { eligible: false, reason: 'gender_mismatch' } ❌

// مثال 3: ضيف ذكر، عمره 35، دعوة للعمر 20-30
const guest3 = { gender: 'male', age: 35 };
const invitation3 = { genderPreference: 'any', ageRange: '20-30' };
// النتيجة: { eligible: false, reason: 'age_range_preference: 20-30' } ❌
```

---

## 2️⃣ طلب الانضمام (Request to Join)

### الكود من `InvitationCard.jsx`:
```javascript
const handleAction = (e) => {
    e.stopPropagation();
    
    if (!eligibility.eligible) return;
    
    if (isPending) {
        // إلغاء الطلب
        console.log('🔴 Canceling request for invitation:', id);
        cancelRequest(id);
    } else {
        // إرسال طلب جديد
        console.log('🟢 Requesting to join invitation:', id);
        console.log('Current user:', currentUser);
        
        await requestToJoin(id);
        
        console.log('✅ Request sent successfully');
        alert(t('join_request_sent'));
        
        // إعادة تحميل الصفحة للتحديث
        window.location.href = '/';
    }
};
```

### الكود من `InvitationContext.jsx`:
```javascript
const requestToJoin = async (invitationId) => {
    try {
        const invitationRef = doc(db, 'invitations', invitationId);
        const invitationDoc = await getDoc(invitationRef);
        
        if (!invitationDoc.exists()) {
            throw new Error('Invitation not found');
        }
        
        const invitation = invitationDoc.data();
        const currentRequests = invitation.requests || [];
        
        // التحقق من عدم وجود طلب سابق
        if (currentRequests.includes(currentUser.id)) {
            alert('You already requested to join this invitation');
            return;
        }
        
        // إضافة الطلب
        await updateDoc(invitationRef, {
            requests: [...currentRequests, currentUser.id]
        });
        
        // إرسال إشعار للمضيف
        await notifyHost(invitation.authorId, currentUser, invitationId);
        
        console.log('✅ Request sent successfully');
    } catch (error) {
        console.error('❌ Error requesting to join:', error);
        alert('Failed to send request');
    }
};
```

---

## 3️⃣ قبول/رفض الضيف (Host Approval)

### الكود من `InvitationContext.jsx`:
```javascript
const approveUser = async (invitationId, userId) => {
    try {
        const invitationRef = doc(db, 'invitations', invitationId);
        const invitationDoc = await getDoc(invitationRef);
        
        if (!invitationDoc.exists()) return;
        
        const invitation = invitationDoc.data();
        const currentRequests = invitation.requests || [];
        const currentJoined = invitation.joined || [];
        
        // إزالة من requests وإضافة إلى joined
        await updateDoc(invitationRef, {
            requests: currentRequests.filter(id => id !== userId),
            joined: [...currentJoined, userId]
        });
        
        // إرسال إشعار للضيف
        await notifyInvitationAccepted(userId, currentUser, invitationId);
        
        // إنشاء دردشة جماعية إذا لم تكن موجودة
        if (!invitation.groupChatId) {
            const chatId = await createGroupChat(invitationId, invitation);
            await updateDoc(invitationRef, { groupChatId: chatId });
        }
        
        console.log('✅ User approved successfully');
    } catch (error) {
        console.error('❌ Error approving user:', error);
    }
};

const rejectUser = async (invitationId, userId) => {
    try {
        const invitationRef = doc(db, 'invitations', invitationId);
        const invitationDoc = await getDoc(invitationRef);
        
        if (!invitationDoc.exists()) return;
        
        const invitation = invitationDoc.data();
        const currentRequests = invitation.requests || [];
        
        // إزالة من requests
        await updateDoc(invitationRef, {
            requests: currentRequests.filter(id => id !== userId)
        });
        
        // إرسال إشعار للضيف
        await notifyInvitationRejected(userId, currentUser, invitationId);
        
        console.log('✅ User rejected successfully');
    } catch (error) {
        console.error('❌ Error rejecting user:', error);
    }
};
```

---

## 4️⃣ الدردشة الجماعية (Group Chat)

### الكود من `InvitationDetails.jsx`:
```javascript
// إرسال رسالة
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

// الاستماع للرسائل الجديدة (Real-time)
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
```

### عرض الرسائل:
```javascript
{groupChatMessages.length === 0 ? (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <img 
                            src={msg.senderAvatar} 
                            alt={msg.senderName}
                            style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                        />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {msg.senderName}
                        </span>
                    </div>
                )}
                <div style={{
                    background: isOwnMessage ? 'var(--primary)' : 'var(--bg-card)',
                    color: 'white',
                    padding: '10px 14px',
                    borderRadius: isOwnMessage ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    fontSize: '0.9rem'
                }}>
                    {msg.text}
                </div>
            </div>
        );
    })
)}
```

---

## 5️⃣ رحلة اللقاء (Meeting Journey)

### الكود من `InvitationDetails.jsx`:
```javascript
// تحديث حالة اللقاء
const updateMeetingStatus = async (invitationId, newStatus) => {
    try {
        const invitationRef = doc(db, 'invitations', invitationId);
        await updateDoc(invitationRef, {
            meetingStatus: newStatus,
            [`${newStatus}At`]: serverTimestamp()
        });
        
        console.log(`✅ Meeting status updated to: ${newStatus}`);
    } catch (error) {
        console.error('❌ Error updating meeting status:', error);
    }
};

// عرض Timeline
<div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
    {/* خط الخلفية */}
    <div style={{ 
        position: 'absolute', 
        top: '15px', 
        left: '10%', 
        right: '10%', 
        height: '2px', 
        background: 'rgba(255,255,255,0.1)', 
        zIndex: 1 
    }}></div>
    
    {/* خط التقدم */}
    <div style={{
        position: 'absolute', 
        top: '15px', 
        left: '10%',
        width: meetingStatus === 'planning' ? '0%' : 
               (meetingStatus === 'on_way' ? '40%' : '80%'),
        height: '2px', 
        background: 'var(--primary)', 
        boxShadow: '0 0 8px var(--primary)', 
        zIndex: 2, 
        transition: 'width 0.8s ease'
    }}></div>
    
    {/* المراحل */}
    <div style={{ textAlign: 'center', zIndex: 5, flex: 1 }}>
        <div style={{ 
            width: '28px', 
            height: '28px', 
            borderRadius: '50%', 
            margin: '0 auto 5px', 
            background: 'var(--primary)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: '1rem' 
        }}>🖊️</div>
        <span style={{ fontSize: '0.6rem', fontWeight: '800', color: 'white' }}>
            {t('status_planning')}
        </span>
    </div>
    
    <div style={{ textAlign: 'center', zIndex: 5, flex: 1 }}>
        <div style={{
            width: '28px', 
            height: '28px', 
            borderRadius: '50%', 
            margin: '0 auto 5px',
            background: meetingStatus === 'on_way' || meetingStatus === 'arrived' || meetingStatus === 'completed' 
                ? 'var(--primary)' 
                : 'var(--bg-card)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            border: '1px solid var(--border-color)', 
            fontSize: '1rem'
        }}>🚗</div>
        <span style={{ 
            fontSize: '0.6rem', 
            fontWeight: '800', 
            color: meetingStatus === 'on_way' ? 'var(--primary)' : 'var(--text-muted)' 
        }}>
            {t('status_on_way')}
        </span>
    </div>
    
    <div style={{ textAlign: 'center', zIndex: 5, flex: 1 }}>
        <div style={{
            width: '28px', 
            height: '28px', 
            borderRadius: '50%', 
            margin: '0 auto 5px',
            background: meetingStatus === 'arrived' || meetingStatus === 'completed' 
                ? 'var(--primary)' 
                : 'var(--bg-card)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            border: '1px solid var(--border-color)', 
            fontSize: '1rem'
        }}>📍</div>
        <span style={{ 
            fontSize: '0.6rem', 
            fontWeight: '800', 
            color: meetingStatus === 'arrived' ? 'var(--primary)' : 'var(--text-muted)' 
        }}>
            {t('status_arrived')}
        </span>
    </div>
</div>

{/* أزرار الإجراءات */}
<div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
    {isAccepted && meetingStatus === 'planning' && (
        <button 
            onClick={() => updateMeetingStatus(id, 'on_way')} 
            className="btn btn-primary"
        >
            {t('im_on_way')}
        </button>
    )}
    
    {isAccepted && meetingStatus === 'on_way' && (
        <button 
            onClick={() => updateMeetingStatus(id, 'arrived')} 
            className="btn btn-secondary"
        >
            {t('ive_arrived')}
        </button>
    )}
    
    {isHost && meetingStatus !== 'completed' && (
        <button 
            onClick={() => updateMeetingStatus(id, 'completed')} 
            className="btn btn-primary"
        >
            <FaCheckCircle /> {t('complete_meeting')}
        </button>
    )}
</div>
```

---

## 6️⃣ التقييم (Rating)

### الكود من `InvitationDetails.jsx`:
```javascript
const submitRating = async (invitationId, ratingData) => {
    try {
        const invitationRef = doc(db, 'invitations', invitationId);
        await updateDoc(invitationRef, {
            rating: ratingData.stars,
            ratedAt: serverTimestamp(),
            ratedBy: currentUser.id
        });
        
        // إضافة نقاط السمعة للمستخدم
        const userRef = doc(db, 'users', currentUser.id);
        await updateDoc(userRef, {
            reputationPoints: increment(ratingData.stars * 10)
        });
        
        console.log('✅ Rating submitted successfully');
        alert(t('rating_submitted'));
    } catch (error) {
        console.error('❌ Error submitting rating:', error);
    }
};

// عرض نموذج التقييم
{meetingStatus === 'completed' && !invitation.rating && (
    <div style={{
        width: '100%',
        background: 'rgba(255,255,255,0.03)',
        padding: '1.5rem',
        borderRadius: '15px',
        border: '1px solid var(--luxury-gold)',
        marginTop: '1rem'
    }}>
        <h4 style={{ 
            color: 'var(--luxury-gold)', 
            fontSize: '0.9rem', 
            marginBottom: '1rem', 
            textAlign: 'center' 
        }}>
            {t('rate_experience')}
        </h4>
        
        <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '10px', 
            marginBottom: '1.5rem' 
        }}>
            {[1, 2, 3, 4, 5].map(star => (
                <button
                    key={star}
                    onClick={() => submitRating(id, { stars: star })}
                    style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        fontSize: '1.8rem', 
                        cursor: 'pointer', 
                        color: 'rgba(255,255,255,0.2)' 
                    }}
                    onMouseEnter={(e) => e.target.style.color = 'var(--luxury-gold)'}
                    onMouseLeave={(e) => e.target.style.color = 'rgba(255,255,255,0.2)'}
                >
                    <FaStar />
                </button>
            ))}
        </div>
        
        <p style={{ 
            fontSize: '0.7rem', 
            color: 'var(--text-muted)', 
            textAlign: 'center' 
        }}>
            {t('earn_rep_points')}
        </p>
    </div>
)}
```

---

## 7️⃣ حساب المسافة ووقت السفر

### الكود من `InvitationDetails.jsx`:
```javascript
// الحصول على موقع المستخدم
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

// حساب المسافة باستخدام Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // نصف قطر الأرض بالكيلومتر
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // المسافة بالكيلومتر
};

// حساب المسافة ووقت السفر
const distance = userLocation && invitation?.lat && invitation?.lng
    ? calculateDistance(userLocation.lat, userLocation.lng, invitation.lat, invitation.lng)
    : null;

const travelTime = distance ? Math.round((distance / 40) * 60) : null;
// افتراض سرعة 40 كم/ساعة

// عرض المسافة ووقت السفر
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
```

---

## 8️⃣ تحديث البروفايل

### الكود من `Profile.jsx`:
```javascript
const handleSave = async () => {
    // التحقق من الحقول الإلزامية
    if (!formData.gender) {
        alert(i18n.language === 'ar'
            ? t('please_select_gender')
            : '⚠️ Please select your gender');
        return;
    }
    
    if (!formData.age || formData.age < 18) {
        alert(i18n.language === 'ar'
            ? t('please_enter_age')
            : '⚠️ Please enter your age (minimum 18 years)');
        return;
    }
    
    // التحقق من الروابط الخارجية
    if (containsExternalLinks(formData.bio)) {
        alert(i18n.language === 'ar'
            ? t('no_external_links')
            : '⚠️ External links and social media accounts are not allowed in profile');
        return;
    }
    
    setIsSaving(true);
    setUploadProgress(0);
    
    try {
        let finalAvatar = formData.avatar;
        
        // رفع الصورة الجديدة إذا تم اختيارها
        if (avatarFile) {
            const url = await uploadProfilePicture(
                avatarFile,
                firebaseUser.uid,
                (progress) => setUploadProgress(progress)
            );
            finalAvatar = url;
        }
        
        // تحديث البروفايل
        await updateProfile({ ...formData, avatar: finalAvatar });
        
        setIsEditing(false);
        setAvatarFile(null);
        setUploadProgress(0);
    } catch (e) {
        console.error(e);
        alert(i18n.language === 'ar'
            ? t('failed_save_profile')
            : 'Failed to save profile'
        );
    } finally {
        setIsSaving(false);
    }
};

// التحقق من الروابط الخارجية
const containsExternalLinks = (text) => {
    const urlPattern = /(https?:\/\/|www\.|@[a-zA-Z0-9_]+|instagram\.com|facebook\.com|twitter\.com|tiktok\.com|snapchat\.com)/gi;
    return urlPattern.test(text);
};
```

---

## 9️⃣ نظام المتابعة

### الكود من `InvitationContext.jsx`:
```javascript
const toggleFollow = async (userId) => {
    try {
        const currentFollowing = currentUser.following || [];
        const isFollowing = currentFollowing.includes(userId);
        
        const userRef = doc(db, 'users', currentUser.id);
        const targetUserRef = doc(db, 'users', userId);
        
        if (isFollowing) {
            // إلغاء المتابعة
            await updateDoc(userRef, {
                following: arrayRemove(userId)
            });
            
            await updateDoc(targetUserRef, {
                followersCount: increment(-1)
            });
            
            console.log('✅ Unfollowed user');
        } else {
            // متابعة
            await updateDoc(userRef, {
                following: arrayUnion(userId)
            });
            
            await updateDoc(targetUserRef, {
                followersCount: increment(1)
            });
            
            // إرسال إشعار
            await notifyNewFollower(userId, currentUser);
            
            console.log('✅ Followed user');
        }
    } catch (error) {
        console.error('❌ Error toggling follow:', error);
    }
};
```

### الاستخدام في الواجهة:
```javascript
<button
    onClick={(e) => { 
        e.stopPropagation(); 
        toggleFollow(author.id); 
    }}
    style={{
        background: currentUser.following.includes(author.id) 
            ? 'transparent' 
            : 'rgba(255,255,255,0.1)',
        border: `1px solid ${currentUser.following.includes(author.id) 
            ? 'var(--primary)' 
            : 'rgba(255,255,255,0.3)'}`,
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
```

---

## 🔟 نظام الإشعارات

### الكود من `notificationHelpers.js`:
```javascript
// إشعار قبول الطلب
export const notifyInvitationAccepted = async (hostUserId, guestUser, invitationId) => {
    try {
        const notificationsRef = collection(db, 'users', hostUserId, 'notifications');
        await addDoc(notificationsRef, {
            type: 'invitation_accepted',
            message: `${guestUser.name || 'Someone'} accepted your invitation`,
            invitationId: invitationId,
            fromUserId: guestUser.id,
            fromUserName: guestUser.name,
            fromUserAvatar: guestUser.avatar,
            createdAt: serverTimestamp(),
            read: false
        });
    } catch (error) {
        console.error('Error sending notification:', error);
    }
};

// إشعار رفض الطلب
export const notifyInvitationRejected = async (hostUserId, guestUser, invitationId) => {
    try {
        const notificationsRef = collection(db, 'users', hostUserId, 'notifications');
        await addDoc(notificationsRef, {
            type: 'invitation_rejected',
            message: `${guestUser.name || 'Someone'} declined your invitation`,
            invitationId: invitationId,
            fromUserId: guestUser.id,
            fromUserName: guestUser.name,
            fromUserAvatar: guestUser.avatar,
            createdAt: serverTimestamp(),
            read: false
        });
    } catch (error) {
        console.error('Error sending notification:', error);
    }
};
```

---

## 1️⃣1️⃣ عرض الأعضاء

### الكود من `InvitationDetails.jsx`:
```javascript
// جلب بيانات الأعضاء المنضمين
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
                        avatar: userData.photo_url || userData.avatar || 
                                `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
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

// عرض قائمة الأعضاء
<div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
    {/* المضيف أولاً */}
    <div style={{ textAlign: 'center' }}>
        <div style={{ 
            width: '50px', 
            height: '50px', 
            borderRadius: '50%', 
            border: '2px solid var(--luxury-gold)', 
            padding: '2px', 
            position: 'relative' 
        }}>
            <img 
                src={author?.avatar} 
                alt={author?.name} 
                style={{ width: '100%', height: '100%', borderRadius: '50%' }} 
            />
            <div style={{ 
                position: 'absolute', 
                bottom: '-4px', 
                right: '0', 
                background: 'var(--luxury-gold)', 
                color: 'black', 
                fontSize: '0.6rem', 
                fontWeight: '900', 
                padding: '1px 5px', 
                borderRadius: '4px' 
            }}>HOST</div>
        </div>
        <span style={{ 
            fontSize: '0.65rem', 
            color: 'var(--text-muted)', 
            display: 'block', 
            marginTop: '4px', 
            maxWidth: '50px', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis' 
        }}>{author?.name}</span>
    </div>
    
    {/* الأعضاء المنضمين */}
    {joined.map(userId => {
        const member = joinedMembersData[userId] || { 
            name: 'Loading...', 
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}` 
        };
        return (
            <div key={userId} style={{ textAlign: 'center' }}>
                <div style={{ 
                    width: '50px', 
                    height: '50px', 
                    borderRadius: '50%', 
                    border: '2px solid var(--primary)', 
                    padding: '2px' 
                }}>
                    <img 
                        src={member.avatar} 
                        alt={member.name} 
                        style={{ 
                            width: '100%', 
                            height: '100%', 
                            borderRadius: '50%', 
                            objectFit: 'cover' 
                        }} 
                    />
                </div>
                <span style={{ 
                    fontSize: '0.65rem', 
                    color: 'var(--text-muted)', 
                    display: 'block', 
                    marginTop: '4px', 
                    maxWidth: '50px', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis' 
                }}>{member.name}</span>
            </div>
        );
    })}
    
    {/* الأماكن الفارغة */}
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
```

---

## 📊 ملخص الوظائف الرئيسية

| الوظيفة | الملف | الدالة |
|---------|-------|---------|
| التحقق من الأهلية | `InvitationCard.jsx` | `checkEligibility()` |
| طلب الانضمام | `InvitationContext.jsx` | `requestToJoin()` |
| قبول الضيف | `InvitationContext.jsx` | `approveUser()` |
| رفض الضيف | `InvitationContext.jsx` | `rejectUser()` |
| إرسال رسالة | `InvitationDetails.jsx` | `handleSendGroupMessage()` |
| تحديث الحالة | `InvitationContext.jsx` | `updateMeetingStatus()` |
| التقييم | `InvitationContext.jsx` | `submitRating()` |
| حساب المسافة | `InvitationDetails.jsx` | `calculateDistance()` |
| تحديث البروفايل | `Profile.jsx` | `handleSave()` |
| المتابعة | `InvitationContext.jsx` | `toggleFollow()` |
| الإشعارات | `notificationHelpers.js` | `notifyInvitationAccepted()` |

---

**تم إعداد هذا المستند بواسطة:** Antigravity AI  
**التاريخ:** 2026-02-03  
**الإصدار:** 1.0
