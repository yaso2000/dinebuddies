import React from 'react';

/**
 * Animation shell so entrance motion does not fight contentEditable / text sync.
 */
export default function StudioTextAnimWrap({ animStyle, className = '', children }) {
    if (!animStyle || !Object.keys(animStyle).length) {
        return children;
    }
    return (
        <div className={`sps-text-anim-wrap${className ? ` ${className}` : ''}`} style={animStyle}>
            {children}
        </div>
    );
}
