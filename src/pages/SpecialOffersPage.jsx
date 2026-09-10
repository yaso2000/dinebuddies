import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaTag, FaArrowLeft, FaArrowRight, FaCheckCircle } from 'react-icons/fa';
import { AppText } from '../components/base';
import { useAuth } from '../context/AuthContext';
import { haversineKm } from '../utils/postsFeedScope';
import { listActiveCommunityOffers, takeCommunityOffer } from '../services/communityMemberApi';
import { offerBannerStyle } from '../utils/offerBanner';
import './SpecialOffersPage.css';
import './CreateCommunityOffer.css';

/**
 * Consumer "Special Offers" — every active offer businesses published to the feed,
 * as a list. "Take it" records the claim for community members; non-members get a
 * floating prompt to join the community first.
 */
export default function SpecialOffersPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const BackIcon = i18n.dir() === 'rtl' ? FaArrowRight : FaArrowLeft;

  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLoc, setUserLoc] = useState(() => {
    const lat = Number(userProfile?.coordinates?.lat);
    const lng = Number(userProfile?.coordinates?.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  });

  // Live GPS refines ordering; profile coords are the immediate fallback.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  // Nearest-first ordering (offers without geo sink to the bottom).
  const sortedOffers = useMemo(() => {
    const withDist = offers.map((o) => {
      const hasGeo = userLoc && Number.isFinite(o.lat) && Number.isFinite(o.lng);
      return { ...o, _dist: hasGeo ? haversineKm(userLoc.lat, userLoc.lng, o.lat, o.lng) : null };
    });
    return withDist.sort((a, b) => {
      if (a._dist == null && b._dist == null) return (b.createdAt || 0) - (a.createdAt || 0);
      if (a._dist == null) return 1;
      if (b._dist == null) return -1;
      return a._dist - b._dist;
    });
  }, [offers, userLoc]);
  const [takingId, setTakingId] = useState('');
  const [takenById, setTakenById] = useState({}); // offerId -> { ok, reason }
  const [joinPrompt, setJoinPrompt] = useState(null); // { partnerId, businessName }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOffers(await listActiveCommunityOffers());
    } catch {
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const take = useCallback(
    async (offer) => {
      if (takingId) return;
      setTakingId(offer.id);
      try {
        const res = await takeCommunityOffer({ offerId: offer.id });
        setTakenById((prev) => ({ ...prev, [offer.id]: res }));
        if (!res.ok && res.reason === 'not_member') {
          setJoinPrompt({ partnerId: offer.partnerId, businessName: offer.businessName });
        }
      } catch {
        setTakenById((prev) => ({ ...prev, [offer.id]: { ok: false, reason: 'error' } }));
      } finally {
        setTakingId('');
      }
    },
    [takingId]
  );

  const takeState = (offer) => {
    const r = takenById[offer.id];
    if (r?.ok) return { label: t('offer_taken', 'Taken ✓'), done: true };
    if (r?.reason === 'already_taken') return { label: t('offer_already_taken', 'Already taken'), done: true };
    return { label: takingId === offer.id ? t('offer_taking', 'Taking…') : t('offer_take_it', 'Take it'), done: false };
  };

  return (
    <div className="special-offers-page">
      <div className="special-offers-page__header">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t('back', 'Back')}
          className="special-offers-page__back">
          <BackIcon />
        </button>
        <AppText as="h1" className="special-offers-page__title">
          <FaTag aria-hidden style={{ marginInlineEnd: 8, color: 'var(--secondary)' }} />
          {t('special_offers_title', 'Special offers')}
        </AppText>
      </div>

      {loading ? (
        <div className="special-offers-page__status">{t('loading', 'Loading…')}</div>
      ) : offers.length === 0 ? (
        <div className="special-offers-page__empty">
          <FaTag style={{ fontSize: '2.4rem', opacity: 0.3 }} aria-hidden />
          <AppText as="p">{t('special_offers_empty', 'No special offers right now. Check back soon.')}</AppText>
        </div>
      ) : (
        <div className="special-offers-list">
          {sortedOffers.map((offer) => {
            const state = takeState(offer);
            return (
              <div key={offer.id} className="offer-banner" style={offerBannerStyle(offer)}>
                <div className="offer-banner__content">
                  <button
                    type="button"
                    className="offer-banner__business"
                    style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer', textAlign: 'start' }}
                    onClick={() => offer.partnerId && navigate(`/business/${offer.partnerId}`)}>
                    {offer.businessName}
                  </button>
                  <div className="offer-banner__title">{offer.title}</div>
                  {offer.description ? <div className="offer-banner__desc">{offer.description}</div> : null}
                </div>
                <button
                  type="button"
                  className="offer-banner__take"
                  disabled={state.done || takingId === offer.id}
                  onClick={() => take(offer)}>
                  {state.done ? <FaCheckCircle aria-hidden style={{ marginInlineEnd: 4 }} /> : null}
                  {state.label}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {joinPrompt && (
        <div className="special-offers-join-overlay" role="dialog" aria-modal="true" onClick={() => setJoinPrompt(null)}>
          <div className="special-offers-join" onClick={(e) => e.stopPropagation()}>
            <AppText as="h3" className="special-offers-join__title">
              {t('offer_join_first_title', 'Join to unlock this offer')}
            </AppText>
            <AppText as="p" className="special-offers-join__text">
              {t('offer_join_first_text', 'This offer is for {{business}} community members. Join the community first to take it.', { business: joinPrompt.businessName || t('this_business', 'this business') })}
            </AppText>
            <div className="special-offers-join__actions">
              <button
                type="button"
                className="special-offers-join__btn special-offers-join__btn--primary"
                onClick={() => {
                  const pid = joinPrompt.partnerId;
                  setJoinPrompt(null);
                  if (pid) navigate(`/business/${pid}`);
                }}>
                {t('offer_join_community', 'Join the community')}
              </button>
              <button
                type="button"
                className="special-offers-join__btn"
                onClick={() => setJoinPrompt(null)}>
                {t('later', 'Later')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
