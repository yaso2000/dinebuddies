import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaBan, FaChevronLeft, FaDoorOpen, FaVolumeMute } from 'react-icons/fa';
import { AppText } from '../base';
import { getAppTextDirection } from '../../utils/bidiText';

/**
 * Host long-press menu for a Stage guest:
 * Mute (5m / 1h / entire broadcast) · Kick · Block (all future Stages).
 */
export default function StageHostGuestModerationMenu({
    open,
    anchorRect,
    member,
    busy = false,
    onMute,
    onKick,
    onBlock,
    onClose,
}) {
    const { t, i18n } = useTranslation();
    const contentDir = getAppTextDirection(i18n.language);
    const menuRef = useRef(null);
    const [panel, setPanel] = useState('root'); // root | mute

    useEffect(() => {
        if (!open) {
            setPanel('root');
            return undefined;
        }
        const onOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
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
        Math.min(
            (anchorRect?.top ?? window.innerHeight / 2) - 8,
            window.innerHeight - 220
        )
    );
    const left = Math.min(
        window.innerWidth - 220,
        Math.max(8, (anchorRect?.left ?? 16) + (anchorRect?.width || 0) / 2 - 100)
    );

    const name = member.displayName || t('member', 'Member');

    return createPortal(
        <div
            ref={menuRef}
            className="stage-host-guest-mod-menu"
            style={{ top, left }}
            dir={contentDir}
            role="menu"
            aria-label={t('stage_host_moderation_menu', 'Guest moderation')}
        >
            <AppText as="p" className="stage-host-guest-mod-menu__title">
                {name}
            </AppText>

            {panel === 'mute' ? (
                <>
                    <button
                        type="button"
                        className="stage-host-guest-mod-menu__item"
                        role="menuitem"
                        disabled={busy}
                        onClick={() => setPanel('root')}
                    >
                        <FaChevronLeft size={13} aria-hidden />
                        <AppText as="span">{t('back', 'Back')}</AppText>
                    </button>
                    <button
                        type="button"
                        className="stage-host-guest-mod-menu__item"
                        role="menuitem"
                        disabled={busy}
                        onClick={() => onMute?.('5m')}
                    >
                        <AppText as="span">
                            {t('stage_mute_5_minutes', '5 minutes')}
                        </AppText>
                    </button>
                    <button
                        type="button"
                        className="stage-host-guest-mod-menu__item"
                        role="menuitem"
                        disabled={busy}
                        onClick={() => onMute?.('1h')}
                    >
                        <AppText as="span">{t('stage_mute_1_hour', '1 hour')}</AppText>
                    </button>
                    <button
                        type="button"
                        className="stage-host-guest-mod-menu__item"
                        role="menuitem"
                        disabled={busy}
                        onClick={() => onMute?.('session')}
                    >
                        <AppText as="span">
                            {t('stage_mute_entire_broadcast', 'Entire broadcast')}
                        </AppText>
                    </button>
                </>
            ) : (
                <>
                    <button
                        type="button"
                        className="stage-host-guest-mod-menu__item"
                        role="menuitem"
                        disabled={busy}
                        onClick={() => setPanel('mute')}
                    >
                        <FaVolumeMute size={14} aria-hidden />
                        <AppText as="span">{t('mute_member', 'Mute')}</AppText>
                    </button>
                    <button
                        type="button"
                        className="stage-host-guest-mod-menu__item stage-host-guest-mod-menu__item--danger"
                        role="menuitem"
                        disabled={busy}
                        onClick={() => onKick?.()}
                    >
                        <FaDoorOpen size={14} aria-hidden />
                        <AppText as="span">
                            {t('stage_kick_from_broadcast', 'Remove from broadcast')}
                        </AppText>
                    </button>
                    <button
                        type="button"
                        className="stage-host-guest-mod-menu__item stage-host-guest-mod-menu__item--danger"
                        role="menuitem"
                        disabled={busy}
                        onClick={() => onBlock?.()}
                    >
                        <FaBan size={14} aria-hidden />
                        <AppText as="span">
                            {t('stage_block_from_stages', 'Block from all Stages')}
                        </AppText>
                    </button>
                </>
            )}
        </div>,
        document.body
    );
}
