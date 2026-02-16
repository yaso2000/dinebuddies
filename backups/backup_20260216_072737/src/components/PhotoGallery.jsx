import React, { useState } from 'react';
import { FaTimes, FaChevronLeft, FaChevronRight, FaImage } from 'react-icons/fa';

const PhotoGallery = ({ photos = [], businessName = 'Business' }) => {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    if (!photos || photos.length === 0) {
        return (
            <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '3rem 2rem',
                textAlign: 'center',
                marginTop: '1.5rem'
            }}>
                <FaImage style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: '1rem' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                    No photos available yet
                </p>
            </div>
        );
    }

    const openLightbox = (index) => {
        setCurrentImageIndex(index);
        setLightboxOpen(true);
        document.body.style.overflow = 'hidden';
    };

    const closeLightbox = () => {
        setLightboxOpen(false);
        document.body.style.overflow = 'auto';
    };

    const goToNext = () => {
        setCurrentImageIndex((prev) => (prev + 1) % photos.length);
    };

    const goToPrevious = () => {
        setCurrentImageIndex((prev) => (prev - 1 + photos.length) % photos.length);
    };

    const handleKeyDown = (e) => {
        if (!lightboxOpen) return;

        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowRight') goToNext();
        if (e.key === 'ArrowLeft') goToPrevious();
    };

    React.useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxOpen]);

    return (
        <>
            {/* Photo Grid */}
            <div style={{ marginTop: '1.5rem' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem'
                }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '800' }}>
                        Photo Gallery
                    </h3>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
                    </span>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: '12px'
                }}>
                    {photos.map((photo, index) => (
                        <div
                            key={index}
                            onClick={() => openLightbox(index)}
                            style={{
                                position: 'relative',
                                paddingBottom: '100%',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.05)';
                                e.currentTarget.style.boxShadow = '0 8px 20px rgba(139, 92, 246, 0.3)';
                                e.currentTarget.style.borderColor = 'var(--primary)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = 'none';
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                            }}
                        >
                            <img
                                src={photo.url || photo}
                                alt={photo.caption || `${businessName} photo ${index + 1}`}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                }}
                            />

                            {/* Overlay on hover */}
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
                                opacity: 0,
                                transition: 'opacity 0.3s',
                                display: 'flex',
                                alignItems: 'flex-end',
                                padding: '12px'
                            }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
                            >
                                {photo.caption && (
                                    <p style={{
                                        color: 'white',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        margin: 0
                                    }}>
                                        {photo.caption}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Lightbox */}
            {lightboxOpen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.95)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px',
                        animation: 'fadeIn 0.3s ease'
                    }}
                    onClick={closeLightbox}
                >
                    {/* Close Button */}
                    <button
                        onClick={closeLightbox}
                        style={{
                            position: 'absolute',
                            top: '20px',
                            right: '20px',
                            width: '50px',
                            height: '50px',
                            borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.1)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: 'white',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                            zIndex: 10001
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.8)';
                            e.currentTarget.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        <FaTimes />
                    </button>

                    {/* Image Counter */}
                    <div style={{
                        position: 'absolute',
                        top: '20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(0, 0, 0, 0.7)',
                        backdropFilter: 'blur(10px)',
                        padding: '10px 20px',
                        borderRadius: '20px',
                        color: 'white',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        zIndex: 10001
                    }}>
                        {currentImageIndex + 1} / {photos.length}
                    </div>

                    {/* Previous Button */}
                    {photos.length > 1 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                goToPrevious();
                            }}
                            style={{
                                position: 'absolute',
                                left: '20px',
                                width: '50px',
                                height: '50px',
                                borderRadius: '50%',
                                background: 'rgba(255, 255, 255, 0.1)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                color: 'white',
                                fontSize: '1.5rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                                zIndex: 10001
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.8)';
                                e.currentTarget.style.transform = 'scale(1.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            <FaChevronLeft />
                        </button>
                    )}

                    {/* Next Button */}
                    {photos.length > 1 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                goToNext();
                            }}
                            style={{
                                position: 'absolute',
                                right: '20px',
                                width: '50px',
                                height: '50px',
                                borderRadius: '50%',
                                background: 'rgba(255, 255, 255, 0.1)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                color: 'white',
                                fontSize: '1.5rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                                zIndex: 10001
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.8)';
                                e.currentTarget.style.transform = 'scale(1.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            <FaChevronRight />
                        </button>
                    )}

                    {/* Main Image */}
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            maxWidth: '90vw',
                            maxHeight: '90vh',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '20px'
                        }}
                    >
                        <img
                            src={photos[currentImageIndex].url || photos[currentImageIndex]}
                            alt={photos[currentImageIndex].caption || `Photo ${currentImageIndex + 1}`}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '80vh',
                                objectFit: 'contain',
                                borderRadius: '12px',
                                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
                            }}
                        />

                        {/* Caption */}
                        {photos[currentImageIndex].caption && (
                            <div style={{
                                background: 'rgba(0, 0, 0, 0.7)',
                                backdropFilter: 'blur(10px)',
                                padding: '15px 25px',
                                borderRadius: '12px',
                                color: 'white',
                                fontSize: '0.95rem',
                                maxWidth: '600px',
                                textAlign: 'center'
                            }}>
                                {photos[currentImageIndex].caption}
                            </div>
                        )}
                    </div>

                    {/* Thumbnail Strip (for 2+ photos) */}
                    {photos.length > 1 && (
                        <div style={{
                            position: 'absolute',
                            bottom: '20px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            display: 'flex',
                            gap: '10px',
                            padding: '15px',
                            background: 'rgba(0, 0, 0, 0.7)',
                            backdropFilter: 'blur(10px)',
                            borderRadius: '12px',
                            maxWidth: '90vw',
                            overflowX: 'auto',
                            zIndex: 10001
                        }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {photos.map((photo, index) => (
                                <div
                                    key={index}
                                    onClick={() => setCurrentImageIndex(index)}
                                    style={{
                                        width: '60px',
                                        height: '60px',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        border: index === currentImageIndex
                                            ? '3px solid var(--primary)'
                                            : '3px solid transparent',
                                        opacity: index === currentImageIndex ? 1 : 0.6,
                                        transition: 'all 0.2s',
                                        flexShrink: 0
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                                    onMouseLeave={(e) => {
                                        if (index !== currentImageIndex) {
                                            e.currentTarget.style.opacity = 0.6;
                                        }
                                    }}
                                >
                                    <img
                                        src={photo.url || photo}
                                        alt={`Thumbnail ${index + 1}`}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <style>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }
            `}</style>
        </>
    );
};

export default PhotoGallery;
