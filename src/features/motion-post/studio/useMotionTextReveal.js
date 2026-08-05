import { useEffect, useRef, useState } from 'react';

/**
 * Re-run studio text entrance when the post canvas is ≥ `threshold` visible.
 * Resets (frozen) when it leaves the viewport.
 */
export function useMotionTextReveal({ threshold = 0.45, enabled = true } = {}) {
    const ref = useRef(null);
    const [animPlayKey, setAnimPlayKey] = useState(0);
    const wasVisibleRef = useRef(false);

    useEffect(() => {
        if (!enabled) {
            setAnimPlayKey(1);
            return undefined;
        }
        const el = ref.current;
        if (!el) return undefined;

        const observer = new IntersectionObserver(
            ([entry]) => {
                const ratio = entry?.intersectionRatio ?? 0;
                const visible = Boolean(entry?.isIntersecting) && ratio >= threshold;
                if (visible && !wasVisibleRef.current) {
                    wasVisibleRef.current = true;
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            setAnimPlayKey((k) => k + 1);
                        });
                    });
                } else if (!visible && wasVisibleRef.current) {
                    wasVisibleRef.current = false;
                    setAnimPlayKey(0);
                }
            },
            { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: '0px' }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [enabled, threshold]);

    return { ref, animPlayKey, animationActive: animPlayKey > 0 };
}
