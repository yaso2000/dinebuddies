import React from 'react';

/**
 * Lightweight animated SVG per category (CSS keyframes in PrivateInvitationCardPreview.css).
 * Replace internals later with Lottie or richer assets without changing the public API.
 */
const SIZE = 52;

function SvgWrap({ children, categoryId }) {
    return (
        <span className={`private-card-cat-icon private-card-cat-icon--${categoryId}`} aria-hidden="true">
            <svg width={SIZE} height={SIZE} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                {children}
            </svg>
        </span>
    );
}

export default function PrivateCardCategoryIcon({ categoryId = 'social' }) {
    const id = typeof categoryId === 'string' ? categoryId.toLowerCase() : 'social';

    switch (id) {
        case 'birthday':
            return (
                <SvgWrap categoryId={id}>
                    <ellipse cx="24" cy="38" rx="14" ry="4" fill="currentColor" opacity="0.25" />
                    <rect x="14" y="18" width="20" height="16" rx="3" fill="currentColor" opacity="0.9" />
                    <path d="M24 10v8M18 14h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="20" cy="12" r="2" fill="currentColor" />
                    <circle cx="28" cy="12" r="2" fill="currentColor" />
                </SvgWrap>
            );
        case 'work':
            return (
                <SvgWrap categoryId={id}>
                    <rect x="10" y="14" width="28" height="22" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path d="M10 20h28" stroke="currentColor" strokeWidth="2" />
                    <rect x="18" y="24" width="12" height="8" rx="1" fill="currentColor" opacity="0.85" />
                </SvgWrap>
            );
        case 'nightlife':
            return (
                <SvgWrap categoryId={id}>
                    <path d="M8 36 L16 12 L24 28 L32 12 L40 36" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                    <circle cx="36" cy="10" r="3" fill="currentColor" className="private-card-cat-spark" />
                </SvgWrap>
            );
        case 'dining':
            return (
                <SvgWrap categoryId={id}>
                    <ellipse cx="24" cy="36" rx="12" ry="3" fill="currentColor" opacity="0.2" />
                    <path d="M16 14h16v12a8 8 0 01-16 0V14z" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path d="M20 10v4M28 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </SvgWrap>
            );
        case 'cafe':
            return (
                <SvgWrap categoryId={id}>
                    <path d="M12 18h20v14a6 6 0 01-6 6H18a6 6 0 01-6-6V18z" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path d="M32 22h4a3 3 0 010 6h-4" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path d="M14 10c2-4 6-4 8 0" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.7" className="private-card-cat-steam" />
                </SvgWrap>
            );
        case 'gaming':
            return (
                <SvgWrap categoryId={id}>
                    <rect x="8" y="16" width="32" height="20" rx="4" stroke="currentColor" strokeWidth="2" fill="none" />
                    <circle cx="18" cy="26" r="3" fill="currentColor" />
                    <circle cx="30" cy="26" r="3" fill="currentColor" />
                    <path d="M22 26h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </SvgWrap>
            );
        case 'family':
            return (
                <SvgWrap categoryId={id}>
                    <circle cx="18" cy="18" r="5" stroke="currentColor" strokeWidth="2" fill="none" />
                    <circle cx="30" cy="18" r="5" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path d="M12 38c0-6 5-10 12-10s12 4 12 10" stroke="currentColor" strokeWidth="2" fill="none" />
                </SvgWrap>
            );
        case 'celebration':
            return (
                <SvgWrap categoryId={id}>
                    <path d="M10 38 L24 8 L38 38 Z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
                    <circle cx="24" cy="16" r="3" fill="currentColor" className="private-card-cat-spark" />
                </SvgWrap>
            );
        case 'cinema':
            return (
                <SvgWrap categoryId={id}>
                    <rect x="8" y="14" width="32" height="22" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                    <circle cx="24" cy="25" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path d="M12 18h4M32 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </SvgWrap>
            );
        case 'sports':
            return (
                <SvgWrap categoryId={id}>
                    <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path d="M10 24h28M24 10c4 8 4 20 0 28" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
                </SvgWrap>
            );
        case 'concert':
        case 'singing':
        case 'bbq':
            return (
                <SvgWrap categoryId="concert">
                    <rect x="20" y="10" width="8" height="12" rx="4" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path d="M24 22v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M18 27h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M24 27v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path
                        d="M14 16c0 5.5 4.5 10 10 10s10-4.5 10-10"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                        className="private-card-cat-note"
                    />
                </SvgWrap>
            );
        case 'dating':
            return (
                <SvgWrap categoryId={id}>
                    <path
                        d="M24 36c-8-9-16-14-16-22a8 8 0 0116-4 8 8 0 0116 4c0 8-8 13-16 22z"
                        fill="currentColor"
                        opacity="0.88"
                    />
                </SvgWrap>
            );
        case 'social':
        default:
            return (
                <SvgWrap categoryId="social">
                    <circle cx="16" cy="20" r="5" stroke="currentColor" strokeWidth="2" fill="none" />
                    <circle cx="32" cy="20" r="5" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path d="M8 38c0-7 6-12 16-12s16 5 16 12" stroke="currentColor" strokeWidth="2" fill="none" />
                </SvgWrap>
            );
    }
}
