import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AppText } from '../base';
import UserAvatar from '../UserAvatar';
import { getAppTextDirection } from '../../utils/bidiText';

/**
 * Small floating identity card for a Stage participant — shown on click when
 * the avatar grid hides names (desktop). Not a menu: just who this person is.
 */
export default function StageParticipantPreviewCard({ open, anchorRect, member, isHost, onClose }) {
    const { t, i18n } = useTranslation();
    const contentDir = getAppTextDirection(i18n.language);
    const cardRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onOutside = (event) => {
            if (cardRef.current && !cardRef.current.contains(event.target)) {
                onClose?.();
            }
        };
        const onKey = (event) => {
            if (event.key === 'Escape') onClose?.();
        };
        document.addEventListener('pointerdown', onOutside);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onOutside);
            document.removeEventListener('keydown', onKey);
        };
    }, [open, onClose]);

    if (!open || !member || typeof document === 'undefined') return null;

    const top = Math.max(
        8,
        Math.min((anchorRect?.bottom ?? window.innerHeight / 2) + 8, window.innerHeight - 140)
    );
    const left = Math.min(
        window.innerWidth - 220,
        Math.max(8, (anchorRect?.left ?? 16) + (anchorRect?.width || 0) / 2 - 100)
    );

    const name = member.displayName || t('member', 'Member');

    return createPortal(
        <div
            ref={cardRef}
            className="stage-participant-preview-card"
            style={{ top, left }}
            dir={contentDir}
            role="dialog"
            aria-label={name}
        >
            <UserAvatar
                user={member}
                src={member.avatar}
                alt={name}
                className="stage-participant-preview-card__avatar"
                style={{ width: 56, height: 56 }}
            />
            <AppText as="p" className="stage-participant-preview-card__name">
                {name}
            </AppText>
            {isHost ? (
                <AppText as="span" className="stage-participant-preview-card__badge">
                    {t('host', 'Host')}
                </AppText>
            ) : member.isOnline ? (
                <AppText as="span" className="stage-participant-preview-card__status">
                    {t('online', 'Online')}
                </AppText>
            ) : null}
        </div>,
        document.body
    );
}
