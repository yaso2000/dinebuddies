export function getTwilioVerifyConfig() {
    const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
    const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
    const verifyServiceSid = String(process.env.TWILIO_VERIFY_SERVICE_SID || '').trim();
    return { accountSid, authToken, verifyServiceSid };
}

function assertTwilioConfigured() {
    const { accountSid, authToken, verifyServiceSid } = getTwilioVerifyConfig();
    if (!accountSid || !authToken || !verifyServiceSid) {
        throw new Error('TWILIO_NOT_CONFIGURED');
    }
    return { accountSid, authToken, verifyServiceSid };
}

function twilioAuthHeader(accountSid, authToken) {
    const basic = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    return { Authorization: `Basic ${basic}`, Accept: 'application/json' };
}

/**
 * @param {string} path e.g. /Services/VA.../Verifications
 * @param {{ method?: string, form?: Record<string, string> }} [opts]
 */
async function twilioVerifyFetch(path, { method = 'GET', form } = {}) {
    const { accountSid, authToken } = assertTwilioConfigured();
    const url = `https://verify.twilio.com/v2${path}`;
    const headers = twilioAuthHeader(accountSid, authToken);
    let body;
    if (form) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        body = new URLSearchParams(form).toString();
    }
    const res = await fetch(url, { method, headers, body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.message || res.statusText || 'Twilio Verify error');
        err.code = data.code;
        err.status = res.status;
        err.moreInfo = data.more_info;
        throw err;
    }
    return data;
}

/** @param {string} phone E.164 */
export async function sendTwilioOTP(phone) {
    const { verifyServiceSid } = assertTwilioConfigured();
    return twilioVerifyFetch(
        `/Services/${encodeURIComponent(verifyServiceSid)}/Verifications`,
        { method: 'POST', form: { To: phone, Channel: 'sms' } }
    );
}

/** @param {string} phone E.164 @param {string} code */
export async function checkTwilioOTP(phone, code) {
    const { verifyServiceSid } = assertTwilioConfigured();
    return twilioVerifyFetch(
        `/Services/${encodeURIComponent(verifyServiceSid)}/VerificationCheck`,
        {
            method: 'POST',
            form: { To: phone, Code: String(code).trim() },
        }
    );
}

/** Smoke test: env + Verify service reachable (no SMS). */
export async function pingTwilioVerifyService() {
    const { verifyServiceSid } = assertTwilioConfigured();
    const service = await twilioVerifyFetch(`/Services/${encodeURIComponent(verifyServiceSid)}`);
    return {
        ok: true,
        friendlyName: service.friendly_name || service.sid,
    };
}
