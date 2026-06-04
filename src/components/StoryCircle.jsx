import React from 'react';
import UserAvatar from './UserAvatar';

const StoryCircle = ({ partner, hasNewStory, onClick }) => {
    return (
        <div
            onClick={onClick}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                minWidth: '80px',
                flexShrink: 0,
            }}
        >
            <div
                style={{
                    padding: '3px',
                    background: hasNewStory
                        ? 'linear-gradient(135deg, #8b5cf6, #ec4899, #f97316)'
                        : 'var(--border-color)',
                    borderRadius: '50%',
                    transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                }}
            >
                <UserAvatar
                    user={{
                        id: partner.id,
                        display_name: partner.name,
                        photo_url: partner.logo,
                        gender: partner.gender,
                    }}
                    src={partner.logo}
                    alt={partner.name}
                    style={{
                        width: 64,
                        height: 64,
                        boxShadow: '0 0 0 3px var(--bg-body)',
                    }}
                />
            </div>

            <span
                style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    maxWidth: '70px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                }}
            >
                {partner.name}
            </span>
        </div>
    );
};

export default StoryCircle;
