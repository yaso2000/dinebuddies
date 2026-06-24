import { loadEnv } from 'vite';

let envApplied = false;

/** Merge `.env` into process.env once for local /api handlers (Firebase Admin, etc.). */
export function applyDevEnv() {
    if (envApplied) return;
    const env = loadEnv(process.env.MODE || 'development', process.cwd(), '');
    for (const [key, value] of Object.entries(env)) {
        if (value !== undefined && value !== '' && !process.env[key]) {
            process.env[key] = value;
        }
    }
    envApplied = true;
}

export function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        if (req.__devJsonBody !== undefined) {
            resolve(req.__devJsonBody);
            return;
        }
        let raw = '';
        req.on('data', (chunk) => {
            raw += chunk;
        });
        req.on('end', () => {
            try {
                const parsed = raw ? JSON.parse(raw) : {};
                req.__devJsonBody = parsed;
                resolve(parsed);
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', reject);
    });
}

export function createVercelResponse(nodeRes) {
    const res = {
        setHeader(name, value) {
            nodeRes.setHeader(name, value);
            return res;
        },
        status(code) {
            nodeRes.statusCode = code;
            return {
                json(body) {
                    if (!nodeRes.headersSent) {
                        nodeRes.setHeader('Content-Type', 'application/json');
                        nodeRes.end(JSON.stringify(body));
                    }
                },
                end(data) {
                    if (!nodeRes.headersSent) {
                        nodeRes.end(data);
                    }
                },
            };
        },
    };
    return res;
}

export async function runDevApiHandler(handlerModule, req, nodeRes) {
    applyDevEnv();
    const body = await readJsonBody(req);
    const vercelReq = {
        method: req.method,
        headers: req.headers,
        body,
        socket: req.socket,
    };
    await handlerModule.default(vercelReq, createVercelResponse(nodeRes));
}
