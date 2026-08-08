import React from 'react';
import { EventTemplateView } from './templates/EventPostTemplates';
import { SpecialOfferTemplateView } from './templates/SpecialOfferTemplates';
import SqNormalStubV1 from './templates/SqNormalStubV1';
import type { MotionPreviewAspect, MotionPreviewDesign } from './templates/motionTemplateShared';
import { validateMotionPost, type MotionPostPayload } from './validateMotionPost';

export type MotionAspectRatioString = '1:1' | '16:9' | '9:16';

export type RenderMotionPostOptions = {
    fallbackTitle?: string;
    /** Studio / UI preview only — feed and saved lists omit this so cards stay 1:1. */
    previewAspect?: MotionPreviewAspect;
    /** Studio-only overlay / placement / focus — not persisted. */
    previewDesign?: MotionPreviewDesign | null;
    /** Normal-post layout id (placeholder carousel); passed through for future template rendering. */
    postTemplateId?: string;
    /** Resolved UI aspect string (1:1, 16:9, 9:16). */
    aspectRatio?: MotionAspectRatioString;
};

function UnknownTemplateFallback({ title = 'Unsupported motion template' }: { title?: string }) {
    return (
        <div
            style={{
                width: '100%',
                maxWidth: 420,
                aspectRatio: '1 / 1',
                borderRadius: 16,
                border: '1px dashed rgba(148,163,184,0.5)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--text-muted)',
                background: 'var(--bg-card)',
                padding: 16,
                textAlign: 'center',
            }}
        >
            <div>
                <strong>{title}</strong>
                <div style={{ marginTop: 8, fontSize: 13 }}>Check `templateId` and payload structure.</div>
            </div>
        </div>
    );
}

export function renderMotionPost(post: unknown, options: RenderMotionPostOptions = {}) {
    const result = validateMotionPost(post);
    if (!result.valid || !result.safePost) {
        return <UnknownTemplateFallback title={options.fallbackTitle || 'Invalid motion post payload'} />;
    }

    const safePost: MotionPostPayload = result.safePost;
    const props = {
        content: safePost.content,
        style: safePost.style!,
        previewAspect: options.previewAspect,
        previewDesign: options.previewDesign,
    };
    if (options.previewDesign) {
        console.log('[MotionAI][renderMotionPost]', {
            templateId: safePost.templateId,
            previewAspect: options.previewAspect,
            previewDesign: options.previewDesign,
        });
    }
    if (safePost.templateId === 'normal_post_stub_v1') {
        console.log('[MotionPost][renderMotionPost]', {
            templateId: safePost.templateId,
            postTemplateId: options.postTemplateId,
            aspectRatio: options.aspectRatio,
            previewAspect: options.previewAspect,
        });
    }

    switch (safePost.templateId) {
        case 'discount_hero':
        case 'premium_offer':
        case 'split_promo':
        case 'coupon_style':
        case 'flash_sale':
            return <SpecialOfferTemplateView {...props} templateId={safePost.templateId} />;
        case 'elegant_invitation':
        case 'party_night':
        case 'birthday_celebration':
        case 'business_event':
        case 'romantic_dinner':
            return <EventTemplateView {...props} templateId={safePost.templateId} />;
        case 'normal_post_stub_v1':
            return (
                <SqNormalStubV1
                    content={safePost.content}
                    style={safePost.style!}
                    previewAspect={options.previewAspect}
                    previewDesign={options.previewDesign}
                    postTemplateId={options.postTemplateId}
                    aspectRatio={options.aspectRatio}
                />
            );
        default:
            return <UnknownTemplateFallback title={options.fallbackTitle} />;
    }
}

