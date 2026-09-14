import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaCity, FaTimes, FaChevronLeft, FaChevronRight, FaGift, FaBriefcase, FaCalendarAlt } from 'react-icons/fa';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useInvitations } from '../context/InvitationContext';

/** Normalize a city string for loose comparison (case/space/punctuation-insensitive). */
const normCity = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Two cities "match" when one contains the other (handles "Al Zahra, Jeddah" vs "Jeddah"). */
function cityMatches(userCity, otherCity) {
  const a = normCity(userCity);
  const b = normCity(otherCity);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/** Read a business/partner city from its public_profiles doc. */
async function fetchBusinessCity(uid) {
  try {
    const snap = await getDoc(doc(db, 'public_profiles', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return d.businessPublic?.city || d.userPublic?.city || d.city || null;
  } catch {
    return null;
  }
}

/**
 * City register — a header button that opens "what's available in the viewer's
 * city": active public invitations, live offers, and open jobs. Each item opens
 * its existing flow (join the invite / view the offer / apply for the job).
 * Display only — no search. Summary view → per-category short list → back/close.
 */
export default function CityRegisterPanel() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { userProfile, currentUser, isGuest } = useAuth();
  const { invitations } = useInvitations();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState('summary'); // 'summary' | 'invitations' | 'offers' | 'jobs'
  const [offers, setOffers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  const userCity = userProfile?.city || currentUser?.city || '';

  // Lock the page behind the modal (iOS otherwise scrolls the header behind it).
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Active public invitations already in the viewer's city (from context, no reads).
  const cityInvitations = useMemo(() => {
    if (!userCity) return [];
    return (invitations || []).filter((inv) => {
      if ((inv.privacy || 'public') !== 'public') return false;
      const c = inv.city || inv.restaurantCity || inv.userCity;
      return cityMatches(userCity, c);
    });
  }, [invitations, userCity]);

  // Offers + jobs need the posting business's city → resolved on open.
  const loadOffersAndJobs = useCallback(async () => {
    if (!userCity) { setOffers([]); setJobs([]); return; }
    setLoading(true);
    try {
      const [offerSnap, jobSnap] = await Promise.all([
        getDocs(query(collection(db, 'active_offers'), where('status', '==', 'active'))),
        getDocs(query(collection(db, 'business_jobs'), where('status', '==', 'open'))),
      ]);
      const rawOffers = offerSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const rawJobs = jobSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Resolve each posting business's city once.
      const bizIds = [
        ...new Set([
          ...rawOffers.map((o) => o.partnerId),
          ...rawJobs.map((j) => j.businessId),
        ].filter(Boolean)),
      ];
      const cityEntries = await Promise.all(
        bizIds.map(async (id) => [id, await fetchBusinessCity(id)])
      );
      const cityById = new Map(cityEntries);

      setOffers(
        rawOffers.filter((o) => cityMatches(userCity, cityById.get(o.partnerId)))
          .map((o) => ({ ...o, _bizCity: cityById.get(o.partnerId) }))
      );
      setJobs(
        rawJobs.filter((j) =>
          cityMatches(userCity, cityById.get(j.businessId)) || cityMatches(userCity, j.location)
        )
      );
    } catch (e) {
      console.error('[CityRegister] load offers/jobs', e);
      setOffers([]); setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [userCity]);

  const openPanel = () => {
    setView('summary');
    setOpen(true);
    loadOffersAndJobs();
  };

  const go = (path) => { setOpen(false); navigate(path); };

  // Don't show for guests — a city register needs a signed-in profile city.
  if (isGuest || userProfile?.role === 'guest') return null;

  const isRtl = i18n.dir() === 'rtl';
  const BackIcon = isRtl ? FaChevronRight : FaChevronLeft;

  const CATS = [
    { key: 'invitations', icon: <FaCalendarAlt />, color: '#ef4444', label: t('city_register_invitations', 'دعوات عامة نشطة'), count: cityInvitations.length },
    { key: 'offers', icon: <FaGift />, color: '#8b5cf6', label: t('city_register_offers', 'عروض'), count: offers.length },
    { key: 'jobs', icon: <FaBriefcase />, color: '#0ea5e9', label: t('city_register_jobs', 'وظائف'), count: jobs.length },
  ];

  const rowStyle = {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'start',
    padding: '14px 14px', borderRadius: 14, border: '1px solid var(--border-color, #e5e7eb)',
    background: 'var(--bg-card, #fff)', cursor: 'pointer', marginBottom: 10,
  };

  const renderList = (items, kind) => {
    if (loading && kind !== 'invitations') {
      return <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 24 }}>{t('loading', 'جارٍ التحميل…')}</p>;
    }
    if (!items.length) {
      return <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 24 }}>{t('city_register_empty', 'لا يوجد شيء متاح هنا حاليًا.')}</p>;
    }
    return items.map((it) => {
      let title = '', subtitle = '', onClick = () => {};
      if (kind === 'invitations') {
        title = it.title || t('invitation', 'دعوة');
        subtitle = [it.restaurantName, it.city || it.restaurantCity].filter(Boolean).join(' · ');
        onClick = () => go(`/invitation/${it.id}`);
      } else if (kind === 'offers') {
        title = it.title || t('offer', 'عرض');
        subtitle = it.description ? String(it.description).slice(0, 60) : (it._bizCity || '');
        onClick = () => go(`/business/${it.partnerId}`);
      } else {
        title = it.title || t('job', 'وظيفة');
        subtitle = [it.businessName, it.location].filter(Boolean).join(' · ');
        onClick = () => go(`/business/${it.businessId}`);
      }
      return (
        <button key={it.id} type="button" onClick={onClick} dir={i18n.dir()} style={rowStyle}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 800, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
            {subtitle ? <span style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</span> : null}
          </span>
          <span style={{ color: 'var(--text-tertiary, #9ca3af)', transform: isRtl ? 'scaleX(-1)' : 'none' }}>›</span>
        </button>
      );
    });
  };

  const listFor = (k) => (k === 'invitations' ? cityInvitations : k === 'offers' ? offers : jobs);
  const activeCat = CATS.find((c) => c.key === view);

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className="notification-bell header-settings-btn"
        title={t('city_register_title', 'سجل المدينة')}
        aria-label={t('city_register_title', 'سجل المدينة')}
      >
        <FaCity />
      </button>

      {open && createPortal(
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2147483000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'max(16px, env(safe-area-inset-top,0px)) 16px max(16px, env(safe-area-inset-bottom,0px))' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            dir={i18n.dir()}
            style={{ position: 'relative', width: '100%', maxWidth: 480, maxHeight: '86dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg-card, #fff)', borderRadius: 20, boxShadow: '0 18px 50px rgba(0,0,0,0.28)', overflow: 'hidden' }}
          >
            {/* Header: back (in list) + title + close */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 12px', borderBottom: '1px solid var(--border-color, #eee)' }}>
              {view !== 'summary' ? (
                <button type="button" onClick={() => setView('summary')} aria-label={t('back', 'رجوع')} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'var(--bg-body, rgba(0,0,0,0.06))', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BackIcon />
                </button>
              ) : <span style={{ width: 34 }} />}
              <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 900, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                  {view === 'summary' ? t('city_register_title', 'سجل المدينة') : activeCat?.label}
                </span>
                {userCity ? <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{userCity}</span> : null}
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('close', 'إغلاق')} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'var(--bg-body, rgba(0,0,0,0.06))', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FaTimes />
              </button>
            </div>

            <div style={{ padding: 16, overflowY: 'auto' }}>
              {!userCity ? (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 24 }}>
                  {t('city_register_no_city', 'أضف مدينتك في الملف الشخصي لعرض ما هو متاح حولك.')}
                </p>
              ) : view === 'summary' ? (
                CATS.map((c) => (
                  <button key={c.key} type="button" onClick={() => setView(c.key)} dir={i18n.dir()} style={rowStyle}>
                    <span style={{ width: 40, height: 40, borderRadius: 12, background: `${c.color}1a`, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{c.icon}</span>
                    <span style={{ flex: 1, fontWeight: 800, color: 'var(--text-main)' }}>{c.label}</span>
                    <span style={{ fontWeight: 900, fontSize: '1.1rem', color: c.color, minWidth: 24, textAlign: 'center' }}>{loading && c.key !== 'invitations' ? '…' : c.count}</span>
                    <span style={{ color: 'var(--text-tertiary, #9ca3af)', transform: isRtl ? 'scaleX(-1)' : 'none' }}>›</span>
                  </button>
                ))
              ) : (
                renderList(listFor(view), view)
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
