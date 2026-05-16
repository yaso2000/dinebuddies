import React, { memo, useCallback, useState } from 'react';
import { FaChevronRight } from 'react-icons/fa';

function ProfileInvitationListItem({ inv, navigate, t }) {
    const thumbSrc =
        inv.customImage || inv.restaurantImage || inv.videoThumbnail || inv.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400';
    const [imgLoaded, setImgLoaded] = useState(false);
    const go = useCallback(() => {
        navigate(inv.privacy === 'private' ? `/invitation/private/${inv.id}` : `/invitation/${inv.id}`);
    }, [inv.privacy, inv.id, navigate]);

    const onKeyDown = useCallback(
        (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                go();
            }
        },
        [go]
    );

    return (
        <div className="profile-invitation-item" onClick={go} role="button" tabIndex={0} onKeyDown={onKeyDown}>
            <div className="profile-invitation-item__thumb-wrap" style={{ position: 'relative', width: 42, height: 42, flexShrink: 0 }}>
                {!imgLoaded && (
                    <div
                        className="profile-invitation-item__thumb-skeleton"
                        aria-hidden
                        style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 8,
                            background: 'var(--hover-overlay)',
                        }}
                    />
                )}
                <img
                    className="profile-invitation-item__thumb"
                    src={thumbSrc}
                    loading="lazy"
                    decoding="async"
                    onLoad={() => setImgLoaded(true)}
                    onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400';
                        setImgLoaded(true);
                    }}
                    alt={inv.title}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: imgLoaded ? 1 : 0,
                        transition: 'opacity 0.2s ease',
                    }}
                />
            </div>
            <div className="profile-invitation-item__content">
                <div className="profile-invitation-item__title-row">
                    <h4 className="profile-invitation-item__title">{inv.title}</h4>
                    {inv.privacy === 'private' ? (
                        <span className="profile-invitation-item__badge profile-invitation-item__badge--private">{t('type_private')}</span>
                    ) : (
                        <span className="profile-invitation-item__badge profile-invitation-item__badge--public">{t('type_public', 'Public')}</span>
                    )}
                </div>
                <span className="profile-invitation-item__date">{inv.date ? inv.date.split('T')[0] : 'Today'}</span>
            </div>
            <FaChevronRight style={{ opacity: 0.3, flexShrink: 0 }} />
        </div>
    );
}

export default memo(ProfileInvitationListItem);
