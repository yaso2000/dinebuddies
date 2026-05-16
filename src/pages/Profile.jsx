import React, { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useProfilePageLogic } from '../hooks/useProfilePageLogic';
import ProfileLoadingShell from '../components/profile/ProfileLoadingShell';
import ProfilePersonalToolbar from '../components/profile/ProfilePersonalToolbar';
import ProfileAvatarAndEditRow from '../components/profile/ProfileAvatarAndEditRow';
import ProfileEditFormPanel from '../components/profile/ProfileEditFormPanel';
import ProfileReadOnlyIdentity from '../components/profile/ProfileReadOnlyIdentity';
import ProfileFollowStatsAndSubscription from '../components/profile/ProfileFollowStatsAndSubscription';
import ProfilePremiumActivePlanCard from '../components/profile/ProfilePremiumActivePlanCard';
import ProfileEnhancementsSection from '../components/profile/ProfileEnhancementsSection';
import ProfileInvitationsPanel from '../components/profile/ProfileInvitationsPanel';

const Profile = () => {
    const { isDark, toggleTheme } = useTheme();
    const logic = useProfilePageLogic();
    const {
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
    } = logic;

    const isOwnProfile = true;
    const enhancementUserId = useMemo(() => currentUser?.uid || currentUser?.id, [currentUser?.uid, currentUser?.id]);

    if (loading || !userProfile || !realtimeUser) {
        return <ProfileLoadingShell t={t} />;
    }

    return (
        <div className="profile-shell profile-page">
            <div className="profile-content">
                <div className="personal-view">
                    <ProfilePersonalToolbar
                        isOwnProfile={isOwnProfile}
                        navigate={navigate}
                        t={t}
                        isDark={isDark}
                        toggleTheme={toggleTheme}
                    />

                    <div className="profile-identity" style={{ marginBottom: 'var(--profile-stack-gap)' }}>
                        <ProfileAvatarAndEditRow
                            isEditing={isEditing}
                            userProfile={userProfile}
                            realtimeUser={realtimeUser}
                            formData={formData}
                            setAvatarFile={setAvatarFile}
                            uploadProgress={uploadProgress}
                            t={t}
                            setIsEditing={setIsEditing}
                        />

                        {isEditing ? (
                            <ProfileEditFormPanel
                                formData={formData}
                                setFormData={setFormData}
                                t={t}
                                currentUser={currentUser}
                                handleSave={handleSave}
                                isSaving={isSaving}
                                cancelEditing={cancelEditing}
                            />
                        ) : (
                            <ProfileReadOnlyIdentity realtimeUser={realtimeUser} t={t} />
                        )}

                        {!isEditing && (
                            <ProfileFollowStatsAndSubscription
                                realtimeUser={realtimeUser}
                                userProfile={userProfile}
                                navigate={navigate}
                                t={t}
                                i18n={i18n}
                            />
                        )}
                    </div>

                    {!isEditing && <ProfilePremiumActivePlanCard userProfile={userProfile} navigate={navigate} t={t} />}

                    {!isEditing && (
                        <>
                            <ProfileEnhancementsSection userId={enhancementUserId} />
                            <ProfileInvitationsPanel
                                t={t}
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                                publicPosted={publicPosted}
                                privatePosted={privatePosted}
                                receivedPrivate={receivedPrivate}
                                myJoinedInvitations={myJoinedInvitations}
                                activeList={activeList}
                                navigate={navigate}
                                deleteInvitation={deleteInvitation}
                                privateInvitations={privateInvitations}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Profile;
