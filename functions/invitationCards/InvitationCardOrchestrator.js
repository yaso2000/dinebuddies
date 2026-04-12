/**
 * InvitationCardOrchestrator — end-to-end generation (max 3 attempts, 3 cards each).
 */

const crypto = require('crypto');
const InvitationKindRouter = require('./InvitationKindRouter');
const PromptBlueprintBuilder = require('./PromptBlueprintBuilder');
const StochasticVariationController = require('./StochasticVariationController');
const CardVisualGeneratorGateway = require('./CardVisualGeneratorGateway');
const MotionRecipeBuilder = require('./MotionRecipeBuilder');
const AdjustmentOptionSuggester = require('./AdjustmentOptionSuggester');
const DraftRepository = require('./DraftRepository');

const promptBuilder = new PromptBlueprintBuilder();
const stochastic = new StochasticVariationController();
const visualGateway = new CardVisualGeneratorGateway();
const motionBuilder = new MotionRecipeBuilder();
const adjustmentSuggester = new AdjustmentOptionSuggester();
const draftRepo = new DraftRepository();

function normalizeInput(data) {
    const invitationKind = typeof data?.invitationKind === 'string' ? data.invitationKind.trim().toLowerCase() : '';
    const inviterDisplayName = typeof data?.inviterDisplayName === 'string' ? data.inviterDisplayName.trim() : '';
    const placeDisplayName = typeof data?.placeDisplayName === 'string' ? data.placeDisplayName.trim() : '';
    const message = typeof data?.message === 'string' ? data.message.trim() : '';
    const userPreferences = data?.userPreferences && typeof data.userPreferences === 'object' ? data.userPreferences : {};
    const outputFormat = data?.outputFormat === 'animated' ? 'animated' : 'static';
    const clientAttemptId = typeof data?.clientAttemptId === 'string' ? data.clientAttemptId.trim() : '';
    let draftGroupId = typeof data?.draftGroupId === 'string' ? data.draftGroupId.trim() : '';

    const base = {
        invitationKind,
        inviterDisplayName,
        placeDisplayName,
        message,
        userPreferences,
        outputFormat,
        clientAttemptId
    };

    if (invitationKind === 'private') {
        return {
            ...base,
            draftGroupId,
            occasionLabel: typeof data?.occasionLabel === 'string' ? data.occasionLabel.trim() : '',
            guestCountHint: data?.guestCountHint,
            privacyTone: typeof data?.privacyTone === 'string' ? data.privacyTone.trim() : undefined,
            adjustmentHint: typeof data?.adjustmentHint === 'string' ? data.adjustmentHint.trim() : ''
        };
    }

    if (invitationKind === 'dating') {
        return {
            ...base,
            draftGroupId,
            interactionIntent: typeof data?.interactionIntent === 'string' ? data.interactionIntent.trim() : '',
            comfortLevel: typeof data?.comfortLevel === 'string' ? data.comfortLevel.trim() : ''
        };
    }

    throw new Error('Invalid invitationKind.');
}

async function runInvitationCardGeneration(data, context) {
    const uid = context.auth.uid;
    const input = normalizeInput(data);

    if (!input.inviterDisplayName || !input.placeDisplayName) {
        throw new Error('inviterDisplayName and placeDisplayName are required.');
    }

    let draftGroupId = input.draftGroupId;
    if (!draftGroupId) {
        draftGroupId = crypto.randomUUID();
        await draftRepo.createSession(draftGroupId, uid, {
            invitationKind: input.invitationKind,
            clientAttemptId: input.clientAttemptId
        });
    } else {
        const existing = await draftRepo.getSession(draftGroupId);
        if (!existing) {
            throw new Error('Invalid or unknown draftGroupId.');
        }
        if (existing.data.userId !== uid) {
            throw new Error('This session does not belong to the current user.');
        }
        if (existing.data.invitationKind !== input.invitationKind) {
            throw new Error('invitationKind does not match this session.');
        }
    }

    const session = await draftRepo.getSession(draftGroupId);

    const attemptIndex = (session.data.attemptCount || 0) + 1;
    if (attemptIndex > 3) {
        throw new Error('Maximum attempts (3) reached for this draft group.');
    }

    const { rulesEngine, copyComposer } = InvitationKindRouter.route(input.invitationKind);
    const rulesResult = rulesEngine.validateAndAnnotate(input);
    if (!rulesResult.ok) {
        throw new Error(rulesResult.errors?.join(' ') || 'Validation failed.');
    }

    const priorFingerprints = new Set(session.data.fingerprints || []);
    const seeds = stochastic.seedsForAttempt(draftGroupId, attemptIndex);

    const cards = [];
    const newFingerprints = [];

    for (let slot = 1; slot <= 3; slot += 1) {
        let seed = seeds[slot - 1];
        let blueprint = promptBuilder.build({
            invitationKind: input.invitationKind,
            input,
            annotations: rulesResult.annotations,
            variationSlot: slot,
            seed
        });

        let textOverlay = copyComposer.compose(blueprint);
        let visualPrompt = blueprint.visualPrompt;

        const cardId = `${draftGroupId}_a${attemptIndex}_s${slot}`;

        let stored = await visualGateway.generateAndStore({
            visualPrompt,
            userId: uid,
            draftGroupId,
            cardId
        });

        let fp = stochastic.fingerprint(textOverlay, stored.storagePath);
        if (priorFingerprints.has(fp) || newFingerprints.includes(fp)) {
            seed = stochastic.nudgeSeed(seed);
            blueprint = promptBuilder.build({
                invitationKind: input.invitationKind,
                input,
                annotations: rulesResult.annotations,
                variationSlot: slot,
                seed
            });
            textOverlay = copyComposer.compose(blueprint);
            visualPrompt = blueprint.visualPrompt;
            stored = await visualGateway.generateAndStore({
                visualPrompt,
                userId: uid,
                draftGroupId,
                cardId: `${cardId}_r`
            });
            fp = stochastic.fingerprint(textOverlay, stored.storagePath);
        }

        priorFingerprints.add(fp);
        newFingerprints.push(fp);

        const animationProfile =
            input.outputFormat === 'animated' ? motionBuilder.build(input.outputFormat, slot) : null;

        cards.push({
            cardId,
            slotIndex: slot,
            image: stored.imageUrl,
            textOverlay,
            animationProfile,
            provenance: {
                invitationKind: input.invitationKind,
                attemptIndex,
                variationSlot: slot,
                seedPrefix: seed.slice(0, 16)
            },
            fingerprint: fp,
            storagePath: stored.storagePath
        });
    }

    await draftRepo.appendAttempt(draftGroupId, {
        attemptIndex,
        cards: cards.map((c) => ({
            cardId: c.cardId,
            slotIndex: c.slotIndex,
            textOverlay: c.textOverlay,
            imageUrl: c.image,
            storagePath: c.storagePath,
            animationProfile: c.animationProfile,
            provenance: c.provenance,
            fingerprint: c.fingerprint
        })),
        newFingerprints
    });

    const adjustmentOptions =
        attemptIndex < 3
            ? adjustmentSuggester.suggest({ invitationKind: input.invitationKind, cards })
            : [];

    return {
        draftGroupId,
        attemptIndex,
        cards: cards.map(({ storagePath, fingerprint, ...rest }) => rest),
        adjustmentOptions
    };
}

module.exports = { runInvitationCardGeneration, normalizeInput };
