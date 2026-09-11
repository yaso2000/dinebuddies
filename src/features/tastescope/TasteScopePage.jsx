import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { normalizeUserGender } from '../../utils/avatarUtils';
import { AppText } from '../../components/base';
import { computeTitle } from './computeTitle';
import { titleName } from './titleDisplay';
import useTasteScope from './useTasteScope';
import TasteScopeIntro from './TasteScopeIntro';
import TasteScopeQuiz from './TasteScopeQuiz';
import TasteScopeResult from './TasteScopeResult';

/**
 * TasteScope route container (`/tastescope`): intro → quiz → result state
 * machine. Owns persistence (via useTasteScope) and gender resolution; the
 * screens stay presentational. See TASTESCOPE_SPEC.md §7, §11 (step 3).
 */
export default function TasteScopePage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const rtl = i18n.dir() === 'rtl';
  const isArabic = (i18n.language || 'ar').startsWith('ar');
  const { userProfile } = useAuth();
  const { showToast } = useToast();
  const gender = normalizeUserGender(userProfile);

  const {
    tasteScope, hasTitle, canRetake, daysUntilRetake, saving, saveResult,
  } = useTasteScope();

  const [phase, setPhase] = useState('intro'); // 'intro' | 'quiz' | 'result'
  const [result, setResult] = useState(null);  // { titleId, runnerUpId, answers }
  const [saved, setSaved] = useState(false);

  const handleComplete = async (answers) => {
    const { titleId, runnerUpId } = computeTitle(answers);
    setResult({ titleId, runnerUpId, answers });
    setSaved(false);
    setPhase('result');

    const res = await saveResult({ answers, titleId, runnerUpId });
    if (res.ok) {
      setSaved(true);
      if (res.changed && res.from) {
        showToast(
          t('tastescope.changed', {
            from: titleName(t, res.from, gender, isArabic),
            to: titleName(t, titleId, gender, isArabic),
            defaultValue: `لقبك تغيّر من ${titleName(t, res.from, gender, isArabic)} إلى ${titleName(t, titleId, gender, isArabic)}`,
          }),
          'success',
        );
      }
    } else if (res.reason === 'retake_locked') {
      showToast(t('tastescope.profile.retakeIn', { days: res.daysUntilRetake, defaultValue: `أعد الاختبار بعد ${res.daysUntilRetake} يوم` }), 'info');
    } else if (res.reason === 'write_failed') {
      showToast(t('tastescope.result.saveError', 'تعذّر الحفظ، حاول مرة أخرى'), 'error');
    }
  };

  const viewStoredTitle = () => {
    if (!tasteScope?.titleId) return;
    setResult({ titleId: tasteScope.titleId, runnerUpId: tasteScope.runnerUpId, answers: tasteScope.answers });
    setSaved(true);
    setPhase('result');
  };

  const goBack = () => {
    if (phase === 'result') { setPhase('intro'); return; }
    navigate(-1);
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-body)' }} dir={i18n.dir()}>
      {phase !== 'quiz' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(14px + env(safe-area-inset-top, 0px)) 16px 14px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
          <button type="button" onClick={goBack} aria-label={t('back', 'رجوع')} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1.2rem', cursor: 'pointer' }}>
            <FaChevronLeft style={{ transform: rtl ? 'scaleX(-1)' : 'none' }} />
          </button>
          <AppText as="h2" style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{t('tastescope.name', 'TasteScope')}</AppText>
        </div>
      )}

      {phase === 'intro' && (
        <TasteScopeIntro
          hasTitle={hasTitle}
          canRetake={canRetake}
          daysUntilRetake={daysUntilRetake}
          onStart={() => setPhase('quiz')}
          onViewTitle={viewStoredTitle}
        />
      )}

      {phase === 'quiz' && (
        <TasteScopeQuiz onComplete={handleComplete} onExit={() => setPhase('intro')} />
      )}

      {phase === 'result' && result && (
        <TasteScopeResult
          titleId={result.titleId}
          runnerUpId={result.runnerUpId}
          answers={result.answers}
          gender={gender}
          saving={saving}
          saved={saved}
          canRetake={canRetake}
          daysUntilRetake={daysUntilRetake}
          onRetake={() => setPhase('quiz')}
          onDone={() => navigate('/profile')}
        />
      )}
    </div>
  );
}
