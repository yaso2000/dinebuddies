/**
 * TasteScope — read the current user's result and run/restyle tests via server
 * callables. Each test generates the full profile (title + reading + cover) at
 * once: free once every 90 days, otherwise 150 credits, max 5 tests/day. One
 * free cover restyle per test. See TASTESCOPE_SPEC Appendix A (v2).
 */
import { useCallback, useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { AXES } from './tastescopeData';

const functions = getFunctions(app, 'us-central1');
const DAY_MS = 24 * 60 * 60 * 1000;
export const RETAKE_PRICE = 150;
export const DAILY_LIMIT = 5;

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
  const { currentUser } = useAuth();
  const { userProfile } = useAuth();
  const [busy, setBusy] = useState(false);

  const tasteScope = userProfile?.tasteScope || null;

  const derived = useMemo(() => {
    const now = Date.now();
    const hasTitle = Boolean(tasteScope?.titleId);
    const freeAt = toMillis(tasteScope?.freeRetakeAt);
    const freeAvailable = !hasTitle || !freeAt || now >= freeAt;
    const daysUntilFree = freeAvailable ? 0 : Math.ceil((freeAt - now) / DAY_MS);
    const today = new Date().toISOString().slice(0, 10);
    const testsToday = tasteScope?.testDay === today ? (Number(tasteScope?.testDayCount) || 0) : 0;
    const testsRemainingToday = Math.max(0, DAILY_LIMIT - testsToday);
    return {
      hasTitle,
      freeAvailable,
      daysUntilFree,
      retakePrice: freeAvailable ? 0 : RETAKE_PRICE,
      testsRemainingToday,
      canTest: testsRemainingToday > 0,
      coverRestyleUsed: Boolean(tasteScope?.coverRestyleUsed),
      visibility: tasteScope?.visibility || 'public',
    };
  }, [tasteScope]);

  /** Run a full test: server generates title+reading+cover and charges if paid. */
  const runTest = useCallback(async ({ answers, titleId, runnerUpId, style = 'cinematic', locale }) => {
    if (!currentUser?.uid) return { ok: false, reason: 'not_signed_in' };
    if (!isValidAnswers(answers)) return { ok: false, reason: 'invalid_answers' };
    setBusy(true);
    try {
      const res = await httpsCallable(functions, 'tastescopeRunTest')({ answers, titleId, runnerUpId, style, locale });
      return res?.data || { ok: false, reason: 'failed' };
    } catch {
      return { ok: false, reason: 'failed' };
    } finally {
      setBusy(false);
    }
  }, [currentUser]);

  /** One free cover restyle per test. */
  const restyleCover = useCallback(async (style, locale) => {
    if (!currentUser?.uid) return { ok: false, reason: 'not_signed_in' };
    try {
      const res = await httpsCallable(functions, 'tastescopeRestyleCover')({ style, locale });
      return res?.data || { ok: false, reason: 'failed' };
    } catch {
      return { ok: false, reason: 'failed' };
    }
  }, [currentUser]);

  /** public | friends | hidden */
  const setVisibility = useCallback(async (v) => {
    const uid = currentUser?.uid;
    if (!uid) return { ok: false };
    const val = ['public', 'friends', 'hidden'].includes(v) ? v : 'public';
    try {
      await updateDoc(doc(db, 'users', uid), { 'tasteScope.visibility': val });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }, [currentUser]);

  return {
    tasteScope,
    titleId: tasteScope?.titleId || null,
    runnerUpId: tasteScope?.runnerUpId || null,
    answers: tasteScope?.answers || null,
    ...derived,
    busy,
    runTest,
    restyleCover,
    setVisibility,
  };
}

export default useTasteScope;
