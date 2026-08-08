import { AI_USER_PROMPT_MAX_CHARS } from '../constants/aiPromptLimits';

/**
 * Resolve the prompt sent to AI: manual input → form context → fallback default.
 * Always returns a string capped at {@link AI_USER_PROMPT_MAX_CHARS} (may be empty if no fallback).
 *
 * @param {{
 *   manualPrompt?: string,
 *   buildContextPrompt?: () => string,
 *   fallback?: string,
 * }} params
 */
export function resolveAiUserPrompt({ manualPrompt = '', buildContextPrompt, fallback = '' } = {}) {
    const fromManual = String(manualPrompt || '').trim();
    const fromContext =
        typeof buildContextPrompt === 'function' ? String(buildContextPrompt() || '').trim() : '';
    const resolved = fromManual || fromContext || String(fallback || '').trim();
    return resolved.slice(0, AI_USER_PROMPT_MAX_CHARS);
}
