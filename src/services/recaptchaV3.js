const SCRIPT_ID = 'dineb-recaptcha-v3';
let loadPromise = null;

function getSiteKey() {
    return String(import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').trim();
}

export function isRecaptchaConfigured() {
    return !!getSiteKey();
}

function loadRecaptchaScript() {
    const siteKey = getSiteKey();
    if (!siteKey) {
        return Promise.reject(new Error('RECAPTCHA_NOT_CONFIGURED'));
    }
    if (typeof window !== 'undefined' && window.grecaptcha?.execute) {
        return Promise.resolve(window.grecaptcha);
    }
    if (loadPromise) return loadPromise;

    loadPromise = new Promise((resolve, reject) => {
        const existing = document.getElementById(SCRIPT_ID);
        if (existing) {
            existing.addEventListener('load', () => resolve(window.grecaptcha));
            existing.addEventListener('error', () => reject(new Error('recaptcha_script_failed')));
            return;
        }
        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            window.grecaptcha.ready(() => resolve(window.grecaptcha));
        };
        script.onerror = () => reject(new Error('recaptcha_script_failed'));
        document.head.appendChild(script);
    });
    return loadPromise;
}

/**
 * @param {string} action - reCAPTCHA v3 action name
 * @returns {Promise<string>}
 */
export async function executeRecaptchaV3(action) {
    const siteKey = getSiteKey();
    if (!siteKey) return '';
    const grecaptcha = await loadRecaptchaScript();
    return grecaptcha.execute(siteKey, { action });
}
