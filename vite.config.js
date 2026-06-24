import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fetchPlaceAutocompleteWithFallback } from './api/_googlePlacesAutocompleteCore.js'
import { runDevApiHandler } from './scripts/dev-api-local.mjs'
import fs from 'fs'
import path from 'path'
import dns from 'dns'
import { exec } from 'child_process'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const __viteConfigDir = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { fetchPlacePhotoBufferDetailed } = require(path.join(__viteConfigDir, 'functions', 'placePhotoFetch.js'))

const dnsLookup = dns.promises.lookup.bind(dns.promises)

// SSRF protection: blocked hostnames (lowercase)
const BLOCKED_HOSTNAMES = new Set([
    'localhost', 'localhost.localdomain', 'localhost4', 'localhost6',
    'ip6-localhost', 'ip6-loopback', 'ipv6-localhost', 'ipv6-loopback',
    'metadata', 'metadata.google.internal', 'metadata.google.com',
    '169.254.169.254', '::1', '0.0.0.0'
])

function isBlockedHostname(hostname) {
    if (!hostname || typeof hostname !== 'string') return true
    const h = hostname.toLowerCase().trim()
    if (BLOCKED_HOSTNAMES.has(h)) return true
    if (h.endsWith('.local') || h.endsWith('.internal')) return true
    return false
}

function isBlockedIPv4(ip) {
    const parts = ip.split('.').map(Number)
    if (parts.length !== 4 || parts.some(isNaN)) return true
    const [a, b, c] = parts
    if (a === 127) return true                          // 127.0.0.0/8 loopback
    if (a === 10) return true                           // 10.0.0.0/8 private
    if (a === 172 && b >= 16 && b <= 31) return true    // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true             // 192.168.0.0/16 private
    if (a === 169 && b === 254) return true             // 169.254.0.0/16 link-local
    if (a === 0) return true                            // 0.0.0.0/8
    if (a >= 224) return true                           // 224.0.0.0/4 multicast + reserved
    return false
}

function isBlockedIPv6(ip) {
    const norm = ip.toLowerCase()
    if (norm === '::1') return true
    if (norm.startsWith('fe80:') || norm.startsWith('fe8') || norm.startsWith('fe9') || norm.startsWith('fea') || norm.startsWith('feb')) return true  // fe80::/10 link-local
    if (norm.startsWith('fc') || norm.startsWith('fd')) return true  // fc00::/7 private
    if (norm.startsWith('ff')) return true              // ff00::/8 multicast
    if (norm.startsWith('::ffff:') && norm.length > 7) {
        const v4 = norm.slice(7)
        if (v4.includes('.')) return isBlockedIPv4(v4)   // IPv4-mapped
    }
    return false
}

function isBlockedIP(ip) {
    if (!ip || typeof ip !== 'string') return true
    const trimmed = ip.trim()
    if (trimmed.includes(':')) return isBlockedIPv6(trimmed)
    return isBlockedIPv4(trimmed)
}

async function validateProxyUrl(targetUrl) {
    let parsed
    try {
        parsed = new URL(targetUrl)
    } catch {
        return { ok: false, error: 'Invalid URL' }
    }
    const proto = parsed.protocol
    if (proto !== 'http:' && proto !== 'https:') {
        return { ok: false, error: 'URL scheme not allowed' }
    }
    const hostname = parsed.hostname
    if (!hostname) return { ok: false, error: 'Invalid hostname' }
    if (isBlockedHostname(hostname)) {
        return { ok: false, error: 'URL hostname not allowed' }
    }
    try {
        const { address } = await dnsLookup(hostname, { family: 0 })
        if (isBlockedIP(address)) {
            return { ok: false, error: 'URL resolves to blocked address' }
        }
        return { ok: true }
    } catch (err) {
        return { ok: false, error: 'Could not resolve hostname' }
    }
}

// Custom middleware to handle development operations
const devOperations = () => ({
    name: 'dev-operations',
    configureServer(server) {
        function parseAddressComponents(components) {
            let city = ''
            let country = ''
            let countryCode = ''
            if (Array.isArray(components)) {
                for (const c of components) {
                    if (c.types?.includes('locality')) city = c.long_name || ''
                    if (c.types?.includes('administrative_area_level_1') && !city) city = c.long_name || ''
                    if (c.types?.includes('country')) {
                        country = c.long_name || ''
                        countryCode = (c.short_name || '').toUpperCase().slice(0, 2)
                    }
                }
            }
            return { city, country, countryCode }
        }

        server.middlewares.use(async (req, res, next) => {
            let devUrl = null
            try {
                devUrl = new URL(req.url, `http://${req.headers.host}`)
            } catch {
                devUrl = null
            }

            if (devUrl?.pathname === '/api/business-login-resolver' && req.method === 'POST') {
                try {
                    const handler = await import('./api/auth/login-resolver.js')
                    await runDevApiHandler(handler, req, res)
                } catch (err) {
                    console.error('Dev business-login-resolver error:', err)
                    res.statusCode = 500
                    res.setHeader('Content-Type', 'application/json')
                    const hint =
                        err instanceof Error &&
                        /Firebase Admin credentials/i.test(err.message)
                            ? 'Firebase Admin غير مُعد محلياً — أضف FIREBASE_SERVICE_ACCOUNT_JSON في .env'
                            : 'حدث خطأ في خادم حل الهوية.'
                    res.end(JSON.stringify({ message: hint }))
                }
                return
            }

            if (req.method === 'GET') {
                let url
                try {
                    url = new URL(req.url, `http://${req.headers.host}`)
                } catch {
                    url = null
                }
                const env = loadEnv(process.env.MODE || 'development', process.cwd(), '')
                const key = process.env.GOOGLE_MAPS_SERVER_KEY || env.GOOGLE_MAPS_SERVER_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || env.VITE_GOOGLE_MAPS_API_KEY || env.GOOGLE_MAPS_API_KEY
                const referer = `http://${req.headers.host || 'localhost:5176'}/`

                if (url && url.pathname === '/api/place-autocomplete') {
                    const input = url.searchParams.get('input')
                    const sessionToken = url.searchParams.get('sessionToken')
                    const countryCode = url.searchParams.get('countryCode')
                    const languageCode = url.searchParams.get('languageCode')
                    const businessOnly = url.searchParams.get('businessOnly')
                    const minLat = url.searchParams.get('minLat')
                    const minLon = url.searchParams.get('minLon')
                    const maxLat = url.searchParams.get('maxLat')
                    const maxLon = url.searchParams.get('maxLon')
                    if (!input || typeof input !== 'string' || input.trim().length < 2 || !sessionToken) {
                        res.statusCode = 400
                        res.setHeader('Content-Type', 'application/json')
                        res.end(JSON.stringify({ error: 'Missing input (min 2 chars) or sessionToken' }))
                        return
                    }
                    try {
                        const result = await fetchPlaceAutocompleteWithFallback({
                            input: input.trim(),
                            sessionToken: String(sessionToken),
                            languageCode: languageCode || 'en',
                            countryCode: countryCode || '',
                            minLat,
                            minLon,
                            maxLat,
                            maxLon,
                            businessOnly: businessOnly === '1' || businessOnly === 'true',
                        })
                        res.setHeader('Content-Type', 'application/json')
                        res.setHeader('Access-Control-Allow-Origin', '*')
                        if (!result.ok) {
                            res.statusCode = result.status === 503 ? 503 : 502
                            res.end(JSON.stringify({
                                status: 'ERROR',
                                predictions: [],
                                error: result.errorMessage || 'Autocomplete upstream error',
                            }))
                            return
                        }
                        res.end(JSON.stringify({
                            status: result.predictions.length ? 'OK' : 'ZERO_RESULTS',
                            predictions: result.predictions,
                            ...(result.errorMessage && !result.predictions.length
                                ? { hint: result.errorMessage }
                                : {}),
                        }))
                        return
                    } catch (err) {
                        console.error('Dev place-autocomplete error:', err)
                        res.statusCode = 500
                        res.setHeader('Content-Type', 'application/json')
                        res.end(JSON.stringify({ error: 'Internal server error' }))
                        return
                    }
                }

                if (url && url.pathname === '/api/place-details') {
                    const placeId = url.searchParams.get('placeId')
                    if (!placeId || !key) {
                        res.statusCode = 400
                        res.setHeader('Content-Type', 'application/json')
                        res.end(JSON.stringify({ error: 'Missing placeId or API key' }))
                        return
                    }
                    // Cost-control: disable Google Place photos in dev too.
                    const fields = 'name,formatted_address,address_components,geometry,place_id,formatted_phone_number,international_phone_number,website,url,opening_hours,types'
                    try {
                        const durl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${key}`
                        const response = await fetch(durl, { headers: { 'Referer': referer } })
                        const data = await response.json()
                        res.setHeader('Content-Type', 'application/json')
                        res.setHeader('Access-Control-Allow-Origin', '*')
                        if (data.status !== 'OK' || !data.result) {
                            res.statusCode = data.status === 'ZERO_RESULTS' ? 404 : 400
                            res.end(JSON.stringify({ error: data.status || 'Not found' }))
                            return
                        }
                        const place = data.result
                        const { city, country, countryCode } = parseAddressComponents(place.address_components || [])
                        const loc = place.geometry?.location || {}
                        const plat = typeof loc.lat === 'number' ? loc.lat : null
                        const plng = typeof loc.lng === 'number' ? loc.lng : null
                        let workingHours = null
                        if (place.opening_hours?.weekday_text?.length) {
                            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                            workingHours = {}
                            place.opening_hours.weekday_text.forEach((text, i) => {
                                workingHours[days[i]] = {
                                    isOpen: !String(text || '').toLowerCase().includes('closed'),
                                    text: String(text || ''),
                                }
                            })
                        }
                        res.end(JSON.stringify({
                            businessName: place.name || '',
                            address: place.formatted_address || '',
                            city,
                            country,
                            countryCode: countryCode || 'AU',
                            lat: plat,
                            lng: plng,
                            placeId: place.place_id || placeId,
                            phone: place.formatted_phone_number || place.international_phone_number || '',
                            website: place.website || place.url || '',
                            description: '',
                            coverImage: null,
                            logo: null,
                            gallery: [],
                            workingHours,
                            types: place.types || [],
                        }))
                        return
                    } catch (err) {
                        console.error('Dev place-details error:', err)
                        res.statusCode = 500
                        res.setHeader('Content-Type', 'application/json')
                        res.end(JSON.stringify({ error: 'Internal server error' }))
                        return
                    }
                }

                if (url && url.pathname === '/api/place-photo') {
                    const placeId = url.searchParams.get('placeId');
                    const index = url.searchParams.get('index') || '0';
                    const googleKey = key || '';
                    if (!placeId || !googleKey) {
                        res.statusCode = 400;
                        res.end(JSON.stringify({ error: 'Missing placeId or maps API key' }));
                        return;
                    }
                    try {
                        const result = await fetchPlacePhotoBufferDetailed(placeId, index, googleKey, referer);
                        if (!result.ok) {
                            console.warn(`Dev place-photo fetch failed for ${placeId}:`, result.error);
                            res.statusCode = result.status;
                            res.end(JSON.stringify({
                                error: result.error,
                                ...(result.google !== undefined ? { google: result.google } : {}),
                            }));
                            return;
                        }
                        res.setHeader('Content-Type', result.contentType);
                        res.setHeader('Access-Control-Allow-Origin', '*');
                        res.setHeader('Cache-Control', 'public, max-age=3600');
                        res.end(Buffer.from(result.buffer));
                    } catch (e) {
                        console.error('Dev place-photo error:', e);
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: String(e?.message || 'Unknown error') }));
                    }
                    return;
                }
            }

            if (req.url.startsWith('/__dev/')) {
                const url = new URL(req.url, `http://${req.headers.host}`)
                const action = url.pathname.replace('/__dev/', '')

                if (req.method === 'GET' && action === 'proxy-image') {
                    const targetUrl = url.searchParams.get('url');

                    if (!targetUrl) {
                        res.statusCode = 400;
                        res.end('Missing url parameter');
                        return;
                    }

                    const validation = await validateProxyUrl(targetUrl);
                    if (!validation.ok) {
                        res.statusCode = 400;
                        res.end(validation.error || 'Invalid url');
                        return;
                    }

                    console.log(`Proxying image: ${targetUrl}`);

                    try {
                        if (typeof fetch === 'function') {
                            const headers = {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                            };
                            const maxRedirects = 3;
                            let currentUrl = targetUrl;
                            let response = await fetch(currentUrl, { headers, redirect: 'manual' });

                            for (let i = 0; i < maxRedirects && response.status >= 300 && response.status < 400; i++) {
                                const location = response.headers.get('location');
                                if (!location) break;
                                try {
                                    currentUrl = new URL(location, currentUrl).href;
                                } catch { break; }
                                const redirectValidation = await validateProxyUrl(currentUrl);
                                if (!redirectValidation.ok) {
                                    res.statusCode = 400;
                                    res.end('Redirect to blocked address');
                                    return;
                                }
                                response = await fetch(currentUrl, { headers, redirect: 'manual' });
                            }

                            if (response.status >= 300 && response.status < 400) {
                                res.statusCode = 400;
                                res.end('Redirect limit exceeded');
                                return;
                            }

                            if (!response.ok) {
                                throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
                            }

                            const arrayBuffer = await response.arrayBuffer();
                            const buffer = Buffer.from(arrayBuffer);

                            const contentType = response.headers.get('content-type');
                            if (contentType) res.setHeader('Content-Type', contentType);

                            res.setHeader('Access-Control-Allow-Origin', '*');
                            res.setHeader('Cache-Control', 'public, max-age=3600');

                            res.end(buffer);
                        } else {
                            const https = await import('https');
                            const http = await import('http');
                            const client = targetUrl.startsWith('https') ? https : http;

                            client.get(targetUrl, (proxyRes) => {
                                res.statusCode = proxyRes.statusCode;
                                if (proxyRes.headers['content-type']) {
                                    res.setHeader('Content-Type', proxyRes.headers['content-type']);
                                }
                                res.setHeader('Access-Control-Allow-Origin', '*');
                                proxyRes.pipe(res);
                            }).on('error', (e) => {
                                console.error('Proxy error:', e);
                                res.statusCode = 500;
                                res.end('Proxy error: ' + e.message);
                            });
                        }
                    } catch (error) {
                        console.error('Proxy Exception:', error);
                        res.statusCode = 500;
                        res.end('Proxy Exception: ' + error.message);
                    }
                    return;
                }



                if (req.method === 'GET' && action === 'backups') {
                    // List backups
                    const backupDir = path.resolve(__dirname, 'backups')
                    if (!fs.existsSync(backupDir)) {
                        fs.mkdirSync(backupDir)
                    }
                    const backups = fs.readdirSync(backupDir)
                        .filter(file => fs.statSync(path.join(backupDir, file)).isDirectory())
                        .map(name => {
                            const stat = fs.statSync(path.join(backupDir, name))
                            return { id: name, timestamp: stat.mtime }
                        })
                        .sort((a, b) => b.timestamp - a.timestamp)

                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify(backups))
                    return
                }

                if (req.method === 'POST' && action === 'create-backup') {
                    // Create Backup
                    const now = new Date()
                    const timestamp = now.toISOString().replace(/T/, '_').replace(/:/g, '').split('.')[0]
                    const backupName = `backup_${timestamp}`
                    const sourceDir = __dirname
                    const backupDir = path.resolve(__dirname, 'backups', backupName)

                    if (!fs.existsSync(backupDir)) {
                        fs.mkdirSync(backupDir, { recursive: true })
                    }

                    // Exclude heavy folders like node_modules, .git, dist, backups
                    const excludeDirs = ['node_modules', '.git', 'dist', 'backups', '.firebase', '.github']
                    const excludeList = excludeDirs.map(d => `/XD "${path.join(sourceDir, d)}"`).join(' ')

                    // Use robocopy for Windows (fast and robust)
                    const command = `robocopy "${sourceDir}" "${backupDir}" /E /XF *.log *.lock package-lock.json ${excludeList} /NFL /NDL /NJH /NJS /NC /NS /NP`

                    console.log(`Creating backup: ${backupName}...`)
                    exec(command, (error, stdout, stderr) => {
                        // robocopy returns exit codes, 0-7 are success/warnings
                        if (error && error.code > 7) {
                            console.error('Backup failed:', error)
                            res.statusCode = 500
                            res.end(JSON.stringify({ error: 'Check console for details' }))
                        } else {
                            console.log('Backup created successfully!')
                            res.setHeader('Content-Type', 'application/json')
                            res.end(JSON.stringify({ success: true, backupId: backupName }))
                        }
                    })
                    return
                }

                if (req.method === 'POST' && action === 'restore-backup') {
                    let body = ''
                    req.on('data', chunk => { body += chunk })
                    req.on('end', () => {
                        const { backupId } = JSON.parse(body)
                        if (!backupId) {
                            res.statusCode = 400
                            res.end('Missing backupId')
                            return
                        }

                        // 1. Allowlist: backup_ plus alphanumeric, dash, underscore only
                        if (typeof backupId !== 'string' || !/^backup_[a-zA-Z0-9_-]+$/.test(backupId)) {
                            res.statusCode = 400
                            res.end('Invalid backupId')
                            return
                        }

                        const backupsDir = path.resolve(__dirname, 'backups')
                        const backupPath = path.resolve(backupsDir, backupId)

                        // 2. Path boundary check: resolved path must stay inside backups
                        const relative = path.relative(backupsDir, backupPath)
                        if (relative.startsWith('..') || path.isAbsolute(relative)) {
                            res.statusCode = 400
                            res.end('Invalid backupId')
                            return
                        }
                        const targetPath = __dirname

                        if (!fs.existsSync(backupPath)) {
                            res.statusCode = 404
                            res.end('Backup not found')
                            return
                        }

                        console.log(`Restoring backup: ${backupId}...`)

                        const restoreSrcCmd = `robocopy "${path.join(backupPath, 'src')}" "${path.join(targetPath, 'src')}" /MIR /NFL /NDL /NJH /NJS`
                        const restorePublicCmd = `robocopy "${path.join(backupPath, 'public')}" "${path.join(targetPath, 'public')}" /MIR /NFL /NDL /NJH /NJS`
                        const copyRootCmd = `robocopy "${backupPath}" "${targetPath}" *.json *.js *.html *.css /LEV:1 /XO /NFL /NDL /NJH /NJS`

                        exec(restoreSrcCmd, (err1) => {
                            if (err1 && err1.code > 7) { console.error('Restore src failed', err1); res.statusCode = 500; res.end('Failed src'); return; }

                            exec(restorePublicCmd, (err2) => {
                                if (err2 && err2.code > 7) { console.error('Restore public failed', err2); res.statusCode = 500; res.end('Failed public'); return; }

                                exec(copyRootCmd, (err3) => {
                                    console.log('Restore completed!')
                                    res.setHeader('Content-Type', 'application/json')
                                    res.end(JSON.stringify({ success: true }))
                                })
                            })
                        })
                    })
                    return
                }
            }
            next()
        })
    }
})

const devEnv = loadEnv(process.env.MODE || 'development', process.cwd(), '')
/** In `npm run dev`, proxy /api/auth to production (or VITE_DEV_API_PROXY). Plain Vite does not run serverless API routes. */
const devAuthApiProxy =
    String(devEnv.VITE_DEV_API_PROXY || 'https://www.dinebuddies.com').trim() || 'https://www.dinebuddies.com'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), devOperations()],
    build: {
        // Default 500 kB triggers noisy warnings; main app chunk is intentionally large until further code-splitting.
        chunkSizeWarningLimit: 2000,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) return
                    if (id.includes('/firebase/')) return 'vendor-firebase'
                    if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router-dom/')) return 'vendor-react'
                    if (id.includes('/i18next/') || id.includes('/react-i18next/')) return 'vendor-i18n'
                    if (id.includes('/leaflet/') || id.includes('/react-leaflet/')) return 'vendor-maps'
                    if (id.includes('/stripe/')) return 'vendor-stripe'
                    if (id.includes('/lottie-react/') || id.includes('/lottie-web/')) return 'vendor-media'
                }
            }
        }
    },
    server: {
        host: '0.0.0.0',
        port: 5176,
        strictPort: true,
        open: '/login?tab=business',
        proxy: {
            '/api': {
                target: devAuthApiProxy,
                changeOrigin: true,
                // Local dev: avoid 500 when Node cannot verify the production TLS chain (corporate proxy / AV).
                secure: false,
            },
        },
    },
})
