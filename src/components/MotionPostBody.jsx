import React, { useMemo } from 'react';
import { renderMotionPost } from '../features/motion-post/renderMotionPost';
import StudioLivePreview from '../features/motion-post/studio/StudioLivePreview';
import { layoutToPreviewAspect } from '../features/motion-post/studio/studioConstants';
import { useMotionTextReveal } from '../features/motion-post/studio/useMotionTextReveal';
import {
    motionFirestoreDocToPreviewPayload,
    motionPostPreviewAspectFromDoc,
    studioEditorFromDoc,
} from '../features/motion-post/motionPostFeedUtils';

/**
 * Shared motion post canvas (studio-accurate) with scroll-triggered text entrance.
 */
export default function MotionPostBody({ post, scrollReveal = true, playOnMount = false }) {
    const studioEditor = useMemo(() => studioEditorFromDoc(post), [post]);
    const previewPayload = useMemo(() => motionFirestoreDocToPreviewPayload(post), [post]);
    const previewAspect = useMemo(() => {
        if (studioEditor?.layoutModel) return layoutToPreviewAspect(studioEditor.layoutModel);
        return motionPostPreviewAspectFromDoc(post);
    }, [post, studioEditor]);

    const previewMaxWidth =
        previewAspect === 'landscape' ? 520 : previewAspect === 'vertical' ? 300 : 420;

    const contentRaw = post?.content && typeof post.content === 'object' ? post.content : {};
    const mediaRaw = post?.media && typeof post.media === 'object' ? post.media : {};
    const studioTitle = String(contentRaw.title || '').trim();
    const studioBody = String(contentRaw.description || contentRaw.subtitle || '').trim();
    const studioImageUrl = String(mediaRaw.imageUrl || contentRaw.imageUrl || '').trim();

    const { ref: revealRef, animPlayKey } = useMotionTextReveal({
        enabled: scrollReveal && !playOnMount,
    });
    const effectiveAnimKey = playOnMount ? 1 : animPlayKey;

    return (
        <div
            ref={revealRef}
            className="motion-post-body"
            style={{ maxWidth: previewMaxWidth, margin: '0 auto', width: '100%' }}
        >
            {studioEditor ? (
                <StudioLivePreview
                    readOnly
                    layoutModel={studioEditor.layoutModel}
                    title={studioTitle}
                    body={studioBody}
                    imageUrl={studioImageUrl}
                    style={studioEditor.style}
                    promoStickers={studioEditor.promoStickers || []}
                    textAnimation={
                        studioEditor.textAnimation ||
                        (typeof studioEditor.style?.animation === 'string'
                            ? studioEditor.style.animation
                            : 'slide')
                    }
                    animPlayKey={effectiveAnimKey}
                    freezeUntilPlayed={scrollReveal && !playOnMount}
                />
            ) : (
                renderMotionPost(previewPayload, { previewAspect })
            )}
        </div>
    );
}
