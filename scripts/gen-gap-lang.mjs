/** Shared English corrections applied before translation */
export const enCorrections = {
  editor_leave_dont_save: "Don't save",
  social_invite_landing_subtitle_named: "Join DineBuddies free to accept or decline {{host}}'s invitation — it only takes a few seconds.",
  social_share_greeting: "🎉 You're invited!",
  community_blocked_message: "You have been blocked from {{name}}'s community",
  ai_prompt_social_invitation_default: 'Write a social invitation title and welcoming message suited to the occasion and venue.',
  private_ai_all_fields_required: 'Fill in the date, time, location, and message before using AI.',
  private_ai_description_missing: 'Add a short description or use AI to draft your message first.',
  private_ai_fields_applied: 'AI suggestions applied — review before sending.',
  private_ai_fields_empty: 'Nothing to apply yet — generate a draft with AI first.',
  private_ai_preview_label: 'AI preview',
  private_camera_short_hint: 'Record a short video for your invite',
};

/** Per-language overrides for keys needing special interpolation */
export const interpFixes = {
  favorite_places_local_hint: {
    de: 'Orte in ${searchData.city} anzeigen',
    es: 'Mostrando locales en ${searchData.city}',
    fr: 'Affichage des lieux à ${searchData.city}',
    it: 'Mostra locali a ${searchData.city}',
    pt: 'Mostrando locais em ${searchData.city}',
    tr: '${searchData.city} içindeki mekanlar gösteriliyor',
    hi: '${searchData.city} में स्थान दिखाए जा रहे हैं',
    ur: '${searchData.city} میں مقامات دکھائے جا رہے ہیں',
  },
  private_send_invite_badge_title: {
    de: 'Private Einladung an ${displayName} senden',
    es: 'Enviar invitación privada a ${displayName}',
    fr: 'Envoyer une invitation privée à ${displayName}',
    it: 'Invia invito privato a ${displayName}',
    pt: 'Enviar convite privado para ${displayName}',
    tr: '${displayName} adlı kişiye özel davet gönder',
    hi: '${displayName} को निजी निमंत्रण भेजें',
    ur: '${displayName} کو نجی دعوت بھیجیں',
  },
  private_send_invite_confirm: {
    de: 'Private Einladung an ${displayName} senden?',
    es: '¿Enviar invitación privada a ${displayName}?',
    fr: 'Envoyer une invitation privée à ${displayName} ?',
    it: 'Inviare invito privato a ${displayName}?',
    pt: 'Enviar convite privado para ${displayName}?',
    tr: '${displayName} adlı kişiye özel davet gönderilsin mi?',
    hi: '${displayName} को निजी निमंत्रण भेजें?',
    ur: '${displayName} کو نجی دعوت بھیجیں؟',
  },
};
