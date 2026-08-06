/**
 * Save working tree to the local git repo and push to GitHub (cloud) in one step.
 *
 * Usage (from repo root):
 *   npm run save
 *   npm run save -- "short message about the change"
 *
 * Flow: pull --rebase → stage safe files → commit → push.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const gitDir = join(root, '.git');

function run(cmd, args, { allowFail = false } = {}) {
    const result = spawnSync(cmd, args, {
        cwd: root,
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: process.env,
    });
    const code = result.status === null ? 1 : result.status;
    if (code !== 0 && !allowFail) {
        process.exit(code);
    }
    return code;
}

function runCapture(cmd, args) {
    const result = spawnSync(cmd, args, {
        cwd: root,
        encoding: 'utf8',
        shell: process.platform === 'win32',
        env: process.env,
    });
    if (result.status !== 0) {
        return '';
    }
    return (result.stdout || '').trim();
}

if (!existsSync(gitDir)) {
    console.error('[save] Not a git repository. Run this from the dinebuddies folder.');
    process.exit(1);
}

const messageFromArgs = process.argv.slice(2).join(' ').trim();
const branch = runCapture('git', ['rev-parse', '--abbrev-ref', 'HEAD']) || 'main';

console.log(`[save] Branch: ${branch}`);
console.log('[save] 1/4 Pull latest from cloud (rebase)...');
run('git', ['pull', '--rebase', 'origin', branch], { allowFail: true });

const status = runCapture('git', ['status', '--porcelain']);
if (!status) {
    console.log('[save] No local changes to commit. Pushing branch anyway...');
    run('git', ['push', '-u', 'origin', branch]);
    console.log('[save] Done. Local and GitHub are in sync.');
    process.exit(0);
}

console.log('[save] 2/4 Staging changes (skipping large Android bundles)...');
run('git', ['add', '-A']);
// Keep release AABs out of routine saves — they slow GitHub/Vercel and are not needed for the web app.
run('git', ['reset', '--', 'dist-android/', 'dist-android/**'], { allowFail: true });
run('git', ['reset', '--', '*.aab'], { allowFail: true });

const staged = runCapture('git', ['diff', '--cached', '--name-only']);
if (!staged) {
    console.log('[save] Nothing left to commit after skipping AABs.');
    console.log('[save] Pushing branch anyway...');
    run('git', ['push', '-u', 'origin', branch]);
    console.log('[save] Done.');
    process.exit(0);
}

const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
const message = messageFromArgs || `Save local work ${stamp}`;

console.log('[save] 3/4 Commit...');
run('git', ['commit', '-m', message]);

console.log('[save] 4/4 Push to GitHub...');
run('git', ['push', '-u', 'origin', branch]);

console.log('[save] Done. Saved on this device and on GitHub (cloud).');
console.log('[save] Tip: before you start work next time, run: git pull origin ' + branch);
