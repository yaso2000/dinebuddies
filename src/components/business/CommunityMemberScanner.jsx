import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import jsQR from 'jsqr';
import { FaTimes, FaCheckCircle, FaExclamationTriangle, FaCamera } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { AppText } from '../base';
import {
  parseMembershipQrPayload,
  parseOfferClaimQrPayload,
  verifyCommunityMember,
  redeemOfferClaim,
} from '../../services/communityMemberApi';
import './CommunityMemberScanner.css';

/**
 * Business-owner scanner. Handles two QR kinds:
 *  - Per-offer claim QR (DBO1:<offerId>:<claimToken>) — the main flow: redeems that
 *    ONE specific offer for the member who claimed it. Unambiguous, one tap.
 *  - Membership QR (DBM1:<partnerId>:<qrToken>) — verifies the member's identity
 *    (their number) without touching any offer.
 * Camera via getUserMedia, decode via jsQR, all decisions server-side.
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
  const [result, setResult] = useState(null); // { mode:'offer'|'member', ok, reason, ... }

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

      // 1) Per-offer claim QR — redeem that specific offer.
      const offerClaim = parseOfferClaimQrPayload(payload);
      if (offerClaim) {
        busyRef.current = true;
        stopCamera();
        setPhase('verifying');
        try {
          const res = await redeemOfferClaim(offerClaim);
          setResult({ mode: 'offer', ...res });
        } catch (e) {
          setResult({ mode: 'offer', ok: false, reason: 'error', message: e?.message });
        }
        setPhase('result');
        return;
      }

      // 2) Membership QR — verify identity only.
      const membership = parseMembershipQrPayload(payload);
      if (!membership) return; // not our QR — keep scanning
      busyRef.current = true;
      stopCamera();
      if (membership.partnerId !== partnerId) {
        setResult({ mode: 'member', ok: false, reason: 'wrong_community' });
        setPhase('result');
        return;
      }
      setPhase('verifying');
      try {
        const res = await verifyCommunityMember(membership);
        setResult({ mode: 'member', ...res });
      } catch (e) {
        setResult({ mode: 'member', ok: false, reason: 'error', message: e?.message });
      }
      setPhase('result');
    },
    [partnerId, stopCamera]
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

  const memberReasonText = (reason) => {
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

  const offerReasonText = (reason) => {
    switch (reason) {
      case 'offer_not_found':
      case 'claim_not_found':
        return t('scanner_offer_invalid', 'This offer code is not valid.');
      case 'offer_inactive':
        return t('offer_unavailable', 'This offer is no longer available.');
      default:
        return t('scanner_reason_error', 'Could not redeem this offer. Try again.');
    }
  };

  const memberBadge = (n) => `#${String(n || 0).padStart(4, '0')}`;

  return createPortal(
    <div className="member-scanner-overlay" role="dialog" aria-modal="true">
      <div className="member-scanner">
        <div className="member-scanner__header">
          <AppText as="h3" className="member-scanner__title">
            <FaCamera aria-hidden style={{ marginInlineEnd: 8 }} />
            {t('scanner_title_offer', 'Scan & redeem')}
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
                {t('scanner_hint_offer', "Point the camera at the member's offer or membership QR.")}
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

          {/* Offer redeemed successfully */}
          {phase === 'result' && result?.mode === 'offer' && result.ok && (
            <div className="member-scanner__result member-scanner__result--ok">
              <FaCheckCircle className="member-scanner__result-icon" aria-hidden />
              <AppText as="p" className="member-scanner__result-title">
                {t('scanner_offer_redeemed', 'Redeemed ✓')}
              </AppText>
              {result.offerTitle ? (
                <AppText as="p" className="member-scanner__result-offer">{result.offerTitle}</AppText>
              ) : null}
              <AppText as="p" className="member-scanner__result-number">
                {memberBadge(result.memberNumber)}
                {result.memberName ? ` · ${result.memberName}` : ''}
              </AppText>
              <button type="button" className="member-scanner__btn" onClick={startCamera}>
                {t('scanner_scan_another', 'Scan another')}
              </button>
            </div>
          )}

          {/* Offer already redeemed */}
          {phase === 'result' && result?.mode === 'offer' && !result.ok && result.reason === 'already_redeemed' && (
            <div className="member-scanner__result member-scanner__result--fail">
              <FaExclamationTriangle className="member-scanner__result-icon" aria-hidden />
              <AppText as="p" className="member-scanner__result-title">
                {t('scanner_offer_already', 'Already redeemed')}
              </AppText>
              {result.offerTitle ? (
                <AppText as="p" className="member-scanner__result-offer">{result.offerTitle}</AppText>
              ) : null}
              <button type="button" className="member-scanner__btn" onClick={startCamera}>
                {t('scanner_scan_another', 'Scan another')}
              </button>
            </div>
          )}

          {/* Offer redeem failed */}
          {phase === 'result' && result?.mode === 'offer' && !result.ok && result.reason !== 'already_redeemed' && (
            <div className="member-scanner__result member-scanner__result--fail">
              <FaExclamationTriangle className="member-scanner__result-icon" aria-hidden />
              <AppText as="p">{offerReasonText(result.reason)}</AppText>
              <button type="button" className="member-scanner__btn" onClick={startCamera}>
                {t('retry', 'Retry')}
              </button>
            </div>
          )}

          {/* Membership verified (identity only) */}
          {phase === 'result' && result?.mode === 'member' && result.ok && (
            <div className="member-scanner__result member-scanner__result--ok">
              <FaCheckCircle className="member-scanner__result-icon" aria-hidden />
              <AppText as="p" className="member-scanner__result-title">
                {t('scanner_verified', 'Verified member')}
              </AppText>
              <AppText as="p" className="member-scanner__result-number">
                {memberBadge(result.memberNumber)}
              </AppText>
              {result.memberName ? (
                <AppText as="p" className="member-scanner__result-name">{result.memberName}</AppText>
              ) : null}
              <button type="button" className="member-scanner__btn" onClick={startCamera}>
                {t('scanner_scan_another', 'Scan another')}
              </button>
            </div>
          )}

          {/* Membership verify failed */}
          {phase === 'result' && result?.mode === 'member' && !result.ok && (
            <div className="member-scanner__result member-scanner__result--fail">
              <FaExclamationTriangle className="member-scanner__result-icon" aria-hidden />
              <AppText as="p">{memberReasonText(result.reason)}</AppText>
              <button type="button" className="member-scanner__btn" onClick={startCamera}>
                {t('retry', 'Retry')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
