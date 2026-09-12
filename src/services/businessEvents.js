/**
 * Business Events — a standalone `business_events` collection (NOT items inside a
 * business menu). Events power the "المناسبات / Events" tab. Ended events are
 * hidden from the public view (never deleted). See the business-profile redesign.
 *
 * Document shape (business_events/{eventId}):
 *   businessId, ownerId, title, description, imageUrl,
 *   startAt (Timestamp), endAt (Timestamp|null),
 *   endsAt (Timestamp = endAt||startAt — the field queries range on),
 *   price (string|null), entryNote (string|null), dressCode (string|null),
 *   capacity (number|null), city, countryCode, isActive, createdAt, updatedAt
 */
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, onSnapshot,
  query, where, orderBy, limit as qLimit, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const COL = 'business_events';

const toTs = (v) => {
  if (!v) return null;
  if (v instanceof Timestamp) return v;
  if (v && typeof v.toDate === 'function') return v;
  const ms = typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(ms) ? Timestamp.fromMillis(ms) : null;
};

/** Build the persisted event payload from a plain form object. */
export function buildEventPayload(form = {}) {
  const startAt = toTs(form.startAt);
  const endAt = toTs(form.endAt);
  const capacity = Number(form.capacity);
  return {
    businessId: String(form.businessId || '').trim(),
    ownerId: String(form.ownerId || '').trim(),
    title: String(form.title || '').trim(),
    description: String(form.description || '').trim(),
    imageUrl: String(form.imageUrl || '').trim(),
    startAt: startAt || null,
    endAt: endAt || null,
    // endsAt drives the "still upcoming" query; falls back to startAt.
    endsAt: endAt || startAt || null,
    price: String(form.price || '').trim() || null,
    entryNote: String(form.entryNote || '').trim() || null,
    dressCode: String(form.dressCode || '').trim() || null,
    capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : null,
    city: String(form.city || '').trim(),
    countryCode: String(form.countryCode || '').trim().toUpperCase().slice(0, 2),
    isActive: form.isActive !== false,
  };
}

export async function createEvent(form) {
  const payload = buildEventPayload(form);
  const ref = await addDoc(collection(db, COL), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateEvent(eventId, form) {
  const payload = buildEventPayload(form);
  await updateDoc(doc(db, COL, eventId), { ...payload, updatedAt: serverTimestamp() });
  return eventId;
}

export async function deleteEvent(eventId) {
  await deleteDoc(doc(db, COL, eventId));
}

const isUpcoming = (e) => {
  const ends = e?.endsAt?.toMillis ? e.endsAt.toMillis() : 0;
  return e?.isActive !== false && ends >= Date.now();
};

/** Upcoming (not-ended, active) events for one business, soonest first. */
export async function listUpcomingForBusiness(businessId, max = 50) {
  const id = String(businessId || '').trim();
  if (!id) return [];
  const q = query(
    collection(db, COL),
    where('businessId', '==', id),
    where('isActive', '==', true),
    where('endsAt', '>=', Timestamp.now()),
    orderBy('endsAt', 'asc'),
    qLimit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Live subscription to a business's upcoming events (owner view includes all active). */
export function subscribeBusinessEvents(businessId, cb, { includeEnded = false } = {}) {
  const id = String(businessId || '').trim();
  if (!id) { cb([]); return () => {}; }
  const q = query(
    collection(db, COL),
    where('businessId', '==', id),
    orderBy('endsAt', 'asc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      cb(includeEnded ? rows : rows.filter(isUpcoming));
    },
    () => cb([]),
  );
}

/** Upcoming events in a city/country, soonest first (city optional). */
export async function listUpcomingInArea({ countryCode, city } = {}, max = 50) {
  const cc = String(countryCode || '').trim().toUpperCase().slice(0, 2);
  if (!cc) return [];
  const clauses = [
    where('countryCode', '==', cc),
    ...(city ? [where('city', '==', String(city).trim())] : []),
    where('isActive', '==', true),
    where('endsAt', '>=', Timestamp.now()),
    orderBy('endsAt', 'asc'),
    qLimit(max),
  ];
  const snap = await getDocs(query(collection(db, COL), ...clauses));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
