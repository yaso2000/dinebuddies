import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaPlus, FaEdit, FaTrash, FaRegCalendarAlt, FaUserPlus } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useBusinessEvents } from '../../hooks/useBusinessEvents';
import { createEvent, updateEvent, deleteEvent } from '../../services/businessEvents';
import { uploadImage } from '../../utils/imageUpload';
import { ImageUploadZone } from '../../services/imageUploadZones';
import { notifyImageUploadError } from '../../utils/imageModerationErrors';

const toMillis = (v) => (v?.toMillis ? v.toMillis() : (typeof v === 'number' ? v : 0));

function formatEventDate(startAt, endAt, isArabic) {
  const start = toMillis(startAt);
  if (!start) return '';
  const locale = isArabic ? 'ar' : 'en';
  const opts = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
  const s = new Date(start).toLocaleString(locale, opts);
  const end = toMillis(endAt);
  if (end && end > start) {
    const e = new Date(end).toLocaleString(locale, { hour: '2-digit', minute: '2-digit' });
    return `${s} – ${e}`;
  }
  return s;
}

const EMPTY = { title: '', description: '', imageUrl: '', startAt: '', endAt: '', price: '', entryNote: '', dressCode: '', capacity: '', isActive: true };

/** datetime-local <-> Firestore Timestamp millis helpers. */
const tsToLocalInput = (v) => {
  const ms = toMillis(v);
  if (!ms) return '';
  const d = new Date(ms - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

export default function BusinessProfileEventsTab({ profile }) {
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.language || 'ar').startsWith('ar');
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const businessInfo = profile?.businessInfo || {};
  const isOwner = Boolean(profile?.isOwner);
  const businessId = profile?.business?.uid || profile?.business?.id || profile?.profileId || '';
  const businessName = profile?.business?.display_name || profile?.business?.name || businessInfo.businessName || '';

  const { events } = useBusinessEvents(businessId, { includeEnded: isOwner });

  const [editing, setEditing] = useState(null); // null | 'new' | eventId
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (profile?.activeTab !== 'events') return null;

  const openNew = () => { setForm(EMPTY); setEditing('new'); };
  const openEdit = (ev) => {
    setForm({
      title: ev.title || '', description: ev.description || '', imageUrl: ev.imageUrl || '',
      startAt: tsToLocalInput(ev.startAt), endAt: tsToLocalInput(ev.endAt),
      price: ev.price || '', entryNote: ev.entryNote || '', dressCode: ev.dressCode || '',
      capacity: ev.capacity || '', isActive: ev.isActive !== false,
    });
    setEditing(ev.id);
  };

  const onImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(
        file,
        `business_events/${businessId}/${Date.now()}.jpg`,
        null,
        { maxSizeMB: 1, maxWidthOrHeight: 1400 },
        { moderationZone: ImageUploadZone.FEATURED, userId: currentUser?.uid },
      );
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (err) {
      notifyImageUploadError(showToast, err, t);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.title.trim() || !form.startAt) {
      showToast(t('business_event_missing', 'العنوان والتاريخ مطلوبان'), 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        businessId,
        ownerId: currentUser?.uid || '',
        startAt: form.startAt ? new Date(form.startAt).getTime() : null,
        endAt: form.endAt ? new Date(form.endAt).getTime() : null,
        city: businessInfo.city || '',
        countryCode: businessInfo.countryCode || '',
      };
      if (editing === 'new') await createEvent(payload);
      else await updateEvent(editing, payload);
      showToast(t('business_event_saved', 'تم حفظ المناسبة'), 'success');
      setEditing(null);
    } catch (err) {
      showToast(err?.message || t('business_event_save_error', 'تعذّر الحفظ'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (ev) => {
    const ok = await confirm({ message: t('business_event_delete_confirm', 'حذف هذه المناسبة؟'), tone: 'danger' });
    if (!ok) return;
    try { await deleteEvent(ev.id); showToast(t('business_event_deleted', 'تم الحذف'), 'success'); }
    catch (err) { showToast(err?.message || 'error', 'error'); }
  };

  const invite = (ev) => {
    if (currentUser?.isGuest || !currentUser) { navigate('/login'); return; }
    navigate('/create-social', {
      state: {
        eventId: ev.id,
        businessId,
        selectedRestaurant: {
          id: businessId, name: businessName,
          image: businessInfo.coverImage || profile?.business?.photo_url || '',
          address: businessInfo.address || '', city: businessInfo.city || '',
          lat: businessInfo.lat ?? profile?.business?.coordinates?.lat ?? null,
          lng: businessInfo.lng ?? profile?.business?.coordinates?.lng ?? null,
          countryCode: businessInfo.countryCode || '', type: businessInfo.businessType || 'Restaurant',
        },
        eventTitle: ev.title,
      },
    });
  };

  // Plain computation (NOT a hook) — it runs after the early return above, so it
  // must not be useMemo (that would be a conditional hook and crash on tab switch).
  const sorted = [...events].sort((a, b) => toMillis(a.startAt) - toMillis(b.startAt));

  // Visitor with no upcoming events: render nothing (the tab is hidden anyway).
  if (!isOwner && sorted.length === 0) return null;

  return (
    <div dir={i18n.dir()} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {isOwner && (
        <button type="button" onClick={openNew} style={btnPrimary}>
          <FaPlus /> {t('business_event_add', 'أضف مناسبة')}
        </button>
      )}

      {sorted.length === 0 && isOwner && (
        <p style={{ color: 'var(--text-secondary,#6b7280)', textAlign: 'center', margin: '12px 0' }}>
          {t('business_event_none_owner', 'لا مناسبات بعد — أضف أول مناسبة.')}
        </p>
      )}

      {sorted.map((ev) => {
        const ended = toMillis(ev.endsAt) < Date.now();
        return (
          <div key={ev.id} style={{ ...card, opacity: ev.isActive === false || ended ? 0.6 : 1 }}>
            {ev.imageUrl ? (
              <img src={ev.imageUrl} alt={ev.title} style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: '14px 14px 0 0', display: 'block' }} />
            ) : null}
            <div style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary,#ef4444)', fontSize: '0.82rem', fontWeight: 700, marginBottom: 4 }}>
                <FaRegCalendarAlt /> {formatEventDate(ev.startAt, ev.endAt, isArabic)}
                {(ended || ev.isActive === false) && <span style={{ color: 'var(--text-tertiary,#9ca3af)' }}>· {t('business_event_ended', 'منتهية')}</span>}
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>{ev.title}</h3>
              {ev.description ? <p style={{ margin: '0 0 8px', fontSize: '0.9rem', color: 'var(--text-secondary,#6b7280)', lineHeight: 1.6 }}>{ev.description}</p> : null}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {ev.price ? <span style={chip}>💵 {ev.price}</span> : ev.entryNote ? <span style={chip}>🎟️ {ev.entryNote}</span> : null}
                {ev.dressCode ? <span style={chip}>👔 {ev.dressCode}</span> : null}
                {ev.capacity ? <span style={chip}>👥 {ev.capacity}</span> : null}
              </div>
              {isOwner ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => openEdit(ev)} style={btnGhost}><FaEdit /> {t('edit', 'تعديل')}</button>
                  <button type="button" onClick={() => remove(ev)} style={{ ...btnGhost, color: '#ef4444' }}><FaTrash /> {t('delete', 'حذف')}</button>
                </div>
              ) : (
                <button type="button" onClick={() => invite(ev)} style={btnPrimary}>
                  <FaUserPlus /> {t('business_event_invite', 'ادعُ شخصاً لهذه المناسبة')}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {editing && (
        <div onClick={() => !saving && setEditing(null)} style={overlay}>
          <div onClick={(e) => e.stopPropagation()} dir={i18n.dir()} style={sheet}>
            <h3 style={{ margin: '0 0 12px', fontWeight: 800 }}>{editing === 'new' ? t('business_event_add', 'أضف مناسبة') : t('business_event_edit', 'تعديل المناسبة')}</h3>
            <label style={lbl}>{t('business_event_title', 'العنوان')} *</label>
            <input style={inp} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <label style={lbl}>{t('business_event_desc', 'الوصف')}</label>
            <textarea style={{ ...inp, minHeight: 70 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>{t('business_event_start', 'يبدأ')} *</label>
                <input type="datetime-local" style={inp} value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>{t('business_event_end', 'ينتهي')}</label>
                <input type="datetime-local" style={inp} value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>{t('business_event_price', 'السعر / الدخول')}</label>
                <input style={inp} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder={t('business_event_price_ph', 'مثال: 50 ريال أو دخول مجاني')} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>{t('business_event_dress', 'الزيّ')}</label>
                <input style={inp} value={form.dressCode} onChange={(e) => setForm({ ...form, dressCode: e.target.value })} />
              </div>
            </div>
            <label style={lbl}>{t('business_event_capacity', 'السعة')}</label>
            <input type="number" style={inp} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            <label style={lbl}>{t('business_event_image', 'صورة')}</label>
            {form.imageUrl ? <img src={form.imageUrl} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 10, marginBottom: 8 }} /> : null}
            <input type="file" accept="image/*" onChange={onImage} disabled={uploading} />
            <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              {t('business_event_active', 'نشِطة (ظاهرة للزوّار)')}
            </label>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button type="button" onClick={() => setEditing(null)} disabled={saving} style={{ ...btnGhost, flex: 1, justifyContent: 'center' }}>{t('cancel', 'إلغاء')}</button>
              <button type="button" onClick={save} disabled={saving || uploading} style={{ ...btnPrimary, flex: 1, justifyContent: 'center' }}>{saving ? '…' : t('save', 'حفظ')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const card = { background: 'var(--bg-card,#fff)', border: '1px solid var(--border-color,#e5e7eb)', borderRadius: 14, overflow: 'hidden' };
const chip = { padding: '4px 10px', borderRadius: 999, background: 'var(--bg-body,#f3f4f6)', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' };
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, border: 'none', background: 'var(--primary,#ef4444)', color: '#fff', fontWeight: 800, fontSize: '0.92rem', cursor: 'pointer' };
const btnGhost = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 12, border: '1px solid var(--border-color,#e5e7eb)', background: 'transparent', color: 'var(--text-main)', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' };
const sheet = { width: '100%', maxWidth: 520, maxHeight: '92dvh', overflowY: 'auto', background: 'var(--bg-card,#fff)', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom,0px))' };
const lbl = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary,#6b7280)', margin: '10px 0 4px' };
const inp = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-color,#e5e7eb)', background: 'var(--bg-body,#fff)', color: 'var(--text-main)', fontSize: '0.92rem' };
