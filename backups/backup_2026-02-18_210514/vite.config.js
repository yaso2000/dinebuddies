import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'

// Custom middleware to handle development operations
const devOperations = () => ({
    name: 'dev-operations',
    configureServer(server) {
        server.middlewares.use((req, res, next) => {
            if (req.url.startsWith('/__dev/')) {
                const url = new URL(req.url, `http://${req.headers.host}`)
                const action = url.pathname.replace('/__dev/', '')

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

                        // RESTORE LOGIC: robocopy /MIR (Mirror) makes target exactly like source
                        // EXTREME CAUTION: This deletes files in target not present in source!
                        // We must be careful not to delete critical ignored files.

                        // We only mirror 'src' and 'public' folders to be safe about code changes
                        // Restoring root files manually

                        const restoreSrcCmd = `robocopy "${path.join(backupPath, 'src')}" "${path.join(targetPath, 'src')}" /MIR /NFL /NDL /NJH /NJS`
                        const restorePublicCmd = `robocopy "${path.join(backupPath, 'public')}" "${path.join(targetPath, 'public')}" /MIR /NFL /NDL /NJH /NJS`

                        // Copy root files (non-recursive)
                        const copyRootCmd = `robocopy "${backupPath}" "${targetPath}" *.json *.js *.html *.css /LEV:1 /XO /NFL /NDL /NJH /NJS`

                        // Executing sequentially
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
        port: 5176
    }
})
