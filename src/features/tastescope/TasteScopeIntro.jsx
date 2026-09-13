import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ALL_POLES, AXES } from './tastescopeData';

/**
 * TasteScope intro screen. Preloads all 20 pole images so the rounds feel
 * instant, then hands control to the quiz. See TASTESCOPE_SPEC.md §7.
 */
export default function TasteScopeIntro({
  hasTitle, freeAvailable = true, retakePrice = 0, canTest = true, testsRemainingToday = 5,
  onStart, onViewTitle,
}) {
  const { t } = useTranslation();

  const startLabel = !hasTitle
    ? t('tastescope.intro.start', 'ابدأ')
    : !canTest
      ? t('tastescope.intro.dailyLimit', 'بلغت الحدّ اليومي (5)')
      : freeAvailable
        ? t('tastescope.intro.retakeFree', 'أعد الاختبار (مجاناً)')
        : t('tastescope.intro.retakePaid', { n: retakePrice, defaultValue: `أعد الاختبار — ${retakePrice} كريدت` });

  // Preload every pole image up front (10 rounds × 2 = 20 files, ~100 KB each).
  useEffect(() => {
    const imgs = AXES.flatMap((axis) => ALL_POLES
      .filter((pole) => axis.image[pole])
      .map((pole) => axis.image[pole]))
      .filter(Boolean);
    imgs.forEach((src) => { const i = new Image(); i.src = src; });
  }, []);

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '32px 22px calc(40px + env(safe-area-inset-bottom, 0px))', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', lineHeight: 1, marginBottom: 14 }}>🍽️</div>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: '0 0 10px', color: 'var(--text-main)' }}>
        {t('tastescope.intro.title', 'اكتشف لقب ذوقك')}
      </h1>
      <p style={{ fontSize: '1rem', color: 'var(--text-secondary, #6b7280)', margin: '0 0 6px', lineHeight: 1.6 }}>
        {t('tastescope.intro.subtitle', 'عشر صور. اضغط ما تشتهيه. لا توجد إجابة خاطئة.')}
      </p>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary, #9ca3af)', margin: '0 0 28px' }}>
        {t('tastescope.intro.disclaimer', 'للمتعة فقط 🎈')}
      </p>

      {hasTitle && (
        <button
          type="button"
          onClick={onViewTitle}
          style={{ display: 'block', width: '100%', padding: '14px 18px', marginBottom: 12, borderRadius: 14, border: 'none', background: 'var(--primary, #ef4444)', color: '#fff', fontSize: '1rem', fontWeight: 800, cursor: 'pointer' }}
        >
          {t('tastescope.intro.viewTitle', 'اعرض لقبي')}
        </button>
      )}

      <button
        type="button"
        onClick={onStart}
        disabled={hasTitle && !canTest}
        style={{
          display: 'block', width: '100%', padding: '14px 18px', borderRadius: 14,
          border: hasTitle ? '1.5px solid var(--border-color, #e5e7eb)' : 'none',
          background: hasTitle ? 'transparent' : 'var(--primary, #ef4444)',
          color: hasTitle ? 'var(--text-main)' : '#fff',
          fontSize: '1rem', fontWeight: 800,
          cursor: hasTitle && !canTest ? 'not-allowed' : 'pointer',
          opacity: hasTitle && !canTest ? 0.55 : 1,
        }}
      >
        {startLabel}
      </button>

      {hasTitle && canTest && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary, #9ca3af)', margin: '10px 0 0' }}>
          {freeAvailable
            ? t('tastescope.intro.freeNote', 'إعادة مجانية متاحة الآن')
            : t('tastescope.intro.freeEvery', 'اختبار مجاني كل 90 يومًا')}
          {` · ${t('tastescope.intro.remainingToday', { n: testsRemainingToday, defaultValue: `${testsRemainingToday} متبقٍ اليوم` })}`}
        </p>
      )}
    </div>
  );
}
