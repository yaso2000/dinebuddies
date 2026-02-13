import React, { useState, useRef } from 'react';
import { FaWhatsapp, FaTwitter, FaFacebook, FaTelegram, FaLink, FaShareAlt, FaInstagram } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import InstagramStoryTemplate from './InstagramStoryTemplate';

const ShareButtons = ({ title, description, url, storyData, type = 'invitation' }) => {
    const { t } = useTranslation();
    const [generatingStory, setGeneratingStory] = useState(false);
    const storyRef = useRef(null);

    const shareText = `${title}${description ? `\n\n${description}` : ''}`;
    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(url);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(`${shareText}\n${url}`);
        alert(t('link_copied_clipboard'));
    };

    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: title,
                    text: description,
                    url: url,
                });
            } catch (error) {
                console.log('Error sharing:', error);
            }
        } else {
            copyToClipboard();
        }
    };

    const handleInstagramStory = async () => {
        if (!storyData) {
            alert(t('instagram_story_not_available'));
            return;
        }

        try {
            setGeneratingStory(true);

            // Allow time for render
            await new Promise(resolve => setTimeout(resolve, 500));

            const html2canvas = (await import('html2canvas')).default;

            if (storyRef.current) {
                const canvas = await html2canvas(storyRef.current, {
                    useCORS: true,
                    scale: 1, // Sufficient for 1080p
                    backgroundColor: '#0f172a'
                });

                canvas.toBlob(async (blob) => {
                    if (!blob) {
                        setGeneratingStory(false);
                        return;
                    }

                    const file = new File([blob], 'story.png', { type: 'image/png' });

                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        try {
                            await navigator.share({
                                files: [file],
                                title: t('share_via') + ' Instagram',
                                text: shareText
                            });
                        } catch (err) {
                            console.error('Share failed', err);
                        }
                    } else {
                        // Fallback: Download image
                        const link = document.createElement('a');
                        link.download = 'instagram-story.png';
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                        alert(t('image_downloaded'));
                    }
                    setGeneratingStory(false);
                }, 'image/png');
            }
        } catch (error) {
            console.error('Error generating story:', error);
            setGeneratingStory(false);
            alert(t('failed_generate_story'));
        }
    };

    const platforms = [
        {
            name: 'Native',
            icon: <FaShareAlt />,
            action: handleNativeShare,
            color: 'var(--primary)',
            show: !!navigator.share
        },
        {
            name: 'WhatsApp',
            icon: <FaWhatsapp />,
            url: `https://wa.me/?text=${encodedText}%0A%0A${encodedUrl}`,
            color: '#25D366',
            show: true
        },
        {
            name: 'Instagram',
            icon: <FaInstagram />,
            action: handleInstagramStory,
            color: '#E1306C',
            show: true // Always show, falls back to download
        },
        {
            name: 'Facebook',
            icon: <FaFacebook />,
            url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
            color: '#1877F2',
            show: true
        },
        {
            name: 'Twitter',
            icon: <FaTwitter />,
            url: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
            color: '#1DA1F2',
            show: true
        },
        {
            name: 'Telegram',
            icon: <FaTelegram />,
            url: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
            color: '#0088cc',
            show: true
        },
        {
            name: 'Copy Link',
            icon: <FaLink />,
            action: copyToClipboard,
            color: 'var(--text-muted)',
            show: true
        }
    ];

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
            {platforms.filter(p => p.show).map((platform) => (
                <button
                    key={platform.name}
                    onClick={() => {
                        if (platform.action) platform.action();
                        else window.open(platform.url, '_blank');
                    }}
                    style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        border: 'none',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: platform.color,
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem',
                        transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        opacity: 0.85,
                        backdropFilter: 'blur(4px)',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = platform.color;
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.transform = 'translateY(-3px) scale(1.1)';
                        e.currentTarget.style.boxShadow = `0 8px 15px -3px ${platform.color}66`; // glow effect
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.opacity = '0.85';
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                    }}
                    title={`Share on ${platform.name}`}
                    aria-label={`Share on ${platform.name}`}
                >
                    {platform.icon}
                </button>
            ))}
        </div>
    );
};

export default ShareButtons;
