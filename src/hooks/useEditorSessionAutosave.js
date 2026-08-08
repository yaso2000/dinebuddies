import { useCallback, useEffect, useRef } from 'react';
import {
    clearEditorSessionDraft,
    readEditorSessionDraft,
    writeEditorSessionDraft,
} from '../utils/editorSessionDraft';

/**
 * Persist editor state to sessionStorage and restore on return.
 *
 * @param {{
 *   enabled?: boolean;
 *   storageKey: string | null;
 *   ready?: boolean;
 *   skipRestore?: boolean;
 *   buildPayload: () => object | Promise<object>;
 *   buildSyncPayload?: () => object | null;
 *   applyPayload: (payload: object) => void | Promise<void>;
 *   isEmpty: (payload: object) => boolean;
 *   onRestored?: () => void;
 *   debounceMs?: number;
 *   deps?: unknown[];
 * }} options
 */
export function useEditorSessionAutosave({
    enabled = true,
    storageKey,
    ready = true,
    skipRestore = false,
    buildPayload,
    buildSyncPayload,
    applyPayload,
    isEmpty,
    onRestored,
    debounceMs = 500,
    deps = [],
}) {
    const hydratedRef = useRef(false);
    /** Set after clearDraft (discard/publish) so unmount/visibility flushes don't resurrect the draft. */
    const suppressedRef = useRef(false);
    const buildRef = useRef(buildPayload);
    const buildSyncRef = useRef(buildSyncPayload);
    const applyRef = useRef(applyPayload);
    const isEmptyRef = useRef(isEmpty);
    const onRestoredRef = useRef(onRestored);

    buildRef.current = buildPayload;
    buildSyncRef.current = buildSyncPayload;
    applyRef.current = applyPayload;
    isEmptyRef.current = isEmpty;
    onRestoredRef.current = onRestored;

    const flushSaveSync = useCallback(() => {
        if (!enabled || !storageKey || !ready || suppressedRef.current) return;
        try {
            const payload = buildSyncRef.current?.() ?? null;
            if (!payload || isEmptyRef.current(payload)) {
                clearEditorSessionDraft(storageKey);
                return;
            }
            writeEditorSessionDraft(storageKey, payload);
        } catch {
            /* ignore snapshot errors */
        }
    }, [enabled, ready, storageKey]);

    const flushSave = useCallback(async () => {
        if (!enabled || !storageKey || !ready || suppressedRef.current) return;
        try {
            const payload = await buildRef.current();
            if (!payload || isEmptyRef.current(payload)) {
                clearEditorSessionDraft(storageKey);
                return;
            }
            writeEditorSessionDraft(storageKey, payload);
        } catch {
            /* ignore snapshot errors */
        }
    }, [enabled, ready, storageKey]);

    const clearDraft = useCallback(() => {
        suppressedRef.current = true;
        if (storageKey) clearEditorSessionDraft(storageKey);
    }, [storageKey]);

    useEffect(() => {
        if (!enabled || !storageKey || !ready || skipRestore || hydratedRef.current) return;

        let cancelled = false;
        hydratedRef.current = true;

        (async () => {
            const saved = readEditorSessionDraft(storageKey);
            if (!saved || isEmptyRef.current(saved)) return;
            try {
                await applyRef.current(saved);
                if (!cancelled) onRestoredRef.current?.();
            } catch {
                /* ignore restore errors */
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [enabled, ready, skipRestore, storageKey]);

    useEffect(() => {
        if (!enabled || !storageKey || !ready) return undefined;

        const timer = window.setTimeout(() => {
            void flushSave();
        }, debounceMs);

        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- caller passes editor state via deps
    }, [debounceMs, enabled, flushSave, ready, storageKey, ...deps]);

    useEffect(() => {
        if (!enabled || !storageKey || !ready) return undefined;

        const onHide = () => {
            if (document.visibilityState === 'hidden') {
                flushSaveSync();
                void flushSave();
            }
        };

        const onPageHide = () => {
            flushSaveSync();
            void flushSave();
        };

        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('pagehide', onPageHide);

        return () => {
            document.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('pagehide', onPageHide);
            flushSaveSync();
            void flushSave();
        };
    }, [enabled, flushSave, flushSaveSync, ready, storageKey]);

    return { clearDraft, flushSave, flushSaveSync };
}
