import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaEllipsisH, FaFlag, FaBan } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import { toggleUserBlock } from '../utils/userSocialLists';
import NewReportModal from './NewReportModal';
import { AppText } from './base';

/**
 * Report / block control for a story-rail game card (Camera or AI, Guess my sign).
 * Required for UGC compliance: viewers must be able to report objectionable content
 * and block the person who posted it. Renders an absolutely-positioned "⋯" button
 * in the card's top corner — the parent card must be `position: relative`.
 *
 * @param {{ ownerId: string, ownerName?: string, onBlocked?: () => void }} props
 */
export default function GameCardReport({ ownerId, ownerName, onBlocked }) {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const { submitReport } = useInvitations();
    const { showToast } = useToast();
    const uid = currentUser?.uid || null;
    const [menuOpen, setMenuOpen] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);

    if (!ownerId || ownerId === uid) return null;

    const doBlock = async () => {
        setMenuOpen(false);
        try {
            await toggleUserBlock(uid, ownerId, true);
            showToast(t('user_blocked', 'Blocked. You won’t see their cards.'), 'success');
            onBlocked?.();
        } catch {
            showToast(t('action_failed', 'Something went wrong. Try again.'), 'error');
        }
    };

    return (
        <>
            <button type="button" aria-label={t('more', 'More')}
                onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                style={{ position: 'absolute', top: 12, insetInlineEnd: 12, zIndex: 20, width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.45)', color: '#fff', display: 'grid', placeItems: 'center', backdropFilter: 'blur(4px)' }}>
                <FaEllipsisH />
            </button>

            {menuOpen ? (
                <div onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
                    style={{ position: 'fixed', inset: 0, zIndex: 70 }}>
                    <div onClick={(e) => e.stopPropagation()}
                        style={{ position: 'absolute', top: 54, insetInlineEnd: 12, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, overflow: 'hidden', minWidth: 180, boxShadow: '0 10px 30px rgba(0,0,0,0.35)' }}>
                        <button type="button" onClick={() => { setMenuOpen(false); setReportOpen(true); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '13px 16px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'inherit' }}>
                            <FaFlag color="#f43f5e" /> <AppText as="span">{t('report', 'Report')}</AppText>
                        </button>
                        <div style={{ height: 1, background: 'var(--border-color)' }} />
                        <button type="button" onClick={doBlock}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '13px 16px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'inherit' }}>
                            <FaBan /> <AppText as="span">{t('block_user', 'Block')}</AppText>
                        </button>
                    </div>
                </div>
            ) : null}

            {reportOpen ? (
                <NewReportModal
                    isOpen
                    onClose={() => setReportOpen(false)}
                    reportType="user"
                    targetId={ownerId}
                    targetName={ownerName || ''}
                    onSubmit={submitReport}
                />
            ) : null}
        </>
    );
}
