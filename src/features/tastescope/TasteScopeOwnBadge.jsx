import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { normalizeUserGender } from '../../utils/avatarUtils';
import useTasteScope from './useTasteScope';
import TasteScopeBadge from './TasteScopeBadge';

/**
 * Own-profile inline badge: the `full` TasteScope badge with the quiz/retake CTA
 * in its sheet. Renders nothing until the current user has a title (the CTA card
 * covers the no-title state). Reads gender from the signed-in profile.
 */
export default function TasteScopeOwnBadge() {
  const { userProfile } = useAuth();
  const { titleId, hasTitle } = useTasteScope();

  if (!hasTitle) return null;

  return (
    <TasteScopeBadge
      variant="full"
      titleId={titleId}
      gender={normalizeUserGender(userProfile)}
      showCta
    />
  );
}
