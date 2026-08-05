/**
 * POST /api/generate-image — disabled (no cloud AI). Returns 503 until a new provider is wired.
 */
export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end(JSON.stringify({ ok: false, code: 'method_not_allowed', message: 'POST only.' }));
        return;
    }
    res.statusCode = 503;
    res.end(
        JSON.stringify({
            ok: false,
            code: 'ai_disabled',
            message: 'AI image and headline generation is turned off.',
        })
    );
}
