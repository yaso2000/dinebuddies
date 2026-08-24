import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
dotenv.config();
initializeApp({ credential: cert({ projectId: 'dinebuddies', clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: String(process.env.FIREBASE_PRIVATE_KEY||'').replace(/\n/g,'\n') })});
const db = getFirestore();
const pp = await db.collection('public_profiles').where('profileType','==','business').limit(12).get();
console.log('sampling', pp.size, 'businesses:');
for (const d of pp.docs) {
  const p = d.data();
  const bp = p.businessPublic || {};
  // is there a users/ doc and a restaurants/ doc for this id?
  const [u, r] = await Promise.all([
    db.collection('users').doc(d.id).get(),
    db.collection('restaurants').doc(d.id).get(),
  ]);
  const ud = u.exists ? u.data() : null;
  console.log(JSON.stringify({
    id: d.id.slice(0,10),
    name: (p.displayName||'').slice(0,18),
    inUsers: u.exists,
    inRestaurants: r.exists,
    role: ud?.role || r.data()?.role || '(none)',
    accountType: ud?.accountType || '(none)',
    isBusinessFlag: ud?.isBusiness ?? '(none)',
    ownerId: (ud?.ownerId || r.data()?.ownerId || '').slice(0,10) || '(none)',
    isVirtual: (ud?.isVirtual ?? r.data()?.isVirtual) ?? '(none)',
    createdBy: ud?.createdBy || r.data()?.createdBy || '(none)',
    liveStageId: bp.liveStageId ?? '(absent)',
  }));
}
process.exit(0);
