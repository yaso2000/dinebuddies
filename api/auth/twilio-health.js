/**
 * GET /api/auth/twilio-health
 * Checks TWILIO_* env and Verify service reachability (does not send SMS).
 */
import { getTwilioVerifyConfig, pingTwilioVerifyService } from '../_twilioVerify.js';
import { applyApiCors, handleCorsPreflight } from '../_cors.js';

export default async function handler(req, res) {
    applyApiCors(req, res);
    if (handleCorsPreflight(req, res)) return;

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { accountSid, authToken, verifyServiceSid } = getTwilioVerifyConfig();
    const configured = !!(accountSid && authToken && verifyServiceSid);

    if (!configured) {
        return res.status(503).json({
            ok: false,
            configured: false,
            missing: [
                !accountSid && 'TWILIO_ACCOUNT_SID',
                !authToken && 'TWILIO_AUTH_TOKEN',
                !verifyServiceSid && 'TWILIO_VERIFY_SERVICE_SID',
            ].filter(Boolean),
        });
    }

    try {
        const ping = await pingTwilioVerifyService();
        return res.status(200).json({
            ok: true,
            configured: true,
            verifyService: ping.friendlyName,
        });
    } catch (err) {
        console.error('[twilio-health]', err);
        return res.status(502).json({
            ok: false,
            configured: true,
            verifyReachable: false,
            twilioCode: err?.code || null,
            message: err?.message || 'Verify service unreachable',
        });
    }
}
