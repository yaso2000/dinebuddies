import React, { useEffect } from 'react';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';

/**
 * مكون تشخيصي لفحص بيانات الأصدقاء
 * استخدم هذا المكون للتحقق من أن البيانات تُجلب بشكل صحيح
 */
const FriendsDebugger = () => {
    const { allUsers } = useInvitations();
    const { userProfile, currentUser } = useAuth();

    useEffect(() => {
        console.log('=== FRIENDS DEBUGGER ===');
        console.log('1. Auth Context Data:', {
            hasCurrentUser: !!currentUser,
            currentUserId: currentUser?.uid,
            hasUserProfile: !!userProfile,
            userProfileFollowing: userProfile?.following,
            userProfileFollowingCount: userProfile?.following?.length || 0
        });

        console.log('2. All Users Data:', {
            allUsersCount: allUsers?.length || 0,
            allUsers: allUsers?.map(u => ({
                id: u.id,
                name: u.display_name || u.name,
                hasFollowing: !!u.following,
                followingCount: u.following?.length || 0
            }))
        });

        if (userProfile?.following && allUsers) {
            const myFollowing = userProfile.following;
            const matchedUsers = allUsers.filter(u => myFollowing.includes(u.id));

            console.log('3. Matched Friends:', {
                myFollowingIds: myFollowing,
                matchedCount: matchedUsers.length,
                matchedUsers: matchedUsers.map(u => ({
                    id: u.id,
                    name: u.display_name || u.name,
                    photo: u.photo_url || u.avatar
                }))
            });

            // Check for mismatches
            const unmatchedIds = myFollowing.filter(id => !allUsers.find(u => u.id === id));
            if (unmatchedIds.length > 0) {
                console.warn('⚠️ Following IDs not found in allUsers:', unmatchedIds);
            }
        }

        console.log('======================');
    }, [currentUser, userProfile, allUsers]);

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: '#1e293b',
            color: 'white',
            padding: '15px',
            borderRadius: '12px',
            border: '2px solid #8b5cf6',
            maxWidth: '300px',
            zIndex: 10000,
            fontSize: '12px'
        }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#8b5cf6' }}>🔍 Friends Debugger</h4>
            <div style={{ marginBottom: '8px' }}>
                <strong>Following:</strong> {userProfile?.following?.length || 0}
            </div>
            <div style={{ marginBottom: '8px' }}>
                <strong>All Users:</strong> {allUsers?.length || 0}
            </div>
            <div style={{ marginBottom: '8px' }}>
                <strong>Matched:</strong> {
                    userProfile?.following && allUsers
                        ? allUsers.filter(u => userProfile.following.includes(u.id)).length
                        : 0
                }
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '10px' }}>
                Check console for detailed logs
            </div>
        </div>
    );
};

export default FriendsDebugger;
