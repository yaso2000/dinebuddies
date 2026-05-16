import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getFollowersCount } from '../utils/followHelpers';
import { getSafeAvatar } from '../utils/avatarUtils';
import { uploadProfilePicture } from '../utils/imageUpload';
import { containsExternalLinks } from '../utils/profileBioValidation';
import { buildProfileInvitationLists } from '../utils/profileInvitationLists';

export function useProfilePageLogic() {
    const { t, i18n } = useTranslation();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { currentUser, updateProfile, invitations, privateInvitations, deleteInvitation } = useInvitations();
    const { userProfile, loading } = useAuth();

    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState('public');
    const [isSaving, setIsSaving] = useState(false);
    const [avatarFile, setAvatarFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    const [realtimeUser, setRealtimeUser] = useState(userProfile || currentUser);

    const [formData, setFormData] = useState({
        name: userProfile?.display_name || userProfile?.displayName || currentUser?.name || currentUser?.displayName || '',
        bio: userProfile?.bio || '',
        avatar: getSafeAvatar(userProfile || currentUser),
        interests: userProfile?.interests || [],
        gender: userProfile?.gender || 'male',
        age: userProfile?.age || 18,
        ageCategory: userProfile?.ageCategory || '',
        availableForDating: userProfile?.availableForDating !== false,
    });

    useEffect(() => {
        if (!userProfile?.isBusiness || !currentUser?.uid) return;
        navigate(`/business/${currentUser.uid}`, { replace: true });
    }, [userProfile?.isBusiness, currentUser?.uid, navigate]);

    useEffect(() => {
        if (!currentUser?.uid) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const count = await getFollowersCount(currentUser.uid);
                if (!cancelled) {
                    setRealtimeUser((prev) => ({ ...(prev || {}), followersCount: count }));
                }
            } catch (error) {
                console.error('Error fetching followers count:', error);
            }
        })();
        return () => { cancelled = true; };
    }, [currentUser?.uid]);

    useEffect(() => {
        if (!currentUser?.uid) return;
        const currentData = userProfile || currentUser;
        if (!currentData) return;

        setRealtimeUser((prev) => ({
            ...(prev || {}),
            ...currentData,
            id: currentUser.uid,
            followersCount: typeof prev?.followersCount === 'number' ? prev.followersCount : (currentData.followersCount ?? 0),
            avatar: getSafeAvatar({ ...(prev || {}), ...currentData }),
        }));

        if (!isEditing) {
            setFormData({
                name: currentData.display_name || currentData.displayName || currentData.name || '',
                bio: currentData.bio || '',
                avatar: getSafeAvatar(currentData),
                interests: currentData.interests || [],
                gender: currentData.gender || 'male',
                age: currentData.age || 25,
                ageCategory: currentData.ageCategory || '',
                phone: currentData.phone || '',
                availableForDating: currentData.availableForDating !== false,
            });
        }
    }, [currentUser?.uid, isEditing, userProfile]);

    const profileUid = currentUser?.uid || currentUser?.id;

    const { publicPosted, privatePosted, receivedPrivate, myJoinedInvitations } = useMemo(
        () => buildProfileInvitationLists({ invitations, privateInvitations, profileUid }),
        [invitations, privateInvitations, profileUid]
    );

    const activeList = useMemo(() => {
        switch (activeTab) {
            case 'public':
                return publicPosted;
            case 'private':
                return [...privatePosted, ...receivedPrivate];
            case 'joined':
                return myJoinedInvitations;
            default:
                return [];
        }
    }, [activeTab, publicPosted, privatePosted, receivedPrivate, myJoinedInvitations]);

    const handleSave = useCallback(async () => {
        if (isSaving) return;
        const trimmedName = (formData.name || '').trim();
        if (!trimmedName) {
            showToast(
                i18n.language === 'ar'
                    ? t('please_enter_name', { defaultValue: 'يرجى إدخال الاسم' })
                    : 'Please enter your name',
                'error'
            );
            return;
        }

        if (containsExternalLinks(formData.bio)) {
            showToast(
                i18n.language === 'ar'
                    ? t('no_external_links')
                    : '⚠️ External links and social media accounts are not allowed in profile',
                'error'
            );
            return;
        }

        setIsSaving(true);
        setUploadProgress(0);

        try {
            let finalAvatar = formData.avatar;
            if (avatarFile && currentUser?.uid) {
                finalAvatar = await uploadProfilePicture(avatarFile, currentUser.uid, (progress) =>
                    setUploadProgress(progress)
                );
            }

            await updateProfile({
                name: trimmedName,
                bio: formData.bio,
                availableForDating: formData.availableForDating,
                avatar: finalAvatar,
            });
            setIsEditing(false);
            setAvatarFile(null);
            setUploadProgress(0);
        } catch (e) {
            console.error(e);
            showToast(i18n.language === 'ar' ? t('failed_save_profile') : 'Failed to save profile', 'error');
        } finally {
            setIsSaving(false);
        }
    }, [
        isSaving,
        formData,
        avatarFile,
        currentUser?.uid,
        updateProfile,
        showToast,
        i18n.language,
        t,
    ]);

    const cancelEditing = useCallback(() => {
        setAvatarFile(null);
        setUploadProgress(0);
        setIsEditing(false);
    }, []);

    return {
        t,
        i18n,
        navigate,
        currentUser,
        userProfile,
        loading,
        realtimeUser,
        formData,
        setFormData,
        isEditing,
        setIsEditing,
        activeTab,
        setActiveTab,
        isSaving,
        avatarFile,
        setAvatarFile,
        uploadProgress,
        handleSave,
        cancelEditing,
        publicPosted,
        privatePosted,
        receivedPrivate,
        myJoinedInvitations,
        activeList,
        deleteInvitation,
        privateInvitations,
    };
}
