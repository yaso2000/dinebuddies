/**
 * Stop stale Vite dev servers on default ports (Windows + Unix).
 * Usage: node scripts/kill-vite-dev-ports.mjs
 */
import { execSync } from 'child_process';

const PORTS = [5176, 5177, 5178, 5179];

function killPortWindows(port) {
    try {
        const out = execSync(`netstat -ano | findstr :${port}`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const pids = new Set();
        for (const line of out.split('\n')) {
            if (!line.includes('LISTENING')) continue;
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
        }
        for (const pid of pids) {
            try {
                execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
                console.log(`[kill-vite-dev-ports] stopped PID ${pid} (port ${port})`);
            } catch {
                /* ignore */
            }
        }
    } catch {
        /* no listener */
    }
}

function killPortUnix(port) {
    try {
        const out = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        for (const pid of out.split('\n').map((s) => s.trim()).filter(Boolean)) {
            try {
                execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
                console.log(`[kill-vite-dev-ports] stopped PID ${pid} (port ${port})`);
            } catch {
                /* ignore */
            }
        }
    } catch {
        /* no listener */
    }
}

const killPort = process.platform === 'win32' ? killPortWindows : killPortUnix;

for (const port of PORTS) {
    killPort(port);
}

console.log('[kill-vite-dev-ports] done — run: npm run dev');
