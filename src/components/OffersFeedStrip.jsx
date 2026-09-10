import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaTag } from 'react-icons/fa';
import { AppText } from './base';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { haversineKm } from '../utils/postsFeedScope';
import { listActiveCommunityOffers, takeCommunityOffer } from '../services/communityMemberApi';
import { offerBannerStyle } from '../utils/offerBanner';
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

  const [offers, setOffers] = useState([]);
  const [takingId, setTakingId] = useState('');
  const [takenById, setTakenById] = useState({});
  const [userLoc, setUserLoc] = useState(() => {
    const lat = Number(userProfile?.coordinates?.lat);
    const lng = Number(userProfile?.coordinates?.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  });

  useEffect(() => {
    let cancelled = false;
    if (isGuest) return undefined;
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
  }, [isGuest]);

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

  const take = useCallback(
    async (offer) => {
      if (takingId) return;
      setTakingId(offer.id);
      try {
        const res = await takeCommunityOffer({ offerId: offer.id });
        if (res.ok) {
          setTakenById((prev) => ({ ...prev, [offer.id]: true }));
          showToast(t('offer_taken', 'Taken ✓'), 'success');
        } else if (res.reason === 'already_taken') {
          setTakenById((prev) => ({ ...prev, [offer.id]: true }));
          showToast(t('offer_already_taken', 'Already taken'), 'info');
        } else if (res.reason === 'not_member') {
          showToast(
            t('offer_join_first_toast', 'Join the community first to take this offer.'),
            'info'
          );
          if (offer.partnerId) navigate(`/business/${offer.partnerId}`);
        } else {
          showToast(t('offer_send_failed', 'Could not complete. Please try again.'), 'error');
        }
      } catch {
        showToast(t('offer_send_failed', 'Could not complete. Please try again.'), 'error');
      } finally {
        setTakingId('');
      }
    },
    [takingId, navigate, showToast, t]
  );

  if (isGuest || sorted.length === 0) return null;

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
          const done = takenById[offer.id];
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
                  disabled={done || takingId === offer.id}
                  onClick={() => take(offer)}>
                  {done ? t('offer_taken', 'Taken ✓') : takingId === offer.id ? t('offer_taking', 'Taking…') : t('offer_take_it', 'Take it')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
