import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaTimes, FaCrown } from 'react-icons/fa';
import StageParticipantActions from './community/StageParticipantActions';
import { useProfileGiftPicker } from '../hooks/useProfileGiftPicker';
import { AppText } from './base';

/** Small round avatar (image or initial) — self-contained to avoid page-local deps. */
function SheetAvatar({ src, name, size = 44 }) {
    if (src) {
        return <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
    }
    return (
        <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: 'var(--primary)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800 }}>
            {String(name || '?').charAt(0).toUpperCase()}
        </div>
    );
}

/**
 * Floating participants list for a group game — the point of these games is to
 * connect people, so tapping the player count opens this: everyone's profile
 * with wave / gift / follow (the same actions used in Stage rooms).
 *
 * @param {{ players: Array<{uid:string,name:string,avatar?:string}>, hostId?: string, onClose: () => void }} props
 */
export default function GroupGameParticipantsSheet({ players = [], hostId, onClose, title }) {
    const { t } = useTranslation();
    const { openGiftPicker, giftModal } = useProfileGiftPicker();
    const heading = title || t('group_game_players', 'Players');

    return createPortal(
        <>
            <div onClick={onClose}
                style={{ position: 'fixed', inset: 0, zIndex: 2000000200, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <div onClick={(e) => e.stopPropagation()}
                    style={{ width: '100%', maxWidth: 520, maxHeight: '82vh', background: 'var(--bg-body)', borderTopLeftRadius: 20, borderTopRightRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 -8px 30px rgba(0,0,0,0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: '1px solid var(--border-color)' }}>
                        <AppText as="h3" style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, flex: 1 }}>
                            {heading} · {players.length}
                        </AppText>
                        <button type="button" onClick={onClose} aria-label={t('close', 'Close')}
                            style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'var(--bg-elevated)', color: 'var(--text-main)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                            <FaTimes />
                        </button>
                    </div>

                    <div style={{ overflowY: 'auto', padding: '10px 14px calc(16px + env(safe-area-inset-bottom, 0px))' }}>
                        {players.map((p) => {
                            const member = { id: p.uid, uid: p.uid, name: p.name, display_name: p.name, displayName: p.name, avatar: p.avatar, photoURL: p.avatar };
                            return (
                                <div key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: '1px solid var(--border-color)' }}>
                                    <SheetAvatar src={p.avatar} name={p.name} size={44} />
                                    <AppText as="span" style={{ flex: 1, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                                        {hostId && p.uid === hostId ? <FaCrown size={12} color="var(--primary)" title={t('group_game_host', 'Host')} /> : null}
                                    </AppText>
                                    <StageParticipantActions member={member} onGift={openGiftPicker} />
                                </div>
                            );
                        })}
                        {players.length === 0 ? (
                            <AppText as="p" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>{t('group_game_no_players', 'No players yet.')}</AppText>
                        ) : null}
                    </div>
                </div>
            </div>
            {giftModal}
        </>,
        document.body
    );
}
