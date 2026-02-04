import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './AuthContext';
import { db } from '../firebase/config';
import { followUser, unfollowUser } from '../utils/followHelpers';
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    orderBy,
    doc,
    updateDoc,
    setDoc,
    arrayUnion,
    arrayRemove,
    deleteDoc,
    serverTimestamp,
    where,
    getDoc
} from 'firebase/firestore';

const InvitationContext = createContext();



// Helper to prevent undefined context access
export const useInvitations = () => {
    const context = useContext(InvitationContext);
    if (!context) {
        throw new Error('useInvitations must be used within an InvitationProvider');
    }
    return context;
};

export const InvitationProvider = ({ children }) => {
    // --- 1. Current User (Integrated with Firebase) ---
    const { currentUser: firebaseUser, userProfile: firebaseProfile, updateUserProfile, isGuest } = useAuth();



    // Derived state source of truth
    const currentUser = React.useMemo(() => {
        console.log('🔍 InvitationContext - Building currentUser:', {
            hasFirebaseUser: !!firebaseUser,
            hasFirebaseProfile: !!firebaseProfile,
            firebaseProfileFollowing: firebaseProfile?.following,
            firebaseProfileData: firebaseProfile
        });

        if (firebaseUser) {
            const baseProfile = firebaseProfile || {};
            const email = baseProfile.email || firebaseUser.email || '';

            // Hardcoded Super Admin Logic
            const isSuperAdmin = ['admin@dinebuddies.com', 'yaser@dinebuddies.com'].includes(email.toLowerCase());

            const user = {
                id: firebaseUser.uid,
                name: baseProfile.display_name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                avatar: baseProfile.photo_url || firebaseUser.photoURL || 'https://via.placeholder.com/150',
                email: email,
                accountType: isSuperAdmin ? 'admin' : (baseProfile.accountType || 'user'), // Changed from 'individual' to 'user'
                userRole: isSuperAdmin ? 'admin' : (baseProfile.role || 'user'),
                ownedRestaurants: baseProfile.ownedRestaurants || [],
                bio: baseProfile.bio || '',
                interests: baseProfile.interests || [],
                following: baseProfile.following || [],
                followersCount: baseProfile.followersCount || 0,
                reputation: baseProfile.reputation || 0,
                joinedCommunities: baseProfile.joinedCommunities || [],
                age: baseProfile.age || 25,
                gender: baseProfile.gender || 'male',
                isNewUser: !firebaseProfile // Flag to indicate this is a new user without Firestore profile yet
            };

            console.log('✅ InvitationContext - currentUser built:', {
                id: user.id,
                name: user.name,
                followingCount: user.following?.length || 0,
                following: user.following,
                baseProfileFollowing: baseProfile.following,
                firebaseProfileFollowing: firebaseProfile?.following
            });

            return user;
        }


        // Guest user fallback - NO personal data
        return {
            id: 'guest',
            name: 'Guest',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest&backgroundColor=b6e3f4',
            email: '',
            accountType: 'guest',
            userRole: 'guest',
            ownedRestaurants: [],
            bio: '',
            interests: [],
            following: [],
            followersCount: 0,
            reputation: 0,
            joinedCommunities: [],
            // NO age or gender for guests
            age: null,
            gender: null
        };
    }, [firebaseUser, firebaseProfile]);



    // --- 2. Invitations Logic ---
    // State for invitations (synced with Firestore)
    const [invitations, setInvitations] = useState([]);
    const [loadingInvitations, setLoadingInvitations] = useState(true);

    // Fetch invitations from Firestore (Real-time)
    useEffect(() => {
        const q = query(collection(db, 'invitations'), orderBy('date', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const invites = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setInvitations(invites);
            setLoadingInvitations(false);
        }, (error) => {
            console.error("Error fetching invitations:", error);
            setLoadingInvitations(false);
        });

        return () => unsubscribe();
    }, []);

    // --- Restaurants Logic (Synced with Firestore) ---
    const [restaurants, setRestaurants] = useState([]);



    useEffect(() => {
        // Fetch 'users' where accountType is 'business' (The new source of truth for Partners)
        const q = query(collection(db, 'users'), where('accountType', '==', 'business'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const businessList = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                const info = data.businessInfo;
                const draft = data.businessInfoDraft;

                // Use draft if available AND user is viewing their own? 
                // No, context should provide PUBLIC data.
                // But we want to support the 'permissive' check for legacy data

                if (info) {
                    // Check if published (or legacy undefined)
                    const isPublished = info.isPublished === true || info.isPublished === undefined;

                    if (isPublished) {
                        businessList.push({
                            id: doc.id,
                            ownerId: doc.id,
                            name: info.businessName || 'Business',
                            type: info.businessType || 'Restaurant',
                            // Map coverImage to 'image' for Directory compatibility
                            image: info.coverImage || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
                            avatar: info.logoImage || '', // For map markers
                            location: info.city || info.address || 'Sydney',
                            description: info.description || '',
                            phone: info.phone || '',
                            rating: data.reputation ? Math.min(5, data.reputation / 20) : 5.0, // Mock rating based on reputation
                            reviews: [],
                            // Only set lat/lng if they exist in info
                            lat: info.lat,
                            lng: info.lng,
                            ...info
                        });
                    }
                }
            });

            console.log('Context: Synced restaurants from Users collection:', businessList.length);
            setRestaurants(businessList);
        }, (error) => {
            console.error("Error fetching business partners:", error);
        });

        return () => unsubscribe();
    }, []);
    const [notifications, setNotifications] = useState([]);

    // --- ADMIN DATA (Real Firestore) ---
    const [allUsers, setAllUsers] = useState([]);
    const [reports, setReports] = useState([]);

    // Sync Users from Firestore (for Admin)
    useEffect(() => {
        const q = query(collection(db, 'users'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                joinDate: doc.data().createdAt || new Date().toISOString()
            }));
            console.log('🔍 InvitationContext - allUsers loaded from Firestore:', {
                count: usersData.length,
                users: usersData.map(u => ({ id: u.id, name: u.display_name || u.name, following: u.following }))
            });
            setAllUsers(usersData);
        }, (error) => console.error("Error syncing users:", error));
        return () => unsubscribe();
    }, []);

    // Sync Reports from Firestore (Admin only)
    useEffect(() => {
        // Only sync reports if user is admin
        if (!currentUser?.isAdmin) {
            return;
        }

        const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const reportsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setReports(reportsData);
        }, (error) => {
            console.error("Error syncing reports:", error);
            // Silently fail for non-admin users
        });
        return () => unsubscribe();
    }, [currentUser?.isAdmin]);

    const [subscriptionPlans, setSubscriptionPlans] = useState([
        {
            id: 'p1',
            name: 'الباقة المجانية',
            title: 'ابدأ مجاناً',
            description: 'مثالية للاستخدام الشخصي والتجربة',
            type: 'user',
            price: 0,
            originalPrice: 0,
            discount: 0, // نسبة الخصم
            duration: { type: 'month', value: 1 }, // month, year, day
            invitationCredits: 5, // عدد الدعوات المسموحة شهرياً
            invitationOffers: null, // مثال: "اشتر 4 واحصل على 1 مجانية"
            stripePriceId: null, // مجاني - لا يحتاج Stripe
            features: [
                'إنشاء حتى 5 دعوات شهرياً',
                'الانضمام لدعوات غير محدودة',
                'تصفح المطاعم',
                'دعم عبر البريد الإلكتروني'
            ],
            active: true,
            recommended: false
        },
        {
            id: 'p2',
            name: 'باقة Pro',
            title: 'الأكثر شعبية',
            description: 'للمستخدمين النشطين الذين يحبون التواصل الاجتماعي',
            type: 'user',
            price: 39,
            originalPrice: 49,
            discount: 20, // خصم 20%
            duration: { type: 'month', value: 1 },
            invitationCredits: 20,
            invitationOffers: 'احجز 4 دعوات واحصل على 1 مجانية',
            stripePriceId: 'price_1Sv9aWKpQn3RDJUCeGbeD8hc', // Pro Plan
            features: [
                'دعوات غير محدودة',
                'شارة VIP مميزة',
                'أولوية في الظهور',
                'دعم فوري 24/7',
                'إحصائيات تفصيلية',
                'إمكانية جدولة الدعوات'
            ],
            active: true,
            recommended: true
        },
        {
            id: 'p3',
            name: 'باقة Premium',
            title: 'الباقة الذهبية',
            description: 'للمستخدمين المميزين الذين يبحثون عن تجربة لا مثيل لها',
            type: 'user',
            price: 79,
            originalPrice: 99,
            discount: 20,
            duration: { type: 'month', value: 1 },
            invitationCredits: -1, // -1 تعني غير محدود
            invitationOffers: 'احجز 3 دعوات واحصل على 2 مجانية',
            stripePriceId: 'price_1Sv9bBKpQn3RDJUCBNht0Lq5', // Premium Plan
            features: [
                'دعوات غير محدودة',
                'شارة Premium ذهبية',
                'ظهور في الصفحة الرئيسية',
                'مدير حساب شخصي',
                'خصومات حصرية على المطاعم',
                'وصول مبكر للميزات الجديدة',
                'إلغاء مجاني للدعوات',
                'دعوة +5 ضيوف إضافيين'
            ],
            active: true,
            recommended: false
        },
        {
            id: 'p4',
            name: 'باقة الشريك الأساسية',
            title: 'للمطاعم الصغيرة',
            description: 'حل مثالي للمطاعم والمقاهي الناشئة',
            type: 'partner',
            price: 149,
            originalPrice: 199,
            discount: 25,
            duration: { type: 'month', value: 1 },
            invitationCredits: null, // لا ينطبق على الشركاء
            invitationOffers: null,
            features: [
                'لوحة تحكم كاملة',
                'عرض في دليل المطاعم',
                'قبول الحجوزات',
                'إحصائيات أساسية',
                'دعم عبر البريد'
            ],
            active: true,
            recommended: false
        },
        {
            id: 'p5',
            name: 'باقة الشريك المتقدمة',
            title: 'للمطاعم المتوسطة',
            description: 'أدوات احترافية لإدارة وتنمية أعمالك',
            type: 'partner',
            price: 299,
            originalPrice: 399,
            discount: 25,
            duration: { type: 'month', value: 1 },
            invitationCredits: null,
            invitationOffers: null,
            features: [
                'كل ميزات الباقة الأساسية',
                'ظهور مميز في نتائج البحث',
                'إحصائيات متقدمة وتحليلات',
                'إدارة القوائم والعروض',
                'تكامل مع برامج الولاء',
                'دعم هاتفي مباشر',
                'حملات تسويقية شهرية'
            ],
            active: true,
            recommended: true
        }
    ]);

    // Admin Functions (Firestore Integration)
    const banUser = async (userId) => {
        try {
            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
                const currentStatus = userDoc.data().status || 'active';
                const newStatus = currentStatus === 'active' ? 'banned' : 'active';
                await updateDoc(userRef, { status: newStatus });
                addNotification('تم التحديث', `تم ${newStatus === 'banned' ? 'حظر' : 'فك حظر'} المستخدم`, 'success');
            }
        } catch (error) {
            console.error("Error banning user:", error);
        }
    };

    const resolveReport = async (reportId) => {
        try {
            await updateDoc(doc(db, 'reports', reportId), {
                status: 'resolved',
                resolvedAt: serverTimestamp()
            });
            addNotification('تم الحل', 'تم تحديث حالة البلاغ إلى "محلول"', 'success');
        } catch (error) {
            console.error("Error resolving report:", error);
        }
    };

    const updatePlan = (planId, newData) => {
        setSubscriptionPlans(prev => prev.map(p => p.id === planId ? { ...p, ...newData } : p));
    };

    const sendSystemMessage = async (userId, message) => {
        try {
            await addDoc(collection(db, 'system_messages'), {
                userId,
                message,
                timestamp: serverTimestamp(),
                read: false
            });
            addNotification('تم الإرسال', `تم إرسال الرسالة إلى المستخدم`, 'success');
        } catch (error) {
            console.error("Error sending system message:", error);
        }
    };



    // LocalStorage sync removed - data is now in Firestore

    const addNotification = (title, message, type = 'info') => {
        setNotifications(prev => [{ id: uuidv4(), title, message, time: 'الآن', read: false, type }, ...prev]);
    };

    const addInvitation = async (newInvite) => {
        // Prevent guests from creating invitations
        if (isGuest) {
            console.log('❌ Guests cannot create invitations');
            return false;
        }

        try {
            if (!newInvite.title) return false;

            const inviteData = {
                ...newInvite,
                author: {
                    id: currentUser.id,
                    name: currentUser.name || 'User',
                    avatar: currentUser.avatar || '',
                    isPartner: currentUser.accountType === 'business'
                },
                requests: [], joined: [], chat: [], meetingStatus: 'planning',
                date: newInvite.date || new Date().toISOString(),
                time: newInvite.time || '20:30',
                lat: newInvite.lat || (-33.8688 + (Math.random() - 0.5) * 0.1),
                lng: newInvite.lng || (151.2093 + (Math.random() - 0.5) * 0.1),
                invitedUserIds: newInvite.invitedUserIds || [],
                privacy: newInvite.privacy || 'public',
                createdAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, 'invitations'), inviteData);
            addNotification('تم النشر!', 'دعوتك متاحة الآن للجميع.', 'success');

            // Send notifications to invited users (for private invitations)
            if (inviteData.privacy === 'private' && inviteData.invitedUserIds && inviteData.invitedUserIds.length > 0) {
                console.log('📧 Sending private invitation notifications to:', inviteData.invitedUserIds);

                for (const userId of inviteData.invitedUserIds) {
                    try {
                        await addDoc(collection(db, 'notifications'), {
                            userId: userId,
                            type: 'private_invitation',
                            title: '🎁 دعوة خاصة!',
                            message: `${currentUser.name} دعاك لحضور ${inviteData.title}`,
                            invitationId: docRef.id,
                            invitationTitle: inviteData.title,
                            invitationDate: inviteData.date,
                            invitationTime: inviteData.time,
                            invitationLocation: inviteData.location,
                            senderName: currentUser.name,
                            senderAvatar: currentUser.avatar,
                            read: false,
                            createdAt: serverTimestamp()
                        });
                        console.log(`✅ Notification sent to user: ${userId}`);
                    } catch (notifError) {
                        console.error(`❌ Failed to send notification to ${userId}:`, notifError);
                    }
                }
            }

            // Send notification to partner if invitation is at their restaurant
            if (newInvite.restaurantId) {
                const restaurant = restaurants.find(r => r.id === newInvite.restaurantId);
                if (restaurant) {
                    console.log(`📧 Notification sent to ${restaurant.name}: New booking by ${currentUser.name}`);

                    // Keep local simulation for now
                    addPartnerNotification(restaurant.id, {
                        type: 'new_booking',
                        title: '🎉 حجز جديد!',
                        message: `${currentUser.name} حجز طاولة لـ ${inviteData.guestsNeeded} أشخاص في ${restaurant.name}`,
                        invitationId: docRef.id,
                        date: inviteData.date,
                        time: inviteData.time,
                        guestsNeeded: inviteData.guestsNeeded
                    });
                }
            }

            return docRef.id;
        } catch (err) {
            console.error("Error adding invitation:", err);
            return false;
        }
    };

    const addReport = async (reportData) => {
        try {
            await addDoc(collection(db, 'reports'), {
                ...reportData,
                status: 'pending',
                timestamp: serverTimestamp(),
                reporterId: currentUser?.id,
                reporterName: currentUser?.name
            });
            addNotification('تم الإرسال', 'تم استلام بلاغك وسيقوم فريقنا بمراجعته.', 'success');
        } catch (error) {
            console.error("Error adding report:", error);
        }
    };

    // Helper function to add partner notifications
    const addPartnerNotification = async (restaurantId, notificationData) => {
        try {
            await addDoc(collection(db, 'partner_notifications'), {
                restaurantId,
                ...notificationData,
                timestamp: serverTimestamp(),
                read: false
            });
            console.log('📱 Partner notification added to Firestore:', notificationData);
        } catch (error) {
            console.error("Error adding partner notification", error);
        }
    };

    const requestToJoin = async (invId) => {
        // Prevent guests from joining
        if (isGuest) {
            console.log('❌ Guests cannot join invitations');
            return;
        }

        try {
            const invRef = doc(db, 'invitations', invId);
            const invDoc = await getDoc(invRef);

            if (!invDoc.exists()) {
                console.error("Invitation not found");
                return;
            }

            const invData = invDoc.data();
            const hostId = invData.author?.id;

            // Update invitation with new request
            await updateDoc(invRef, {
                requests: arrayUnion(currentUser.id)
            });

            // Send notification to host
            if (hostId && hostId !== currentUser.id) {
                console.log('📧 Preparing notification:', {
                    hostId,
                    currentUserId: currentUser.id,
                    currentUserName: currentUser.name,
                    invitationTitle: invData.title
                });

                try {
                    const notificationData = {
                        userId: hostId,
                        type: 'join_request',
                        title: '🙋 New Join Request',
                        message: `${currentUser.name} wants to join your invitation "${invData.title}"`,
                        invitationId: invId,
                        requesterId: currentUser.id,
                        requesterName: currentUser.name,
                        requesterAvatar: currentUser.avatar,
                        createdAt: serverTimestamp(),
                        read: false
                    };

                    console.log('📝 Notification data:', notificationData);

                    const docRef = await addDoc(collection(db, 'notifications'), notificationData);
                    console.log('✅ Join request notification sent to host. Doc ID:', docRef.id);
                } catch (notifError) {
                    console.error('❌ Error creating notification:', notifError);
                }
            } else {
                console.log('⚠️ Notification not sent. Reason:', {
                    hostId,
                    currentUserId: currentUser.id,
                    isSameUser: hostId === currentUser.id
                });
            }
        } catch (err) {
            console.error("Error requesting to join:", err);
        }
    };

    const cancelRequest = async (invId) => {
        try {
            const invRef = doc(db, 'invitations', invId);
            await updateDoc(invRef, {
                requests: arrayRemove(currentUser.id)
            });
        } catch (err) { console.error("Error canceling request:", err); }
    };

    const approveUser = async (invId, userId) => {
        try {
            const invRef = doc(db, 'invitations', invId);
            const invDoc = await getDoc(invRef);

            if (!invDoc.exists()) {
                console.error("Invitation not found");
                return;
            }

            const invData = invDoc.data();

            // Update invitation with approved user
            await updateDoc(invRef, {
                requests: arrayRemove(userId),
                joined: arrayUnion(userId)
            });

            // Notification Logic using current state
            const inv = invitations.find(i => i.id === invId);
            if (inv && inv.restaurantId) {
                const restaurant = restaurants.find(r => r.id === inv.restaurantId);
                if (restaurant) {
                    const newJoinedCount = (inv.joined?.length || 0) + 1;
                    const isFull = newJoinedCount >= inv.guestsNeeded;

                    addPartnerNotification(restaurant.id, {
                        type: 'member_joined',
                        title: '👥 عضو جديد انضم!',
                        message: `انضم عضو جديد للحجز في ${restaurant.name}. العدد الحالي: ${newJoinedCount}/${inv.guestsNeeded}`,
                        invitationId: inv.id,
                        currentCount: newJoinedCount,
                        totalNeeded: inv.guestsNeeded
                    });

                    if (isFull) {
                        addPartnerNotification(restaurant.id, {
                            type: 'group_full',
                            title: '✅ اكتمل العدد!',
                            message: `اكتمل عدد المجموعة للحجز في ${restaurant.name}! ${inv.guestsNeeded} أشخاص جاهزون.`,
                            invitationId: inv.id,
                            date: inv.date,
                            time: inv.time,
                            guestsCount: inv.guestsNeeded
                        });
                    }
                }
            }

            // Send notification to approved user
            if (inv) {
                await addDoc(collection(db, 'notifications'), {
                    userId: userId,
                    type: 'request_approved',
                    title: '✅ Request Approved',
                    message: `Your request to join "${inv.title}" has been approved`,
                    invitationId: invId,
                    actionUrl: `/invitation/${invId}`,
                    createdAt: serverTimestamp(),
                    read: false
                });
                console.log('✅ Approval notification sent to user');
            }
        } catch (err) {
            console.error("Error approving user:", err);
        }
    };

    const rejectUser = async (invId, userId) => {
        try {
            const invRef = doc(db, 'invitations', invId);
            await updateDoc(invRef, {
                requests: arrayRemove(userId)
            });
        } catch (err) { console.error("Error rejecting user:", err); }
    };

    const sendChatMessage = (invId, text) => {
        const msg = { id: uuidv4(), senderId: currentUser.id, senderName: currentUser.name, text, timestamp: new Date().toISOString() };
        setInvitations(prev => prev.map(inv => inv.id === invId ? { ...inv, chat: [...(inv.chat || []), msg] } : inv));
    };

    const updateMeetingStatus = async (id, status) => {
        try {
            const invitationRef = doc(db, 'invitations', id);
            const updateData = {
                meetingStatus: status
            };

            // If status is 'completed', save the completion timestamp
            if (status === 'completed') {
                updateData.completedAt = serverTimestamp();
            }

            await updateDoc(invitationRef, updateData);

            // Update local state
            setInvitations(prev => prev.map(inv => {
                if (inv.id === id) {
                    return { ...inv, meetingStatus: status, completedAt: status === 'completed' ? new Date() : inv.completedAt };
                }
                return inv;
            }));
        } catch (error) {
            console.error('Error updating meeting status:', error);
        }
    };

    const updateInvitationTime = (id, newDate, newTime) => {
        setInvitations(prev => prev.map(inv => {
            if (inv.id === id) {
                return { ...inv, date: new Date(newDate).toISOString(), time: newTime };
            }
            return inv;
        }));
    };

    const approveNewTime = (invId) => {
        setInvitations(prev => prev.map(inv =>
            inv.id === invId ? {
                ...inv,
                pendingChangeApproval: (inv.pendingChangeApproval || []).filter(id => id !== currentUser.id),
                joined: [...inv.joined, currentUser.id]
            } : inv
        ));
    };

    const rejectNewTime = (invId) => {
        setInvitations(prev => prev.map(inv =>
            inv.id === invId ? { ...inv, pendingChangeApproval: (inv.pendingChangeApproval || []).filter(id => id !== currentUser.id) } : inv
        ));
    };

    const toggleFollow = async (userId) => {
        // Prevent guests from following
        if (isGuest) {
            console.log('❌ Guests cannot follow users');
            return;
        }

        if (!userId || userId === currentUser.id) return;

        // Store original state for rollback
        const originalFollowing = currentUser.following || [];

        try {
            console.log('🔍 toggleFollow called for userId:', userId);

            // Check if target user exists and get their account type
            const targetUserRef = doc(db, 'users', userId);
            const targetUserDoc = await getDoc(targetUserRef);

            if (!targetUserDoc.exists()) {
                console.error('❌ Target user not found in Firestore:', userId);
                console.log('💡 This user may need to complete their profile setup');
                return;
            }

            const targetUserData = targetUserDoc.data();

            console.log('👤 Target user data:', {
                id: userId,
                accountType: targetUserData?.accountType,
                name: targetUserData?.name,
                exists: targetUserDoc.exists()
            });

            // Business accounts cannot be followed - users should join their community instead
            if (targetUserData?.accountType === 'business') {
                console.log('❌ Cannot follow business accounts. Please join their community instead.');
                return;
            }

            // Check if already following
            const isFollowing = originalFollowing.includes(userId);
            console.log('📊 Is following:', isFollowing);

            if (isFollowing) {
                // Unfollow
                console.log('➖ Unfollowing...');

                // Optimistic update - update UI immediately
                const newFollowing = originalFollowing.filter(id => id !== userId);
                updateUserProfile({ following: newFollowing });

                try {
                    await unfollowUser(currentUser.id, userId);
                    console.log('✅ Unfollowed successfully');

                    // Refresh from Firestore to get actual state
                    const currentUserRef = doc(db, 'users', currentUser.id);
                    const currentUserDoc = await getDoc(currentUserRef);
                    const actualFollowing = currentUserDoc.data()?.following || [];
                    console.log('🔄 Refreshed following from Firestore:', actualFollowing);
                    updateUserProfile({ following: actualFollowing });
                } catch (error) {
                    // Revert on failure
                    console.error('❌ Unfollow failed, reverting...', error);
                    updateUserProfile({ following: originalFollowing });
                    throw error;
                }
            } else {
                // Follow (with notification)
                console.log('➕ Following...');
                console.log('📝 Original following:', originalFollowing);

                // Optimistic update - update UI immediately
                const newFollowing = [...originalFollowing, userId];
                console.log('📝 New following (optimistic):', newFollowing);
                updateUserProfile({ following: newFollowing });
                console.log('✅ UI updated optimistically');

                try {
                    const result = await followUser(currentUser.id, userId, {
                        id: currentUser.id,
                        name: currentUser.name || currentUser.displayName,
                        avatar: currentUser.avatar || currentUser.photoURL
                    });
                    console.log('✅ Follow result:', result);

                    // Refresh from Firestore to get actual state
                    const currentUserRef = doc(db, 'users', currentUser.id);
                    const currentUserDoc = await getDoc(currentUserRef);
                    const actualFollowing = currentUserDoc.data()?.following || [];
                    console.log('🔄 Refreshed following from Firestore:', actualFollowing);
                    updateUserProfile({ following: actualFollowing });

                    if (result && result.success === false) {
                        console.log('⚠️ Follow failed:', result.message);
                    } else {
                        console.log('🎉 Follow successful! Synced with Firestore.');
                    }
                } catch (error) {
                    // Revert on failure
                    console.error('❌ Follow failed, reverting...', error);
                    updateUserProfile({ following: originalFollowing });
                    throw error;
                }
            }
        } catch (error) {
            console.error('❌ Error in toggleFollow:', error);
            // Ensure state is reverted
            updateUserProfile({ following: originalFollowing });
        }
    };

    const getFollowingInvitations = () => {
        return invitations.filter(inv => currentUser.following.includes(inv.author?.id));
    };

    const submitRating = (invId, ratingData) => {
        setInvitations(prev => prev.map(inv => (inv.id === invId ? { ...inv, rating: ratingData } : inv)));
        // updateLocalUser Removed
        // updateLocalUser(prev => ({ ...prev, reputation: (prev.reputation || 0) + 10 }));
        addNotification('🌟 شكراً لتقييمك!', 'حصلت على +10 نقاط سمعة.', 'success');
    };

    // Submit restaurant rating
    const submitRestaurantRating = (restaurantId, ratingData) => {
        const review = {
            id: Date.now().toString(),
            userId: currentUser.id,
            userName: currentUser.name,
            userAvatar: currentUser.avatar,
            rating: ratingData.rating,
            comment: ratingData.comment,
            date: new Date().toISOString(),
            helpful: 0
        };

        setRestaurants(prev => prev.map(res => {
            if (res.id === restaurantId) {
                const reviews = [...(res.reviews || []), review];
                const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
                return {
                    ...res,
                    reviews,
                    rating: Math.round(avgRating * 10) / 10 // Round to 1 decimal
                };
            }
            return res;
        }));

        // updateLocalUser Removed
        // updateLocalUser(prev => ({ ...prev, reputation: (prev.reputation || 0) + 15 }));
        addNotification('⭐ شكراً لتقييمك!', 'حصلت على +15 نقطة سمعة.', 'success');
    };

    const updateProfile = async (data) => {
        try {
            // Use Firebase UID, fallback to currentUser.id
            const userId = firebaseUser?.uid || currentUser.id;

            if (!userId || userId === 'guest') {
                throw new Error('Cannot update profile: User not authenticated');
            }

            const userRef = doc(db, 'users', userId);

            // Ensure we keep 'name' and 'avatar' as they are used throughout the app
            const firestoreData = {
                ...data,
                updatedAt: serverTimestamp()
            };

            // Should we also support old field names for compatibility? 
            // Better to stick to one convention. The app uses 'name' and 'avatar'.
            if (data.name) firestoreData.display_name = data.name; // Keep for legacy compatibility if needed
            if (data.avatar) firestoreData.photo_url = data.avatar; // Keep for legacy compatibility if needed

            // Clean data for Firestore
            const cleanData = JSON.parse(JSON.stringify(firestoreData));

            // Update in Firestore
            await setDoc(userRef, cleanData, { merge: true });

            // updateLocalUser Removed - Firestore listener will update state
            // updateLocalUser(data);

            // Also update in AuthContext if available
            if (updateUserProfile) {
                await updateUserProfile(cleanData);
            }

            return true;
        } catch (error) {
            console.error('Error updating profile:', error);
            throw error;
        }
    };
    const updateRestaurant = async (resId, data) => {
        try {
            const targetId = resId === 'new_res' ? (currentUser.id + '_restaurant') : resId;
            const resRef = doc(db, 'restaurants', targetId);

            const cleanData = JSON.parse(JSON.stringify(data));
            if (resId === 'new_res') delete cleanData.id;
            if (!cleanData.ownerId) cleanData.ownerId = currentUser.id;

            await updateDoc(resRef, cleanData).catch(async (err) => {
                if (err.code === 'not-found' || resId === 'new_res') {
                    const { setDoc } = await import('firebase/firestore');
                    await setDoc(resRef, cleanData, { merge: true });
                } else {
                    throw err;
                }
            });
            // Automatically update User Profile Picture to match Business Logo
            if (cleanData.logo && cleanData.logo !== currentUser.avatar) {
                updateUserProfile({ photo_url: cleanData.logo }).catch(console.error);
            }

            return { success: true, id: targetId };
        } catch (error) {
            console.error("Error updating restaurant:", error);
            return { success: false, error };
        }
    };
    const markAllAsRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    const toggleCommunity = async (restaurantId) => {
        if (!restaurantId || !currentUser) return;

        try {
            const isJoined = (currentUser.joinedCommunities || []).includes(restaurantId);
            const newCommunities = isJoined
                ? currentUser.joinedCommunities.filter(id => id !== restaurantId)
                : [...(currentUser.joinedCommunities || []), restaurantId];

            // Update Firestore
            const userRef = doc(db, 'users', currentUser.id);
            await updateDoc(userRef, {
                joinedCommunities: newCommunities
            });

            // Update local state
            updateUserProfile({ joinedCommunities: newCommunities });

            addNotification(
                isJoined ? '👋 تم المغادرة' : '🎉 مرحباً بك!',
                isJoined ? 'تم إلغاء اشتراكك في المجتمع' : 'انضممت للمجتمع بنجاح! ستصلك إشعارات عن الدعوات الجديدة',
                isJoined ? 'info' : 'success'
            );
        } catch (error) {
            console.error('Error toggling community:', error);
            addNotification(
                '❌ خطأ',
                'فشل في تحديث المجتمع. حاول مرة أخرى.',
                'error'
            );
        }
    };

    // Check if current user can edit a specific restaurant
    const canEditRestaurant = (restaurantId) => {
        if (!currentUser) return false;

        // Admins can edit everything
        if (currentUser.userRole === 'admin') return true;

        // Restaurant owners can only edit their own restaurants
        if (currentUser.accountType === 'business') {
            // In a real app, you would check ownership.
            // For now, if they are business, we assume they own the restaurant attached to their profile
            // OR check currentUser.ownedRestaurants
            return currentUser.ownedRestaurants?.includes(restaurantId);
        }

        return false;
    };



    // Submit Report Function
    const submitReport = async (report) => {
        try {
            const reportRef = await addDoc(collection(db, 'reports'), {
                ...report,
                reporterId: currentUser.id,
                reporterName: currentUser.name,
                timestamp: serverTimestamp(),
                status: 'pending'
            });

            const successMsg = currentUser.name === 'ياسر'
                ? 'تم إرسال التبليغ بنجاح. سنقوم بالمراجعة قريباً.'
                : 'Report submitted successfully. We will review it soon.';

            alert(successMsg);
            return { id: reportRef.id, ...report };
        } catch (error) {
            console.error("Error submitting report:", error);
            return null;
        }
    };

    // --- Partner Posts Feature ---
    // --- Partner Posts Feature (Firestore Realtime) ---
    const [partnerPosts, setPartnerPosts] = useState([]);

    useEffect(() => {
        const q = query(collection(db, 'partner_posts'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPartnerPosts(posts);
        }, (error) => console.error("Error syncing partner posts:", error));
        return () => unsubscribe();
    }, []);

    const addPartnerPost = async (restaurantId, postData) => {
        // 1. Check Daily Limit (Client-side check against synced state)
        const today = new Date().toDateString();
        const todaysPosts = partnerPosts.filter(p =>
            p.restaurantId === restaurantId &&
            new Date(p.createdAt).toDateString() === today
        );

        if (todaysPosts.length >= 3) {
            return { success: false, reason: 'limit_exceeded' };
        }

        try {
            const newPost = {
                restaurantId,
                authorId: currentUser.id,
                authorName: currentUser.name,
                authorAvatar: currentUser.avatar || '',
                content: postData.content,
                image: postData.image || null,
                durationHours: postData.durationHours || 24,
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + (postData.durationHours || 24) * 60 * 60 * 1000).toISOString(),
                likes: []
            };

            await addDoc(collection(db, 'partner_posts'), newPost);
            return { success: true };
        } catch (error) {
            console.error("Error adding post:", error);
            return { success: false, reason: 'error' };
        }
    };

    const getPartnerPosts = (restaurantId) => {
        const now = new Date();
        return partnerPosts
            .filter(p => p.restaurantId === restaurantId) // Match restaurant
            .filter(p => new Date(p.expiresAt) > now)     // Not expired
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Newest first
    };

    const deletePartnerPost = async (postId) => {
        try {
            await deleteDoc(doc(db, 'partner_posts', postId));
        } catch (error) {
            console.error("Error deleting post:", error);
        }
    };

    // --- SEED CONTENT FUNCTION (Populate DB) ---


    return (
        <InvitationContext.Provider value={{
            invitations, restaurants, currentUser, loadingInvitations, addInvitation, requestToJoin, cancelRequest,
            approveUser, rejectUser, sendChatMessage, updateMeetingStatus,
            updateInvitationTime, approveNewTime, rejectNewTime,
            notifications, updateProfile, updateRestaurant, markAllAsRead, addNotification,
            toggleFollow, getFollowingInvitations, submitRating, submitRestaurantRating, toggleCommunity, // Removed restoreDefaults
            // Permissions
            canEditRestaurant, // Removed isDemoMode, toggleDemoMode

            // Admin Exports
            allUsers, reports, subscriptionPlans, banUser, resolveReport, updatePlan, sendSystemMessage, addReport, submitReport,
            // Partner Posts Logic
            partnerPosts, addPartnerPost, getPartnerPosts, deletePartnerPost
        }}>
            {children}
        </InvitationContext.Provider >
    );
};

