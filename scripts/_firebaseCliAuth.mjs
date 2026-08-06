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

/** login:list can still show an email after the refresh token dies — verify with an API call. */
export function isFirebaseCliLoginValid(env = process.env) {
    const result = spawnSync('firebase', ['projects:list', '--non-interactive'], {
        env: ensureNodeTlsEnv(env),
        encoding: 'utf8',
        shell: true,
    });
    const output = `${result.stdout || ''}${result.stderr || ''}`;
    if (result.status !== 0) return false;
    if (/credentials are no longer valid|Authentication Error/i.test(output)) return false;
    return true;
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
    console.error('[firebase] No valid Firebase CLI session.');
    console.error('');
    console.error('Windows / "Firebase CLI Login Failed" page:');
    console.error('  1. Open a normal PowerShell / Terminal (not inside Cursor browser)');
    console.error('  2. cd to the repo, then:');
    console.error('       npm run firebase:login');
    console.error('  3. Open the printed URL in Chrome/Edge, sign in, paste the code back');
    console.error('');
    console.error('If attest / SSL still fails:');
    console.error('  - Disable VPN/proxy, or try a mobile hotspot');
    console.error('  - Or skip login and deploy via service account:');
    console.error('       npm run deploy:firebase-functions:sa -- --only "functions:moderateImage,functions:enforceApprovedImageUpload"');
    console.error('');
}
