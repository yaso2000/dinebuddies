/** True on iPhone/iPad/iPod (all browsers use WebKit). */
export function isAppleWebKit() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return (
        /iPad|iPhone|iPod/i.test(ua)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
}

