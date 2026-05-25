/**
 * Public invitation card: font list for the composer.
 */
import { PRIVATE_CARD_FONTS } from '../components/Invitations/privateCard/privateCardFonts';

/** Same catalog as private/dating cards (Latin + Arabic decorative). */
export const PUBLIC_INVITATION_FONT_OPTIONS = PRIVATE_CARD_FONTS.map((f) => ({
    label: f.defaultLabel,
    cssFamily: f.cssFamily.replace(/"/g, "'"),
}));
