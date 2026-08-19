import React, { useId, useMemo, useState } from 'react';
import {
    getGiftJarImageSrc,
    getGiftShieldVisualTheme,
} from '../../constants/giftShieldVisualThemes';

/**
 * Gift-jar model — PNG jar art from `public/gift-shields/`. The source art is
 * always drawn "full", so progress is communicated by revealing a full-color
 * copy of the jar from the bottom up (clip-path), layered over a
 * desaturated/dimmed base copy — a "filling up" illusion rather than a
 * literal liquid-level render.
 */
export default function GiftShieldVisual({
    tierId = 'bronze',
    state = 'locked',
    progressPct = 0,
    size = 88,
    className = '',
    showSecondGhost = false,
}) {
    const uid = useId().replace(/:/g, '');
    const theme = getGiftShieldVisualTheme(tierId);
    const imageSrc = getGiftJarImageSrc(theme);
    const [imageFailed, setImageFailed] = useState(false);
    const locked = state === 'locked';
    const completed = state === 'completed';
    const useImage = Boolean(imageSrc) && !imageFailed;

    const clampedProgress = useMemo(() => {
        if (locked) return 0;
        if (completed) return 100;
        return Math.max(0, Math.min(100, Number(progressPct) || 0));
    }, [locked, completed, progressPct]);

    const fillStyle = useMemo(
        () => ({ clipPath: `inset(${100 - clampedProgress}% 0 0 0)` }),
        [clampedProgress]
    );

    return (
        <div
            className={`gift-shield-visual gift-shield-visual--${state} gift-shield-visual--${tierId}${useImage ? ' gift-shield-visual--image' : ''} ${className}`.trim()}
            style={{
                width: size,
                height: size,
                ['--shield-glow']: theme.glow,
            }}
        >
            {showSecondGhost && useImage ? (
                <img
                    className="gift-shield-visual__img gift-shield-visual__img--ghost"
                    src={imageSrc}
                    alt=""
                    draggable={false}
                />
            ) : null}

            {useImage ? (
                <>
                    <img
                        className="gift-shield-visual__img gift-shield-visual__img--base"
                        src={imageSrc}
                        alt=""
                        draggable={false}
                        onError={() => setImageFailed(true)}
                    />
                    <img
                        className="gift-shield-visual__img gift-shield-visual__img--fill"
                        src={imageSrc}
                        alt=""
                        aria-hidden
                        draggable={false}
                        style={fillStyle}
                    />
                </>
            ) : (
                <JarFallbackSvg uid={uid} theme={theme} clampedProgress={clampedProgress} />
            )}

            {completed ? (
                <span className="gift-shield-visual__check" aria-hidden>✓</span>
            ) : null}
        </div>
    );
}

/** Minimal jar-silhouette fallback if the PNG fails to load. */
function JarFallbackSvg({ uid, theme, clampedProgress }) {
    const fillH = 72 * (clampedProgress / 100);
    const fillY = 30 + (72 - fillH);
    return (
        <svg className="gift-shield-visual__svg" viewBox="0 0 100 112" role="presentation" aria-hidden>
            <defs>
                <clipPath id={`${uid}-jar-clip`}>
                    <rect x="22" y="30" width="56" height="72" rx="10" />
                </clipPath>
            </defs>
            <rect
                x="22" y="30" width="56" height="72" rx="10"
                fill="rgba(255,255,255,0.06)"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="2"
            />
            <rect
                x="34" y="14" width="32" height="18" rx="4"
                fill="rgba(255,255,255,0.14)"
                stroke="rgba(255,255,255,0.24)"
                strokeWidth="1.5"
            />
            <g clipPath={`url(#${uid}-jar-clip)`}>
                {clampedProgress > 0 ? (
                    <rect x="22" y={fillY} width="56" height={fillH} fill={theme.fillMid} />
                ) : null}
            </g>
        </svg>
    );
}
