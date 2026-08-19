import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ProfileGiftPickerModal from '../components/gifts/ProfileGiftPickerModal';
import { getPrivateInviteeDisplayName } from '../utils/privateInviteAvailability';
import { useToast } from '../context/ToastContext';

function resolveRecipient(raw) {
  if (!raw) return null;
  const user = raw.user || raw;
  const id = user?.id || user?.uid || raw?.id || raw?.uid;
  if (!id) return null;
  return {
    id,
    displayName: getPrivateInviteeDisplayName(user) || user?.display_name || user?.displayName || '',
    allowGifts: user?.privacySettings?.allowGifts !== false,
  };
}

export function useProfileGiftPicker() {
  const [recipient, setRecipient] = useState(null);
  const { showToast } = useToast();
  const { t } = useTranslation();

  const openGiftPicker = useCallback((profileOrUser) => {
    const resolved = resolveRecipient(profileOrUser);
    if (!resolved) return;
    if (!resolved.allowGifts) {
      showToast(t('recipient_gifts_disabled', 'This user is not accepting gifts right now.'), 'info');
      return;
    }
    setRecipient(resolved);
  }, [showToast, t]);

  const closeGiftPicker = useCallback(() => setRecipient(null), []);

  const giftModal = recipient ? (
    <ProfileGiftPickerModal recipient={recipient} onClose={closeGiftPicker} />
  ) : null;

  return { openGiftPicker, closeGiftPicker, giftModal, giftRecipient: recipient };
}
