import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'

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

                    console.log(`Proxying image: ${targetUrl}`);

                    try {
                        // Use global fetch (Node 18+) for redirect support
                        if (typeof fetch === 'function') {
                            const response = await fetch(targetUrl, {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                                }
                            });

                            if (!response.ok) {
                                throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
                            }

                            const arrayBuffer = await response.arrayBuffer();
                            const buffer = Buffer.from(arrayBuffer);

                            // Forward headers
                            const contentType = response.headers.get('content-type');
                            if (contentType) res.setHeader('Content-Type', contentType);

                            res.setHeader('Access-Control-Allow-Origin', '*');
                            res.setHeader('Cache-Control', 'public, max-age=3600');

                            res.end(buffer);
                        } else {
                            // Start simplified fallback for older Node (no redirects)
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

                        const backupPath = path.resolve(__dirname, 'backups', backupId)
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
    server: {
        host: '0.0.0.0', // Listen on all network interfaces
        port: 5176,
        hmr: {
            port: 5176
        }
    }
})
