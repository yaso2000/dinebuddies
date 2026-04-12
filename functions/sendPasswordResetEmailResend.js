/**
 * Sends Firebase Auth password-reset link via Resend (HTML template).
 * Same oobCode / confirmPasswordReset flow as Firebase emails.
 *
 * Env: RESEND_API_KEY, optional PUBLIC_APP_ORIGIN
 */

const crypto = require('crypto');
const { Resend } = require('resend');

const DEFAULT_ORIGIN = 'https://dinebuddies.com';
const FROM = 'DineBuddies <noreply@dinebuddies.com>';
const MIN_RESEND_INTERVAL_MS = 60 * 1000;

function htmlEscape(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function emailRateKey(email) {
    return crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex');
}

function buildPasswordResetEmailHtml(resetLink, displayName) {
    const name = displayName ? htmlEscape(displayName) : 'there';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f172a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
          <tr>
            <td style="padding:28px 28px 8px;text-align:center;">
              <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.02em;">DineBuddies</div>
              <p style="margin:16px 0 0;font-size:15px;line-height:1.5;color:#94a3b8;">Hi ${name},</p>
              <p style="margin:12px 0 0;font-size:15px;line-height:1.5;color:#cbd5e1;">We received a request to reset your password. Use the button below to choose a new one.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;text-align:center;">
              <a href="${resetLink}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:10px;">Reset password</a>
              <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#64748b;">If the button doesn’t work, paste this link into your browser:</p>
              <p style="margin:8px 0 0;font-size:11px;word-break:break-all;color:#94a3b8;">${htmlEscape(resetLink)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px;text-align:center;border-top:1px solid #334155;">
              <p style="margin:16px 0 0;font-size:11px;color:#64748b;">If you didn’t ask to reset your password, you can ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function registerSendPasswordResetEmailResend({ exports, functions, db, admin }) {
    exports.sendPasswordResetEmailResend = functions.runWith({ timeoutSeconds: 60, memory: '256MB' }).https.onCall(async (data) => {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey || typeof apiKey !== 'string') {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'RESEND_API_KEY is not configured on the Functions runtime.'
            );
        }

        const raw = typeof data?.email === 'string' ? data.email.trim() : '';
        const email = raw.toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new functions.https.HttpsError('invalid-argument', 'A valid email is required.');
        }

        const origin = (process.env.PUBLIC_APP_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, '');
        // Match Firebase Hosting default handler path so redirect lands in the SPA (see App.jsx /__/auth/action)
        const continueUrl = `${origin}/__/auth/action`;

        const rateRef = db.collection('password_reset_email_rate').doc(emailRateKey(email));
        const rateSnap = await rateRef.get();
        const lastSent = rateSnap.exists ? rateSnap.data()?.lastSentAt : null;
        if (lastSent?.toMillis && Date.now() - lastSent.toMillis() < MIN_RESEND_INTERVAL_MS) {
            return { ok: true };
        }

        let userRecord;
        try {
            userRecord = await admin.auth().getUserByEmail(email);
        } catch (e) {
            if (e.code === 'auth/user-not-found') {
                return { ok: true };
            }
            console.error('getUserByEmail password reset', e);
            throw new functions.https.HttpsError('internal', 'Could not process request.');
        }

        if (!userRecord.email) {
            return { ok: true };
        }

        const actionCodeSettings = {
            url: continueUrl,
            handleCodeInApp: false,
        };

        let resetLink;
        try {
            resetLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
        } catch (e) {
            console.error('generatePasswordResetLink', e);
            throw new functions.https.HttpsError('internal', 'Could not create reset link.');
        }

        const userDoc = await db.collection('users').doc(userRecord.uid).get();
        const displayName =
            userDoc.exists &&
            (userDoc.data()?.display_name || userDoc.data()?.displayName || userDoc.data()?.businessInfo?.businessName);

        const resend = new Resend(apiKey);
        const { error } = await resend.emails.send({
            from: FROM,
            to: [email],
            subject: 'Reset your DineBuddies password',
            html: buildPasswordResetEmailHtml(resetLink, displayName),
        });

        if (error) {
            console.error('Resend password reset email', error);
            throw new functions.https.HttpsError('internal', error.message || 'Failed to send email.');
        }

        await rateRef.set({ lastSentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

        return { ok: true };
    });
}

module.exports = { registerSendPasswordResetEmailResend };
