import React, { useState, useRef } from 'react';
import { FaWhatsapp, FaTwitter, FaFacebook, FaTelegram, FaLink, FaShareAlt, FaInstagram, FaImage, FaDownload, FaTimes } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { generateShareCardBlob } from '../utils/shareCardCanvas';
import InstagramStoryTemplate from './InstagramStoryTemplate';

const ShareButtons = ({ title, description, url, storyData, type = 'invitation' }) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [generatingCard, setGeneratingCard] = useState(false);
    const [generatingStory, setGeneratingStory] = useState(false);
    const [cardPreviewUrl, setCardPreviewUrl] = useState(null);
    const storyRef = useRef(null);

    const shareText = `${title}${description ? `\n\n${description}` : ''}`;
    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(url);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(`${shareText}\n${url}`).catch(() => { });
        showToast(t('link_copied_clipboard', 'Link copied!'), 'success');
    };

    const handleNativeShare = async () => {
        if (navigator.share) {
            try { await navigator.share({ title, text: description, url }); }
            catch (e) { /* cancelled */ }
        } else {
            copyToClipboard();
        }
    };

    // ── Share Card (Canvas API — no CORS issues)
    const handleShareCard = async () => {
        if (!storyData) return;
        try {
            setGeneratingCard(true);
            setCardPreviewUrl(null);

            const blob = await generateShareCardBlob(storyData, type);
            if (!blob) throw new Error('No blob');

            const file = new File([blob], 'invitation-card.png', { type: 'image/png' });
            const textWithLink = `${shareText}\n\n🔗 ${url}`;

            // Mobile: native file share (opens OS app picker directly) — include URL in text so image + link appear together
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title, text: textWithLink, url });
            } else {
                // Desktop: show preview with download button
                setCardPreviewUrl(URL.createObjectURL(blob));
            }
        } catch (err) {
            console.error('Share card error:', err);
            showToast('Could not generate share card. Please try again.', 'error');
        } finally {
            setGeneratingCard(false);
        }
    };

    // ── Instagram Story (html2canvas of off-screen Story template)
    const handleInstagramStory = async () => {
        if (!storyRef?.current) return;
        try {
            setGeneratingStory(true);
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(storyRef.current, {
                useCORS: true, allowTaint: true, scale: 1,
                backgroundColor: '#0f172a', logging: false,
            });
            const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
            if (!blob) throw new Error('No blob');
            const file = new File([blob], 'instagram-story.png', { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: `${title} – Story`, text: shareText });
            } else {
                const link = document.createElement('a');
                link.download = 'instagram-story.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            }
        } catch (err) {
            console.error('Story error:', err);
        } finally {
            setGeneratingStory(false);
        }
    };

    const platforms = [
        { name: generatingCard ? '⏳' : 'Share Card', icon: <FaImage />, action: handleShareCard, color: '#a78bfa', show: !!storyData, disabled: generatingCard },
        { name: 'Share', icon: <FaShareAlt />, action: handleNativeShare, color: 'var(--primary)', show: !!navigator.share },
        { name: 'WhatsApp', icon: <FaWhatsapp />, url: `https://wa.me/?text=${encodedText}%0A%0A${encodedUrl}`, color: '#25D366', show: true },
        { name: generatingStory ? '⏳' : 'Instagram', icon: <FaInstagram />, action: handleInstagramStory, color: '#E1306C', show: true, disabled: generatingStory },
        { name: 'Facebook', icon: <FaFacebook />, url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`, color: '#1877F2', show: true },
        { name: 'Twitter', icon: <FaTwitter />, url: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`, color: '#1DA1F2', show: true },
        { name: 'Telegram', icon: <FaTelegram />, url: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, color: '#0088cc', show: true },
        { name: 'Copy Link', icon: <FaLink />, action: copyToClipboard, color: 'var(--text-muted)', show: true },
    ];

    return (
        <>
            {/* Off-screen Instagram Story template */}
            {storyData && <InstagramStoryTemplate ref={storyRef} data={storyData} type={type} />}

            {/* Desktop Card Preview */}
            {cardPreviewUrl && (
                <div style={{ marginBottom: 16, position: 'relative' }}>
                    <button
                        onClick={() => { URL.revokeObjectURL(cardPreviewUrl); setCardPreviewUrl(null); }}
                        style={{
                            position: 'absolute', top: 6, right: 6, zIndex: 2,
                            background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
                            width: 26, height: 26, color: 'white', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    ><FaTimes size={11} /></button>
                    <a href={url} target="_blank" rel="noopener noreferrer" title="Open">
                        <img
                            src={cardPreviewUrl}
                            alt="Share Card"
                            style={{ width: '100%', borderRadius: 10, display: 'block', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                        />
                    </a>
                    <a
                        href={cardPreviewUrl}
                        download="invitation-card.png"
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            marginTop: 10, padding: '10px 0', borderRadius: 10,
                            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                            color: 'white', fontWeight: 700, fontSize: '0.9rem',
                            textDecoration: 'none',
                        }}
                    >
                        <FaDownload /> Download Image
                    </a>
                    <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', marginTop: 6 }}>
                        Save then share on WhatsApp / Instagram
                    </p>
                </div>
            )}

            {/* Share Buttons */}
            {!cardPreviewUrl && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
                    {platforms.filter(p => p.show).map((p) => (
                        <button
                            key={p.name}
                            onClick={() => { if (!p.disabled) { p.action ? p.action() : window.open(p.url, '_blank'); } }}
                            title={p.name}
                            aria-label={p.name}
                            style={{
                                width: '48px', height: '48px', borderRadius: '50%', border: 'none',
                                background: 'rgba(255,255,255,0.05)', color: p.color,
                                cursor: p.disabled ? 'wait' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.2rem', transition: 'all 0.2s ease',
                                opacity: p.disabled ? 0.5 : 0.85,
                            }}
                            onMouseEnter={(e) => {
                                if (!p.disabled) {
                                    e.currentTarget.style.background = p.color;
                                    e.currentTarget.style.opacity = '1';
                                    e.currentTarget.style.transform = 'translateY(-3px) scale(1.1)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                e.currentTarget.style.opacity = '0.85';
                                e.currentTarget.style.transform = 'none';
                            }}
                        >
                            {p.icon}
                        </button>
                    ))}
                </div>
            )}
        </>
    );
};

export default ShareButtons;
