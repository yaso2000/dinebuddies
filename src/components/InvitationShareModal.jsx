import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaShareAlt, FaDownload, FaLink, FaTimes, FaCommentDots } from 'react-icons/fa';

/**
 * Modal that shows the invitation share card image with clear actions:
 * Share (native), Download image, Copy link, Close.
 * Use when cardPreviewUrl is set (blob URL from generateShareCardBlob).
 */
const InvitationShareModal = ({
    cardPreviewUrl,
    shareUrl,
    title,
    onClose,
    onShareNative,
    onInternalShare,
    onCopyLink,
    t: tProp,
}) => {
    const { t } = useTranslation();
    const T = tProp || t;

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (cardPreviewUrl) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [cardPreviewUrl, onClose]);

    const handleDownload = () => {
        if (!cardPreviewUrl) return;
        const a = document.createElement('a');
        a.href = cardPreviewUrl;
        a.download = 'dinebuddies-invitation.png';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleCopyLink = async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            if (onCopyLink) onCopyLink();
            else if (typeof T === 'function') {
                const msg = T('link_copied', { defaultValue: 'Link copied!' });
                if (msg && msg !== 'link_copied' && window.showToast) window.showToast(msg, 'success');
            }
        } catch (_) {}
    };

    if (!cardPreviewUrl) return null;

    return (
        <div
            className="invitation-share-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={T('share_invitation', { defaultValue: 'Share invitation' })}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.92)',
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
            }}
            onClick={onClose}
        >
            <div
                className="invitation-share-modal-content"
                style={{
                    background: 'var(--bg-card, #1a1a1a)',
                    borderRadius: 20,
                    border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                    maxWidth: 420,
                    width: '100%',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.1))' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {T('share_invitation', { defaultValue: 'Share invitation' })}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={T('close', { defaultValue: 'Close' })}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            padding: 8,
                            cursor: 'pointer',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <FaTimes size={20} />
                    </button>
                </div>

                {/* Card preview - whole image clickable to open link */}
                <div style={{ padding: 20 }}>
                    {shareUrl ? (
                        <a
                            href={shareUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'block' }}
                            title={T('open_link', { defaultValue: 'Open link' })}
                        >
                            <img
                                src={cardPreviewUrl}
                                alt={title || T('invitation_card', { defaultValue: 'Invitation card' })}
                                style={{
                                    width: '100%',
                                    borderRadius: 12,
                                    display: 'block',
                                    background: '#0d1117',
                                    cursor: 'pointer',
                                }}
                            />
                        </a>
                    ) : (
                        <img
                            src={cardPreviewUrl}
                            alt={title || T('invitation_card', { defaultValue: 'Invitation card' })}
                            style={{
                                width: '100%',
                                borderRadius: 12,
                                display: 'block',
                                background: '#0d1117',
                            }}
                        />
                    )}
                </div>

                {/* Actions */}
                <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {onShareNative && navigator.share && (
                        <button
                            type="button"
                            onClick={onShareNative}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 10,
                                padding: '14px 20px',
                                borderRadius: 12,
                                border: 'none',
                                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: '1rem',
                                cursor: 'pointer',
                            }}
                        >
                            <FaShareAlt size={18} />
                            {T('share', { defaultValue: 'Share' })}
                        </button>
                    )}
                    {onInternalShare && (
                        <button
                            type="button"
                            onClick={onInternalShare}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 10,
                                padding: '14px 20px',
                                borderRadius: 12,
                                border: 'none',
                                background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: '1rem',
                                cursor: 'pointer',
                            }}
                        >
                            <FaCommentDots size={18} />
                            {T('send_in_chat', { defaultValue: 'Send in Chat' })}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleDownload}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 10,
                            padding: '12px 20px',
                            borderRadius: 12,
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-input, rgba(255,255,255,0.06))',
                            color: 'var(--text-main)',
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                        }}
                    >
                        <FaDownload size={16} />
                        {T('download_image', { defaultValue: 'Download image' })}
                    </button>
                    {shareUrl && (
                        <button
                            type="button"
                            onClick={handleCopyLink}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 10,
                                padding: '12px 20px',
                                borderRadius: 12,
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-input, rgba(255,255,255,0.06))',
                                color: 'var(--text-main)',
                                fontWeight: 600,
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                            }}
                        >
                            <FaLink size={16} />
                            {T('copy_link', { defaultValue: 'Copy link' })}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InvitationShareModal;
