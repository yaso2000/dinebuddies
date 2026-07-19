import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import { blockPublicInviteFromBusinessVenue } from '../utils/publicInviteVenueGate';
import {
  resolveHostInvitationNavigationState,
  withBusinessIdInPath,
} from '../utils/hostInvitationFromBusiness';

/**
 * Shared navigation for public / social / private create flows
 * (modal picker, manual hub, FAB sheet).
 */
export function useInviteCreateNavigation({
  navigationState = null,
  businessId: businessIdProp = null,
  restaurants: restaurantsProp = null,
  onAfterNavigate = null,
} = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { cannotCreateInvitations } = useAuth();
  const { canCreateSocialInvitation, restaurants: restaurantsFromContext } = useInvitations();
  const [publicGateChecking, setPublicGateChecking] = useState(false);

  const restaurants = restaurantsProp ?? restaurantsFromContext;

  const resolvedState = useMemo(
    () =>
      resolveHostInvitationNavigationState({
        locationState: navigationState,
        businessId: businessIdProp || navigationState?.businessId || navigationState?.restaurantData?.id,
        restaurants,
      }),
    [businessIdProp, navigationState, restaurants]
  );

  const businessId =
    resolvedState?.restaurantData?.id || businessIdProp || navigationState?.businessId || null;

  const goCreate = useCallback(
    async (kind) => {
      if (cannotCreateInvitations) {
        showToast(t('business_cannot_create_invitation'), 'error');
        onAfterNavigate?.();
        return;
      }
      if (!kind) return;

      const state = { ...resolvedState };

      if (kind === 'public') {
        if (publicGateChecking) return;
        if (state.restaurantData) {
          setPublicGateChecking(true);
          try {
            const blocked = await blockPublicInviteFromBusinessVenue({
              restaurantData: state.restaurantData,
              showToast,
              t,
            });
            if (blocked) return;
          } finally {
            setPublicGateChecking(false);
          }
        }
        navigate(withBusinessIdInPath('/create', businessId), { state });
        onAfterNavigate?.();
        return;
      }

      if (kind === 'social') {
        const quotaInfo = canCreateSocialInvitation('social');
        if (!quotaInfo.profileLoading && !quotaInfo.canCreate) {
          showToast(
            t(
              'insufficient_dine_credits_wallet',
              'Not enough Dine Credits. Open Settings → Dine Credits to top up.'
            ),
            'error'
          );
          navigate('/settings/credits');
          onAfterNavigate?.();
          return;
        }
        navigate(withBusinessIdInPath('/create-social', businessId), { state });
        onAfterNavigate?.();
        return;
      }

      if (kind === 'private' || kind === 'dating') {
        const quotaInfo = canCreateSocialInvitation('private');
        if (!quotaInfo.profileLoading && !quotaInfo.canCreate) {
          showToast(
            t(
              'insufficient_dine_credits_wallet',
              'Not enough Dine Credits. Open Settings → Dine Credits to top up.'
            ),
            'error'
          );
          navigate('/settings/credits');
          onAfterNavigate?.();
          return;
        }
        navigate(withBusinessIdInPath('/create-private', businessId), { state });
        onAfterNavigate?.();
        return;
      }

      if (kind === 'stage') {
        // Free for now — pricing / credits to be added later.
        navigate('/create-stage', { state });
        onAfterNavigate?.();
      }
    },
    [
      businessId,
      canCreateSocialInvitation,
      cannotCreateInvitations,
      navigate,
      onAfterNavigate,
      publicGateChecking,
      resolvedState,
      showToast,
      t,
    ]
  );

  return {
    goCreate,
    publicGateChecking,
    resolvedState,
    businessId,
    cannotCreateInvitations,
  };
}
