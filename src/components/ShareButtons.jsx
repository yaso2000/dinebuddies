import React from 'react';
import { FaFacebook, FaTwitter, FaWhatsapp, FaTiktok, FaLink } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const ShareButtons = ({ title, description, url, type = 'invitation' }) => {
    const { i18n } = useTranslation();

    const shareText = `${title}\n${description || ''}`;
    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(url);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(url);
        alert(i18n.language === 'ar' ? '✓ تم نسخ الرابط' : '✓ Link copied');
    };

    const platforms = [
        {
            name: 'Facebook',
            icon: <FaFacebook />,
            url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
            color: '#1877F2'
        },
        {
            name: 'Twitter',
            icon: <FaTwitter />,
            url: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
            color: '#1DA1F2'
        },
        {
            name: 'WhatsApp',
            icon: <FaWhatsapp />,
            url: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
            color: '#25D366'
        },
        {
            name: 'TikTok',
            icon: <FaTiktok />,
            action: () => {
                copyToClipboard();
            },
            color: '#000000'
        },
        {
            name: 'Copy',
            icon: <FaLink />,
            action: copyToClipboard,
            color: '#8B5CF6'
        }
    ];

    const handleShare = (platform) => {
        if (platform.action) {
            platform.action();
        } else if (platform.url) {
            window.open(platform.url, '_blank', 'width=600,height=400');
        }
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            padding: '12px 0',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
            {platforms.map(platform => (
                <button
                    key={platform.name}
                    onClick={() => handleShare(platform)}
                    style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        border: 'none',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.1rem',
                        transition: 'all 0.2s ease',
                        opacity: 0.7
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = platform.color;
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.opacity = '0.7';
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                    title={platform.name}
                    aria-label={`Share on ${platform.name}`}
                >
                    {platform.icon}
                </button>
            ))}
        </div>
    );
};

export default ShareButtons;
