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
  const { cannotCreateInvitations, currentUser, isBusiness, userProfile } = useAuth();
  const activeGameId = userProfile?.hostActiveGameId || null;
  const activeSuitabilityPostId = userProfile?.suitabilityActivePostId || null;
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

      // Group games: one at a time. If the user already hosts one, enter it;
      // otherwise open the create flow.
      if (kind === 'group_game') {
        navigate(activeGameId ? `/group-game/${activeGameId}` : '/create-group-game');
        onAfterNavigate?.();
        return;
      }

      // "Who suits you?" — a story-rail poll. Reopen the live post if one exists.
      if (kind === 'suitability') {
        navigate(activeSuitabilityPostId ? `/suitability/${activeSuitabilityPostId}` : '/suitability/new');
        onAfterNavigate?.();
        return;
      }

      // "Real or AI?" — create a round (camera or AI image).
      if (kind === 'realornai') {
        navigate('/realornai/new');
        onAfterNavigate?.();
        return;
      }

      // "Guess my sign?" — a story-rail card. Reopen the live one if it exists.
      if (kind === 'zodiac') {
        navigate('/zodiac/new');
        onAfterNavigate?.();
        return;
      }

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

    },
    [
      activeGameId,
      activeSuitabilityPostId,
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
    activeGameId,
    activeSuitabilityPostId,
    liveStageLoading,
  };
}
