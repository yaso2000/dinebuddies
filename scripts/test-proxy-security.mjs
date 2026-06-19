import assert from 'node:assert/strict';
import { assertPublicUrl } from '../api/proxy.js';

async function rejects(url, message) {
    await assert.rejects(() => assertPublicUrl(url), undefined, message);
}

await rejects('file:///etc/passwd', 'non-http protocols are rejected');
await rejects('http://localhost/internal.png', 'localhost is rejected');
await rejects('http://127.0.0.1/internal.png', 'loopback IPv4 is rejected');
await rejects('http://10.0.0.5/internal.png', 'RFC1918 IPv4 is rejected');
await rejects('http://169.254.169.254/latest/meta-data/', 'metadata IP is rejected');
await rejects('http://[::1]/internal.png', 'loopback IPv6 is rejected');
await rejects('http://metadata.google.internal/computeMetadata/v1/', 'GCP metadata host is rejected');

const parsed = await assertPublicUrl('https://8.8.8.8/image.png');
assert.equal(parsed.protocol, 'https:');
assert.equal(parsed.hostname, '8.8.8.8');

console.log('proxy security assertions passed');
