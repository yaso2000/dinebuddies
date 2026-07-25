import assert from 'node:assert/strict';
import { parseInvitationCoordinates } from '../src/utils/invitationCoordinates.js';

assert.deepEqual(parseInvitationCoordinates(-33.8688, 151.2093), {
    lat: -33.8688,
    lng: 151.2093,
});
assert.deepEqual(parseInvitationCoordinates('-33.8688', '151.2093'), {
    lat: -33.8688,
    lng: 151.2093,
});

assert.equal(parseInvitationCoordinates(null, 151.2093), null);
assert.equal(parseInvitationCoordinates(-33.8688, null), null);
assert.equal(parseInvitationCoordinates(undefined, undefined), null);
assert.equal(parseInvitationCoordinates(NaN, 151.2093), null);
assert.equal(parseInvitationCoordinates(91, 151.2093), null);
assert.equal(parseInvitationCoordinates(-33.8688, 181), null);
assert.equal(parseInvitationCoordinates('', ''), null);

// Falsy zero is a valid equator / prime-meridian coordinate.
assert.deepEqual(parseInvitationCoordinates(0, 0), { lat: 0, lng: 0 });

console.log('Invitation coordinates validation test passed');
