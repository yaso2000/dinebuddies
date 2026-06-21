import assert from 'node:assert/strict';
import { validateProxyUrl } from '../api/proxy.js';

async function assertBlocked(url, message) {
    const result = await validateProxyUrl(url);
    assert.equal(result.ok, false, message);
}

await assertBlocked('file:///etc/passwd', 'non-http schemes must be blocked');
await assertBlocked('http://localhost/image.png', 'localhost must be blocked');
await assertBlocked('http://127.0.0.1/image.png', 'loopback IPs must be blocked');
await assertBlocked('http://10.1.2.3/image.png', 'private IPs must be blocked');
await assertBlocked('http://169.254.169.254/latest/meta-data', 'metadata IP must be blocked');
await assertBlocked('http://metadata.google.internal/computeMetadata/v1', 'metadata host must be blocked');

const publicIp = await validateProxyUrl('http://8.8.8.8/image.png');
assert.equal(publicIp.ok, true, 'public IP URL should pass validation');
