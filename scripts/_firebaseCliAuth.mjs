/**
 * Shared Firebase CLI auth helpers — always prefer interactive CLI login over service account.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const noKeepAlive = join(scriptsDir, 'firebase-cli-no-keepalive.cjs');

function appendNodeOption(options, flag) {
    if (options.includes(flag)) return options;
    return options ? `${options} ${flag}` : flag;
}

export function ensureNodeTlsEnv(env = process.env) {
    const next = { ...env };
    let options = next.NODE_OPTIONS || '';
    options = appendNodeOption(options, '--use-system-ca');
    // firebase-tools + Node 19+ can fail auth.firebase.tools/attest without this.
    options = appendNodeOption(options, `--require ${noKeepAlive}`);
    next.NODE_OPTIONS = options.trim();
    return next;
}

export function getFirebaseCliLogin(env = process.env) {
    const result = spawnSync('firebase', ['login:list'], {
        env: ensureNodeTlsEnv(env),
        encoding: 'utf8',
        shell: true,
    });

    const output = `${result.stdout || ''}${result.stderr || ''}`;
    const match = output.match(/Logged in as (.+)/);
    if (match?.[1]) {
        return { email: match[1].trim(), output };
    }
    return { email: null, output };
}

export function runFirebase(args, { cwd, env = process.env } = {}) {
    return spawnSync('firebase', args, {
        cwd,
        env: ensureNodeTlsEnv(env),
        stdio: 'inherit',
        shell: true,
    });
}

export function printFirebaseLoginHelp() {
    console.error('');
    console.error('[firebase] No Firebase CLI session. Log in first (recommended):');
    console.error('  npm run firebase:login');
    console.error('');
    console.error('If login still fails (auth.firebase.tools/attest):');
    console.error('  - Disable VPN/proxy temporarily');
    console.error('  - Try another network (mobile hotspot)');
    console.error('  - Or use Node 22 LTS: nvm use 22 && npm run firebase:login');
    console.error('');
    console.error('Or deploy with service account (needs IAM Service Account User on appspot SA):');
    console.error('  npm run deploy:firebase-functions:sa');
    console.error('');
}
