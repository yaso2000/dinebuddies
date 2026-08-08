import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderMotionPost } from './renderMotionPost';
import { MOTION_CATEGORY_LAYOUT_FIXTURES } from './dev/motionCategoryLayoutFixtures';

/** Same DOM role patterns across templates (structure parity for "one layout family"). */
function extractLayoutSignals(html: string) {
    const hasHeroTitle = /class="motion-title"/.test(html);
    const hasBody = /class="motion-body"/.test(html);
    const hasCta = /class="motion-button"/.test(html);
    const isInvalid = /Invalid motion post payload/.test(html) || /Unsupported motion template/.test(html);
    return {
        hasHeroTitle,
        hasBody,
        hasCta,
        isInvalid,
        approxLen: html.length,
    };
}

describe('Motion layout across category-style fixtures', () => {
    it('renders every fixture × aspect and reports structural comparison', () => {
        const rows: string[] = [];
        for (const fx of MOTION_CATEGORY_LAYOUT_FIXTURES) {
            for (const aspect of fx.previewAspects) {
                const el = renderMotionPost(fx.post, {
                    previewAspect: aspect,
                    previewDesign: fx.previewDesign ?? null,
                });
                const html = renderToStaticMarkup(React.createElement(React.Fragment, null, el));
                const sig = extractLayoutSignals(html);
                expect(sig.isInvalid, `${fx.id} ${aspect} should validate and render`).toBe(false);
                expect(sig.hasHeroTitle).toBe(true);
                expect(sig.hasBody).toBe(true);
                const expectsCta = Boolean(fx.post.content.cta?.trim());
                expect(sig.hasCta).toBe(expectsCta);
                rows.push(
                    [
                        fx.label,
                        fx.post.templateId,
                        aspect,
                        String(sig.approxLen),
                        fx.primaryTemplate === fx.post.templateId ? 'yes' : 'alt',
                    ].join('\t'),
                );
            }
        }
        // eslint-disable-next-line no-console
        console.log(
            [
                '\n=== Motion category layout — structural parity ===',
                'Columns: category | template | aspect | htmlLen | primaryTemplateMatch',
                ...rows.sort(),
                '',
                'Structural note: special_offer_post uses layout ids (discount_hero, premium_offer, …); event_post uses elegant_invitation, party_night, birthday_celebration, business_event, romantic_dinner.',
                'For visual comparison, load these payloads in a motion preview harness (see motionCategoryLayoutFixtures).',
                'Invitation OCCASION_PRESETS are unrelated to motion template selection.',
            ].join('\n'),
        );
        expect(rows.length).toBeGreaterThan(0);
    });
});
