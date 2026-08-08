import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from './ToastContext';
import { classifyChatLink } from '../utils/chatLinkSafety';
import { openExternalUrl } from '../platform/externalLinks';
import './ExternalLinkGuard.css';

const ExternalLinkGuardContext = createContext(null);

const EXPLICIT_ALLOWS = new Set([
    'business_maps',
    'business_delivery',
    'product_share',
    'app_media',
    'system',
]);

/**
 * App-wide link policy:
 * - Internal DineBuddies paths → in-app navigate
 * - External URLs → blocked (anti-spam), unless caller uses openExternalUrl with an allow mode
 * - Document-level capture blocks leftover `<a target="_blank">` spam links
 */
export function ExternalLinkGuardProvider({ children }) {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { showToast } = useToast();

    const notifyBlocked = useCallback(() => {
        showToast?.(
            t(
                'external_link_blocked',
                'External links are disabled in the app to prevent spam.'
            ),
            'error'
        );
    }, [showToast, t]);

    const requestOpenLink = useCallback(
        (rawUrl, options = null) => {
            const allow =
                options && typeof options === 'object' ? options.allow || null : null;

            if (allow && EXPLICIT_ALLOWS.has(allow)) {
                const ok = openExternalUrl(rawUrl, { allow });
                if (!ok) notifyBlocked();
                return { handled: true, kind: ok ? allow : 'blocked' };
            }

            const info = classifyChatLink(rawUrl);
            if (!info) return { handled: false };

            if (info.kind === 'internal') {
                navigate(info.href);
                return { handled: true, kind: 'internal' };
            }

            notifyBlocked();
            return { handled: true, kind: 'blocked' };
        },
        [navigate, notifyBlocked]
    );

    useEffect(() => {
        const onClickCapture = (event) => {
            if (event.defaultPrevented) return;
            const anchor = event.target?.closest?.('a[href]');
            if (!anchor) return;

            const rawHref = String(anchor.getAttribute('href') || '').trim();
            if (!rawHref || rawHref === '#') return;

            const lower = rawHref.toLowerCase();
            if (
                lower.startsWith('mailto:') ||
                lower.startsWith('tel:') ||
                lower.startsWith('blob:') ||
                lower.startsWith('data:')
            ) {
                return;
            }

            if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) {
                event.preventDefault();
                event.stopPropagation();
                notifyBlocked();
                return;
            }

            const allowAttr = String(anchor.getAttribute('data-external-allow') || '').trim();
            if (allowAttr && EXPLICIT_ALLOWS.has(allowAttr)) {
                event.preventDefault();
                event.stopPropagation();
                const ok = openExternalUrl(rawHref, { allow: allowAttr });
                if (!ok) notifyBlocked();
                return;
            }

            // Same-document / relative downloads of blob previews already handled above.
            const info = classifyChatLink(rawHref);
            if (!info) {
                // Relative paths that classifyChatLink rejects — let the browser handle
                // only if clearly in-app (starts with /).
                if (rawHref.startsWith('/') && !rawHref.startsWith('//')) {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                notifyBlocked();
                return;
            }

            if (info.kind === 'internal') {
                // Keep first-party navigation inside the SPA when possible.
                if (anchor.getAttribute('target') === '_blank' || event.metaKey || event.ctrlKey) {
                    event.preventDefault();
                    event.stopPropagation();
                    navigate(info.href);
                }
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            notifyBlocked();
        };

        document.addEventListener('click', onClickCapture, true);
        return () => document.removeEventListener('click', onClickCapture, true);
    }, [navigate, notifyBlocked]);

    const value = useMemo(() => ({ requestOpenLink }), [requestOpenLink]);

    return (
        <ExternalLinkGuardContext.Provider value={value}>
            {children}
        </ExternalLinkGuardContext.Provider>
    );
}

export function useExternalLinkGuard() {
    const ctx = useContext(ExternalLinkGuardContext);
    if (!ctx) {
        return {
            requestOpenLink: (rawUrl, options = null) => {
                const allow =
                    options && typeof options === 'object' ? options.allow || null : null;
                if (allow && EXPLICIT_ALLOWS.has(allow)) {
                    const ok = openExternalUrl(rawUrl, { allow });
                    return { handled: true, kind: ok ? allow : 'blocked' };
                }
                const info = classifyChatLink(rawUrl);
                if (!info) return { handled: false };
                if (info.kind === 'internal' && typeof window !== 'undefined') {
                    window.location.assign(info.href);
                    return { handled: true, kind: 'internal' };
                }
                return { handled: true, kind: 'blocked' };
            },
        };
    }
    return ctx;
}
