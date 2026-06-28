import React, { useId, useMemo, useState } from 'react';
import {
    getGiftShieldImageSrc,
    getGiftShieldVisualTheme,
} from '../../constants/giftShieldVisualThemes';

/** Classic heraldic shield silhouette (SVG fallback). */
export const GIFT_SHIELD_PATH =
    'M50 6 C61 6 70 10 76 16 L90 30 C94 40 94 54 90 68 L76 90 C68 100 56 106 50 108 C44 106 32 100 24 90 L10 68 C6 54 6 40 10 30 L24 16 C30 10 39 6 50 6 Z';

const RING_CX = 50;
const RING_CY = 56;
const RING_R = 44;
const RING_CIRC = 2 * Math.PI * RING_R;

function ProgressRing({ theme, ringDash, show }) {
    if (!show) return null;
    return (
        <svg
            className="gift-shield-visual__ring-svg"
            viewBox="0 0 100 112"
            role="presentation"
            aria-hidden
        >
            <circle
                cx={RING_CX}
                cy={RING_CY}
                r={RING_R}
                fill="none"
                stroke={theme.ringTrack}
                strokeWidth="3.5"
            />
            <circle
                cx={RING_CX}
                cy={RING_CY}
                r={RING_R}
                fill="none"
                stroke={theme.ringProgress}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={ringDash}
                transform={`rotate(-90 ${RING_CX} ${RING_CY})`}
                className="gift-shield-visual__ring-arc"
            />
        </svg>
    );
}

function ShieldSvgBody({ uid, theme, locked, completed }) {
    return (
        <svg
            className="gift-shield-visual__svg"
            viewBox="0 0 100 112"
            role="presentation"
            aria-hidden
        >
            <defs>
                <linearGradient id={`${uid}-body`} x1="30%" y1="0%" x2="70%" y2="100%">
                    <stop offset="0%" stopColor={theme.fillTop} />
                    <stop offset="48%" stopColor={theme.fillMid} />
                    <stop offset="100%" stopColor={theme.fillBottom} />
                </linearGradient>
                <linearGradient id={`${uid}-shine`} x1="50%" y1="0%" x2="50%" y2="100%">
                    <stop offset="0%" stopColor={theme.highlight} stopOpacity="0.9" />
                    <stop offset="55%" stopColor={theme.highlight} stopOpacity="0" />
                </linearGradient>
                <filter id={`${uid}-shadow`} x="-20%" y="-20%" width="140%" height="150%">
                    <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor={theme.shadow} floodOpacity="0.85" />
                </filter>
                <clipPath id={`${uid}-clip`}>
                    <path d={GIFT_SHIELD_PATH} />
                </clipPath>
            </defs>
            {locked ? (
                <path
                    d={GIFT_SHIELD_PATH}
                    fill="rgba(255,255,255,0.03)"
                    stroke="rgba(255,255,255,0.16)"
                    strokeWidth="2"
                    className="gift-shield-visual__outline"
                />
            ) : (
                <g filter={`url(#${uid}-shadow)`}>
                    <path
                        d={GIFT_SHIELD_PATH}
                        fill={`url(#${uid}-body)`}
                        stroke={theme.rim}
                        strokeWidth="2"
                    />
                    <ellipse
                        cx="50"
                        cy="38"
                        rx="18"
                        ry="14"
                        fill={`url(#${uid}-shine)`}
                        clipPath={`url(#${uid}-clip)`}
                        opacity="0.85"
                    />
                    <path
                        d="M50 22 L58 38 L50 52 L42 38 Z"
                        fill="rgba(255,255,255,0.12)"
                        stroke="rgba(255,255,255,0.22)"
                        strokeWidth="0.8"
                        opacity={completed ? 0.55 : 0.35}
                    />
                    {completed ? (
                        <path
                            d="M38 56 L46 64 L64 44"
                            fill="none"
                            stroke="#fff"
                            strokeWidth="4.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity="0.92"
                        />
                    ) : null}
                </g>
            )}
        </svg>
    );
}

/**
 * Gift-shield model — PNG from `public/gift-shields/` when available, SVG fallback otherwise.
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
    const imageSrc = getGiftShieldImageSrc(theme);
    const [imageFailed, setImageFailed] = useState(false);
    const locked = state === 'locked';
    const completed = state === 'completed';
    const active = state === 'active' || state === 'active-second';
    const clampedProgress = Math.max(0, Math.min(100, Number(progressPct) || 0));
    const useImage = Boolean(imageSrc) && !imageFailed;

    const ringDash = useMemo(() => {
        const filled = (RING_CIRC * clampedProgress) / 100;
        return `${filled} ${RING_CIRC - filled}`;
    }, [clampedProgress]);

    const showRing = active && !locked;

    return (
        <div
            className={`gift-shield-visual gift-shield-visual--${state} gift-shield-visual--${tierId}${useImage ? ' gift-shield-visual--image' : ''} ${className}`.trim()}
            style={{
                width: size,
                height: size,
                ['--shield-glow']: theme.glow,
            }}
        >
            <ProgressRing theme={theme} ringDash={ringDash} show={showRing} />

            {showSecondGhost && useImage ? (
                <img
                    className="gift-shield-visual__img gift-shield-visual__img--ghost"
                    src={imageSrc}
                    alt=""
                    draggable={false}
                />
            ) : null}

            {useImage ? (
                <img
                    className="gift-shield-visual__img"
                    src={imageSrc}
                    alt=""
                    draggable={false}
                    onError={() => setImageFailed(true)}
                />
            ) : (
                <ShieldSvgBody uid={uid} theme={theme} locked={locked} completed={completed} />
            )}
        </div>
    );
}
