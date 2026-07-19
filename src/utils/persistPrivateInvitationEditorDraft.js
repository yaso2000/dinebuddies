import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { processInvitationMedia } from '../services/mediaService';
import { rememberPrivateDraftCreateKind } from './socialInvitationDraft';
import { resolveCardStructureFromBackgroundId } from './cardStructure';
import { normalizePersonalInviteCategory } from '../constants/personalInviteCategories';
import {
    getDefaultPrivateCardBackgroundId,
    isPrivateBackgroundIdForCategory,
} from '../components/Invitations/privateCard/privateCardBackgrounds';
import { resolveOccasionCategoryId } from '../components/Invitations/socialCard/socialCardOccasionMap';
import {
    DEFAULT_PRIVATE_CARD_BACKGROUND_ID,
    getCardBackgroundOptions,
    resolveCanonicalBackgroundId,
} from '../components/Invitations/socialCard/socialCardBackgrounds';

function sanitizeSocialCardBackgroundId(formData, cardBackgroundId, cardGradientId) {
    if (cardGradientId) return null;
    const categoryId = resolveOccasionCategoryId(formData?.occasionType);
    if (!cardBackgroundId) return DEFAULT_PRIVATE_CARD_BACKGROUND_ID;
    const canonical = resolveCanonicalBackgroundId(categoryId, cardBackgroundId);
    const opts = getCardBackgroundOptions(categoryId);
    if (opts.some((o) => o.id === canonical)) return canonical;
    // Keep the original social id if category options are empty (catalog lag) rather than
    // rewriting to a private/friendship template that breaks preview.
    if (opts.length === 0) return cardBackgroundId;
    return DEFAULT_PRIVATE_CARD_BACKGROUND_ID;
}

function sanitizePrivateCardBackgroundId(formData, cardBackgroundId, cardGradientId) {
    if (cardGradientId) return null;
    const inviteCategory = normalizePersonalInviteCategory(formData?.personalInviteCategory);
    let safeCardBackgroundId = cardBackgroundId || null;
    if (safeCardBackgroundId && !isPrivateBackgroundIdForCategory(safeCardBackgroundId, inviteCategory)) {
        safeCardBackgroundId = getDefaultPrivateCardBackgroundId(inviteCategory);
    }
    return safeCardBackgroundId;
}

/**
 * Create or update a private/private invite Firestore draft from the editor.
 * @param {object} params
 * @returns {Promise<{ ok: true, draftId: string } | { ok: false, code?: string }>}
 */
export async function persistPrivateInvitationEditorDraft({
    type,
    formData,
    getActiveMedia,
    commitAiCoverMedia,
    authorUid,
    cardFrameColorId,
    cardFontId,
    cardCopyOffsetY = 0,
    cardCopyWidthPct = 78,
    cardCopyFontScale = 0,
    cardBackgroundId,
    cardGradientId,
    existingDraftId,
    addHostedInvitation,
    /** Private-only fields */
    socialCardThemeColor = null,
    socialCardShowHostAndMessage = true,
    socialCardTextBackdropTone = null,
    /** Dating-only fields */
    privateCardThemeColor = null,
    privateCardShowHostAndMessage = true,
    privateCardTextBackdropTone = null,
    sanitizeDraft = null,
}) {
    if (!authorUid) {
        return { ok: false, code: 'not_signed_in' };
    }

    let mediaFields = {};
    let activeMedia = await getActiveMedia();

    if (activeMedia?.source === 'ai_generated' && !activeMedia.publishedUrl && commitAiCoverMedia) {
        activeMedia = await commitAiCoverMedia(activeMedia);
    }

    if (activeMedia) {
        mediaFields = await processInvitationMedia(activeMedia, authorUid);
    }

    const initialRsvps = {};
    (formData.invitedFriends || []).forEach((friendId) => {
        initialRsvps[friendId] = 'pending';
    });

    const safeCardBackgroundId =
        type === 'Social'
            ? sanitizeSocialCardBackgroundId(formData, cardBackgroundId, cardGradientId)
            : sanitizePrivateCardBackgroundId(formData, cardBackgroundId, cardGradientId);

    const baseDraft = {
        ...formData,
        ...mediaFields,
        cardFrameColorId,
        cardFontId,
        cardCopyOffsetY,
        cardCopyWidthPct,
        cardCopyFontScale,
        cardBackgroundId: safeCardBackgroundId,
        cardGradientId: cardGradientId || null,
        cardGradientDecorationId: null,
        cardStructure: cardGradientId ? null : resolveCardStructureFromBackgroundId(safeCardBackgroundId),
        rsvps: initialRsvps,
        type,
        status: 'draft',
    };

    if (type === 'Social') {
        Object.assign(baseDraft, {
            socialCardThemeColor,
            socialCardShowHostAndMessage,
            socialCardTextBackdropTone,
        });
        rememberPrivateDraftCreateKind('social');
    } else {
        Object.assign(baseDraft, {
            privateCardThemeColor,
            privateCardShowHostAndMessage,
            privateCardTextBackdropTone,
        });
        if (formData?.personalInviteCategory != null) {
            baseDraft.personalInviteCategory = normalizePersonalInviteCategory(
                formData.personalInviteCategory
            );
        }
        rememberPrivateDraftCreateKind('private');
    }

    const draftData =
        typeof sanitizeDraft === 'function' ? sanitizeDraft(baseDraft) : baseDraft;

    if (existingDraftId) {
        await updateDoc(doc(db, 'social_invitations', existingDraftId), {
            ...draftData,
            updatedAt: serverTimestamp(),
        });
        return { ok: true, draftId: existingDraftId };
    }

    const createResult = await addHostedInvitation({
        ...draftData,
        createdAt: serverTimestamp(),
    });
    const draftId =
        typeof createResult === 'object' && createResult?.ok === true
            ? createResult.id
            : typeof createResult === 'string'
              ? createResult
              : null;

    if (!draftId) {
        return { ok: false, code: 'create_failed', createResult };
    }

    return { ok: true, draftId };
}
