import React from 'react';

const InvitationSkeleton = () => {
    return (
        <div className="invitation-skeleton" style={{
            background: 'var(--bg-card)',
            borderRadius: '20px',
            padding: '1rem',
            border: '1px solid var(--border-color)',
            animation: 'fadeIn 0.3s ease-out'
        }}>
            {/* Image Skeleton */}
            <div className="skeleton-image" style={{
                width: '100%',
                height: '200px',
                borderRadius: '16px',
                background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
                marginBottom: '1rem'
            }}></div>

            {/* Header Skeleton */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                {/* Avatar */}
                <div className="skeleton-avatar" style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite'
                }}></div>

                {/* Name & Time */}
                <div style={{ flex: 1 }}>
                    <div className="skeleton-text" style={{
                        width: '60%',
                        height: '16px',
                        borderRadius: '8px',
                        background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.5s infinite',
                        marginBottom: '0.5rem'
                    }}></div>
                    <div className="skeleton-text" style={{
                        width: '40%',
                        height: '12px',
                        borderRadius: '8px',
                        background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.5s infinite'
                    }}></div>
                </div>
            </div>

            {/* Title Skeleton */}
            <div className="skeleton-text" style={{
                width: '80%',
                height: '20px',
                borderRadius: '8px',
                background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
                marginBottom: '0.75rem'
            }}></div>

            {/* Location Skeleton */}
            <div className="skeleton-text" style={{
                width: '50%',
                height: '14px',
                borderRadius: '8px',
                background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
                marginBottom: '1rem'
            }}></div>

            {/* Stats Skeleton */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton-badge" style={{
                        width: '70px',
                        height: '28px',
                        borderRadius: '14px',
                        background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.5s infinite'
                    }}></div>
                ))}
            </div>

            {/* Button Skeleton */}
            <div className="skeleton-button" style={{
                width: '100%',
                height: '48px',
                borderRadius: '16px',
                background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.1) 25%, rgba(139, 92, 246, 0.2) 50%, rgba(139, 92, 246, 0.1) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite'
            }}></div>
        </div>
    );
};

export default InvitationSkeleton;
