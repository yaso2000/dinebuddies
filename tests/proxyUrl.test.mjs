import assert from 'node:assert/strict';
import { ReadableStream } from 'node:stream/web';
import { readBodyWithLimit, validateProxyUrl } from '../api/_proxyUrl.js';

assert.equal((await validateProxyUrl('ftp://example.com/image.jpg')).ok, false);
assert.equal((await validateProxyUrl('http://localhost/image.jpg')).ok, false);
assert.equal((await validateProxyUrl('http://127.0.0.1/image.jpg')).ok, false);
assert.equal((await validateProxyUrl('http://10.0.0.2/image.jpg')).ok, false);
assert.equal((await validateProxyUrl('http://169.254.169.254/latest/meta-data/')).ok, false);
assert.equal((await validateProxyUrl('http://metadata.google.internal/computeMetadata/v1/')).ok, false);
assert.equal((await validateProxyUrl('https://example.com/image.jpg')).ok, true);

const okResponse = new Response('abc', {
    headers: { 'content-length': '3' },
});
assert.equal((await readBodyWithLimit(okResponse, 3)).toString(), 'abc');

await assert.rejects(
    () => readBodyWithLimit(new Response('abcd', { headers: { 'content-length': '4' } }), 3),
    /Response too large/
);

const streamResponse = new Response(new ReadableStream({
    start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3, 4]));
        controller.close();
    },
}));

await assert.rejects(() => readBodyWithLimit(streamResponse, 3), /Response too large/);

console.log('proxy URL security assertions passed');
