import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ALL_POLES, AXES } from './tastescopeData';

/**
 * TasteScope intro screen. Preloads all 20 pole images so the rounds feel
 * instant, then hands control to the quiz. See TASTESCOPE_SPEC.md §7.
 */
export default function TasteScopeIntro({ hasTitle, canRetake, daysUntilRetake, onStart, onViewTitle }) {
  const { t } = useTranslation();

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
        {t('tastescope.intro.title', 'اكتشف لقبك الغذائي')}
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
        disabled={hasTitle && !canRetake}
        style={{
          display: 'block', width: '100%', padding: '14px 18px', borderRadius: 14,
          border: hasTitle ? '1.5px solid var(--border-color, #e5e7eb)' : 'none',
          background: hasTitle ? 'transparent' : 'var(--primary, #ef4444)',
          color: hasTitle ? 'var(--text-main)' : '#fff',
          fontSize: '1rem', fontWeight: 800,
          cursor: hasTitle && !canRetake ? 'not-allowed' : 'pointer',
          opacity: hasTitle && !canRetake ? 0.55 : 1,
        }}
      >
        {!hasTitle
          ? t('tastescope.intro.start', 'ابدأ')
          : canRetake
            ? t('tastescope.intro.retake', 'أعد الاختبار')
            : t('tastescope.profile.retakeIn', { days: daysUntilRetake, defaultValue: `أعد الاختبار بعد ${daysUntilRetake} يوم` })}
      </button>
    </div>
  );
}
