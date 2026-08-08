import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
    openExternalUrl,
    isGoogleMapsUrl,
    isProductShareUrl,
    isAppMediaUrl,
    parseExternalHttpUrl,
} from './externalLinks.js';

describe('externalLinks anti-spam policy', () => {
    /** @type {ReturnType<typeof vi.fn>} */
    let openMock;

    beforeEach(() => {
        openMock = vi.fn();
        vi.stubGlobal('open', openMock);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('blocks arbitrary external URLs by default', () => {
        expect(openExternalUrl('https://spam.example/path')).toBe(false);
        expect(openMock).not.toHaveBeenCalled();
    });

    it('allows Google Maps only with business_maps', () => {
        const maps =
            'https://www.google.com/maps/search/?api=1&query=Sydney';
        expect(openExternalUrl(maps, { allow: 'business_maps' })).toBe(true);
        expect(openMock).toHaveBeenCalledOnce();
        expect(
            openExternalUrl('https://evil.com/maps', { allow: 'business_maps' })
        ).toBe(false);
    });

    it('allows delivery URLs with business_delivery', () => {
        expect(
            openExternalUrl('https://www.ubereats.com/store/x', {
                allow: 'business_delivery',
            })
        ).toBe(true);
    });

    it('allows product share hosts only with product_share', () => {
        expect(
            openExternalUrl('https://wa.me/?text=hi', { allow: 'product_share' })
        ).toBe(true);
        expect(
            openExternalUrl('https://spam.example/', { allow: 'product_share' })
        ).toBe(false);
    });

    it('allows Firebase Storage with app_media', () => {
        const media =
            'https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media';
        expect(openExternalUrl(media, { allow: 'app_media' })).toBe(true);
        expect(
            openExternalUrl('https://evil.com/file.pdf', { allow: 'app_media' })
        ).toBe(false);
    });

    it('classifies maps / share / media hosts', () => {
        const maps = parseExternalHttpUrl(
            'https://www.google.com/maps/search/?api=1&query=a'
        );
        expect(maps && isGoogleMapsUrl(maps)).toBe(true);
        const wa = parseExternalHttpUrl('https://wa.me/?text=x');
        expect(wa && isProductShareUrl(wa)).toBe(true);
        const storage = parseExternalHttpUrl(
            'https://firebasestorage.googleapis.com/v0/b/x/o/y'
        );
        expect(storage && isAppMediaUrl(storage)).toBe(true);
    });
});
