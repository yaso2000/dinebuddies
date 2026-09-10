import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaTag, FaTrash, FaCheckCircle } from 'react-icons/fa';
import { AppText } from '../base';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import {
  listBusinessActiveOffers,
  takeCommunityOffer,
  deleteCommunityOffer,
} from '../../services/communityMemberApi';
import { isBusinessUser } from '../../utils/accountRole';
import { offerBannerStyle } from '../../utils/offerBanner';
import OfferClaimQrModal from '../OfferClaimQrModal';
import '../../pages/CreateCommunityOffer.css';
import './BusinessProfileOffers.css';

/**
 * Active offers of a single business, shown on its profile page. The owner sees a
 * delete control on each; a member can take an offer (per-offer claim QR); a
 * non-member is nudged to the community. Businesses can't take offers.
 */
export default function BusinessProfileOffers({ profileId, isOwner }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const isBusiness = isBusinessUser(userProfile);

  const [offers, setOffers] = useState([]);
  const [takingId, setTakingId] = useState('');
  const [takenById, setTakenById] = useState({});
  const [deletingId, setDeletingId] = useState('');
  const [claimModal, setClaimModal] = useState(null);

  const load = useCallback(async () => {
    if (!profileId) return;
    try {
      setOffers(await listBusinessActiveOffers({ partnerId: profileId }));
    } catch {
      setOffers([]);
    }
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  const take = useCallback(
    async (offer) => {
      if (takingId) return;
      const known = takenById[offer.id];
      if (known?.status === 'claimed' && known.claimToken) {
        setClaimModal({ offerId: offer.id, claimToken: known.claimToken, offerTitle: offer.title, businessName: offer.businessName, status: 'claimed' });
        return;
      }
      setTakingId(offer.id);
      try {
        const res = await takeCommunityOffer({ offerId: offer.id });
        if (res.ok) {
          setTakenById((prev) => ({ ...prev, [offer.id]: res }));
          setClaimModal({ offerId: offer.id, claimToken: res.claimToken || null, offerTitle: offer.title || res.offerTitle || '', businessName: offer.businessName, status: res.status || 'claimed' });
        } else if (res.reason === 'not_member') {
          showToast(t('offer_join_first_toast', 'Join the community first to take this offer.'), 'info');
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
    [takingId, takenById, showToast, t]
  );

  const remove = useCallback(
    async (offer) => {
      if (deletingId) return;
      const ok = await confirm({
        message: t('offer_delete_confirm_msg', 'Delete this offer? It will be removed from the feed and your profile. Paid credits are not refunded.'),
        tone: 'danger',
      });
      if (!ok) return;
      setDeletingId(offer.id);
      try {
        const res = await deleteCommunityOffer({ offerId: offer.id });
        if (res?.ok) {
          setOffers((prev) => prev.filter((o) => o.id !== offer.id));
          showToast(t('offer_deleted', 'Offer deleted.'), 'success');
        } else {
          showToast(t('save_failed', 'Could not save. Please try again.'), 'error');
        }
      } catch {
        showToast(t('save_failed', 'Could not save. Please try again.'), 'error');
      } finally {
        setDeletingId('');
      }
    },
    [confirm, deletingId, showToast, t]
  );

  if (offers.length === 0) return null;

  return (
    <div className="biz-profile-offers">
      <AppText as="h3" className="biz-profile-offers__title">
        <FaTag aria-hidden style={{ marginInlineEnd: 8, color: 'var(--secondary)' }} />
        {t('special_offers_title', 'Special offers')}
      </AppText>
      <div className="biz-profile-offers__list">
        {offers.map((offer) => {
          const claimed = takenById[offer.id];
          const isRedeemed = claimed?.status === 'redeemed';
          return (
            <div key={offer.id} className="offer-banner" style={offerBannerStyle(offer)}>
              <div className="offer-banner__content">
                <div className="offer-banner__business">{offer.businessName}</div>
                <div className="offer-banner__title">{offer.title}</div>
                {offer.description ? <div className="offer-banner__desc">{offer.description}</div> : null}
              </div>
              {isOwner ? (
                <button
                  type="button"
                  className="biz-profile-offers__delete"
                  onClick={() => remove(offer)}
                  disabled={deletingId === offer.id}
                  title={t('delete', 'Delete')}
                  aria-label={t('delete', 'Delete')}>
                  <FaTrash aria-hidden />
                </button>
              ) : !isBusiness ? (
                <button
                  type="button"
                  className="offer-banner__take"
                  disabled={isRedeemed || takingId === offer.id}
                  onClick={() => take(offer)}>
                  {isRedeemed ? (
                    <>
                      <FaCheckCircle aria-hidden style={{ marginInlineEnd: 4 }} />
                      {t('offer_redeemed', 'Redeemed ✓')}
                    </>
                  ) : claimed?.status === 'claimed' ? (
                    t('offer_show_code', 'Show code')
                  ) : takingId === offer.id ? (
                    t('offer_taking', 'Taking…')
                  ) : (
                    t('offer_take_it', 'Take it')
                  )}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {claimModal && <OfferClaimQrModal claim={claimModal} onClose={() => setClaimModal(null)} />}
    </div>
  );
}
