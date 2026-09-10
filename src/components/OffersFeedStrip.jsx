import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaTag } from 'react-icons/fa';
import { AppText } from './base';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { haversineKm } from '../utils/postsFeedScope';
import { listActiveCommunityOffers, takeCommunityOffer } from '../services/communityMemberApi';
import { isBusinessUser } from '../utils/accountRole';
import { offerBannerStyle } from '../utils/offerBanner';
import OfferClaimQrModal from './OfferClaimQrModal';
import '../pages/CreateCommunityOffer.css';
import './OffersFeedStrip.css';

/**
 * Horizontal "special offers near you" strip on the main social feed. Nearest
 * first. "Take it" records the claim for members; non-members are nudged to join
 * (full join-prompt UX lives on the /offers page).
 */
export default function OffersFeedStrip() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userProfile, isGuest } = useAuth();
  const { showToast } = useToast();
  // Business accounts don't take offers — they only share the feed & stories.
  const isBusiness = isBusinessUser(userProfile);

  const [offers, setOffers] = useState([]);
  const [takingId, setTakingId] = useState('');
  const [takenById, setTakenById] = useState({}); // offerId -> { status, claimToken }
  const [claimModal, setClaimModal] = useState(null);
  const [userLoc, setUserLoc] = useState(() => {
    const lat = Number(userProfile?.coordinates?.lat);
    const lng = Number(userProfile?.coordinates?.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  });

  useEffect(() => {
    let cancelled = false;
    if (isGuest || isBusiness) return undefined;
    (async () => {
      try {
        const list = await listActiveCommunityOffers();
        if (!cancelled) setOffers(list);
      } catch {
        if (!cancelled) setOffers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isGuest, isBusiness]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  const sorted = useMemo(() => {
    const withDist = offers.map((o) => {
      const hasGeo = userLoc && Number.isFinite(o.lat) && Number.isFinite(o.lng);
      return { ...o, _dist: hasGeo ? haversineKm(userLoc.lat, userLoc.lng, o.lat, o.lng) : null };
    });
    return withDist
      .sort((a, b) => {
        if (a._dist == null && b._dist == null) return (b.createdAt || 0) - (a.createdAt || 0);
        if (a._dist == null) return 1;
        if (b._dist == null) return -1;
        return a._dist - b._dist;
      })
      .slice(0, 12);
  }, [offers, userLoc]);

  const openClaim = useCallback(
    (offer, res) => {
      setClaimModal({
        offerId: offer.id,
        claimToken: res.claimToken || null,
        offerTitle: offer.title || res.offerTitle || '',
        businessName: offer.businessName || '',
        status: res.status || 'claimed',
      });
    },
    []
  );

  const take = useCallback(
    async (offer) => {
      if (takingId) return;
      // Already claimed this session — just re-show the code.
      const known = takenById[offer.id];
      if (known?.status === 'claimed' && known.claimToken) {
        openClaim(offer, known);
        return;
      }
      setTakingId(offer.id);
      try {
        const res = await takeCommunityOffer({ offerId: offer.id });
        if (res.ok) {
          setTakenById((prev) => ({ ...prev, [offer.id]: res }));
          openClaim(offer, res);
        } else if (res.reason === 'not_member') {
          showToast(
            t('offer_join_first_toast', 'Join the community first to take this offer.'),
            'info'
          );
          if (offer.partnerId) navigate(`/business/${offer.partnerId}`);
        } else if (res.reason === 'business_forbidden') {
          showToast(t('offer_business_forbidden', "Business accounts can't take offers."), 'info');
        } else if (res.reason === 'offer_inactive' || res.reason === 'offer_not_found') {
          showToast(t('offer_unavailable', 'This offer is no longer available.'), 'info');
        } else {
          showToast(t('offer_take_failed', 'Could not take the offer. Please try again.'), 'error');
        }
      } catch {
        showToast(t('offer_take_failed', 'Could not take the offer. Please try again.'), 'error');
      } finally {
        setTakingId('');
      }
    },
    [takingId, takenById, openClaim, navigate, showToast, t]
  );

  if (isGuest || isBusiness || sorted.length === 0) return null;

  return (
    <div className="offers-feed-strip">
      <div className="offers-feed-strip__head">
        <AppText as="span" className="offers-feed-strip__title">
          <FaTag aria-hidden style={{ marginInlineEnd: 6, color: 'var(--secondary)' }} />
          {t('offers_near_you', 'Special offers near you')}
        </AppText>
        <Link to="/offers" className="offers-feed-strip__all">{t('see_all', 'See all')}</Link>
      </div>
      <div className="offers-feed-strip__row">
        {sorted.map((offer) => {
          const claimed = takenById[offer.id];
          const isRedeemed = claimed?.status === 'redeemed';
          const label = isRedeemed
            ? t('offer_redeemed', 'Redeemed ✓')
            : claimed?.status === 'claimed'
            ? t('offer_show_code', 'Show code')
            : takingId === offer.id
            ? t('offer_taking', 'Taking…')
            : t('offer_take_it', 'Take it');
          return (
            <div key={offer.id} className="offers-feed-strip__slide">
              <div className="offer-banner" style={offerBannerStyle(offer)}>
                <div className="offer-banner__content">
                  <div
                    className="offer-banner__business"
                    style={{ cursor: 'pointer' }}
                    onClick={() => offer.partnerId && navigate(`/business/${offer.partnerId}`)}>
                    {offer.businessName}
                  </div>
                  <div className="offer-banner__title">{offer.title}</div>
                  {offer.description ? <div className="offer-banner__desc">{offer.description}</div> : null}
                </div>
                <button
                  type="button"
                  className="offer-banner__take"
                  disabled={isRedeemed || takingId === offer.id}
                  onClick={() => take(offer)}>
                  {label}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {claimModal && (
        <OfferClaimQrModal claim={claimModal} onClose={() => setClaimModal(null)} />
      )}
    </div>
  );
}
