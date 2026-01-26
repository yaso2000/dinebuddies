import React, { createContext, useContext, useState, useEffect } from 'react';
import { invitations as initialData, restaurants as initialRestaurants } from '../data/mockData';
import { v4 as uuidv4 } from 'uuid';

const InvitationContext = createContext();

const STORAGE_KEYS = {
    USER: 'db_user_data_v1',
    INVITATIONS: 'db_invitations_v1'
};

export const useInvitations = () => {
    const context = useContext(InvitationContext);
    if (!context) {
        return {
            invitations: [], restaurants: [], currentUser: { id: 'guest', name: 'Guest', accountType: 'individual', following: [] },
            notifications: [], addInvitation: () => { }, requestToJoin: () => { }, cancelRequest: () => { },
            approveUser: () => { }, rejectUser: () => { }, sendChatMessage: () => { }, updateMeetingStatus: () => { },
            updateInvitationTime: () => { }, approveNewTime: () => { }, rejectNewTime: () => { },
            updateProfile: () => { }, updateRestaurant: () => { }, markAllAsRead: () => { },
            getFollowingInvitations: () => [], toggleFollow: () => { }, submitRating: () => { }, toggleCommunity: () => { }
        };
    }
    return context;
};

export const InvitationProvider = ({ children }) => {
    // --- 1. Current User ---
    const [currentUser, setCurrentUser] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.USER);
            if (saved && saved !== 'undefined') {
                const parsed = JSON.parse(saved);
                return {
                    ...parsed,
                    id: parsed.id || 'current_user',
                    accountType: parsed.accountType || 'individual', // 'individual', 'partner', 'admin'
                    userRole: parsed.userRole || 'user', // 'user', 'partner_owner', 'admin'
                    ownedRestaurants: Array.isArray(parsed.ownedRestaurants) ? parsed.ownedRestaurants : [], // IDs of restaurants owned
                    following: Array.isArray(parsed.following) ? parsed.following : ['user_1', 'user_2'],
                    reputation: Number(parsed.reputation) || 450
                };
            }
        } catch (e) { console.error("User parity error", e); }
        return {
            id: 'current_user',
            name: 'ياسر',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Yaser',
            accountType: 'individual',
            userRole: 'user', // Regular user by default
            ownedRestaurants: [], // Empty for regular users
            bio: '',
            interests: ['تذوق الطعام', 'أفلام آيماكس'],
            following: ['user_1', 'user_2'],
            followersCount: 124,
            reputation: 450,
            joinedCommunities: [],
            age: 28, // User's age for eligibility checking
            gender: 'male' // 'male', 'female', 'other'
        };
    });

    // --- DEMO MODE: Set to false in production ---
    // When true, anyone can edit any restaurant (for testing/development)
    // When false, only restaurant owners can edit their own restaurants
    const [isDemoMode, setIsDemoMode] = useState(true);

    // --- 2. Invitations Logic ---
    const [invitations, setInvitations] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.INVITATIONS);
            let list = saved ? JSON.parse(saved) : [];
            if (!Array.isArray(list)) list = [];

            const existingIds = new Set(list.map(i => i.id));
            const freshMocks = (initialData || []).filter(m => !existingIds.has(m.id))
                .map(m => ({ ...m, meetingStatus: 'planning' }));

            const combined = [...list, ...freshMocks];

            return combined.map(inv => ({
                ...inv,
                requests: Array.isArray(inv.requests) ? inv.requests : [],
                joined: Array.isArray(inv.joined) ? inv.joined : [],
                chat: Array.isArray(inv.chat) ? inv.chat : [],
                meetingStatus: inv.meetingStatus || 'planning',
                author: inv.author && typeof inv.author === 'object' ? inv.author : { id: 'system', name: 'DineBuddies' }
            }));
        } catch (e) { return initialData || []; }
    });

    const [restaurants, setRestaurants] = useState(initialRestaurants || []);
    const [notifications, setNotifications] = useState([
        { id: 'n1', title: 'تم قبول طلبك!', message: 'وافق أحمد على انضمامك لدعوة العشاء.', time: '١٠ دقائق', read: false, type: 'approval' }
    ]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
    }, [currentUser]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.INVITATIONS, JSON.stringify(invitations));
    }, [invitations]);

    const addNotification = (title, message, type = 'info') => {
        setNotifications(prev => [{ id: uuidv4(), title, message, time: 'الآن', read: false, type }, ...prev]);
    };

    const addInvitation = (newInvite) => {
        try {
            if (!newInvite.title) return false;
            const invite = {
                ...newInvite,
                id: uuidv4(),
                author: { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar },
                requests: [], joined: [], chat: [], meetingStatus: 'planning',
                date: newInvite.date || new Date().toISOString(),
                time: newInvite.time || '20:30',
                lat: newInvite.lat || (24.7136 + (Math.random() - 0.5) * 0.1),
                lng: newInvite.lng || (46.6753 + (Math.random() - 0.5) * 0.1)
            };
            setInvitations(prev => [invite, ...prev]);
            addNotification('تم النشر!', 'دعوتك متاحة الآن للجميع.', 'success');

            // Send notification to partner if invitation is at their restaurant
            if (newInvite.restaurantId) {
                const restaurant = restaurants.find(r => r.id === newInvite.restaurantId);
                if (restaurant) {
                    // In real app, this would send a push notification to the restaurant owner
                    console.log(`📧 Notification sent to ${restaurant.name}: New booking by ${currentUser.name} for ${invite.guestsNeeded} guests on ${invite.date}`);

                    // Add notification to partner's notification list (simulated)
                    addPartnerNotification(restaurant.id, {
                        type: 'new_booking',
                        title: '🎉 حجز جديد!',
                        message: `${currentUser.name} حجز طاولة لـ ${invite.guestsNeeded} أشخاص في ${restaurant.name}`,
                        invitationId: invite.id,
                        date: invite.date,
                        time: invite.time,
                        guestsNeeded: invite.guestsNeeded
                    });
                }
            }

            return invite.id;
        } catch (err) { return false; }
    };

    // Helper function to add partner notifications
    const addPartnerNotification = (restaurantId, notificationData) => {
        // In a real app, this would be stored in a database and sent via push notification
        // For now, we'll just log it and store it in localStorage
        const partnerNotifications = JSON.parse(localStorage.getItem('partner_notifications') || '[]');
        partnerNotifications.unshift({
            id: uuidv4(),
            restaurantId,
            ...notificationData,
            timestamp: new Date().toISOString(),
            read: false
        });
        localStorage.setItem('partner_notifications', JSON.stringify(partnerNotifications));
        console.log('📱 Partner notification added:', notificationData);
    };

    const requestToJoin = (invId) => {
        setInvitations(prev => prev.map(inv =>
            inv.id === invId && !inv.requests.includes(currentUser.id)
                ? { ...inv, requests: [...inv.requests, currentUser.id] } : inv
        ));
    };

    const cancelRequest = (invId) => {
        setInvitations(prev => prev.map(inv =>
            inv.id === invId ? { ...inv, requests: inv.requests.filter(id => id !== currentUser.id) } : inv
        ));
    };

    const approveUser = (invId, userId) => {
        setInvitations(prev => prev.map(inv => {
            if (inv.id === invId) {
                const newJoined = [...inv.joined, userId];
                const isFull = newJoined.length >= inv.guestsNeeded;

                // Send notification to partner about new member
                if (inv.restaurantId) {
                    const restaurant = restaurants.find(r => r.id === inv.restaurantId);
                    if (restaurant) {
                        addPartnerNotification(restaurant.id, {
                            type: 'member_joined',
                            title: '👥 عضو جديد انضم!',
                            message: `انضم عضو جديد للحجز في ${restaurant.name}. العدد الحالي: ${newJoined.length}/${inv.guestsNeeded}`,
                            invitationId: inv.id,
                            currentCount: newJoined.length,
                            totalNeeded: inv.guestsNeeded
                        });

                        // Send notification when group is full
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

                return {
                    ...inv,
                    requests: inv.requests.filter(id => id !== userId),
                    joined: newJoined,
                    chat: [...inv.chat, {
                        id: uuidv4(),
                        senderId: 'system',
                        senderName: 'DineBuddies',
                        text: isFull ? 'اكتمل العدد! 🎉' : 'انضم عضو جديد! 🎉',
                        timestamp: new Date().toISOString()
                    }]
                };
            }
            return inv;
        }));
    };

    const rejectUser = (invId, userId) => {
        setInvitations(prev => prev.map(inv =>
            inv.id === invId ? { ...inv, requests: inv.requests.filter(id => id !== userId) } : inv
        ));
    };

    const sendChatMessage = (invId, text) => {
        const msg = { id: uuidv4(), senderId: currentUser.id, senderName: currentUser.name, text, timestamp: new Date().toISOString() };
        setInvitations(prev => prev.map(inv => inv.id === invId ? { ...inv, chat: [...(inv.chat || []), msg] } : inv));
    };

    const updateMeetingStatus = (id, status) => {
        setInvitations(prev => prev.map(inv => {
            if (inv.id === id) {
                const sysMsg = { id: uuidv4(), senderId: 'system', senderName: 'DineBuddies', text: `تحديث الحالة: ${status}`, timestamp: new Date().toISOString() };
                return { ...inv, meetingStatus: status, chat: [...(inv.chat || []), sysMsg] };
            }
            return inv;
        }));
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

    const toggleFollow = (userId) => {
        if (!userId || userId === currentUser.id) return;
        setCurrentUser(prev => {
            const isFollowing = prev.following.includes(userId);
            return {
                ...prev,
                following: isFollowing ? prev.following.filter(id => id !== userId) : [...prev.following, userId]
            };
        });
    };

    const getFollowingInvitations = () => {
        return invitations.filter(inv => currentUser.following.includes(inv.author?.id));
    };

    const submitRating = (invId, ratingData) => {
        setInvitations(prev => prev.map(inv => (inv.id === invId ? { ...inv, rating: ratingData } : inv)));
        setCurrentUser(prev => ({ ...prev, reputation: (prev.reputation || 0) + 10 }));
        addNotification('🌟 شكراً لتقييمك!', 'حصلت على +10 نقاط سمعة.', 'success');
    };

    const updateProfile = (data) => setCurrentUser(prev => ({ ...prev, ...data }));
    const updateRestaurant = (resId, data) => setRestaurants(prev => prev.map(res => res.id === resId ? { ...res, ...data } : res));
    const markAllAsRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    const toggleCommunity = (restaurantId) => {
        if (!restaurantId) return;
        setCurrentUser(prev => {
            const isJoined = (prev.joinedCommunities || []).includes(restaurantId);
            const newCommunities = isJoined
                ? prev.joinedCommunities.filter(id => id !== restaurantId)
                : [...(prev.joinedCommunities || []), restaurantId];

            addNotification(
                isJoined ? '👋 تم المغادرة' : '🎉 مرحباً بك!',
                isJoined ? 'تم إلغاء اشتراكك في المجتمع' : 'انضممت للمجتمع بنجاح! ستصلك إشعارات عن الدعوات الجديدة',
                isJoined ? 'info' : 'success'
            );

            return { ...prev, joinedCommunities: newCommunities };
        });
    };

    // --- Permission Checking ---
    const canEditRestaurant = (restaurantId) => {
        // In demo mode, anyone can edit
        if (isDemoMode) return true;

        // Admins can edit everything
        if (currentUser.userRole === 'admin') return true;

        // Restaurant owners can only edit their own restaurants
        if (currentUser.userRole === 'partner_owner') {
            return currentUser.ownedRestaurants.includes(restaurantId);
        }

        // Regular users cannot edit
        return false;
    };

    // Toggle demo mode (for development/testing)
    const toggleDemoMode = () => {
        setIsDemoMode(prev => !prev);
        addNotification(
            isDemoMode ? '🔒 وضع الإنتاج' : '🔓 وضع التجربة',
            isDemoMode
                ? 'الآن فقط أصحاب المنشآت يمكنهم التعديل'
                : 'الآن يمكن لأي شخص التعديل (للتجربة فقط)',
            'info'
        );
    };

    // Switch user account (for testing different roles)
    const switchUserAccount = (accountType) => {
        const accounts = {
            user: {
                id: 'current_user',
                name: 'ياسر',
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Yaser',
                userRole: 'user',
                ownedRestaurants: [],
                accountType: 'individual'
            },
            partner: {
                id: 'partner_user',
                name: 'مدير Le Bistro',
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Manager',
                userRole: 'partner_owner',
                ownedRestaurants: ['res_1'], // Owns Le Bistro Premium
                accountType: 'partner'
            },
            admin: {
                id: 'admin_user',
                name: 'مدير النظام',
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin',
                userRole: 'admin',
                ownedRestaurants: [],
                accountType: 'admin'
            }
        };

        const newAccount = accounts[accountType];
        if (newAccount) {
            setCurrentUser(prev => ({
                ...prev,
                ...newAccount,
                following: prev.following,
                followersCount: prev.followersCount,
                reputation: prev.reputation,
                joinedCommunities: prev.joinedCommunities
            }));
            addNotification(
                '🔄 تم تبديل الحساب',
                `أنت الآن: ${newAccount.name}`,
                'info'
            );
        }
    };

    const restoreDefaults = () => {
        const confirmMsg = currentUser.name === 'ياسر' ? 'هل أنت متأكد من مسح كافة البيانات والعودة للبداية؟' : 'Are you sure you want to reset all data?';
        if (window.confirm(confirmMsg)) {
            localStorage.clear();
            window.location.reload();
        }
    };

    return (
        <InvitationContext.Provider value={{
            invitations, restaurants, currentUser, addInvitation, requestToJoin, cancelRequest,
            approveUser, rejectUser, sendChatMessage, updateMeetingStatus,
            updateInvitationTime, approveNewTime, rejectNewTime,
            notifications, updateProfile, updateRestaurant, markAllAsRead, addNotification,
            restoreDefaults, toggleFollow, getFollowingInvitations, submitRating, toggleCommunity,
            // New permission and demo mode functions
            canEditRestaurant, isDemoMode, toggleDemoMode, switchUserAccount
        }}>
            {children}
        </InvitationContext.Provider>
    );
};

