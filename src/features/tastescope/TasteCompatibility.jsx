import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { AXES } from './tastescopeData';
import { computeCompatibility } from './computeCompatibility';

/** Interim Arabic defaults (real i18n arrives in Step 6). */
const AXIS_LABEL_AR = {
  adventure: 'المغامرة', heat: 'الحدّة', ritual: 'الطقس', social: 'الاجتماعية',
  rhythm: 'الإيقاع', simplicity: 'البساطة', sweetness: 'الحلاوة', origin: 'الأصل',
  sugar: 'السكر', sharing: 'المشاركة',
};
const INVITE_LABEL_AR = {
  breakfast: 'فطور', lateDinner: 'عشاء متأخر', groupTable: 'طاولة جماعية',
  fineDining: 'عشاء فاخر', cafe: 'مقهى', dinnerForTwo: 'عشاء لشخصين',
};

const hasTaste = (ts) => Boolean(ts && ts.titleId && ts.answers && typeof ts.answers === 'object');

/**
 * Taste-compatibility strip, shown on ANOTHER user's profile only.
 *   - both viewer & viewed have a title → the match line + a tappable sheet.
 *   - viewer has none (viewed does) → a one-line nudge to take the quiz.
 *   - viewed has none → nothing.
 * Reuses already-loaded data (no extra reads). See TASTESCOPE_SPEC.md §5, §7.
 *
 * @param {string}   otherUserId     the viewed user's uid (for the invite CTA guard)
 * @param {{titleId,answers}} otherTasteScope  from the loaded public_profiles/users doc
 * @param {() => void} onInvite      opens the existing private-invite flow to this user
 */
export default function TasteCompatibility({ otherUserId, otherTasteScope, onInvite }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const [open, setOpen] = useState(false);

  const mine = userProfile?.tasteScope || null;
  const other = otherTasteScope || null;

  const result = useMemo(() => {
    if (!hasTaste(mine) || !hasTaste(other)) return null;
    return computeCompatibility(mine.answers, other.answers, mine.titleId, other.titleId);
  }, [mine, other]);

  // Viewed user has no title → render nothing. Also guard self-view.
  if (!hasTaste(other) || (otherUserId && otherUserId === currentUser?.uid)) return null;

  // Viewer has no title → nudge to take the quiz.
  if (!hasTaste(mine)) {
    return (
      <button
        type="button"
        onClick={() => navigate('/tastescope')}
        dir={i18n.dir()}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'start',
          padding: '11px 14px', borderRadius: 14, border: '1px dashed var(--border-color, #e5e7eb)',
          background: 'transparent', color: 'var(--text-secondary, #6b7280)', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 18 }}>🍽️</span>
        <span style={{ flex: 1 }}>{t('tastescope.compat.nudge', 'خذ الاختبار لترى توافقكما')}</span>
        <span style={{ transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' }}>›</span>
      </button>
    );
  }

  const inviteLabel = t(`tastescope.compat.invite.${result.suggestedInvite}`, INVITE_LABEL_AR[result.suggestedInvite] || result.suggestedInvite);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        dir={i18n.dir()}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'start',
          padding: '12px 14px', borderRadius: 14, border: '1px solid var(--border-color, #e5e7eb)',
          background: 'var(--bg-card, #fff)', cursor: 'pointer',
        }}
      >
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1, color: '#ec4899', minWidth: 40 }}>
          <span style={{ fontSize: 16 }}>❤️</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 900 }}>{result.percent}%</span>
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 700 }}>
          {t('tastescope.compat.line', {
            percent: result.percent, invite: inviteLabel,
            defaultValue: `توافقكما الغذائي: ${result.percent}% — أفضل دعوة بينكما: ${inviteLabel}`,
          })}
        </span>
        <span style={{ color: 'var(--text-tertiary, #9ca3af)', transform: i18n.dir() === 'rtl' ? 'scaleX(-1)' : 'none' }}>›</span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            dir={i18n.dir()}
            style={{ width: '100%', maxWidth: 520, maxHeight: '85dvh', overflowY: 'auto', background: 'var(--bg-card, #fff)', borderRadius: '20px 20px 0 0', padding: '18px 20px calc(24px + env(safe-area-inset-bottom, 0px))' }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--border-color, #e5e7eb)', margin: '0 auto 14px' }} />
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ec4899' }}>❤️ {result.percent}%</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #6b7280)', fontWeight: 700 }}>
                {result.axisMatches}/{AXES.length} · {inviteLabel}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
              {AXES.map((axis) => {
                const minePole = mine.answers[axis.id];
                const theirPole = other.answers[axis.id];
                const matched = minePole != null && minePole === theirPole;
                return (
                  <div key={axis.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: matched ? 'rgba(16,185,129,0.10)' : 'var(--bg-body, #f8f8f8)' }}>
                    <span style={{ width: 18, textAlign: 'center', color: matched ? '#10b981' : 'var(--text-tertiary, #cbd5e1)', fontWeight: 900 }}>
                      {matched ? '✓' : '·'}
                    </span>
                    <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary, #6b7280)' }}>
                      {t(`tastescope.axis.${axis.id}`, AXIS_LABEL_AR[axis.id] || axis.id)}
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {matched
                        ? t(`tastescope.pole.${minePole}`, minePole)
                        : `${t(`tastescope.pole.${minePole}`, minePole)} · ${t(`tastescope.pole.${theirPole}`, theirPole)}`}
                    </span>
                  </div>
                );
              })}
            </div>

            {onInvite && (
              <button
                type="button"
                onClick={() => { setOpen(false); onInvite(); }}
                style={{ display: 'block', width: '100%', padding: '13px 16px', borderRadius: 14, border: 'none', background: 'var(--primary, #ef4444)', color: '#fff', fontSize: '0.98rem', fontWeight: 800, cursor: 'pointer' }}
              >
                {t('tastescope.compat.sendInvite', 'أرسل دعوة')}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
