import { useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { resolveEnabledSections, PROFILE_SECTIONS } from '../config/businessProfileConfig';

/**
 * Owner-curated profile sections. Enabling/disabling a section only flips its
 * visibility (businessInfo.sections) — content (menu items, events, etc.) is
 * never touched, so removing then re-adding a section restores it in full.
 */
export function useBusinessSections(profile) {
  const info = profile?.businessInfo || {};
  const businessId = profile?.business?.uid || profile?.business?.id || profile?.profileId || '';
  const isOwner = Boolean(profile?.isOwner);

  const enabled = resolveEnabledSections(info);
  const disabled = PROFILE_SECTIONS.filter((s) => !enabled.includes(s));

  const persist = useCallback(
    async (next) => {
      if (!isOwner || !businessId) return;
      try {
        await updateDoc(doc(db, 'users', businessId), { 'businessInfo.sections': next });
      } catch {
        /* surfaced by the caller's own toasts if needed */
      }
    },
    [isOwner, businessId],
  );

  const addSection = useCallback(
    (id) => {
      if (!PROFILE_SECTIONS.includes(id) || enabled.includes(id)) return;
      persist([...enabled, id]);
    },
    [enabled, persist],
  );

  const removeSection = useCallback(
    (id) => persist(enabled.filter((s) => s !== id)),
    [enabled, persist],
  );

  return { enabled, disabled, isEnabled: (id) => enabled.includes(id), addSection, removeSection, isOwner };
}

export default useBusinessSections;
