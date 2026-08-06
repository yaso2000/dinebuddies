/**
 * Display helpers for invitation magnetic swipe cards.
 */

export function formatInvitationPaymentLabel(t, paymentType) {
  if (!paymentType) return t('payment_split', 'Split');
  return t(`payment_type_${String(paymentType).toLowerCase().replace(/ /g, '_')}`, {
    defaultValue: paymentType,
  });
}

export function formatInvitationGenderLabel(t, invitation) {
  const groups = Array.isArray(invitation?.genderGroups)
    ? invitation.genderGroups.filter(Boolean)
    : [];
  if (groups.length > 0) {
    if (groups.includes('any') || groups.length >= 3) {
      return t('gender_any', 'Any gender');
    }
    return groups
      .map((g) => t(`gender_${String(g).toLowerCase()}`, { defaultValue: g }))
      .join(' · ');
  }
  const pref = invitation?.genderPreference;
  if (!pref || pref === 'any' || pref === 'custom') {
    return t('gender_any', 'Any gender');
  }
  return t(`gender_${String(pref).toLowerCase()}`, { defaultValue: pref });
}

export function formatInvitationAgeLabel(t, ageRange) {
  if (!ageRange) return t('age_any', 'Any age');
  return `${t('age_range_preference', 'Age')}: ${ageRange}`;
}

export function formatInvitationDistanceLabel(t, distanceKm) {
  if (distanceKm == null || !Number.isFinite(Number(distanceKm))) return null;
  return `${Number(distanceKm).toFixed(1)} ${t('km_away', 'km away')}`;
}

export function formatInviteDateTime(t, i18n, date, time) {
  let dateLine = '';
  if (date) {
    const d = date?.toDate ? date.toDate() : new Date(date);
    if (!Number.isNaN(d.getTime())) {
      dateLine = d.toLocaleDateString(i18n.language === 'ar' ? 'ar-u-nu-latn' : undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  }
  let timeLine = '';
  if (time) {
    timeLine = String(time).includes('T')
      ? String(time).split('T')[1].substring(0, 5)
      : String(time);
  }
  return [dateLine, timeLine].filter(Boolean).join(' · ');
}
