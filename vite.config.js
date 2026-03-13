import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import dns from 'dns'
import { exec } from 'child_process'

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
        server.middlewares.use(async (req, res, next) => {
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

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), devOperations()],
    build: {
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
        host: '0.0.0.0', // Listen on all network interfaces
        port: 5176
    }
})
