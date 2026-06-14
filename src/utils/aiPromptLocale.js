import i18n from '../i18n';

/**
 * Localized default when the user leaves the AI prompt field empty.
 * @param {'regular_post' | 'featured_post' | 'animated_post' | 'invitation' | 'design_studio'} postType
 * @param {'public' | 'private' | 'date' | undefined} [subType]
 * @param {(key: string, opts?: object) => string} [t]
 */
export function getAiUserPromptFallback(postType, subType, t = i18n.t.bind(i18n)) {
    if (postType === 'invitation') {
        if (subType === 'date') return t('ai_prompt_dating_default');
        if (subType === 'private') return t('ai_prompt_private_invitation_default');
        return t('ai_prompt_public_invitation_default');
    }
    if (postType === 'featured_post') {
        return t('ai_prompt_featured_post_default', { name: t('business') });
    }
    if (postType === 'animated_post') {
        return t('ai_prompt_animated_post_default');
    }
    if (postType === 'design_studio') {
        return t('ai_design_studio_prompt_placeholder', {
            defaultValue: 'e.g. warm sunset beach scene, earthy tones, no text…',
        });
    }
    return t('ai_prompt_regular_post_default');
}

/**
 * Build localized user prompt for regular feed posts.
 * @param {{ title?: string, text?: string, attachedInvitation?: { title?: string } | null }} params
 */
export function buildRegularPostAiUserPrompt({ title = '', text = '', attachedInvitation = null } = {}) {
    const parts = [];
    if (String(title).trim()) parts.push(String(title).trim());
    if (String(text).trim()) parts.push(String(text).trim());
    if (attachedInvitation?.title) {
        parts.push(
            i18n.t('ai_context_post_linked_invitation', { title: attachedInvitation.title }),
        );
    }
    return parts.join('\n') || i18n.t('ai_prompt_regular_post_default');
}

/**
 * Build localized user prompt for private invitations.
 * @param {{ occasionType?: string, location?: string, date?: string, time?: string, title?: string, description?: string }} formData
 */
export function buildPrivateInvitationAiUserPrompt(formData = {}) {
    const parts = [
        formData.occasionType &&
            i18n.t('ai_context_occasion', { value: formData.occasionType }),
        formData.location?.trim() &&
            i18n.t('ai_context_location', { value: formData.location.trim() }),
        formData.date &&
            formData.time &&
            i18n.t('ai_context_schedule', { date: formData.date, time: formData.time }),
        formData.title?.trim() &&
            i18n.t('ai_context_current_title', { value: formData.title.trim() }),
        formData.description?.trim() &&
            i18n.t('ai_context_current_message', { value: formData.description.trim() }),
    ].filter(Boolean);

    return parts.join('\n') || i18n.t('ai_prompt_private_invitation_default');
}

/**
 * Build localized user prompt for dating invitations.
 * @param {{ location?: string, date?: string, time?: string, title?: string, description?: string }} formData
 * @param {{ display_name?: string } | null} selectedInvitee
 */
export function buildDatingInvitationAiUserPrompt(formData = {}, selectedInvitee = null) {
    const parts = [
        selectedInvitee?.display_name &&
            i18n.t('ai_prompt_dating_invitee', { name: selectedInvitee.display_name }),
        formData.location?.trim() &&
            i18n.t('ai_context_location', { value: formData.location.trim() }),
        formData.date &&
            formData.time &&
            i18n.t('ai_context_schedule', { date: formData.date, time: formData.time }),
        formData.title?.trim() &&
            i18n.t('ai_context_current_title', { value: formData.title.trim() }),
        formData.description?.trim() &&
            i18n.t('ai_context_current_message', { value: formData.description.trim() }),
    ].filter(Boolean);

    return parts.join('\n') || i18n.t('ai_prompt_dating_default');
}

/**
 * @param {{ date?: string, time?: string, guestsNeeded?: string | number, paymentType?: string, title?: string, description?: string }} formData
 */
export function buildPublicInvitationAiUserPrompt(formData = {}) {
    const parts = [
        formData.date &&
            formData.time &&
            i18n.t('ai_context_schedule', { date: formData.date, time: formData.time }),
        formData.guestsNeeded &&
            i18n.t('ai_context_seats', { value: String(formData.guestsNeeded) }),
        formData.paymentType &&
            i18n.t('ai_context_payment', { value: formData.paymentType }),
        formData.title?.trim() &&
            i18n.t('ai_context_current_title', { value: formData.title.trim() }),
        formData.description?.trim() &&
            i18n.t('ai_context_current_message', { value: formData.description.trim() }),
    ].filter(Boolean);

    return parts.join('\n') || i18n.t('ai_prompt_public_invitation_default');
}

/**
 * @param {{ businessName?: string, title?: string, description?: string }} params
 */
export function buildFeaturedPostAiUserPrompt({ businessName = '', title = '', description = '' } = {}) {
    const parts = [
        businessName && i18n.t('ai_context_business_name', { value: businessName }),
        title.trim() && i18n.t('ai_context_current_title', { value: title.trim() }),
        description.trim() && i18n.t('ai_context_current_message', { value: description.trim() }),
    ].filter(Boolean);

    return (
        parts.join('\n') ||
        i18n.t('ai_prompt_featured_post_default', { name: businessName || i18n.t('business') })
    );
}

/**
 * @param {{ title?: string, body?: string }} params
 */
export function buildAnimatedPostAiUserPrompt({ title = '', body = '' } = {}) {
    const parts = [
        title.trim() && i18n.t('ai_context_current_title', { value: title.trim() }),
        body.trim() && i18n.t('ai_context_current_message', { value: body.trim() }),
    ].filter(Boolean);

    return parts.join('\n') || i18n.t('ai_prompt_animated_post_default');
}
