import React from 'react';
import './VideoPlayer.css';

/**
 * A highly simplified Video Player component.
 * Relies on native browser controls for maximum reliability.
 */
const VideoPlayer = ({
    videoUrl,
    thumbnail,
    autoPlay = false,
    muted = true,
    loop = false,
    controls = true,
    className = ''
}) => {
    return (
        <div className={`video-player-container ${className}`}>
            <video
                src={videoUrl}
                poster={thumbnail}
                controls={controls}
                autoPlay={autoPlay}
                muted={muted}
                loop={loop}
                playsInline
                className="native-video-element"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
        </div>
    );
};

export default VideoPlayer;
