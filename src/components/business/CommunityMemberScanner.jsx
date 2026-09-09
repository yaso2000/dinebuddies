import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { FaTimes, FaCheckCircle, FaExclamationTriangle, FaCamera } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { AppText } from '../base';
import {
  parseMembershipQrPayload,
  verifyCommunityMember,
  listCommunityOffers,
  redeemCommunityOffer,
} from '../../services/communityMemberApi';
import './CommunityMemberScanner.css';

/**
 * Business-owner screen: scan a member's QR (DBM1:<partnerId>:<qrToken>) to verify
 * they belong to THIS community before applying an offer. Camera via getUserMedia,
 * decode via jsQR, verification server-side (verifyCommunityMember).
 */
export default function CommunityMemberScanner({ partnerId, onClose }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const busyRef = useRef(false);

  const [phase, setPhase] = useState('scanning'); // scanning | verifying | result | error
  const [cameraError, setCameraError] = useState('');
  const [result, setResult] = useState(null); // { ok, reason, memberNumber, memberName, ... }
  const [scannedToken, setScannedToken] = useState('');
  const [offers, setOffers] = useState([]);
  const [redeemingId, setRedeemingId] = useState('');
  const [redeemedById, setRedeemedById] = useState({}); // offerId -> { ok, reason, redeemedAt }

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const handleDecoded = useCallback(
    async (payload) => {
      if (busyRef.current) return;
      const parsed = parseMembershipQrPayload(payload);
      if (!parsed) return; // not our QR — keep scanning
      busyRef.current = true;
      stopCamera();

      if (parsed.partnerId !== partnerId) {
        setResult({ ok: false, reason: 'wrong_community' });
        setPhase('result');
        return;
      }

      setPhase('verifying');
      setScannedToken(parsed.qrToken);
      setRedeemedById({});
      try {
        const res = await verifyCommunityMember(parsed);
        setResult(res);
        if (res?.ok) {
          // Load active offers so the owner can redeem one for this member.
          try {
            setOffers(await listCommunityOffers({ activeOnly: true }));
          } catch {
            setOffers([]);
          }
        }
      } catch (e) {
        setResult({ ok: false, reason: 'error', message: e?.message });
      }
      setPhase('result');
    },
    [partnerId, stopCamera]
  );

  const redeem = useCallback(
    async (offer) => {
      if (!scannedToken || redeemingId) return;
      setRedeemingId(offer.id);
      try {
        const res = await redeemCommunityOffer({ qrToken: scannedToken, offerId: offer.id });
        setRedeemedById((prev) => ({ ...prev, [offer.id]: res }));
      } catch (e) {
        setRedeemedById((prev) => ({ ...prev, [offer.id]: { ok: false, reason: 'error' } }));
      } finally {
        setRedeemingId('');
      }
    },
    [scannedToken, redeemingId]
  );

  const startCamera = useCallback(async () => {
    setCameraError('');
    setResult(null);
    busyRef.current = false;
    setPhase('scanning');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play().catch(() => {});

      const canvas = canvasRef.current || document.createElement('canvas');
      canvasRef.current = canvas;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const tick = () => {
        if (!streamRef.current || !video) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          try {
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
            if (code?.data) {
              void handleDecoded(code.data);
              return;
            }
          } catch {
            /* frame not ready */
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setCameraError(
        e?.name === 'NotAllowedError'
          ? t('scanner_camera_denied', 'Camera permission denied. Allow camera access to scan.')
          : t('scanner_camera_error', 'Could not start the camera.')
      );
      setPhase('error');
    }
  }, [handleDecoded, t]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const reasonText = (reason) => {
    switch (reason) {
      case 'not_found':
        return t('scanner_reason_not_found', 'This code is not a valid membership.');
      case 'wrong_community':
        return t('scanner_reason_wrong_community', 'This member belongs to a different community.');
      case 'left':
      case 'removed':
      case 'inactive':
        return t('scanner_reason_inactive', 'This membership is no longer active.');
      default:
        return t('scanner_reason_error', 'Could not verify this member. Try again.');
    }
  };

  return (
    <div className="member-scanner-overlay" role="dialog" aria-modal="true">
      <div className="member-scanner">
        <div className="member-scanner__header">
          <AppText as="h3" className="member-scanner__title">
            <FaCamera aria-hidden style={{ marginInlineEnd: 8 }} />
            {t('scanner_title', 'Verify member')}
          </AppText>
          <button
            type="button"
            className="member-scanner__close"
            onClick={() => {
              stopCamera();
              onClose?.();
            }}
            aria-label={t('close', 'Close')}>
            <FaTimes />
          </button>
        </div>

        <div className="member-scanner__body">
          {phase === 'scanning' && (
            <>
              <div className="member-scanner__viewport">
                <video ref={videoRef} className="member-scanner__video" muted playsInline />
                <div className="member-scanner__frame" aria-hidden />
              </div>
              <AppText as="p" className="member-scanner__hint">
                {t('scanner_hint', "Point the camera at the member's QR code.")}
              </AppText>
            </>
          )}

          {phase === 'verifying' && (
            <AppText as="p" className="member-scanner__status">
              {t('scanner_verifying', 'Verifying…')}
            </AppText>
          )}

          {phase === 'error' && (
            <div className="member-scanner__result member-scanner__result--fail">
              <FaExclamationTriangle className="member-scanner__result-icon" aria-hidden />
              <AppText as="p">{cameraError}</AppText>
              <button type="button" className="member-scanner__btn" onClick={startCamera}>
                {t('retry', 'Retry')}
              </button>
            </div>
          )}

          {phase === 'result' && result?.ok && (
            <div className="member-scanner__result member-scanner__result--ok">
              <FaCheckCircle className="member-scanner__result-icon" aria-hidden />
              <AppText as="p" className="member-scanner__result-title">
                {t('scanner_verified', 'Verified member')}
              </AppText>
              <AppText as="p" className="member-scanner__result-number">
                {`#${String(result.memberNumber || 0).padStart(4, '0')}`}
              </AppText>
              {result.memberName ? (
                <AppText as="p" className="member-scanner__result-name">{result.memberName}</AppText>
              ) : null}

              {offers.length > 0 && (
                <div className="member-scanner__offers">
                  <AppText as="p" className="member-scanner__offers-title">
                    {t('scanner_redeem_offer', 'Redeem an offer')}
                  </AppText>
                  {offers.map((offer) => {
                    const r = redeemedById[offer.id];
                    return (
                      <div key={offer.id} className="member-scanner__offer-row">
                        <div className="member-scanner__offer-info">
                          <span className="member-scanner__offer-name">{offer.title}</span>
                          {r?.ok ? (
                            <span className="member-scanner__offer-state member-scanner__offer-state--ok">
                              {t('scanner_offer_redeemed', 'Redeemed ✓')}
                            </span>
                          ) : r && r.reason === 'already_redeemed' ? (
                            <span className="member-scanner__offer-state member-scanner__offer-state--warn">
                              {t('scanner_offer_already', 'Already redeemed')}
                            </span>
                          ) : r ? (
                            <span className="member-scanner__offer-state member-scanner__offer-state--warn">
                              {t('scanner_offer_failed', 'Could not redeem')}
                            </span>
                          ) : null}
                        </div>
                        {!r?.ok && (
                          <button
                            type="button"
                            className="member-scanner__offer-btn"
                            disabled={redeemingId === offer.id}
                            onClick={() => redeem(offer)}>
                            {redeemingId === offer.id ? t('scanner_verifying', 'Verifying…') : t('scanner_redeem', 'Redeem')}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <button type="button" className="member-scanner__btn" onClick={startCamera}>
                {t('scanner_scan_another', 'Scan another')}
              </button>
            </div>
          )}

          {phase === 'result' && result && !result.ok && (
            <div className="member-scanner__result member-scanner__result--fail">
              <FaExclamationTriangle className="member-scanner__result-icon" aria-hidden />
              <AppText as="p">{reasonText(result.reason)}</AppText>
              <button type="button" className="member-scanner__btn" onClick={startCamera}>
                {t('retry', 'Retry')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
