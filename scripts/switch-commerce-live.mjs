/**
 * Validate Stripe + PayPal LIVE credentials, sync client env, update Vercel, deploy.
 *
 * Prerequisites (edit before running):
 *   functions/.env  — STRIPE_MODE=live, sk_live_*, live price IDs, live webhook, PAYPAL_MODE=live + live creds
 *   .env            — VITE_STRIPE_PUBLISHABLE_KEY=pk_live_*, VITE_PAYPAL_* live (no VITE_STRIPE_TEST_MODE)
 *
 * Usage:
 *   node scripts/switch-commerce-live.mjs           # validate only
 *   node scripts/switch-commerce-live.mjs --deploy  # validate + deploy functions + frontend
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const deploy = process.argv.includes('--deploy');

function loadEnvFile(path) {
    if (!existsSync(path)) return {};
    const out = {};
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const i = t.indexOf('=');
        if (i === -1) continue;
        out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
    return out;
}

function setEnvLine(content, key, value) {
    const re = new RegExp(`^${key}=.*$`, 'm');
    const line = `${key}=${value}`;
    if (re.test(content)) return content.replace(re, line);
    return `${content.replace(/\s*$/, '')}\n${line}\n`;
}

function fail(msg) {
    console.error(`\n❌ ${msg}`);
    process.exit(1);
}

function ok(msg) {
    console.log(`✅ ${msg}`);
}

async function probePayPalOAuth(baseUrl, clientId, clientSecret) {
    const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && Boolean(data?.access_token), status: res.status, error: data?.error };
}

async function probeStripeSecretKey(secretKey) {
    const res = await fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${secretKey}` },
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: data?.error?.message || data?.error?.type };
}

function run(cmd, args, opts = {}) {
    const result = spawnSync(cmd, args, {
        stdio: 'inherit',
        shell: true,
        cwd: root,
        env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --use-system-ca`.trim() },
        ...opts,
    });
    if (result.status !== 0) {
        fail(`Command failed: ${cmd} ${args.join(' ')}`);
    }
}

async function main() {
    const fnEnvPath = join(root, 'functions', '.env');
    const clientEnvPath = join(root, '.env');
    const fn = loadEnvFile(fnEnvPath);
    const client = loadEnvFile(clientEnvPath);

    console.log('Checking LIVE commerce configuration…\n');

    const stripeMode = String(fn.STRIPE_MODE || '').toLowerCase();
    const stripeSecret = String(fn.STRIPE_SECRET_KEY || '').trim();
    const pk = String(client.VITE_STRIPE_PUBLISHABLE_KEY || '').trim();
    const stripeTestFlag =
        client.VITE_STRIPE_TEST_MODE === 'true' || client.VITE_STRIPE_TEST_MODE === '1';

    if (stripeMode !== 'live') fail('Set STRIPE_MODE=live in functions/.env');
    if (!stripeSecret.startsWith('sk_live_')) {
        fail('STRIPE_SECRET_KEY must be sk_live_… (not sk_test_ or rk_test_) in functions/.env');
    }
    if (!pk.startsWith('pk_live_')) {
        fail('Add VITE_STRIPE_PUBLISHABLE_KEY=pk_live_… to root .env');
    }
    if (stripeTestFlag) fail('Remove VITE_STRIPE_TEST_MODE or set it to false in root .env');

    const priceKeys = [
        'STRIPE_PRICE_CREDITS_200',
        'STRIPE_PRICE_CREDITS_500',
        'STRIPE_PRICE_CREDITS_1000',
        'STRIPE_PRICE_CREDITS_3000',
        'STRIPE_PRICE_BUSINESS_MONTHLY',
    ];
    for (const k of priceKeys) {
        const v = String(fn[k] || '').trim();
        if (!v.startsWith('price_')) fail(`Missing or invalid ${k} in functions/.env (Live price ID)`);
    }
    if (!String(fn.STRIPE_WEBHOOK_SECRET || '').trim().startsWith('whsec_')) {
        fail('Set STRIPE_WEBHOOK_SECRET=whsec_… from Live webhook in functions/.env');
    }

    const paypalMode = String(fn.PAYPAL_MODE || '').toLowerCase();
    const paypalId = String(fn.PAYPAL_CLIENT_ID || '').trim();
    const paypalSecret = String(fn.PAYPAL_CLIENT_SECRET || '').trim();
    if (paypalMode !== 'live') fail('Set PAYPAL_MODE=live in functions/.env');
    if (!paypalId || !paypalSecret) fail('Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in functions/.env');

    const clientPaypalMode = String(client.VITE_PAYPAL_MODE || '').toLowerCase();
    const clientPaypalTest =
        client.VITE_PAYPAL_TEST_MODE === 'true' || client.VITE_PAYPAL_TEST_MODE === '1';
    if (clientPaypalMode !== 'live') fail('Set VITE_PAYPAL_MODE=live in root .env');
    if (clientPaypalTest) fail('Set VITE_PAYPAL_TEST_MODE=false in root .env');
    if (String(client.VITE_PAYPAL_CLIENT_ID || '').trim() !== paypalId) {
        fail('VITE_PAYPAL_CLIENT_ID in .env must match PAYPAL_CLIENT_ID in functions/.env');
    }

    const stripeProbe = await probeStripeSecretKey(stripeSecret);
    if (!stripeProbe.ok) fail(`Stripe Live key rejected: ${stripeProbe.error || 'unknown'}`);
    ok('Stripe Live secret key valid');

    const livePaypal = await probePayPalOAuth(
        'https://api-m.paypal.com',
        paypalId,
        paypalSecret
    );
    if (!livePaypal.ok) {
        fail(
            `PayPal Live OAuth failed (${livePaypal.status} ${livePaypal.error || ''}). Use Live Client ID + Secret from PayPal Developer Dashboard (Live tab).`
        );
    }
    ok('PayPal Live OAuth valid');

    // Sync client PayPal vars from functions/.env if missing
    let clientContent = existsSync(clientEnvPath) ? readFileSync(clientEnvPath, 'utf8') : '';
    clientContent = setEnvLine(clientContent, 'VITE_PAYPAL_CLIENT_ID', paypalId);
    clientContent = setEnvLine(clientContent, 'VITE_PAYPAL_CURRENCY', fn.PAYPAL_CURRENCY || 'USD');
    clientContent = setEnvLine(clientContent, 'VITE_PAYPAL_MODE', 'live');
    clientContent = setEnvLine(clientContent, 'VITE_PAYPAL_TEST_MODE', 'false');
    if (!pk) clientContent = setEnvLine(clientContent, 'VITE_STRIPE_PUBLISHABLE_KEY', pk);
    writeFileSync(clientEnvPath, clientContent);
    ok('Synced root .env client vars');

    console.log('\nAll LIVE checks passed.');
    if (!deploy) {
        console.log('\nRun with --deploy to push Firebase Functions + Vercel frontend.');
        return;
    }

    console.log('\nDeploying Firebase Functions (Stripe + PayPal + webhook)…');
    run('npm', [
        'run',
        'deploy:firebase-functions',
        '--',
        'functions:stripeWebhook,functions:createCheckoutSession,functions:createCreditsCheckoutSession,functions:getStripeCommerceStatus,functions:createPayPalCreditsOrder,functions:capturePayPalCreditsOrder,functions:getPayPalCommerceStatus',
    ]);

    console.log('\nBuilding frontend with Live env…');
    const buildEnv = {
        ...process.env,
        VITE_STRIPE_PUBLISHABLE_KEY: pk,
        VITE_PAYPAL_CLIENT_ID: paypalId,
        VITE_PAYPAL_CURRENCY: fn.PAYPAL_CURRENCY || 'USD',
        VITE_PAYPAL_MODE: 'live',
        VITE_PAYPAL_TEST_MODE: 'false',
        NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --use-system-ca`.trim(),
    };
    const build = spawnSync('npm', ['run', 'build'], {
        stdio: 'inherit',
        shell: true,
        cwd: root,
        env: buildEnv,
    });
    if (build.status !== 0) fail('Frontend build failed');

    console.log('\nDeploying frontend to Vercel…');
    run('npm', ['run', 'deploy:predist'], { env: buildEnv });

    ok('Live commerce deployed. Real charges apply — test with a small amount first.');
}

main().catch((err) => fail(err?.message || String(err)));
