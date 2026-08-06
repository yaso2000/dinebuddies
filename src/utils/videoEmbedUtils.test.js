import { describe, expect, it, vi, afterEach } from 'vitest';
import {
    parseYoutubeLink,
    sanitizeYoutubePlaylistId,
    sanitizeYoutubeVideoId,
    computeYoutubeMemberStartSec,
    buildYoutubeBannerBackgroundSrc,
    hasYoutubeBannerMedia,
    normalizeYoutubePositionSec,
    pickTrustedYoutubePauseSec,
    resolveYoutubeSyncAtMs,
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

describe('youtube sync helpers', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('sanitizes ids', () => {
        expect(sanitizeYoutubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
        expect(sanitizeYoutubePlaylistId('PLrAXtmRdnEQy6nuLMOV8u4M4xXq')).toMatch(/^PL/);
        expect(sanitizeYoutubePlaylistId('dQw4w9WgXcQ')).toBe('');
    });

    it('computes start with pause / live', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:01:00Z'));
        const syncAt = Date.parse('2026-01-01T00:00:00Z');
        expect(computeYoutubeMemberStartSec(syncAt, { positionSec: 10 })).toBe(70);
        expect(
            computeYoutubeMemberStartSec(syncAt, { positionSec: 10, paused: true })
        ).toBe(10);
        expect(computeYoutubeMemberStartSec(syncAt, { isLive: true })).toBe(0);
        expect(normalizeYoutubePositionSec(12.9)).toBe(12);
        expect(pickTrustedYoutubePauseSec(45, 0)).toBe(45);
        expect(pickTrustedYoutubePauseSec(45, 44)).toBe(44);
    });

    it('prefers client sync ms when close to server', () => {
        const server = 1_000_000;
        const client = 1_000_400;
        expect(resolveYoutubeSyncAtMs(server, client)).toBe(client);
        expect(resolveYoutubeSyncAtMs(server, server + 120_000)).toBe(server);
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
