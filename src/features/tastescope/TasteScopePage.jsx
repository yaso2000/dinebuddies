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
 * TasteScope route container (`/tastescope`): intro → quiz → generating → result.
 * Finishing the quiz runs a server test that generates the whole profile
 * (title + reading + cover) at once. First is free; a retake is free once every
 * 90 days, else 150 credits; max 5/day. See TASTESCOPE_SPEC Appendix A (v2).
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
    tasteScope, hasTitle, freeAvailable, retakePrice, canTest, testsRemainingToday, runTest,
  } = useTasteScope();

  const [phase, setPhase] = useState('intro'); // 'intro' | 'quiz' | 'generating' | 'result'
  const [result, setResult] = useState(null);  // { titleId, runnerUpId, answers }

  const handleComplete = async (answers) => {
    const { titleId, runnerUpId } = computeTitle(answers);
    const prevTitleId = tasteScope?.titleId || null;
    setResult({ titleId, runnerUpId, answers });
    setPhase('generating');

    const res = await runTest({ answers, titleId, runnerUpId, style: 'cinematic', locale: isArabic ? 'ar' : 'en' });
    if (res.ok) {
      const finalTitle = res.titleId || titleId;
      setResult({ titleId: finalTitle, runnerUpId: res.runnerUpId || runnerUpId, answers });
      setPhase('result');
      if (prevTitleId && prevTitleId !== finalTitle) {
        showToast(
          t('tastescope.changed', {
            from: titleName(t, prevTitleId, gender, isArabic),
            to: titleName(t, finalTitle, gender, isArabic),
            defaultValue: `لقبك تغيّر من ${titleName(t, prevTitleId, gender, isArabic)} إلى ${titleName(t, finalTitle, gender, isArabic)}`,
          }),
          'success',
        );
      }
      return;
    }
    // Failure — nothing was charged.
    if (res.reason === 'insufficient_credits') {
      showToast(t('tastescope.gen.insufficientRetake', { n: retakePrice, defaultValue: `رصيدك لا يكفي (${retakePrice} كريدت)` }), 'error');
    } else if (res.reason === 'daily_limit') {
      showToast(t('tastescope.intro.dailyLimit', 'بلغت الحدّ اليومي (5)'), 'error');
    } else {
      showToast(t('tastescope.gen.failed', 'تعذّر الإنشاء، لم يُخصم شيء'), 'error');
    }
    setPhase(hasTitle ? 'intro' : 'intro');
  };

  const viewStoredTitle = () => {
    if (!tasteScope?.titleId) return;
    setResult({ titleId: tasteScope.titleId, runnerUpId: tasteScope.runnerUpId, answers: tasteScope.answers });
    setPhase('result');
  };

  const goBack = () => {
    if (phase === 'result') { setPhase('intro'); return; }
    navigate(-1);
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-body)' }} dir={i18n.dir()}>
      {phase !== 'quiz' && phase !== 'generating' && (
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
          freeAvailable={freeAvailable}
          retakePrice={retakePrice}
          canTest={canTest}
          testsRemainingToday={testsRemainingToday}
          onStart={() => setPhase('quiz')}
          onViewTitle={viewStoredTitle}
        />
      )}

      {phase === 'quiz' && (
        <TasteScopeQuiz onComplete={handleComplete} onExit={() => setPhase('intro')} />
      )}

      {phase === 'generating' && (
        <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, textAlign: 'center' }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', border: '4px solid var(--border-color, #e5e7eb)', borderTopColor: 'var(--primary, #ef4444)', animation: 'tsSpin 0.9s linear infinite' }} />
          <style>{'@keyframes tsSpin{to{transform:rotate(360deg)}}'}</style>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {t('tastescope.generatingProfile', 'جارٍ تجهيز ملفك الغذائي…')}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #6b7280)' }}>
            {t('tastescope.generatingHint', 'نرسم غلافك ونكتب قراءتك — لحظات')}
          </div>
        </div>
      )}

      {phase === 'result' && result && (
        <TasteScopeResult
          titleId={result.titleId}
          runnerUpId={result.runnerUpId}
          answers={result.answers}
          gender={gender}
          canRetake={canTest}
          onRetake={() => setPhase('quiz')}
          onDone={() => navigate('/profile')}
        />
      )}
    </div>
  );
}
