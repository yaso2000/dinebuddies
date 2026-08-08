import { describe, expect, it, beforeEach } from 'vitest';
import {
    canConsumerEnterApp,
    clearConsumerEntryOk,
    markConsumerEntryOk,
    shouldForceCompleteProfileRedirect,
} from './consumerProfileComplete.js';

describe('shouldForceCompleteProfileRedirect', () => {
    const incomplete = {
        uid: 'u1',
        displayName: 'Alex',
        // missing gender + age — typical OAuth cache before server fields load
    };
    const complete = {
        uid: 'u1',
        displayName: 'Alex',
        gender: 'male',
        ageCategory: '25-34',
        isProfileComplete: true,
    };

    beforeEach(() => {
        clearConsumerEntryOk('u1');
    });

    it('never forces complete-profile before server sync (prevents flash)', () => {
        expect(
            shouldForceCompleteProfileRedirect({
                profileServerSynced: false,
                profile: incomplete,
            })
        ).toBe(false);
    });

    it('forces complete-profile only after sync confirms incompleteness', () => {
        expect(
            shouldForceCompleteProfileRedirect({
                profileServerSynced: true,
                profile: incomplete,
            })
        ).toBe(true);
    });

    it('does not force when profile is complete', () => {
        expect(
            shouldForceCompleteProfileRedirect({
                profileServerSynced: true,
                profile: complete,
            })
        ).toBe(false);
        expect(canConsumerEnterApp(complete)).toBe(true);
    });

    it('does not force when session entry-ok is set for this uid', () => {
        markConsumerEntryOk('u1');
        expect(
            shouldForceCompleteProfileRedirect({
                profileServerSynced: true,
                profile: incomplete,
                uid: 'u1',
            })
        ).toBe(false);
    });
});
