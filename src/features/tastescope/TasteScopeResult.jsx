import React from 'react';
import { useTranslation } from 'react-i18next';
import { AXES, POLE_TO_AXIS } from './tastescopeData';
import { explainTitle } from './computeTitle';
import { titleName, titleDesc, titleVisuals } from './titleDisplay';
import TasteScopeGenerate from './TasteScopeGenerate';

/**
 * TasteScope result screen: gendered title, description, "with a touch of …",
 * a strip of the 10 chosen poles, and add-to-profile / share. The result is
 * already persisted by the container; "Add to my profile" just confirms.
 * See TASTESCOPE_SPEC.md §7.
 */
export default function TasteScopeResult({ titleId, runnerUpId, answers, gender, saving, saved, onRetake, canRetake, daysUntilRetake, onDone }) {
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.language || 'ar').startsWith('ar');

  const name = titleName(t, titleId, gender, isArabic);
  const desc = titleDesc(t, titleId, gender, isArabic);
  const { emoji, accent } = titleVisuals(titleId);
  const runnerUpName = runnerUpId ? titleName(t, runnerUpId, gender, isArabic) : '';

  // 10 chosen poles in canonical axis order (the screenshot strip).
  const chips = AXES
    .map((axis) => answers?.[axis.id])
    .filter(Boolean)
    .map((pole) => ({ pole, axisId: POLE_TO_AXIS[pole] }));

  // The picks that actually define this title — the "why you got this name".
  const definingPoles = explainTitle(answers, titleId).matched;

  const share = async () => {
    const text = isArabic
      ? `لقبي الغذائي في DineBuddies: ${name} ${emoji}`
      : `My taste title on DineBuddies: ${name} ${emoji}`;
    try {
      if (navigator.share) await navigator.share({ title: t('tastescope.name', 'TasteScope'), text });
      else if (navigator.clipboard) await navigator.clipboard.writeText(text);
    } catch { /* user cancelled share — ignore */ }
  };

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '28px 22px calc(40px + env(safe-area-inset-bottom, 0px))', textAlign: 'center' }}>
      <div style={{ fontSize: '4rem', lineHeight: 1, marginBottom: 8 }}>{emoji}</div>
      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-tertiary, #9ca3af)', marginBottom: 4 }}>
        {t('tastescope.result.youAre', 'لقبك الغذائي')}
      </div>
      <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: '0 0 12px', color: accent }}>{name}</h1>
      <p style={{ fontSize: '1.02rem', color: 'var(--text-main)', lineHeight: 1.7, margin: '0 0 8px' }}>{desc}</p>
      {runnerUpName && (
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary, #6b7280)', margin: '0 0 22px' }}>
          {t('tastescope.result.touchOf', { title: runnerUpName, defaultValue: `بلمسة من ${runnerUpName}` })}
        </p>
      )}

      {/* Why this title — the link between the picks and the name. */}
      {definingPoles.length > 0 && (
        <div style={{ textAlign: 'start', margin: '0 0 22px', padding: '14px 16px', borderRadius: 14, background: 'var(--bg-card, #f3f4f6)', border: `1px solid ${accent}33` }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: accent, marginBottom: 6 }}>
            {t('tastescope.result.why', { title: name, defaultValue: `لماذا أنت ${name}؟` })}
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.7, margin: 0 }}>
            {t('tastescope.result.whyLead', 'لأن اختياراتك مالت إلى')}{' '}
            <span style={{ fontWeight: 800 }}>
              {definingPoles.map((pole) => t(`tastescope.pole.${pole}`, pole)).join(isArabic ? '، ' : ', ')}
            </span>
            {' '}—{' '}{desc}
          </p>
        </div>
      )}

      {/* How you answered — the screenshot strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', margin: '4px 0 26px' }}>
        {chips.map(({ pole, axisId }) => (
          <span key={axisId} style={{ padding: '6px 12px', borderRadius: 999, background: 'var(--bg-card, #f3f4f6)', border: '1px solid var(--border-color, #e5e7eb)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {t(`tastescope.pole.${pole}`, pole)}
          </span>
        ))}
      </div>

      {/* Generate a personal reading + cover (Gemini; first of each is free). */}
      {saved ? <TasteScopeGenerate /> : null}

      <button
        type="button"
        onClick={onDone}
        disabled={saving}
        style={{ display: 'block', width: '100%', padding: '14px 18px', marginBottom: 12, borderRadius: 14, border: 'none', background: 'var(--primary, #ef4444)', color: '#fff', fontSize: '1rem', fontWeight: 800, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
      >
        {saving
          ? t('tastescope.result.saving', 'جارٍ الحفظ…')
          : saved
            ? t('tastescope.result.addedToProfile', 'أُضيف إلى ملفك ✓')
            : t('tastescope.result.addToProfile', 'أضِفه إلى ملفي')}
      </button>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={share}
          style={{ flex: 1, padding: '12px 16px', borderRadius: 14, border: '1.5px solid var(--border-color, #e5e7eb)', background: 'transparent', color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 800, cursor: 'pointer' }}
        >
          {t('tastescope.result.share', 'مشاركة')}
        </button>
        {canRetake && (
          <button
            type="button"
            onClick={onRetake}
            style={{ flex: 1, padding: '12px 16px', borderRadius: 14, border: '1.5px solid var(--border-color, #e5e7eb)', background: 'transparent', color: 'var(--text-secondary, #6b7280)', fontSize: '0.95rem', fontWeight: 800, cursor: 'pointer' }}
          >
            {t('tastescope.intro.retake', 'أعد الاختبار')}
          </button>
        )}
      </div>
      {!canRetake && daysUntilRetake > 0 && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary, #9ca3af)', margin: '14px 0 0' }}>
          {t('tastescope.profile.retakeIn', { days: daysUntilRetake, defaultValue: `يمكنك إعادة الاختبار بعد ${daysUntilRetake} يوم` })}
        </p>
      )}
    </div>
  );
}
