import React from 'react';
import { renderMotionPost } from '../../features/motion-post/renderMotionPost';
import { MOTION_CATEGORY_LAYOUT_FIXTURES } from '../../features/motion-post/dev/motionCategoryLayoutFixtures';
import { MOTION_SPECIAL_OFFER_VISUAL_QA_FIXTURES } from '../../features/motion-post/dev/motionSpecialOfferVisualQaFixtures';

const ASPECTS = [
    { id: 'square', label: '1:1' },
    { id: 'vertical', label: '9:16' },
    { id: 'landscape', label: '16:9' },
];

const pageStyle = {
    minHeight: '100dvh',
    background: 'radial-gradient(1200px 600px at 0% 0%, rgba(232, 110, 46, 0.12), transparent 42%), #070a13',
    color: '#e8eef8',
    padding: '18px clamp(12px, 3vw, 28px) 40px',
};

const gridStyle = {
    display: 'grid',
    gap: 14,
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
};

const chipStyle = {
    display: 'inline-block',
    borderRadius: 999,
    border: '1px solid rgba(148, 163, 184, 0.34)',
    padding: '3px 9px',
    fontSize: 11,
    letterSpacing: 0.2,
    color: '#dbe7ff',
    background: 'rgba(15, 23, 42, 0.5)',
};

const ALL_QA_FIXTURES = [...MOTION_CATEGORY_LAYOUT_FIXTURES, ...MOTION_SPECIAL_OFFER_VISUAL_QA_FIXTURES];

export default function MotionCategoryQa() {
    return (
        <div style={pageStyle}>
            <header style={{ marginBottom: 14 }}>
                <h1 style={{ margin: 0, fontSize: 'clamp(20px, 3.4vw, 30px)', lineHeight: 1.15 }}>
                    Motion Category Visual QA
                </h1>
                <p style={{ margin: '8px 0 0', color: 'rgba(226, 232, 240, 0.82)' }}>
                    Dev-only preview of current motion renderer across category-style fixtures.
                </p>
            </header>

            <div style={{ marginBottom: 18 }}>
                <span style={chipStyle}>Birthday</span>{' '}
                <span style={chipStyle}>Business</span>{' '}
                <span style={chipStyle}>Dating</span>{' '}
                <span style={chipStyle}>Nightlife</span>{' '}
                <span style={chipStyle}>Family</span>{' '}
                <span style={chipStyle}>Offer QA ×5</span>
            </div>

            <section style={gridStyle}>
                {ALL_QA_FIXTURES.flatMap((fixture) =>
                    ASPECTS.map((aspect) => {
                        const card = renderMotionPost(fixture.post, {
                            previewAspect: aspect.id,
                            previewDesign: fixture.previewDesign ?? null,
                        });
                        const theme = fixture.post.style?.themeId || '-';
                        return (
                            <article
                                key={`${fixture.id}-${fixture.post.templateId}-${aspect.id}`}
                                style={{
                                    background: 'rgba(8, 12, 22, 0.86)',
                                    border: '1px solid rgba(148, 163, 184, 0.25)',
                                    borderRadius: 14,
                                    padding: 10,
                                    display: 'grid',
                                    gap: 10,
                                    alignContent: 'start',
                                }}
                            >
                                <div style={{ display: 'grid', gap: 4, fontSize: 12, color: 'rgba(226, 232, 240, 0.9)' }}>
                                    <div><strong>category:</strong> {fixture.label}</div>
                                    <div><strong>template:</strong> <code>{fixture.post.templateId}</code></div>
                                    <div><strong>aspect:</strong> {aspect.label}</div>
                                    <div><strong>theme:</strong> <code>{theme}</code></div>
                                </div>
                                <div style={{ width: '100%' }}>{card}</div>
                            </article>
                        );
                    }),
                )}
            </section>
        </div>
    );
}
