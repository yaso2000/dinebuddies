import React, { useCallback, useState } from 'react';
import ProfileGiftPickerModal from '../components/gifts/ProfileGiftPickerModal';
import { getPrivateInviteeDisplayName } from '../utils/privateInviteAvailability';

function resolveRecipient(raw) {
  if (!raw) return null;
  const user = raw.user || raw;
  const id = user?.id || user?.uid || raw?.id || raw?.uid;
  if (!id) return null;
  return {
    id,
    displayName: getPrivateInviteeDisplayName(user) || user?.display_name || user?.displayName || '',
  };
}

export function useProfileGiftPicker() {
  const [recipient, setRecipient] = useState(null);

  const openGiftPicker = useCallback((profileOrUser) => {
    const resolved = resolveRecipient(profileOrUser);
    if (resolved) setRecipient(resolved);
  }, []);

  const closeGiftPicker = useCallback(() => setRecipient(null), []);

  const giftModal = recipient ? (
    <ProfileGiftPickerModal recipient={recipient} onClose={closeGiftPicker} />
  ) : null;

  return { openGiftPicker, closeGiftPicker, giftModal, giftRecipient: recipient };
}
