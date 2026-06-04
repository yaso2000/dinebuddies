/**
 * Test Twilio Verify credentials and optional OTP send (no twilio npm package).
 *
 * Usage:
 *   node scripts/test-twilio-verify.mjs
 *   node scripts/test-twilio-verify.mjs +61476759654
 *
 * Loads TWILIO_* from .env in project root (same vars as Vercel).
 */
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(root, '.env') });

const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
const verifyServiceSid = String(process.env.TWILIO_VERIFY_SERVICE_SID || '').trim();
const phone = String(process.argv[2] || '').trim();

function mask(value, visible = 4) {
    const s = String(value || '');
    if (!s) return '(empty)';
    if (s.length <= visible * 2) return '*'.repeat(Math.min(s.length, 8));
    return `${s.slice(0, visible)}…${s.slice(-visible)}`;
}

function authHeader() {
    const basic = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    return { Authorization: `Basic ${basic}` };
}

async function twilioFetch(path, { method = 'GET', form } = {}) {
    const url = `https://verify.twilio.com/v2${path}`;
    const headers = { ...authHeader(), Accept: 'application/json' };
    let body;
    if (form) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        body = new URLSearchParams(form).toString();
    }
    const res = await fetch(url, { method, headers, body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.message || res.statusText);
        err.code = data.code;
        err.status = res.status;
        err.moreInfo = data.more_info;
        throw err;
    }
    return data;
}

console.log('--- Twilio Verify env check ---');
console.log('TWILIO_ACCOUNT_SID         ', accountSid ? mask(accountSid) : 'MISSING');
console.log('TWILIO_AUTH_TOKEN          ', authToken ? 'set' : 'MISSING');
console.log('TWILIO_VERIFY_SERVICE_SID  ', verifyServiceSid ? mask(verifyServiceSid) : 'MISSING');
console.log('');

if (!accountSid || !authToken || !verifyServiceSid) {
    console.error('Fix: add all three to .env (copy from Vercel) then re-run.');
    process.exit(1);
}

try {
    const service = await twilioFetch(`/Services/${encodeURIComponent(verifyServiceSid)}`);
    console.log('Service OK:', service.friendly_name || service.sid);
} catch (err) {
    console.error('Cannot fetch Verify service (wrong SID or bad credentials):');
    console.error('  code:', err.code);
    console.error('  message:', err.message);
    process.exit(1);
}

if (!phone) {
    console.log('');
    console.log('Env + service look good. To send a test SMS:');
    console.log('  node scripts/test-twilio-verify.mjs +614XXXXXXXXX');
    console.log('');
    console.log('Trial: number must be in Verified Caller IDs first.');
    process.exit(0);
}

if (!/^\+\d{8,15}$/.test(phone)) {
    console.error('Phone must be E.164, e.g. +61476759654');
    process.exit(1);
}

console.log('Sending test verification to', phone, '...');

try {
    const verification = await twilioFetch(
        `/Services/${encodeURIComponent(verifyServiceSid)}/Verifications`,
        { method: 'POST', form: { To: phone, Channel: 'sms' } }
    );
    console.log('Twilio accepted request:');
    console.log('  sid:', verification.sid);
    console.log('  status:', verification.status);
    console.log('  to:', verification.to);
    console.log('');
    console.log('If no SMS: Twilio Console → Monitor → Logs → Verify.');
    console.log('Trial: Phone Numbers → Verified caller IDs must include this number.');
} catch (err) {
    console.error('Twilio rejected send:');
    console.error('  code:', err.code);
    console.error('  message:', err.message);
    console.error('  status:', err.status);
    if (err.moreInfo) console.error('  more:', err.moreInfo);
    if (err.code === 60200) {
        console.error('Hint: Invalid parameter — use E.164 e.g. +61476759654');
    }
    process.exit(1);
}
