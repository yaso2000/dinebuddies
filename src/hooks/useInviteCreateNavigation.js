import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import { useMyLiveStage } from './useMyLiveStage';
import { blockPublicInviteFromBusinessVenue } from '../utils/publicInviteVenueGate';
import { getInvitationDailyFreeStatus } from '../utils/privateInvitationCredits';
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
  const { cannotCreateInvitations, currentUser, isBusiness } = useAuth();
  const { canCreateSocialInvitation, restaurants: restaurantsFromContext } = useInvitations();
  const { stageId: liveStageId, hasLiveStage, loading: liveStageLoading } = useMyLiveStage();
  const [publicGateChecking, setPublicGateChecking] = useState(false);
  const [dailyFreeStatus, setDailyFreeStatus] = useState(null);

  useEffect(() => {
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid) {
      setDailyFreeStatus(null);
      return;
    }
    let cancelled = false;
    getInvitationDailyFreeStatus(uid).then((status) => {
      if (!cancelled) setDailyFreeStatus(status);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid, currentUser?.id]);

  const restaurants = restaurantsProp ?? restaurantsFromContext;

  const activeHostedStage = useMemo(
    () => (liveStageId ? { id: liveStageId } : null),
    [liveStageId]
  );

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
      if (!kind) return;

      // Business accounts may open/enter a Stage; invitation types stay blocked.
      if (kind === 'stage') {
        if (hasLiveStage && liveStageId) {
          navigate(`/stage/${liveStageId}`, {
            state: {
              stageHostId: currentUser?.uid || null,
            },
          });
          onAfterNavigate?.();
          return;
        }
        if (liveStageLoading) {
          showToast(t('loading_stages', 'Loading stages…'), 'info');
          return;
        }
        navigate('/create-stage', { state: { ...resolvedState } });
        onAfterNavigate?.();
        return;
      }

      if (cannotCreateInvitations || isBusiness) {
        showToast(t('business_cannot_create_invitation'), 'error');
        onAfterNavigate?.();
        return;
      }

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
        const quotaInfo = canCreateSocialInvitation('social', {
          freeSlotAvailable: Boolean(dailyFreeStatus?.socialFree),
        });
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
        const quotaInfo = canCreateSocialInvitation('private', {
          freeSlotAvailable: Boolean(dailyFreeStatus?.privateFree),
        });
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
      }
    },
    [
      businessId,
      canCreateSocialInvitation,
      cannotCreateInvitations,
      currentUser?.uid,
      dailyFreeStatus,
      hasLiveStage,
      isBusiness,
      liveStageId,
      liveStageLoading,
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
    activeHostedStage,
    liveStageLoading,
  };
}
