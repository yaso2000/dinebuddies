import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaTag } from 'react-icons/fa';
import { AppText } from './base';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { listActiveCommunityOffers, takeCommunityOffer } from '../services/communityMemberApi';
import { isBusinessUser } from '../utils/accountRole';
import { offerBannerStyle } from '../utils/offerBanner';
import OfferClaimQrModal from './OfferClaimQrModal';
import '../pages/CreateCommunityOffer.css';
import './OffersFeedStrip.css';

/**
 * Horizontal special-offers strip on the main social feed. Order is randomised on
 * every load so no single offer is always first (fair rotation). "Take it" records
 * the claim for members; non-members are nudged to join.
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

  useEffect(() => {
    let cancelled = false;
    if (isGuest || isBusiness) return undefined;
    (async () => {
      try {
        const list = await listActiveCommunityOffers();
        // Randomise order so no single offer is always first — reshuffled on every
        // load/refresh so businesses get fair rotation in the swipe strip.
        const shuffled = Array.isArray(list) ? [...list] : [];
        for (let i = shuffled.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        if (!cancelled) setOffers(shuffled);
      } catch {
        if (!cancelled) setOffers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isGuest, isBusiness]);

  const sorted = useMemo(() => offers.slice(0, 12), [offers]);

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
          {t('special_offers_title', 'Special offers')}
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
