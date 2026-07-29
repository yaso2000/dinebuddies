import { describe, expect, it } from 'vitest';
import {
    getSafeAvatar,
    isProviderAccountPhotoUrl,
    isUserUploadedPhotoUrl,
    pickPreferredAvatarUrl,
    resolveOAuthPhotoUpdate,
} from './avatarUtils.js';

const UPLOAD =
    'https://firebasestorage.googleapis.com/v0/b/dinebuddies.appspot.com/o/users%2Fu1%2Favatar.jpg?alt=media';
const GOOGLE = 'https://lh3.googleusercontent.com/a/ACg8ocTestPhotoId';
const FACEBOOK = 'https://platform-lookaside.fbsbx.com/platform/profilepic/?asid=1';
const STOCK = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400';

describe('consumer avatar priority', () => {
    it('classifies upload vs OAuth', () => {
        expect(isUserUploadedPhotoUrl(UPLOAD)).toBe(true);
        expect(isUserUploadedPhotoUrl(GOOGLE)).toBe(false);
        expect(isProviderAccountPhotoUrl(GOOGLE)).toBe(true);
        expect(isProviderAccountPhotoUrl(FACEBOOK)).toBe(true);
        expect(isProviderAccountPhotoUrl(UPLOAD)).toBe(false);
    });

    it('prefers uploaded over Google and stock', () => {
        expect(
            pickPreferredAvatarUrl({
                photo_url: GOOGLE,
                photoURL: UPLOAD,
                avatar: STOCK,
            })
        ).toBe(UPLOAD);
    });

    it('prefers Google over stock / empty', () => {
        expect(pickPreferredAvatarUrl({ photo_url: STOCK, photoURL: GOOGLE })).toBe(GOOGLE);
        expect(pickPreferredAvatarUrl({ photo_url: STOCK }, { authPhotoUrl: GOOGLE })).toBe(GOOGLE);
        expect(pickPreferredAvatarUrl({ photo_url: STOCK })).toBe(null);
    });

    it('falls back to letter/initial — not Unsplash', () => {
        const url = getSafeAvatar({ displayName: 'Sara', photo_url: STOCK });
        expect(url.startsWith('data:image/svg+xml')).toBe(true);
        expect(url.includes('unsplash')).toBe(false);
    });

    it('never lets OAuth overwrite an uploaded photo', () => {
        expect(resolveOAuthPhotoUpdate({ photo_url: UPLOAD }, GOOGLE)).toBe(null);
        expect(resolveOAuthPhotoUpdate({ photo_url: STOCK }, GOOGLE)).toEqual({
            photo_url: GOOGLE,
            photoURL: GOOGLE,
            avatar: GOOGLE,
        });
        expect(resolveOAuthPhotoUpdate({}, GOOGLE)).toEqual({
            photo_url: GOOGLE,
            photoURL: GOOGLE,
            avatar: GOOGLE,
        });
    });
});
