import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { processInvitationMedia } from '../services/mediaService';
import { rememberPrivateDraftCreateKind } from './privateInvitationDraft';
import { resolveCardStructureFromBackgroundId } from './cardStructure';

/**
 * Create or update a private/dating invitation Firestore draft from the editor.
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
    addPrivateInvitation,
    /** Private-only fields */
    privateCardThemeColor = null,
    privateCardShowHostAndMessage = true,
    privateCardTextBackdropTone = null,
    /** Dating-only fields */
    datingCardThemeColor = null,
    datingCardShowHostAndMessage = true,
    datingCardTextBackdropTone = null,
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

    const baseDraft = {
        ...formData,
        ...mediaFields,
        cardFrameColorId,
        cardFontId,
        cardCopyOffsetY,
        cardCopyWidthPct,
        cardCopyFontScale,
        cardBackgroundId: cardGradientId ? null : cardBackgroundId || null,
        cardGradientId: cardGradientId || null,
        cardGradientDecorationId: null,
        cardStructure: cardGradientId ? null : resolveCardStructureFromBackgroundId(cardBackgroundId),
        rsvps: initialRsvps,
        type,
        status: 'draft',
    };

    if (type === 'Private') {
        Object.assign(baseDraft, {
            privateCardThemeColor,
            privateCardShowHostAndMessage,
            privateCardTextBackdropTone,
        });
        rememberPrivateDraftCreateKind('private');
    } else {
        Object.assign(baseDraft, {
            datingCardThemeColor,
            datingCardShowHostAndMessage,
            datingCardTextBackdropTone,
        });
        rememberPrivateDraftCreateKind('dating');
    }

    const draftData =
        typeof sanitizeDraft === 'function' ? sanitizeDraft(baseDraft) : baseDraft;

    if (existingDraftId) {
        await updateDoc(doc(db, 'private_invitations', existingDraftId), {
            ...draftData,
            updatedAt: serverTimestamp(),
        });
        return { ok: true, draftId: existingDraftId };
    }

    const createResult = await addPrivateInvitation({
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
