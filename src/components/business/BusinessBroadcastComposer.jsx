import React, { useState, useRef } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../firebase/config';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { uploadImage } from '../../utils/mediaUtils';
import { FaTimes, FaSpinner, FaBullhorn, FaTag, FaPaperPlane, FaImage, FaRegCommentDots } from 'react-icons/fa';
import { AppText, AppTextInput } from '../base';

/**
 * Business → community members broadcast (offer / announcement). Lands in each
 * member's Business Inbox. Paid Business plan only (enforced server-side too).
 */
export default function BusinessBroadcastComposer({ isOpen, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { currentUser } = useAuth();

  const [kind, setKind] = useState('offer');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [discountLabel, setDiscountLabel] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [image, setImage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef(null);

  if (!isOpen) return null;

  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.uid) return;
    setUploadingImage(true);
    try {
      const url = await uploadImage(file, currentUser.uid);
      setImage(url);
    } catch (err) {
      console.error('broadcast image', err);
      showToast(t('broadcast_image_error', 'Could not upload the image.'), 'error');
    } finally {
      setUploadingImage(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if (!title.trim() && !body.trim()) {
      showToast(t('broadcast_req_content', 'Add a title or a message.'), 'error');
      return;
    }
    setSending(true);
    try {
      const functions = getFunctions(app, 'us-central1');
      const res = await httpsCallable(functions, 'sendBusinessBroadcast')({
        kind,
        title: title.trim(),
        body: body.trim(),
        discountLabel: kind === 'offer' ? discountLabel.trim() : '',
        expiresAt: expiresAt || '',
        image: image || '',
      });
      const sent = Number(res?.data?.sent) || 0;
      showToast(
        sent > 0
          ? t('broadcast_sent', 'Sent to {{count}} members.', { count: sent })
          : t('broadcast_no_members', 'No community members to send to yet.'),
        sent > 0 ? 'success' : 'info'
      );
      setTitle(''); setBody(''); setDiscountLabel(''); setExpiresAt(''); setImage('');
      onClose();
    } catch (err) {
      console.error('broadcast', err);
      const code = String(err?.code || '');
      if (code === 'functions/failed-precondition') {
        showToast(t('broadcast_paid_only', 'Broadcasting offers requires a Paid Business plan.'), 'info');
        navigate('/settings/subscription');
      } else if (code === 'functions/resource-exhausted') {
        showToast(t('broadcast_rate_limited', 'You are sending broadcasts too fast. Please wait.'), 'error');
      } else {
        showToast(t('broadcast_error', 'Could not send the broadcast. Try again.'), 'error');
      }
    } finally {
      setSending(false);
    }
  };

  const kindBtn = (value, icon, label, color) => {
    const active = kind === value;
    return (
      <button type="button" onClick={() => setKind(value)} style={{
        flex: 1, padding: 12, borderRadius: 12, fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        background: active ? `${color}1a` : 'var(--bg-elevated)',
        border: active ? `2px solid ${color}` : '2px solid transparent',
        color: active ? color : 'var(--text-secondary)',
      }}>{icon} {label}</button>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', padding: 16 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 24, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: 20, borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-main)' }}>
          <AppText as="h3" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>{t('broadcast_title', 'Send to your community')}</AppText>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer', padding: 4 }}><FaTimes /></button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {t('broadcast_intro', 'Reaches every member of your community in their Business inbox — separate from personal chat.')}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {kindBtn('offer', <FaTag />, t('broadcast_kind_offer', 'Offer'), '#f59e0b')}
            {kindBtn('announcement', <FaBullhorn />, t('broadcast_kind_announcement', 'Announcement'), '#3b82f6')}
            {kindBtn('message', <FaRegCommentDots />, t('broadcast_kind_message', 'Message'), '#8b5cf6')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>{t('broadcast_field_title', 'Title')}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'offer' ? t('broadcast_title_ph_offer', 'e.g. 20% off this weekend') : t('broadcast_title_ph_ann', 'e.g. New branch now open')}
              style={{ width: '100%', padding: 14, borderRadius: 14, border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-main)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>{t('broadcast_field_body', 'Message')}</label>
            <AppTextInput as="textarea" value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('broadcast_body_ph', 'Write the details…')}
              style={{ width: '100%', height: 110, padding: 14, borderRadius: 14, border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-main)', fontSize: '0.95rem', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>

          {/* Optional image */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {t('broadcast_field_image', 'Image')} <AppText as="span" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({t('optional', 'optional')})</AppText>
            </label>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} style={{ display: 'none' }} />
            {image ? (
              <div style={{ position: 'relative', width: '100%', borderRadius: 14, overflow: 'hidden' }}>
                <img src={image} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />
                <button type="button" onClick={() => setImage('')} aria-label={t('remove', 'Remove')} style={{ position: 'absolute', top: 8, insetInlineEnd: 8, width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer' }}>
                  <FaTimes />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadingImage} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 14,
                border: '1px dashed var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
                fontWeight: 700, fontSize: '0.9rem', cursor: uploadingImage ? 'wait' : 'pointer'
              }}>
                {uploadingImage ? <FaSpinner className="spin" /> : <FaImage />}
                {uploadingImage ? t('broadcast_image_uploading', 'Uploading…') : t('broadcast_add_image', 'Add an image')}
              </button>
            )}
          </div>

          {kind === 'offer' && (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>{t('broadcast_field_discount', 'Discount')}</label>
                <input value={discountLabel} onChange={(e) => setDiscountLabel(e.target.value)} placeholder="20%"
                  style={{ width: '100%', padding: 14, borderRadius: 14, border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-main)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>{t('broadcast_field_expiry', 'Expires')}</label>
                <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                  style={{ width: '100%', padding: 14, borderRadius: 14, border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-main)', fontSize: '0.95rem', boxSizing: 'border-box' }} />
              </div>
            </div>
          )}

          <button onClick={handleSend} disabled={sending} style={{
            width: '100%', padding: 16, borderRadius: 16, background: 'var(--brand-primary)', color: '#fff', fontWeight: 800,
            fontSize: '1.05rem', border: 'none', cursor: sending ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            {sending ? <FaSpinner className="spin" /> : <FaPaperPlane />}
            {sending ? t('sending', 'Sending...') : t('broadcast_send', 'Send to community')}
          </button>
        </div>
      </div>
    </div>
  );
}
