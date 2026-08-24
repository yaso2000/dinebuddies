import { CONNECTION_REFOLLOW_COOLDOWN_MS } from './connectionActionCooldown';

const COOLDOWN_HOURS = Math.round(CONNECTION_REFOLLOW_COOLDOWN_MS / (60 * 60 * 1000));

/**
 * Cancelling a like or a follow locks the action for a day, so a mis-tap is
 * expensive. One shared copy so every card and profile asks the same way, and
 * says what it will cost.
 *
 * @param {(key: string, opts?: object) => string} t
 */
export function likeCancelConfirmOptions(t) {
  return {
    title: t('unlike_confirm_title', 'Remove your like?'),
    message: t('unlike_confirm_message', {
      hours: COOLDOWN_HOURS,
      defaultValue: `You will not be able to like them again for ${COOLDOWN_HOURS} hours.`,
    }),
    confirmLabel: t('unlike', 'Unlike'),
    tone: 'danger',
  };
}

/** @param {(key: string, opts?: object) => string} t */
export function followCancelConfirmOptions(t) {
  return {
    title: t('unfollow_confirm_title', 'Unfollow?'),
    message: t('unfollow_confirm_message', {
      hours: COOLDOWN_HOURS,
      defaultValue: `You will not be able to follow them again for ${COOLDOWN_HOURS} hours.`,
    }),
    confirmLabel: t('unfollow', 'Unfollow'),
    tone: 'danger',
  };
}
