import React, { memo, useCallback, useEffect, useState } from 'react';
import { FaEdit } from 'react-icons/fa';
import ImageUpload from '../ImageUpload';
import { getSafeAvatar } from '../../utils/avatarUtils';

function ProfileAvatarAndEditRow({
    isEditing,
    userProfile,
    realtimeUser,
    formData,
    setAvatarFile,
    uploadProgress,
    t,
    setIsEditing,
}) {
    const avatarSrc = getSafeAvatar(realtimeUser);
    const [avatarLoaded, setAvatarLoaded] = useState(false);

    useEffect(() => {
        setAvatarLoaded(false);
    }, [avatarSrc]);

    const onEditClick = useCallback(() => setIsEditing(true), [setIsEditing]);

    return (
        <div
            className="profile-avatar-edit-row"
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
                marginBottom: '0.5rem',
            }}
        >
            <div style={{ display: 'inline-block', position: 'relative' }}>
                {isEditing ? (
                    <>
                        <ImageUpload
                            currentImage={getSafeAvatar(formData)}
                            onImageSelect={setAvatarFile}
                            onImageRemove={() => setAvatarFile(null)}
                            shape="circle"
                            size="large"
                            label={t('change_photo')}
                        />
                        {uploadProgress > 0 && uploadProgress < 100 && (
                            <div
                                style={{
                                    marginTop: '10px',
                                    background: 'var(--card-bg)',
                                    borderRadius: '10px',
                                    padding: '8px 12px',
                                    fontSize: '0.85rem',
                                }}
                            >
                                <div style={{ marginBottom: '5px', color: 'var(--text-secondary)' }}>
                                    {t('uploading_progress')} {Math.round(uploadProgress)}%
                                </div>
                                <div
                                    style={{
                                        height: '4px',
                                        background: 'var(--border-color)',
                                        borderRadius: '2px',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div
                                        style={{
                                            height: '100%',
                                            background: 'var(--primary)',
                                            width: `${uploadProgress}%`,
                                            transition: 'width 0.3s',
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div
                        className="host-avatar-container"
                        style={{
                            width: '100px',
                            height: '100px',
                            margin: '0 auto',
                            border: `3px solid ${
                                userProfile?.role === 'business' || realtimeUser?.role === 'business'
                                    ? 'var(--border-color)'
                                    : realtimeUser?.gender === 'female'
                                      ? '#ec4899'
                                      : realtimeUser?.gender === 'male'
                                        ? '#3b82f6'
                                        : '#a855f7'
                            }`,
                            position: 'relative',
                            background: 'var(--hover-overlay)',
                            overflow: 'hidden',
                        }}
                    >
                        {!avatarLoaded && (
                            <div
                                aria-hidden
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'var(--hover-overlay)',
                                }}
                            />
                        )}
                        <img
                            src={avatarSrc}
                            alt={formData.name}
                            className="host-avatar"
                            decoding="async"
                            loading="eager"
                            onLoad={() => setAvatarLoaded(true)}
                            onError={(e) => {
                                if (!e.target.src.includes('ui-avatars.com')) {
                                    e.target.src = getSafeAvatar(null);
                                }
                                setAvatarLoaded(true);
                            }}
                            style={{
                                opacity: avatarLoaded ? 1 : 0,
                                transition: 'opacity 0.2s ease',
                            }}
                        />
                    </div>
                )}
            </div>

            {!isEditing && !userProfile?.isGuest && (
                <button
                    type="button"
                    className="ui-btn ui-btn--secondary profile-edit-beside-avatar"
                    onClick={onEditClick}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: 700,
                        padding: '10px 16px',
                        borderRadius: '12px',
                        flexShrink: 0,
                    }}
                >
                    <FaEdit size={16} aria-hidden />
                    {t('edit_profile') || 'Edit Profile'}
                </button>
            )}
        </div>
    );
}

export default memo(ProfileAvatarAndEditRow);
