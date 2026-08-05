import React, { useEffect } from 'react';

const TikTokEmbed = ({ videoId }) => {
    useEffect(() => {
        // Need to force TikTok JS to parse the new blockquote every mount
        const existingScript = document.getElementById('tiktok-embed-script');
        if (existingScript) existingScript.remove();

        const script = document.createElement('script');
        script.id = 'tiktok-embed-script';
        script.src = 'https://www.tiktok.com/embed.js';
        script.async = true;
        document.body.appendChild(script);

        return () => {
            if (script.parentNode) script.parentNode.removeChild(script);
        };
    }, [videoId]);

    return (
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%', background: '#000', overflow: 'hidden' }}>
            <blockquote 
                className="tiktok-embed" 
                cite={`https://www.tiktok.com/@tiktok/video/${videoId}`} 
                data-video-id={videoId} 
                style={{ maxWidth: '605px', minWidth: '325px', margin: '0 auto' }}
            >
                <section></section>
            </blockquote>
        </div>
    );
};

export default TikTokEmbed;
