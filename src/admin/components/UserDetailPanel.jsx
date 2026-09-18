import { useMemo, useState } from 'react';
import { AppText } from '../../components/base';
import { getPurchaseCredits, getSavedCredits } from '../../utils/walletCredits';
import { adminApi } from '../api';
import { AGE_CATEGORY_IDS } from '../../constants/ageCategories';
import { isHiddenFromConsumerApp } from '../../utils/consumerSearchExclusions';

const GENDER_OPTIONS = ['male', 'female', 'unspecified'];

/** First non-empty value among the given keys on the user doc. */
function pick(u, keys) {
    for (const k of keys) {
        const v = u?.[k];
        if (v !== undefined && v !== null && v !== '') return v;
    }
    return undefined;
}

function arrLen(v) {
    return Array.isArray(v) ? v.length : 0;
}

/** Human-friendly rendering of a scalar field value. */
function fmt(v) {
    if (v === undefined || v === null || v === '') return '—';
    if (typeof v === 'boolean') return v ? '✓' : '✗';
    if (Array.isArray(v)) return String(v.length);
    if (typeof v === 'object') {
        if (typeof v.latitude === 'number' && typeof v.longitude === 'number') {
            return `${v.latitude.toFixed(4)}, ${v.longitude.toFixed(4)}`;
        }
        try {
            return JSON.stringify(v);
        } catch {
            return String(v);
        }
    }
    return String(v);
}

function Field({ label, value, warn }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <AppText as="span" style={{ fontSize: '0.7rem', opacity: 0.65, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {label}
            </AppText>
            <AppText
                as="span"
                style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    wordBreak: 'break-word',
                    color: warn ? 'var(--db-danger, #e5484d)' : 'inherit',
                }}
            >
                {value}
            </AppText>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div style={{ marginBottom: '0.9rem' }}>
            <AppText as="h4" style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', opacity: 0.85, fontWeight: 700 }}>
                {title}
            </AppText>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: '0.6rem 1rem',
                }}
            >
                {children}
            </div>
        </div>
    );
}

/**
 * Read-only inspection of a full `users/{uid}` document for admins.
 * The row data already carries every field (Admin SDK callables return the full doc),
 * so this only presents it — no extra fetch. The profile-completeness section flags
 * accounts that are marked complete yet miss gender / age category (they get stuck:
 * they enter the app but discovery stays empty and social actions are gated).
 */
export default function UserDetailPanel({ u, t, onChanged, confirm }) {
    const [showRaw, setShowRaw] = useState(false);
    const [fixGender, setFixGender] = useState('');
    const [fixAge, setFixAge] = useState('');
    const [saving, setSaving] = useState(false);
    const [fixMsg, setFixMsg] = useState('');
    const [fixErr, setFixErr] = useState(false);
    const [dups, setDups] = useState(null);
    const [dupLoading, setDupLoading] = useState(false);
    const [dupErr, setDupErr] = useState('');
    const [deletingUid, setDeletingUid] = useState('');

    const displayName = pick(u, ['display_name', 'displayName', 'nickname', 'name']);
    const gender = pick(u, ['gender']);
    const ageCategory = pick(u, ['ageCategory', 'age_category']);
    const age = pick(u, ['age']);
    const isProfileCompleteFlag = u?.isProfileComplete === true;
    const hasPhoto = Boolean(pick(u, ['photoURL', 'photoUrl', 'profilePhotoUrl', 'avatarUrl', 'coverPhotoUrl']));

    // Marked complete but actually missing the immutable gate fields → stuck account.
    const stuckIncomplete = isProfileCompleteFlag && (!gender || !ageCategory);

    const email = pick(u, ['email', 'authEmail']);
    const phone = pick(u, ['phone', 'phoneNumber', 'phone_number']);
    const provider = pick(u, ['provider', 'providerId', 'authProvider', 'signInProvider']);
    const role = pick(u, ['role']) || 'user';
    const country = pick(u, ['countryCode', 'country', 'country_code']);
    const coords = pick(u, ['coordinates', 'location', 'geo', 'coarseLocation']);

    const created = pick(u, ['createdAt', 'created_at', 'createdTime', 'signupAt']);
    const lastActive = pick(u, ['lastActive', 'lastSeen', 'lastActiveAt', 'updatedAt', 'lastLoginAt']);

    const hiddenFromConsumers = useMemo(() => isHiddenFromConsumerApp({ ...u, id: u?.id }), [u]);

    const rawJson = useMemo(() => {
        try {
            return JSON.stringify(u, null, 2);
        } catch {
            return '{}';
        }
    }, [u]);

    const runFix = async () => {
        if (!fixGender && !fixAge) return;
        setSaving(true);
        setFixMsg('');
        setFixErr(false);
        try {
            await adminApi.setUserProfileBasics(u.id, {
                gender: fixGender || undefined,
                ageCategory: fixAge || undefined,
            });
            setFixMsg(t('admin_user_fix_saved', 'Saved. The account can now use discovery.'));
            setFixGender('');
            setFixAge('');
            if (onChanged) onChanged();
        } catch (e) {
            setFixErr(true);
            setFixMsg(e?.message || t('admin_failed', 'Failed'));
        } finally {
            setSaving(false);
        }
    };

    const scanDuplicates = async () => {
        if (!email) return;
        setDupLoading(true);
        setDupErr('');
        try {
            const res = await adminApi.findDuplicateAccounts(email);
            setDups(Array.isArray(res?.accounts) ? res.accounts : []);
        } catch (e) {
            setDupErr(e?.message || t('admin_failed', 'Failed'));
        } finally {
            setDupLoading(false);
        }
    };

    const deleteDuplicate = async (uid) => {
        if (!uid || uid === u.id) return;
        const ok = confirm
            ? await confirm({
                  message: t(
                      'admin_dup_delete_confirm',
                      'Permanently delete this duplicate account and all its data? This cannot be undone.'
                  ),
                  tone: 'danger',
              })
            : window.confirm(t('admin_dup_delete_confirm', 'Permanently delete this duplicate account?'));
        if (!ok) return;
        setDeletingUid(uid);
        try {
            await adminApi.deleteUser(uid);
            await scanDuplicates();
            if (onChanged) onChanged();
        } catch (e) {
            setDupErr(e?.message || t('admin_failed', 'Failed'));
        } finally {
            setDeletingUid('');
        }
    };

    const selectStyle = {
        padding: '6px 8px',
        borderRadius: 6,
        border: '1px solid var(--db-border, rgba(127,127,127,0.35))',
        background: 'var(--db-input-bg, transparent)',
        color: 'inherit',
        fontSize: '0.85rem',
    };

    return (
        <div
            style={{
                padding: '1rem',
                background: 'var(--db-panel-2, rgba(127,127,127,0.06))',
                borderRadius: 10,
                border: '1px solid var(--db-border, rgba(127,127,127,0.18))',
            }}
        >
            {stuckIncomplete && (
                <div
                    style={{
                        marginBottom: '0.9rem',
                        padding: '0.55rem 0.75rem',
                        borderRadius: 8,
                        background: 'rgba(229,72,77,0.12)',
                        border: '1px solid rgba(229,72,77,0.4)',
                    }}
                >
                    <AppText as="span" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--db-danger, #e5484d)' }}>
                        {t(
                            'admin_user_stuck_incomplete',
                            '⚠ Marked complete but gender / age category is missing — this account is stuck (empty discovery, social actions gated). Gender & age category are set only on the completion screen.'
                        )}
                    </AppText>
                </div>
            )}

            <Section title={t('admin_user_section_completion', 'Profile completeness')}>
                <Field label={t('admin_user_field_name', 'Display name')} value={fmt(displayName)} warn={!displayName} />
                <Field label={t('admin_user_field_gender', 'Gender')} value={fmt(gender)} warn={!gender} />
                <Field label={t('admin_user_field_age_category', 'Age category')} value={fmt(ageCategory)} warn={!ageCategory} />
                <Field label={t('admin_user_field_age', 'Age')} value={fmt(age)} />
                <Field label={t('admin_user_field_photo', 'Has photo')} value={fmt(hasPhoto)} />
                <Field label={t('admin_user_field_complete_flag', 'isProfileComplete')} value={fmt(isProfileCompleteFlag)} warn={stuckIncomplete} />
            </Section>

            <div
                style={{
                    marginBottom: '0.9rem',
                    padding: '0.75rem',
                    borderRadius: 8,
                    background: 'var(--db-panel, rgba(127,127,127,0.05))',
                    border: '1px solid var(--db-border, rgba(127,127,127,0.2))',
                }}
            >
                <AppText as="h4" style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 700 }}>
                    {t('admin_user_repair_title', 'Repair profile (set gender / age)')}
                </AppText>
                <AppText as="p" style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', opacity: 0.7 }}>
                    {t(
                        'admin_user_repair_hint',
                        'Admin override for immutable fields. Set only what is missing; leave a field on "keep" to not change it.'
                    )}
                </AppText>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
                    <select
                        style={selectStyle}
                        value={fixGender}
                        onChange={(e) => setFixGender(e.target.value)}
                        disabled={saving}
                    >
                        <option value="">{t('admin_user_repair_keep_gender', gender ? `Gender: keep (${gender})` : 'Gender: (missing)')}</option>
                        {GENDER_OPTIONS.map((g) => (
                            <option key={g} value={g}>
                                {t(g, g)}
                            </option>
                        ))}
                    </select>
                    <select
                        style={selectStyle}
                        value={fixAge}
                        onChange={(e) => setFixAge(e.target.value)}
                        disabled={saving}
                    >
                        <option value="">{t('admin_user_repair_keep_age', ageCategory ? `Age: keep (${ageCategory})` : 'Age category: (missing)')}</option>
                        {AGE_CATEGORY_IDS.map((a) => (
                            <option key={a} value={a}>
                                {a}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        className="db-btn db-btn--lime"
                        disabled={saving || (!fixGender && !fixAge)}
                        onClick={runFix}
                    >
                        {saving ? t('admin_saving', 'Saving…') : t('admin_user_repair_save', 'Save')}
                    </button>
                </div>
                {fixMsg && (
                    <AppText
                        as="p"
                        style={{
                            margin: '0.5rem 0 0',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: fixErr ? 'var(--db-danger, #e5484d)' : 'var(--db-lime, #4caf50)',
                        }}
                    >
                        {fixMsg}
                    </AppText>
                )}
            </div>

            <Section title={t('admin_user_section_identity', 'Identity')}>
                <Field label="UID" value={fmt(u?.id)} />
                <Field label={t('admin_user_field_email', 'Email')} value={fmt(email)} />
                <Field label={t('admin_user_field_phone', 'Phone')} value={fmt(phone)} />
                <Field label={t('admin_user_field_provider', 'Provider')} value={fmt(provider)} />
                <Field label={t('admin_user_field_role', 'Role')} value={fmt(role)} />
                <Field label={t('admin_user_field_country', 'Country')} value={fmt(country)} />
                <Field label={t('admin_user_field_coords', 'Coordinates')} value={fmt(coords)} />
            </Section>

            <Section title={t('admin_user_section_social', 'Social & status')}>
                <Field label={t('admin_user_field_followers', 'Followers')} value={String(arrLen(pick(u, ['followers'])))} />
                <Field label={t('admin_user_field_following', 'Following')} value={String(arrLen(pick(u, ['following'])))} />
                <Field label={t('admin_user_field_blocked', 'Blocked')} value={String(arrLen(pick(u, ['blockedUsers', 'blocked'])))} />
                <Field label={t('admin_user_field_muted', 'Muted')} value={String(arrLen(pick(u, ['mutedUsers', 'muted'])))} />
                <Field label={t('admin_user_field_banned', 'Banned')} value={fmt(u?.banned === true)} warn={u?.banned === true} />
                <Field label={t('admin_user_field_frozen', 'Frozen')} value={fmt(u?.frozen === true)} warn={u?.frozen === true} />
                <Field
                    label={t('admin_user_field_visible', 'Visible to members')}
                    value={hiddenFromConsumers ? t('admin_user_hidden', 'Hidden ✓') : t('admin_user_visible', 'VISIBLE')}
                />
            </Section>

            <Section title={t('admin_user_section_wallet', 'Wallet & dates')}>
                <Field label={t('admin_credits_paid_label', 'Purchase credits')} value={String(getPurchaseCredits(u))} />
                <Field label={t('admin_savings_wallet_label', 'Savings credits')} value={String(getSavedCredits(u))} />
                <Field label={t('admin_user_field_created', 'Created')} value={fmt(created)} />
                <Field label={t('admin_user_field_last_active', 'Last active')} value={fmt(lastActive)} />
            </Section>

            <div
                style={{
                    marginBottom: '0.9rem',
                    padding: '0.75rem',
                    borderRadius: 8,
                    background: 'var(--db-panel, rgba(127,127,127,0.05))',
                    border: '1px solid var(--db-border, rgba(127,127,127,0.2))',
                }}
            >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', justifyContent: 'space-between' }}>
                    <AppText as="h4" style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700 }}>
                        {t('admin_dup_title', 'Duplicate accounts (same email)')}
                    </AppText>
                    <button
                        type="button"
                        className="db-btn db-btn--ghost"
                        disabled={!email || dupLoading}
                        onClick={scanDuplicates}
                    >
                        {dupLoading ? t('admin_scanning', 'Scanning…') : t('admin_dup_scan', 'Scan by email')}
                    </button>
                </div>
                {!email && (
                    <AppText as="p" style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', opacity: 0.6 }}>
                        {t('admin_dup_no_email', 'No email on this account to scan.')}
                    </AppText>
                )}
                {dupErr && (
                    <AppText as="p" style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: 'var(--db-danger, #e5484d)' }}>
                        {dupErr}
                    </AppText>
                )}
                {Array.isArray(dups) && (
                    <div style={{ marginTop: '0.6rem' }}>
                        {dups.length <= 1 ? (
                            <AppText as="p" style={{ margin: 0, fontSize: '0.8rem', color: 'var(--db-lime, #4caf50)', fontWeight: 600 }}>
                                {t('admin_dup_none', 'No duplicates — only one account uses this email.')}
                            </AppText>
                        ) : (
                            <>
                                <AppText as="p" style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'var(--db-danger, #e5484d)', fontWeight: 700 }}>
                                    {t('admin_dup_found', '{{n}} accounts share this email. Keep the top one (most complete); delete the rest.').replace('{{n}}', String(dups.length))}
                                </AppText>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {dups.map((acc, i) => {
                                        const isCurrent = acc.uid === u.id;
                                        const isKeeper = i === 0;
                                        return (
                                            <div
                                                key={acc.uid}
                                                style={{
                                                    padding: '0.55rem 0.7rem',
                                                    borderRadius: 8,
                                                    border: `1px solid ${isKeeper ? 'rgba(76,175,80,0.5)' : 'var(--db-border, rgba(127,127,127,0.25))'}`,
                                                    background: isKeeper ? 'rgba(76,175,80,0.08)' : 'transparent',
                                                    display: 'flex',
                                                    flexWrap: 'wrap',
                                                    gap: '0.5rem 0.9rem',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                }}
                                            >
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                                        {acc.displayName || t('admin_dup_no_name', '(no name)')}
                                                        {isKeeper && <AppText as="span" className="db-badge db-badge--ok">{t('admin_dup_keeper', 'keeper')}</AppText>}
                                                        {isCurrent && <AppText as="span" className="db-badge">{t('admin_dup_current', 'current')}</AppText>}
                                                        {acc.isProfileComplete && <AppText as="span" className="db-badge db-badge--ok">✓</AppText>}
                                                    </div>
                                                    <div className="db-id" style={{ fontSize: '0.68rem' }}>{acc.uid}</div>
                                                    <div style={{ fontSize: '0.7rem', opacity: 0.75, marginTop: 2 }}>
                                                        {t('admin_dup_gender', 'gender')}: {acc.gender || '—'} · {t('admin_dup_age', 'age')}: {acc.ageCategory || '—'} · {t('admin_dup_followers_short', 'F')}:{acc.followers}/{acc.following}
                                                        {acc.providers?.length ? ` · ${acc.providers.join(', ')}` : ''}
                                                    </div>
                                                    {acc.createdAt && (
                                                        <div style={{ fontSize: '0.66rem', opacity: 0.55 }}>{t('admin_dup_created', 'created')}: {acc.createdAt}</div>
                                                    )}
                                                </div>
                                                {!isCurrent && (
                                                    <button
                                                        type="button"
                                                        className="db-btn db-btn--danger"
                                                        disabled={deletingUid === acc.uid}
                                                        onClick={() => deleteDuplicate(acc.uid)}
                                                    >
                                                        {deletingUid === acc.uid ? t('admin_deleting', 'Deleting…') : t('admin_dup_delete', 'Delete')}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            <button
                type="button"
                className="db-btn db-btn--ghost"
                style={{ marginTop: '0.3rem' }}
                onClick={() => setShowRaw((v) => !v)}
            >
                {showRaw ? t('admin_user_hide_raw', 'Hide raw JSON') : t('admin_user_show_raw', 'Show raw JSON')}
            </button>

            {showRaw && (
                <pre
                    style={{
                        marginTop: '0.6rem',
                        padding: '0.75rem',
                        maxHeight: 320,
                        overflow: 'auto',
                        fontSize: '0.72rem',
                        lineHeight: 1.45,
                        background: 'var(--db-code-bg, rgba(0,0,0,0.35))',
                        color: 'var(--db-code-fg, #d6e2f0)',
                        borderRadius: 8,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                    }}
                >
                    {rawJson}
                </pre>
            )}
        </div>
    );
}
