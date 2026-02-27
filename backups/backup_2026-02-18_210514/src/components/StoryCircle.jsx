import React from 'react';

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
                flexShrink: 0
            }}
        >
            {/* Story Ring */}
            <div style={{
                padding: '3px',
                background: hasNewStory
                    ? 'linear-gradient(135deg, #8b5cf6, #ec4899, #f97316)'
                    : 'var(--border-color)',
                borderRadius: '50%',
                transition: 'transform 0.2s'
            }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
                {/* Partner Logo */}
                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: `url(${partner.logo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner.id || 'default'}`})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    border: '3px solid var(--bg-body)'
                }} />
            </div>

            {/* Partner Name */}
            <span style={{
                fontSize: '0.75rem',
                fontWeight: '600',
                color: 'var(--text-primary)',
                maxWidth: '70px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textAlign: 'center'
            }}>
                {partner.name}
            </span>
        </div>
    );
};

export default StoryCircle;
