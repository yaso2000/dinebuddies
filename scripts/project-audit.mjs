/**
 * Step 1 — project inventory (local + git + Vercel link).
 * Run: node scripts/project-audit.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd, opts = {}) {
    try {
        return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim();
    } catch (e) {
        const err = e.stderr?.toString?.() || e.message || String(e);
        return `(failed) ${err.split('\n')[0]}`;
    }
}

function section(title) {
    console.log('\n' + '='.repeat(60));
    console.log(title);
    console.log('='.repeat(60));
}

console.log('DineBuddies — Project audit');
console.log('Root:', root);
console.log('Date:', new Date().toISOString());

section('Package');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
console.log('name:', pkg.name);
console.log('version:', pkg.version);

section('Git remote & branch');
console.log('branch:', run('git branch --show-current'));
console.log('remotes:\n', run('git remote -v'));
console.log('status:\n', run('git status -sb'));

section('Git branches (local)');
console.log(run('git branch -vv') || '(none)');

section('Git branches (remote, last 30)');
console.log(run('git branch -r') || '(none)');

section('Last 5 commits');
console.log(run('git log -5 --oneline') || '(none)');

section('Vercel link (.vercel/project.json)');
const vercelPath = path.join(root, '.vercel', 'project.json');
if (fs.existsSync(vercelPath)) {
    console.log(fs.readFileSync(vercelPath, 'utf8'));
} else {
    console.log('(missing — not linked locally)');
}

section('vercel.json summary');
if (fs.existsSync(path.join(root, 'vercel.json'))) {
    const v = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
    console.log('buildCommand:', v.buildCommand);
    console.log('outputDirectory:', v.outputDirectory);
    console.log('framework:', v.framework);
}

section('PWA manifest');
const manifestPath = path.join(root, 'public', 'manifest.json');
if (fs.existsSync(manifestPath)) {
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log('name:', m.name);
    console.log('short_name:', m.short_name);
    console.log('start_url:', m.start_url);
}

section('Sibling folders under v1/ (possible duplicates)');
const v1 = path.resolve(root, '..');
try {
    const siblings = fs
        .readdirSync(v1, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
        .map((d) => {
            const hasPkg = fs.existsSync(path.join(v1, d.name, 'package.json'));
            const hasGit = fs.existsSync(path.join(v1, d.name, '.git'));
            return `  ${d.name}${hasPkg ? ' [package.json]' : ''}${hasGit ? ' [.git]' : ''}`;
        });
    console.log(siblings.join('\n') || '(none)');
} catch (e) {
    console.log('(could not list)', e.message);
}

section('Native mobile tooling (for App Store / Play later)');
for (const bin of ['npx cap --version', 'java -version 2>&1', 'xcodebuild -version 2>&1']) {
    console.log(bin.split(' ')[0] + ':', run(bin));
}

console.log('\n--- Paste this full output in chat for Step 1 review ---\n');
