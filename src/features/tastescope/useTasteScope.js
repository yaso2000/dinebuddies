/**
 * TasteScope — read/write the current user's result on users/{uid}.tasteScope,
 * with the 90-day retake gate. See TASTESCOPE_SPEC.md §6.
 *
 * The stored shape:
 *   tasteScope: { version, titleId, runnerUpId, answers{10}, takenAt,
 *                 retakeAvailableAt, history[≤5] }
 * Display form (gendered Arabic) is resolved at render time from titleId only.
 */
import { useCallback, useMemo, useState } from 'react';
import { doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { TASTESCOPE_VERSION, AXES, TITLE_IDS } from './tastescopeData';

const DAY_MS = 24 * 60 * 60 * 1000;
const RETAKE_COOLDOWN_MS = 90 * DAY_MS;
const HISTORY_LIMIT = 5;

const toMillis = (v) => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  const parsed = Date.parse(v);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Answers are valid iff they cover exactly the 10 axes, each with one of its poles. */
export function isValidAnswers(answers) {
  if (!answers || typeof answers !== 'object') return false;
  const keys = Object.keys(answers);
  if (keys.length !== AXES.length) return false;
  return AXES.every((axis) => axis.poles.includes(answers[axis.id]));
}

export function useTasteScope() {
  const { currentUser, userProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const tasteScope = userProfile?.tasteScope || null;

  const derived = useMemo(() => {
    const hasTitle = Boolean(tasteScope?.titleId);
    const retakeAt = toMillis(tasteScope?.retakeAvailableAt);
    const now = Date.now();
    const canRetake = !hasTitle || retakeAt === 0 || retakeAt <= now;
    const daysUntilRetake = canRetake ? 0 : Math.ceil((retakeAt - now) / DAY_MS);
    return { hasTitle, canRetake, daysUntilRetake };
  }, [tasteScope]);

  /**
   * Persist a completed quiz. Returns { ok, changed, from, to } — `changed`/`from`
   * power the "your title changed from X to Y" moment.
   * @param {{ answers, titleId, runnerUpId }} result
   */
  const saveResult = useCallback(
    async ({ answers, titleId, runnerUpId }) => {
      const uid = currentUser?.uid;
      if (!uid) return { ok: false, reason: 'not_signed_in' };
      if (!isValidAnswers(answers)) return { ok: false, reason: 'invalid_answers' };
      if (!TITLE_IDS.includes(titleId)) return { ok: false, reason: 'invalid_title' };
      if (!derived.canRetake) return { ok: false, reason: 'retake_locked', daysUntilRetake: derived.daysUntilRetake };

      const prevTitleId = tasteScope?.titleId || null;
      const now = Date.now();
      // History entries can't hold serverTimestamp sentinels (they live in an array),
      // so store plain ms; keep the last HISTORY_LIMIT including this take.
      const prevHistory = Array.isArray(tasteScope?.history) ? tasteScope.history : [];
      const history = [...prevHistory, { titleId, takenAt: now }].slice(-HISTORY_LIMIT);

      const payload = {
        version: TASTESCOPE_VERSION,
        titleId,
        runnerUpId: TITLE_IDS.includes(runnerUpId) ? runnerUpId : null,
        answers,
        takenAt: serverTimestamp(),
        retakeAvailableAt: Timestamp.fromMillis(now + RETAKE_COOLDOWN_MS),
        history,
      };

      setSaving(true);
      setError(null);
      try {
        await updateDoc(doc(db, 'users', uid), { tasteScope: payload });
        return { ok: true, changed: Boolean(prevTitleId && prevTitleId !== titleId), from: prevTitleId, to: titleId };
      } catch (e) {
        setError(e);
        return { ok: false, reason: 'write_failed' };
      } finally {
        setSaving(false);
      }
    },
    [currentUser, tasteScope, derived.canRetake, derived.daysUntilRetake]
  );

  return {
    tasteScope,
    titleId: tasteScope?.titleId || null,
    runnerUpId: tasteScope?.runnerUpId || null,
    answers: tasteScope?.answers || null,
    hasTitle: derived.hasTitle,
    canRetake: derived.canRetake,
    daysUntilRetake: derived.daysUntilRetake,
    saving,
    error,
    saveResult,
  };
}

export default useTasteScope;
