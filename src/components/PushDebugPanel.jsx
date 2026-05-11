import React, { useEffect, useState } from 'react';

/** Substrings that identify push-related diagnostic lines to mirror into the panel. */
const PUSH_DEBUG_MARKERS = ['[PushStep', '[PushError', '[PushStep abort', '[StandaloneCheck', '[iOS DEBUG'];

function pushDebugLineMatches(text) {
    return PUSH_DEBUG_MARKERS.some((m) => text.includes(m));
}

function formatConsoleArgs(args) {
    return args.map((a) => {
        if (a instanceof Error) {
            return `${a.name}: ${a.message}`;
        }
        if (typeof a === 'string') return a;
        try {
            return JSON.stringify(a);
        } catch {
            return String(a);
        }
    }).join(' ');
}

function isPushDebugEnabled() {
    if (typeof window === 'undefined') return false;
    try {
        const q = new URLSearchParams(window.location.search).get('pushdebug');
        if (q === '1') return true;
        return localStorage.getItem('dbPushDebug') === '1';
    } catch {
        return false;
    }
}

const PANEL_STYLE = {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '32vh',
    overflow: 'auto',
    zIndex: 2147483000,
    margin: 0,
    padding: '8px 10px',
    fontSize: '11px',
    lineHeight: 1.35,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    background: 'rgba(15, 23, 42, 0.94)',
    color: '#e2e8f0',
    borderTop: '1px solid rgba(148, 163, 184, 0.45)',
    boxShadow: '0 -4px 24px rgba(0,0,0,0.35)',
    WebkitOverflowScrolling: 'touch',
};

const LABEL_STYLE = {
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#94a3b8',
    marginBottom: '6px',
};

/**
 * Temporary on-screen mirror of push-related console output (opt-in via ?pushdebug=1 or localStorage.dbPushDebug === '1').
 * Does not alter notification behavior — only wraps console when enabled.
 */
export default function PushDebugPanel() {
    const [enabled] = useState(() => isPushDebugEnabled());
    const [lines, setLines] = useState(() => []);

    useEffect(() => {
        if (!enabled) return undefined;

        const origLog = console.log.bind(console);
        const origWarn = console.warn.bind(console);
        const origError = console.error.bind(console);

        const pushLine = (level, args) => {
            const text = formatConsoleArgs(args);
            if (!pushDebugLineMatches(text)) return;
            const ts = new Date().toISOString().slice(11, 23);
            const row = `${ts} [${level}] ${text}`;
            setLines((prev) => {
                const next = prev.length >= 120 ? prev.slice(-119) : prev.slice();
                next.push(row);
                return next;
            });
        };

        console.log = (...args) => {
            pushLine('log', args);
            origLog(...args);
        };
        console.warn = (...args) => {
            pushLine('warn', args);
            origWarn(...args);
        };
        console.error = (...args) => {
            pushLine('error', args);
            origError(...args);
        };

        return () => {
            console.log = origLog;
            console.warn = origWarn;
            console.error = origError;
        };
    }, [enabled]);

    useEffect(() => {
        if (!enabled || lines.length === 0) return;
        // Keep latest entries in view on iOS small panels
        requestAnimationFrame(() => {
            const el = document.getElementById('push-debug-panel-scroll');
            if (el) el.scrollTop = el.scrollHeight;
        });
    }, [enabled, lines]);

    if (!enabled) return null;

    return (
        <div id="push-debug-panel" style={PANEL_STYLE} aria-label="Push debug log">
            <div style={LABEL_STYLE}>Push debug (remove ?pushdebug=1 or localStorage.dbPushDebug)</div>
            <pre
                id="push-debug-panel-scroll"
                style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
                {lines.join('\n')}
            </pre>
        </div>
    );
}
