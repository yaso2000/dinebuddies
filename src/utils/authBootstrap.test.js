import { describe, expect, it } from 'vitest';
import { isAuthBootstrapPending } from './authBootstrap.js';

describe('isAuthBootstrapPending', () => {
    it('is pending while Firebase loading', () => {
        expect(
            isAuthBootstrapPending({
                loading: true,
                currentUser: null,
                isGuest: false,
                profileServerSynced: false,
            })
        ).toBe(true);
    });

    it('is pending for signed-in users until profile sync', () => {
        expect(
            isAuthBootstrapPending({
                loading: false,
                currentUser: { uid: 'u1' },
                isGuest: false,
                profileServerSynced: false,
            })
        ).toBe(true);
        expect(
            isAuthBootstrapPending({
                loading: false,
                currentUser: { uid: 'u1' },
                isGuest: false,
                profileServerSynced: true,
            })
        ).toBe(false);
    });

    it('is not pending for guests without loading', () => {
        expect(
            isAuthBootstrapPending({
                loading: false,
                currentUser: { uid: 'g1' },
                isGuest: true,
                profileServerSynced: false,
            })
        ).toBe(false);
    });
});
