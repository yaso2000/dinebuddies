/** Allow OTP API calls from local Vite dev (cross-origin to production). */
export function applyApiCors(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function handleCorsPreflight(req, res) {
    applyApiCors(req, res);
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return true;
    }
    return false;
}
