/**
 * Sends Firebase Auth email verification link via Resend.
 *
 * 1) If RESEND_VERIFICATION_TEMPLATE_ID is set → send using your published Resend template
 *    (variables USER_NAME, VERIFY_LINK must match the template).
 * 2) Otherwise, or if the template request fails → inline HTML fallback (same deliverability path).
 *
 * Env: RESEND_API_KEY (required), RESEND_VERIFICATION_TEMPLATE_ID (optional; default alias
 *      `account-verification`), PUBLIC_APP_ORIGIN (optional)
 */

const { Resend } = require('resend');

const DEFAULT_ORIGIN = 'https://dinebuddies.com';
const FROM = 'DineBuddies <noreply@dinebuddies.com>';
const MIN_RESEND_INTERVAL_MS = 60 * 1000;

const FLOW_PATHS = {
    /** After verify, land on business login (unified shell); in-app signup goes straight to listing setup. */
    business_signup: '/business/login?fromVerify=1',
    business_login: '/business/login',
    settings_email: '/settings/email',
    pro_settings: '/settings',
    /** Affiliate email/password signup — web dashboard after verify. */
    affiliate_signup: '/affiliate/dashboard?fromVerify=1',
    home: '/',
};

function htmlEscape(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Inline fallback — matches Resend template `account-verification` (USER_NAME, VERIFY_LINK). */
function buildFallbackVerificationHtml(verifyLink, displayName) {
    const name = displayName ? htmlEscape(displayName) : 'there';
    const linkEsc = htmlEscape(verifyLink);
    const logoUrl =
        'https://firebasestorage.googleapis.com/v0/b/dinebuddies.firebasestorage.app/o/db-logo.png?alt=media&token=30cc47d8-0989-4aa9-bae4-3e4f642b4a32';
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify your DineBuddies account</title>
  </head>
  <body style="margin:0; padding:0; background-color:#eef2f7;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
      Verify your email and activate your DineBuddies account.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef2f7; margin:0; padding:0;">
      <tr>
        <td align="center" style="padding:32px 16px;">

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px; margin:0 auto;">

            <tr>
              <td align="center" style="padding-bottom:18px;">
                <img
                  src="${logoUrl}"
                  alt="DineBuddies"
                  width="72"
                  style="display:block; margin:0 auto 12px auto; border:0;"
                />
                <div style="font-family:Arial,Helvetica,sans-serif; font-size:28px; line-height:32px; font-weight:800; color:#13233c;">
                  DineBuddies
                </div>
              </td>
            </tr>

            <tr>
              <td style="background:#09162f; border-radius:24px; overflow:hidden; box-shadow:0 12px 35px rgba(9,22,47,0.18);">

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding:30px 30px 20px 30px; background:linear-gradient(180deg, rgba(255,145,0,0.18) 0%, rgba(255,145,0,0.00) 100%);">
                      <div style="font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:18px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#ff9d1a;">
                        Account Security
                      </div>
                      <div style="padding-top:10px; font-family:Arial,Helvetica,sans-serif; font-size:34px; line-height:40px; font-weight:800; color:#ffffff;">
                        Verify your account
                      </div>
                      <div style="padding-top:12px; font-family:Arial,Helvetica,sans-serif; font-size:16px; line-height:26px; color:#c7d3e4;">
                        Hi ${name}, welcome to DineBuddies. Please verify your email address to activate your account and continue safely.
                      </div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding:0 30px 30px 30px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111f3d; border:1px solid rgba(255,255,255,0.07); border-radius:20px;">
                        <tr>
                          <td style="padding:28px;">

                            <div style="font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:25px; color:#d6e0ee; padding-bottom:24px;">
                              Click the button below to confirm your email address.
                            </div>

                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 24px auto;">
                              <tr>
                                <td align="center" bgcolor="#ff7a00" style="border-radius:14px; background:linear-gradient(90deg,#ff9f00 0%, #ff6a00 100%);">
                                  <a
                                    href="${linkEsc}"
                                    style="display:inline-block; padding:16px 32px; font-family:Arial,Helvetica,sans-serif; font-size:18px; line-height:22px; font-weight:800; color:#ffffff; text-decoration:none; border-radius:14px;"
                                  >
                                    Verify Account
                                  </a>
                                </td>
                              </tr>
                            </table>

                            <div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:23px; color:#b9c7dc; padding-bottom:12px;">
                              If the button does not work, copy and paste this link into your browser:
                            </div>

                            <div style="font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:22px; color:#8eb6ff; word-break:break-all; background:#0a1428; border-radius:12px; padding:14px 16px;">
                              ${linkEsc}
                            </div>

                            <div style="height:1px; line-height:1px; font-size:1px; background:rgba(255,255,255,0.08); margin:24px 0;">&nbsp;</div>

                            <div style="font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:24px; font-weight:700; color:#ffffff; padding-bottom:8px;">
                              Why verify?
                            </div>

                            <div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:24px; color:#c7d3e4;">
                              &bull; Confirm ownership of your email address.<br />
                              &bull; Protect your account and keep it secure.<br />
                              &bull; Access DineBuddies features without interruption.
                            </div>

                            <div style="padding-top:24px; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:22px; color:#93a7c5;">
                              If you did not create this account, you can safely ignore this email.
                            </div>

                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>

            <tr>
              <td align="center" style="padding:18px 10px 0 10px; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:20px; color:#7d8898;">
                &copy; DineBuddies. All rights reserved.
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function registerSendVerificationEmailResend({ exports, functions, db, admin }) {
    exports.sendEmailVerificationResend = functions
        .runWith({ timeoutSeconds: 60, memory: '256MB' })
        .https.onCall(async (data, context) => {
            if (!context.auth?.uid) {
                throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
            }

            const uid = context.auth.uid;
            const apiKey = process.env.RESEND_API_KEY;
            if (!apiKey || typeof apiKey !== 'string') {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'RESEND_API_KEY is not configured on the Functions runtime.'
                );
            }

            const flow = typeof data?.flow === 'string' && FLOW_PATHS[data.flow] ? data.flow : 'home';
            const origin = (process.env.PUBLIC_APP_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, '');
            const continueUrl = `${origin}${FLOW_PATHS[flow]}`;

            const userRecord = await admin.auth().getUser(uid);
            const email = userRecord.email;
            if (!email) {
                throw new functions.https.HttpsError('failed-precondition', 'No email address on this account.');
            }
            if (userRecord.emailVerified) {
                return { ok: true, alreadyVerified: true };
            }

            const userDoc = await db.collection('users').doc(uid).get();
            const lastSent = userDoc.exists ? userDoc.data()?.lastVerificationEmailSentAt : null;
            if (lastSent?.toMillis && Date.now() - lastSent.toMillis() < MIN_RESEND_INTERVAL_MS) {
                throw new functions.https.HttpsError(
                    'resource-exhausted',
                    'Please wait a minute before requesting another verification email.'
                );
            }

            const actionCodeSettings = {
                url: continueUrl,
                handleCodeInApp: false,
            };

            let verifyLink;
            try {
                verifyLink = await admin.auth().generateEmailVerificationLink(email, actionCodeSettings);
            } catch (e) {
                console.error('generateEmailVerificationLink', e);
                throw new functions.https.HttpsError('internal', 'Could not create verification link.');
            }

            const displayName =
                userDoc.exists &&
                (userDoc.data()?.display_name ||
                    userDoc.data()?.displayName ||
                    userDoc.data()?.businessInfo?.businessName);
            const userName = displayName ? String(displayName).trim() || 'there' : 'there';

            const resend = new Resend(apiKey);
            const subject = 'Verify your DineBuddies account';
            const templateId = (
                process.env.RESEND_VERIFICATION_TEMPLATE_ID || 'account-verification'
            ).trim();

            let error = null;

            if (templateId) {
                const templateResult = await resend.emails.send({
                    from: FROM,
                    to: [email],
                    subject,
                    template: {
                        id: templateId,
                        variables: {
                            USER_NAME: userName,
                            VERIFY_LINK: verifyLink,
                        },
                    },
                });
                error = templateResult.error;
                if (error) {
                    console.error('Resend verification (template) failed; retrying with HTML fallback', JSON.stringify(error));
                }
            }

            if (!templateId || error) {
                const html = buildFallbackVerificationHtml(verifyLink, displayName);
                const htmlResult = await resend.emails.send({
                    from: FROM,
                    to: [email],
                    subject,
                    html,
                });
                error = htmlResult.error;
            }

            if (error) {
                console.error('Resend verification email', error);
                const msg =
                    (typeof error === 'object' && error && error.message) ||
                    (typeof error === 'string' ? error : null) ||
                    'Failed to send email.';
                throw new functions.https.HttpsError('internal', msg);
            }

            await db.collection('users').doc(uid).set(
                {
                    lastVerificationEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
            );

            return { ok: true, sent: true };
        });
}

module.exports = { registerSendVerificationEmailResend };
