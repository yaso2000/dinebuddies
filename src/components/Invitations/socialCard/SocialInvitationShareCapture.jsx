import React, { forwardRef } from 'react';
import SocialInvitationCardPreview from './SocialInvitationCardPreview';
import './SocialInvitationShareCapture.css';

/**
 * Off-screen full-resolution copy of the real invitation card for share / SMS capture.
 * Must receive the same preview props as the visible card (via buildSocialInvitationCardPreviewProps).
 */
const SocialInvitationShareCapture = forwardRef(function SocialInvitationShareCapture(
    { cardPreviewProps = null },
    ref
) {
    if (!cardPreviewProps) return null;

    const { className = '', ...previewProps } = cardPreviewProps;

    return (
        <div className="private-invitation-share-capture" aria-hidden>
            <div ref={ref} className="private-invitation-share-capture__stage" data-share-export="true">
                <SocialInvitationCardPreview
                    {...previewProps}
                    className={`${className} social-invitation-card-preview--share-export`.trim()}
                    freezeMotion
                />
            </div>
        </div>
    );
});

export default SocialInvitationShareCapture;
