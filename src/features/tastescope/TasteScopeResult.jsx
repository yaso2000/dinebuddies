import React from 'react';
import { useTranslation } from 'react-i18next';
import { AXES, POLE_TO_AXIS } from './tastescopeData';
import { explainTitle } from './computeTitle';
import { titleName, titleDesc } from './titleDisplay';
import TasteScopeGenerate from './TasteScopeGenerate';
import TitleGlyph from './TitleGlyph';
import useTasteScope from './useTasteScope';

/**
 * TasteScope result page (v2): the whole profile shown at once — cover + name +
 * icon + reading (via TasteScopeGenerate) plus the "why" and the chosen poles.
 * Generation already happened on quiz completion. A full scrollable page with a
 * bottom inset so nothing hides under the app's bottom bar. See Appendix A v2.
 */
export default function TasteScopeResult({ titleId, runnerUpId, answers, gender, canRetake = true, onRetake, onDone }) {
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.language || 'ar').startsWith('ar');
  const { freeAvailable, retakePrice } = useTasteScope();

  const name = titleName(t, titleId, gender, isArabic);
  const desc = titleDesc(t, titleId, gender, isArabic);
  const runnerUpName = runnerUpId ? titleName(t, runnerUpId, gender, isArabic) : '';

  const chips = AXES
    .map((axis) => answers?.[axis.id])
    .filter(Boolean)
    .map((pole) => ({ pole, axisId: POLE_TO_AXIS[pole] }));

  const definingPoles = explainTitle(answers, titleId).matched;

  const retakeLabel = !canRetake
    ? t('tastescope.intro.dailyLimit', 'بلغت الحدّ اليومي (5)')
    : freeAvailable
      ? t('tastescope.intro.retakeFree', 'أعد الاختبار (مجاناً)')
      : t('tastescope.intro.retakePaid', { n: retakePrice, defaultValue: `أعد الاختبار — ${retakePrice} كريدت` });

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 20px calc(96px + env(safe-area-inset-bottom, 0px))', textAlign: 'center' }}>
      <TitleGlyph titleId={titleId} title={name} size={112} style={{ margin: '0 auto 10px', boxShadow: '0 6px 20px rgba(0,0,0,0.12)' }} />
      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-tertiary, #9ca3af)', marginBottom: 4 }}>
        {t('tastescope.result.youAre', 'لقب ذوقك')}
      </div>
      <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: '0 0 12px' }}>{name}</h1>
      <p style={{ fontSize: '1.02rem', color: 'var(--text-main)', lineHeight: 1.7, margin: '0 0 8px' }}>{desc}</p>
      {runnerUpName && (
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary, #6b7280)', margin: '0 0 20px' }}>
          {t('tastescope.result.touchOf', { title: runnerUpName, defaultValue: `بلمسة من ${runnerUpName}` })}
        </p>
      )}

      {/* Generated cover + reading + share + restyle + visibility */}
      <TasteScopeGenerate />

      {/* Why this title */}
      {definingPoles.length > 0 && (
        <div style={{ textAlign: 'start', margin: '14px 0 18px', padding: '14px 16px', borderRadius: 14, background: 'var(--bg-card, #f3f4f6)', border: '1px solid var(--border-color, #e5e7eb)' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: 6 }}>
            {t('tastescope.result.why', { title: name, defaultValue: `لماذا أنت ${name}؟` })}
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.7, margin: 0 }}>
            {t('tastescope.result.whyLead', 'لأن اختياراتك مالت إلى')}{' '}
            <span style={{ fontWeight: 800 }}>
              {definingPoles.map((pole) => t(`tastescope.pole.${pole}`, pole)).join(isArabic ? '، ' : ', ')}
            </span>
          </p>
        </div>
      )}

      {/* How you answered */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', margin: '4px 0 22px' }}>
        {chips.map(({ pole, axisId }) => (
          <span key={axisId} style={{ padding: '6px 12px', borderRadius: 999, background: 'var(--bg-card, #f3f4f6)', border: '1px solid var(--border-color, #e5e7eb)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {t(`tastescope.pole.${pole}`, pole)}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={onDone}
        style={{ display: 'block', width: '100%', padding: '14px 18px', marginBottom: 12, borderRadius: 14, border: 'none', background: 'var(--primary, #ef4444)', color: '#fff', fontSize: '1rem', fontWeight: 800, cursor: 'pointer' }}
      >
        {t('tastescope.result.done', 'تم')}
      </button>

      <button
        type="button"
        onClick={onRetake}
        disabled={!canRetake}
        style={{ display: 'block', width: '100%', padding: '12px 16px', borderRadius: 14, border: '1.5px solid var(--border-color, #e5e7eb)', background: 'transparent', color: 'var(--text-secondary, #6b7280)', fontSize: '0.95rem', fontWeight: 800, cursor: canRetake ? 'pointer' : 'not-allowed', opacity: canRetake ? 1 : 0.55 }}
      >
        {retakeLabel}
      </button>
    </div>
  );
}
