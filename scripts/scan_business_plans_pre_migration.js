/**
 * Read-only Firestore scan: business accounts before migration.
 * Business users identified by role === 'business'. No writes. No migration.
 * Run: node scripts/scan_business_plans_pre_migration.js
 *
 * Credentials: set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path,
 * or place service-account-key.json (or serviceAccountKey.json) in project root.
 */
import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function initAdmin() {
  if (admin.apps.length > 0) return;

  const cwd = process.cwd();
  const keyPaths = [
    path.join(cwd, 'service-account-key.json'),
    path.join(cwd, 'serviceAccountKey.json'),
    path.join(__dirname, '..', 'service-account-key.json'),
    path.join(__dirname, '..', 'serviceAccountKey.json')
  ];

  for (const keyPath of keyPaths) {
    try {
      const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      admin.initializeApp({ credential: admin.credential.cert(key) });
      return;
    } catch (_) {}
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp();
    return;
  }

  throw new Error(
    'Firebase Admin: set GOOGLE_APPLICATION_CREDENTIALS or add service-account-key.json in project root'
  );
}

initAdmin();

const db = admin.firestore();

function isValidTier(value) {
  if (value == null || typeof value !== 'string') return false;
  const t = value.trim();
  return t === 'free' || t === 'professional' || t === 'elite';
}

function hasLegacyFields(data) {
  const info = data.businessInfo || {};
  return (
    info.subscriptionTier !== undefined ||
    info.tier !== undefined ||
    info.subscriptionPlan !== undefined
  );
}

function wouldBeModified(data) {
  if (data.role !== 'business') return false;
  return !isValidTier(data.subscriptionTier) || hasLegacyFields(data);
}

function sanitize(docId, data) {
  const info = data.businessInfo || {};
  return {
    uid: docId,
    subscriptionTier: data.subscriptionTier ?? '(missing)',
    accountType: data.accountType,
    role: data.role,
    display_name: data.display_name ? '[REDACTED]' : null,
    businessInfo: {
      businessName: info.businessName ? '[REDACTED]' : null,
      subscriptionTier:
        info.subscriptionTier !== undefined ? '(present)' : undefined,
      tier: info.tier !== undefined ? '(present)' : undefined,
      subscriptionPlan:
        info.subscriptionPlan !== undefined ? '(present)' : undefined
    }
  };
}

async function scan() {
  try {
    console.log('');
    console.log('Firestore scan: business accounts (role === "business")');
    console.log('');

    const snap = await db.collection('users').get();

    const business = [];
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.role === 'business') {
        business.push({ id: docSnap.id, ...data });
      }
    });

    const total = business.length;
    console.log('Total business documents (role === "business"): ' + total);
    console.log('');

    const byTier = {};
    business.forEach(({ subscriptionTier }) => {
      const t =
        subscriptionTier != null && subscriptionTier !== ''
          ? String(subscriptionTier).trim()
          : '(missing)';
      byTier[t] = (byTier[t] || 0) + 1;
    });

    console.log('--- 1. Count by subscriptionTier ---');
    Object.entries(byTier)
      .sort((a, b) =>
        a[0] === '(missing)' ? 1 : String(a[0]).localeCompare(b[0])
      )
      .forEach(([tier, count]) => console.log('  ' + tier + ': ' + count));
    console.log('');

    const invalidTier = business.filter((d) => !isValidTier(d.subscriptionTier));
    console.log('--- 2. Documents where subscriptionTier is NOT free | professional | elite ---');
    console.log('  Count: ' + invalidTier.length);

    if (invalidTier.length > 0) {
      const byVal = {};
      invalidTier.forEach(({ subscriptionTier }) => {
        const v =
          subscriptionTier != null && subscriptionTier !== ''
            ? String(subscriptionTier).trim()
            : '(missing)';
        byVal[v] = (byVal[v] || 0) + 1;
      });

      console.log('  By value: ' + JSON.stringify(byVal));
      const uids = invalidTier.slice(0, 50).map((d) => d.id);
      console.log(
        '  UIDs: ' +
          uids.join(', ') +
          (invalidTier.length > 50
            ? ' (...+' + (invalidTier.length - 50) + ' more)'
            : '')
      );
    } else {
      console.log('  (none)');
    }

    console.log('');

    const withLegacy = business.filter(hasLegacyFields);
    const withSubTier = business.filter(
      (d) => (d.businessInfo || {}).subscriptionTier !== undefined
    );
    const withTier = business.filter(
      (d) => (d.businessInfo || {}).tier !== undefined
    );
    const withSubPlan = business.filter(
      (d) => (d.businessInfo || {}).subscriptionPlan !== undefined
    );

    console.log('--- 3. Documents containing legacy fields ---');
    console.log(
      '  Any of (businessInfo.subscriptionTier | .tier | .subscriptionPlan): ' +
        withLegacy.length
    );
    console.log('  businessInfo.subscriptionTier: ' + withSubTier.length);
    console.log('  businessInfo.tier: ' + withTier.length);
    console.log('  businessInfo.subscriptionPlan: ' + withSubPlan.length);
    console.log('');

    const toModify = business.filter(wouldBeModified);
    const samples = toModify.slice(0, 5).map((d) => sanitize(d.id, d));

    console.log('--- 4. Sample documents (sanitized) that would be modified ---');
    console.log('  Total that would be modified: ' + toModify.length);
    console.log('');

    samples.forEach((s, i) => {
      console.log('  Sample ' + (i + 1) + ':');
      console.log(
        JSON.stringify(s, null, 2)
          .split('\n')
          .map((l) => '    ' + l)
          .join('\n')
      );
      console.log('');
    });

    const ready = invalidTier.length === 0 && withLegacy.length === 0;

    console.log('--- 5. Readiness for strict migration ---');
    if (ready) {
      console.log(
        '  All business documents have subscriptionTier in { free, professional, elite }'
      );
      console.log(
        '  and none contain legacy fields. Dataset is READY for strict migration.'
      );
    } else {
      console.log(
        '  Issues: ' +
          invalidTier.length +
          ' doc(s) with invalid subscriptionTier, ' +
          withLegacy.length +
          ' doc(s) with legacy fields.'
      );
      console.log(
        '  Dataset is NOT ready for strict migration without review.'
      );
    }

    console.log('');
    console.log('Scan complete. No data was modified.');
    console.log('');
    process.exit(0);
  } catch (err) {
    console.error('Scan failed: ' + err.message);
    process.exit(1);
  }
}

scan();