export default async function handler(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        // Use native fetch (Node 18+) which handles redirects automatically
        const response = await fetch(url);

        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch image: ${response.statusText}` });
        }

        // Forward Content-Type
        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);

        // Allow CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        // Return image data
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.status(200).send(buffer);

    } catch (error) {
        console.error('Proxy Error:', error);
        // Fallback for older Node versions if fetch is missing (unlikely on Vercel)
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
