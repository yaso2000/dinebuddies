/**
 * Routes invitation kind to the correct rules engine and copy composer instances.
 * Does not merge logic between private and dating.
 */

const PrivateOccasionRulesEngine = require('./PrivateOccasionRulesEngine');
const DatingInteractionRulesEngine = require('./DatingInteractionRulesEngine');
const PrivateCopyLineComposer = require('./PrivateCopyLineComposer');
const DatingCopyLineComposer = require('./DatingCopyLineComposer');

const privateRules = new PrivateOccasionRulesEngine();
const datingRules = new DatingInteractionRulesEngine();
const privateCopy = new PrivateCopyLineComposer();
const datingCopy = new DatingCopyLineComposer();

function route(invitationKind) {
    const k = typeof invitationKind === 'string' ? invitationKind.trim().toLowerCase() : '';
    if (k === 'private') {
        return { rulesEngine: privateRules, copyComposer: privateCopy };
    }
    if (k === 'dating') {
        return { rulesEngine: datingRules, copyComposer: datingCopy };
    }
    throw new Error('InvitationKindRouter: invitationKind must be "private" or "dating".');
}

module.exports = { route };
