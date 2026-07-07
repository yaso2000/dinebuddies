import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { FaCopy, FaExternalLinkAlt, FaTimes, FaTv } from 'react-icons/fa';
import { AppText } from '../base';
import {
  ensureCommunityChatDisplayLink,
  revokeCommunityChatDisplayLink,
} from '../../services/communityChatDisplay';
import { useToast } from '../../context/ToastContext';
import './CommunityChatCastLauncher.css';

function BannerToolModal({ title, titleId, onClose, children, footer }) {
  return createPortal(
    <div className="community-chat-cast-modal" role="presentation" onClick={onClose}>
      <div
        className="community-chat-cast-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="community-chat-cast-modal__header">
          <AppText as="h2" id={titleId} className="community-chat-cast-modal__title">
            {title}
          </AppText>
          <button
            type="button"
            className="community-chat-cast-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <FaTimes aria-hidden />
          </button>
        </div>
        <div className="community-chat-cast-modal__body">{children}</div>
        {footer ? <div className="community-chat-cast-modal__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

export default function CommunityChatCastLauncher({ partnerId, disabled = false }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [displayUrl, setDisplayUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');

  const castWindowFeatures = useMemo(
    () => 'popup=yes,width=1280,height=720,noopener,noreferrer',
    []
  );

  const loadDisplayLink = useCallback(async () => {
    if (!partnerId) return;
    setBusy(true);
    try {
      const result = await ensureCommunityChatDisplayLink(partnerId);
      setDisplayUrl(result.url || '');
    } catch (err) {
      console.error('[CommunityChatCastLauncher] ensure link', err);
      showToast(
        t('community_chat_cast_link_failed', 'Could not create the display link.'),
        'error'
      );
    } finally {
      setBusy(false);
    }
  }, [partnerId, showToast, t]);

  useEffect(() => {
    if (!open || !partnerId) return;
    void loadDisplayLink();
  }, [loadDisplayLink, open, partnerId]);

  useEffect(() => {
    if (!displayUrl) {
      setQrDataUrl('');
      return undefined;
    }
    let cancelled = false;
    void QRCode.toDataURL(displayUrl, {
      width: 220,
      margin: 1,
      color: { dark: '#111827', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [displayUrl]);

  const copyLink = async () => {
    if (!displayUrl || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(displayUrl);
      showToast(t('community_chat_cast_copied', 'Display link copied.'), 'success');
    } catch {
      showToast(t('copy_failed', 'Could not copy.'), 'error');
    }
  };

  const openDisplayWindow = () => {
    if (!displayUrl) return;
    window.open(displayUrl, `community-cast-${partnerId}`, castWindowFeatures);
  };

  const revokeLink = async () => {
    if (!partnerId) return;
    setBusy(true);
    try {
      await revokeCommunityChatDisplayLink(partnerId);
      setDisplayUrl('');
      showToast(t('community_chat_cast_revoked', 'Display link disabled.'), 'success');
    } catch (err) {
      console.error('[CommunityChatCastLauncher] revoke', err);
      showToast(t('failed_save', 'Could not save. Please try again.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="community-chat-cast-launcher__btn"
        disabled={disabled}
        aria-label={t('community_chat_cast_tool', 'Cast to screen')}
        title={t('community_chat_cast_tool', 'Cast to screen')}
        onClick={() => setOpen(true)}
      >
        <FaTv aria-hidden />
      </button>

      {open ? (
        <BannerToolModal
          title={t('community_chat_cast_tool', 'Cast to screen')}
          titleId="community-chat-cast-modal-title"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="community-chat-cast-modal__secondary"
                disabled={busy || !displayUrl}
                onClick={() => void revokeLink()}
              >
                {t('community_chat_cast_revoke', 'Disable link')}
              </button>
              <button
                type="button"
                className="community-chat-cast-modal__primary"
                disabled={busy || !displayUrl}
                onClick={openDisplayWindow}
              >
                <FaExternalLinkAlt aria-hidden />
                {t('community_chat_cast_open', 'Open on screen')}
              </button>
            </>
          }
        >
          <AppText as="p" className="community-chat-cast-modal__hint">
            {t(
              'community_chat_cast_hint',
              'Open this link on a TV or tablet browser in your venue. The chat updates live — read only, no login needed on the screen.'
            )}
          </AppText>

          {qrDataUrl ? (
            <div className="community-chat-cast-modal__qr-wrap">
              <img src={qrDataUrl} alt="" className="community-chat-cast-modal__qr" />
            </div>
          ) : null}

          <label className="community-chat-cast-modal__label" htmlFor="community-chat-cast-url">
            {t('community_chat_cast_url_label', 'Display link')}
          </label>
          <div className="community-chat-cast-modal__url-row">
            <input
              id="community-chat-cast-url"
              className="community-chat-cast-modal__url"
              readOnly
              value={busy && !displayUrl ? t('loading', 'Loading…') : displayUrl}
            />
            <button
              type="button"
              className="community-chat-cast-modal__copy"
              disabled={!displayUrl}
              onClick={() => void copyLink()}
              aria-label={t('copy_link', 'Copy link')}
            >
              <FaCopy aria-hidden />
            </button>
          </div>

          <button
            type="button"
            className="community-chat-cast-modal__refresh"
            disabled={busy}
            onClick={() => void loadDisplayLink()}
          >
            {t('community_chat_cast_new_link', 'Generate new link')}
          </button>
        </BannerToolModal>
      ) : null}
    </>
  );
}
