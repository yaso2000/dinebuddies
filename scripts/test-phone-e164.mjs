import { formatToE164, isValidE164 } from '../api/_phoneUtils.js';

const cases = [
    ['20', '01012345678', '+201012345678'],
    ['966', '0501234567', '+966501234567'],
    ['20', '1012345678', '+201012345678'],
];

let failed = 0;
for (const [cc, raw, expected] of cases) {
    const got = formatToE164(cc, raw);
    if (got !== expected) {
        console.error(`FAIL formatToE164(${cc}, ${raw}): got ${got}, want ${expected}`);
        failed += 1;
    }
}
if (!isValidE164('+201012345678')) {
    console.error('FAIL isValidE164 positive');
    failed += 1;
}
if (isValidE164('010123')) {
    console.error('FAIL isValidE164 negative');
    failed += 1;
}
if (failed) {
    process.exit(1);
}
console.log('phone E.164 tests OK');
