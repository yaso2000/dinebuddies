import { describe, expect, it } from 'vitest';
import {
    parseYoutubeLink,
    sanitizeYoutubePlaylistId,
    sanitizeYoutubeVideoId,
    buildYoutubeBannerBackgroundSrc,
    hasYoutubeBannerMedia,
    normalizeYoutubePositionSec,
} from './videoEmbedUtils.js';

describe('parseYoutubeLink extended media', () => {
    it('parses watch / youtu.be / shorts', () => {
        expect(parseYoutubeLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.id).toBe(
            'dQw4w9WgXcQ'
        );
        expect(parseYoutubeLink('https://youtu.be/dQw4w9WgXcQ')?.kind).toBe('video');
        expect(parseYoutubeLink('https://youtube.com/shorts/dQw4w9WgXcQ')?.isShort).toBe(true);
    });

    it('parses live URLs', () => {
        const live = parseYoutubeLink('https://www.youtube.com/live/dQw4w9WgXcQ');
        expect(live).toMatchObject({
            id: 'dQw4w9WgXcQ',
            isLive: true,
            kind: 'live',
        });
    });

    it('parses playlist-only and watch+list', () => {
        const listOnly = parseYoutubeLink(
            'https://www.youtube.com/playlist?list=PLrAXtmRdnEQy6nuLMOV8u4M4xXq'
        );
        expect(listOnly?.playlistId).toMatch(/^PL/);
        expect(listOnly?.kind).toBe('playlist');

        const withVideo = parseYoutubeLink(
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmRdnEQy6nuLMOV8u4M4xXq'
        );
        expect(withVideo?.id).toBe('dQw4w9WgXcQ');
        expect(withVideo?.playlistId).toMatch(/^PL/);
        expect(withVideo?.kind).toBe('playlist');
    });

    it('parses music.youtube.com', () => {
        const music = parseYoutubeLink(
            'https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVM'
        );
        expect(music?.id).toBe('dQw4w9WgXcQ');
        expect(music?.isMusic).toBe(true);
    });
});

describe('youtube embed helpers', () => {
    it('sanitizes ids', () => {
        expect(sanitizeYoutubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
        expect(sanitizeYoutubePlaylistId('PLrAXtmRdnEQy6nuLMOV8u4M4xXq')).toMatch(/^PL/);
        expect(sanitizeYoutubePlaylistId('dQw4w9WgXcQ')).toBe('');
    });

    it('normalizes a position to whole non-negative seconds', () => {
        expect(normalizeYoutubePositionSec(12.9)).toBe(12);
        expect(normalizeYoutubePositionSec(-5)).toBe(0);
        expect(normalizeYoutubePositionSec('not a number')).toBe(0);
    });

    it('builds embed src for live and playlist', () => {
        const live = buildYoutubeBannerBackgroundSrc('dQw4w9WgXcQ', {
            isLive: true,
            startSec: 99,
            loop: false,
        });
        expect(live).toContain('/embed/dQw4w9WgXcQ');
        expect(live).not.toContain('start=');

        const list = buildYoutubeBannerBackgroundSrc('', {
            playlistId: 'PLrAXtmRdnEQy6nuLMOV8u4M4xXq',
            loop: false,
        });
        expect(list).toContain('/embed/videoseries');
        expect(list).toContain('list=PLrAXtmRdnEQy6nuLMOV8u4M4xXq');
    });

    it('detects banner youtube media', () => {
        expect(hasYoutubeBannerMedia({ youtubeId: 'dQw4w9WgXcQ' })).toBe(true);
        expect(
            hasYoutubeBannerMedia({ youtubePlaylistId: 'PLrAXtmRdnEQy6nuLMOV8u4M4xXq' })
        ).toBe(true);
        expect(hasYoutubeBannerMedia({})).toBe(false);
    });
});
