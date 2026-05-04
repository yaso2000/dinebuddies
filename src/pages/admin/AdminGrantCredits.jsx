import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    increment,
    serverTimestamp,
    addDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { searchUsers } from '../../utils/adminUserQueries';
import { sortUsersForGrantSearch } from '../../utils/adminGrantSearchSort';
import { FaSearch, FaGift, FaUser, FaCheckCircle, FaTimesCircle, FaHistory, FaStore } from 'react-icons/fa';

/** @param {Record<string, unknown>|null|undefined} u */
function accountRoleFromUserDoc(u) {
    if (!u) return 'user';
    if (u.isBusiness === true) return 'business';
    const r = String(u.role || '').toLowerCase();
    if (r === 'business' || r === 'partner') return 'business';
    return 'user';
}

/** @param {Record<string, unknown>} u */
function isBusinessProfile(u) {
    return accountRoleFromUserDoc(u) === 'business';
}

const GRANT_KIND = {
    DINE_PAID: 'dine_paid',
    DINE_FREE: 'dine_free',
    PRIVATE_INVITATION: 'private_invitation',
};

const AdminGrantCredits = () => {
    const { currentUser } = useAuth();

    const [search, setSearch] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [searchError, setSearchError] = useState('');

    const [selectedUser, setSelectedUser] = useState(null);

    const [grantKind, setGrantKind] = useState(GRANT_KIND.DINE_PAID);
    const [amount, setAmount] = useState(50);
    const [note, setNote] = useState('');
    const [granting, setGranting] = useState(false);
    const [grantSuccess, setGrantSuccess] = useState(null);

    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    /** Staff/support rarely need credit grants; hide by default. Admins are never listed here. */
    const [includeStaffAccounts, setIncludeStaffAccounts] = useState(false);

    const searchWrapRef = useRef(null);
    const searchSeqRef = useRef(0);

    const runSearch = useCallback(
        async (termRaw, opts = {}) => {
            const clearSelection = opts.clearSelection === true;
            const trimmed = String(termRaw || '').trim();
            if (!trimmed) return;

            const seq = ++searchSeqRef.current;
            setSearching(true);
            setSearchError('');
            if (clearSelection) {
                setSelectedUser(null);
                setGrantSuccess(null);
                setSearchResults([]);
            }

            try {
                let rows = await searchUsers(db, trimmed);
                if (seq !== searchSeqRef.current) return;

                const myUid = currentUser?.uid || currentUser?.id;

                rows = rows.filter((u) => {
                    const r = String(u.role || '').toLowerCase();
                    if (r === 'admin') return false;
                    if (myUid && u.id === myUid) return false;
                    if (!includeStaffAccounts && (r === 'staff' || r === 'support' || r === 'moderator')) return false;
                    return true;
                });

                const sorted = sortUsersForGrantSearch(rows, trimmed).slice(0, 20);
                if (seq !== searchSeqRef.current) return;
                if (sorted.length === 0) {
                    setSearchError(
                        'No matching accounts. Try email, UID, or a longer name prefix. Enable below to include staff/support.'
                    );
                }
                setSearchResults(sorted);
            } catch (err) {
                console.error(err);
                if (seq === searchSeqRef.current) {
                    setSearchError('Search failed. Check your permissions.');
                }
            } finally {
                if (seq === searchSeqRef.current) {
                    setSearching(false);
                }
            }
        },
        [currentUser?.uid, currentUser?.id, includeStaffAccounts]
    );

    /** Live search (debounced) — does not clear the selected user panel. */
    useEffect(() => {
        const trimmed = search.trim();
        if (trimmed.length < 2) {
            setSearchResults([]);
            setSearchError('');
            return undefined;
        }
        const id = setTimeout(() => {
            runSearch(trimmed, { clearSelection: false });
        }, 400);
        return () => clearTimeout(id);
    }, [search, includeStaffAccounts, runSearch]);

    useEffect(() => {
        const onDocDown = (e) => {
            const el = searchWrapRef.current;
            if (!el || el.contains(e.target)) return;
            setSearchResults([]);
        };
        document.addEventListener('mousedown', onDocDown);
        return () => document.removeEventListener('mousedown', onDocDown);
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        if (!search.trim()) return;
        runSearch(search.trim(), { clearSelection: true });
    };

    const loadHistory = async (userId) => {
        setHistoryLoading(true);
        try {
            const snap = await getDocs(
                query(collection(db, 'admin_credit_grants'), where('targetUserId', '==', userId))
            );
            const items = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (b.grantedAt?.seconds || 0) - (a.grantedAt?.seconds || 0));
            setHistory(items);
        } catch {
            setHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    const selectUser = async (user) => {
        setGrantSuccess(null);
        setSearchResults([]);
        try {
            const snap = await getDoc(doc(db, 'users', user.id));
            if (!snap.exists()) {
                setSearchError('User document missing.');
                return;
            }
            setSelectedUser({ id: snap.id, ...snap.data() });
            loadHistory(user.id);
        } catch (e) {
            console.error(e);
            setSearchError('Could not load user.');
        }
    };

    const setGrantKindAndDefaultAmount = (kind) => {
        setGrantKind(kind);
        if (kind === GRANT_KIND.PRIVATE_INVITATION) {
            setAmount(5);
        } else {
            setAmount(50);
        }
    };

    const handleGrant = async (e) => {
        e.preventDefault();
        if (!selectedUser || amount < 1) return;
        setGranting(true);
        setGrantSuccess(null);

        const userRef = doc(db, 'users', selectedUser.id);
        const reason = note.trim() || 'admin_grant';

        try {
            const snapBefore = await getDoc(userRef);
            if (!snapBefore.exists()) {
                setGrantSuccess({ error: 'User document not found.' });
                return;
            }
            const before = snapBefore.data() || {};

            const freeBefore = Math.max(0, Math.floor(Number(before.freeCredits) || 0));
            const paidBefore = Math.max(0, Math.floor(Number(before.paidCredits) || 0));
            const privateBefore = Math.max(0, Math.floor(Number(before.purchasedPrivateCredits) || 0));

            const updates = {
                lastCreditGrantedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            if (grantKind === GRANT_KIND.DINE_PAID) {
                Object.assign(updates, {
                    paidCredits: increment(amount),
                    totalCreditsPurchased: increment(amount),
                });
            } else if (grantKind === GRANT_KIND.DINE_FREE) {
                Object.assign(updates, {
                    freeCredits: increment(amount),
                });
            } else {
                Object.assign(updates, {
                    purchasedPrivateCredits: increment(amount),
                });
            }

            await updateDoc(userRef, updates);

            const afterSnap = await getDoc(userRef);
            const after = afterSnap.data() || {};

            await addDoc(collection(db, 'admin_credit_grants'), {
                targetUserId: selectedUser.id,
                targetUserName:
                    selectedUser.display_name || selectedUser.displayName || selectedUser.email || selectedUser.id,
                targetUserEmail: selectedUser.email || '',
                accountRole: accountRoleFromUserDoc(selectedUser),
                grantKind,
                grantedBy: currentUser?.uid || 'admin',
                grantedByEmail: currentUser?.email || 'admin',
                amount,
                note: note.trim() || null,
                grantedAt: serverTimestamp(),
                freeCreditsBefore: freeBefore,
                paidCreditsBefore: paidBefore,
                purchasedPrivateCreditsBefore: privateBefore,
                freeCreditsAfter: Math.max(0, Math.floor(Number(after.freeCredits) || 0)),
                paidCreditsAfter: Math.max(0, Math.floor(Number(after.paidCredits) || 0)),
                purchasedPrivateCreditsAfter: Math.max(0, Math.floor(Number(after.purchasedPrivateCredits) || 0)),
            });

            if (grantKind === GRANT_KIND.DINE_PAID || grantKind === GRANT_KIND.DINE_FREE) {
                await addDoc(collection(db, 'credit_transactions'), {
                    userId: selectedUser.id,
                    accountRole: accountRoleFromUserDoc(selectedUser),
                    type: grantKind === GRANT_KIND.DINE_PAID ? 'admin_grant_paid' : 'admin_grant_free',
                    amount,
                    balanceType: grantKind === GRANT_KIND.DINE_PAID ? 'paid' : 'free',
                    reason: reason.slice(0, 200),
                    relatedId: 'admin_panel',
                    createdAt: serverTimestamp(),
                    freeUsed: grantKind === GRANT_KIND.DINE_FREE ? amount : 0,
                    paidUsed: grantKind === GRANT_KIND.DINE_PAID ? amount : 0,
                });
            }

            setSelectedUser({ id: selectedUser.id, ...after });
            setGrantSuccess({
                kind: grantKind,
                added: amount,
                user: selectedUser.display_name || selectedUser.displayName || selectedUser.email,
                free: Math.max(0, Math.floor(Number(after.freeCredits) || 0)),
                paid: Math.max(0, Math.floor(Number(after.paidCredits) || 0)),
                private: Math.max(0, Math.floor(Number(after.purchasedPrivateCredits) || 0)),
            });
            setNote('');
            loadHistory(selectedUser.id);
        } catch (err) {
            console.error('Grant failed:', err);
            setGrantSuccess({ error: err.message || 'Failed to grant credits.' });
        } finally {
            setGranting(false);
        }
    };

    const formatDate = (ts) => {
        if (!ts) return '—';
        const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
        return d.toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const freeCr = Math.max(0, Math.floor(Number(selectedUser?.freeCredits) || 0));
    const paidCr = Math.max(0, Math.floor(Number(selectedUser?.paidCredits) || 0));
    const privateCr = Math.max(0, Math.floor(Number(selectedUser?.purchasedPrivateCredits) || 0));

    const dineChips = [25, 50, 100, 200, 500, 1000];
    const privateChips = [1, 3, 5, 10, 20, 50];

    return (
        <div>
            <div className="admin-page-header">
                <h1 className="admin-page-title">Grant credits</h1>
                <p className="admin-page-subtitle">
                    Dine credits (free or paid pool) for AI features, boosts, and in-app spend — or private invitation
                    credits. Search updates as you type (2+ characters); results sort by match quality, then longer
                    prefix overlap, then shorter display name. Admin accounts are never listed; staff/support are optional
                    below.
                </p>
            </div>

            <div className="admin-grid admin-grid-2" style={{ gap: '1.5rem', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="admin-card">
                        <div ref={searchWrapRef} style={{ position: 'relative' }}>
                            <h2
                                style={{
                                    fontSize: '1rem',
                                    fontWeight: '700',
                                    marginBottom: '1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                }}
                            >
                                <FaSearch /> Find user
                            </h2>
                            <form
                                onSubmit={handleSearch}
                                style={{ display: 'flex', gap: '8px' }}
                                autoComplete="off"
                            >
                                <input
                                    type="search"
                                    name="admin-grant-credits-user-query"
                                    className="admin-input"
                                    placeholder="Email, display name, or Firebase UID…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    autoComplete="off"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    style={{ flex: 1 }}
                                    aria-autocomplete="list"
                                    aria-controls="admin-grant-search-listbox"
                                    aria-expanded={searchResults.length > 0}
                                />
                                <button type="submit" className="admin-btn admin-btn-primary" disabled={searching}>
                                    {searching ? '…' : 'Search'}
                                </button>
                            </form>
                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginTop: '10px',
                                    fontSize: '0.82rem',
                                    color: 'var(--admin-text-secondary)',
                                    cursor: 'pointer',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={includeStaffAccounts}
                                    onChange={(e) => setIncludeStaffAccounts(e.target.checked)}
                                />
                                Include staff / support accounts (never admins)
                            </label>
                            {searchError && (
                                <p style={{ color: 'var(--admin-danger)', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                                    {searchError}
                                </p>
                            )}

                            {searchResults.length > 0 && (
                                <ul
                                    id="admin-grant-search-listbox"
                                    role="listbox"
                                    style={{
                                        position: 'absolute',
                                        left: 0,
                                        right: 0,
                                        top: '100%',
                                        marginTop: '6px',
                                        zIndex: 50,
                                        maxHeight: 'min(320px, 55vh)',
                                        overflowY: 'auto',
                                        listStyle: 'none',
                                        padding: '6px',
                                        margin: 0,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px',
                                        background: 'var(--admin-bg-elevated)',
                                        border: '1px solid var(--admin-border)',
                                        borderRadius: 'var(--admin-radius-sm)',
                                        boxShadow: 'var(--admin-shadow-lg)',
                                    }}
                                >
                                    {searchResults.map((u) => (
                                        <li
                                            key={u.id}
                                            role="option"
                                            onClick={() => selectUser(u)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.75rem',
                                                padding: '0.6rem 0.75rem',
                                                borderRadius: 'var(--admin-radius-sm)',
                                                cursor: 'pointer',
                                                background: 'var(--admin-bg-hover)',
                                                border: '1px solid var(--admin-border)',
                                            }}
                                        >
                                            {isBusinessProfile(u) ? (
                                                <FaStore style={{ fontSize: '0.9rem', color: 'var(--admin-text-muted)' }} />
                                            ) : (
                                                <FaUser style={{ fontSize: '0.9rem', color: 'var(--admin-text-muted)' }} />
                                            )}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        fontWeight: '600',
                                                        color: 'var(--admin-text-primary)',
                                                        fontSize: '0.9rem',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {u.display_name || u.displayName || '(no name)'}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                                                    {u.email || '—'} · <span style={{ fontFamily: 'monospace' }}>{u.id}</span>
                                                </div>
                                            </div>
                                            <span
                                                style={{
                                                    fontSize: '0.7rem',
                                                    padding: '2px 8px',
                                                    borderRadius: '999px',
                                                    background: 'var(--admin-primary)20',
                                                    color: 'var(--admin-primary)',
                                                }}
                                            >
                                                {isBusinessProfile(u) ? 'business' : u.role || 'user'}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {selectedUser && (
                        <div className="admin-card" style={{ border: '1px solid var(--admin-primary)40' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                                <div
                                    style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: '50%',
                                        background: 'var(--admin-primary)20',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.2rem',
                                        fontWeight: '800',
                                        color: 'var(--admin-primary)',
                                    }}
                                >
                                    {(selectedUser.display_name || selectedUser.displayName || selectedUser.email || 'U')
                                        .charAt(0)
                                        .toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: '700', color: 'var(--admin-text-primary)' }}>
                                        {selectedUser.display_name || selectedUser.displayName || '(no name)'}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>
                                        {selectedUser.email} ·{' '}
                                        <span style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
                                            {selectedUser.id}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: '10px',
                                    marginBottom: '12px',
                                }}
                            >
                                <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--admin-bg-hover)' }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted)' }}>Dine free</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: '800' }}>{freeCr}</div>
                                </div>
                                <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--admin-bg-hover)' }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted)' }}>Dine paid</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--admin-primary)' }}>
                                        {paidCr}
                                    </div>
                                </div>
                                <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--admin-bg-hover)' }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted)' }}>Private invites</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: '800' }}>{privateCr}</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                                <span
                                    style={{
                                        padding: '3px 10px',
                                        borderRadius: '999px',
                                        background: 'var(--admin-bg-hover)',
                                        color: 'var(--admin-text-secondary)',
                                    }}
                                >
                                    {isBusinessProfile(selectedUser) ? 'Business account' : 'Consumer account'}
                                </span>
                                <span
                                    style={{
                                        padding: '3px 10px',
                                        borderRadius: '999px',
                                        background: 'var(--admin-bg-hover)',
                                        color: 'var(--admin-text-secondary)',
                                    }}
                                >
                                    Role: {selectedUser.role || 'user'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div
                        className="admin-card"
                        style={{ opacity: selectedUser ? 1 : 0.5, pointerEvents: selectedUser ? 'auto' : 'none' }}
                    >
                        <h2
                            style={{
                                fontSize: '1rem',
                                fontWeight: '700',
                                marginBottom: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                        >
                            <FaGift /> Grant
                        </h2>

                        <div style={{ marginBottom: '1rem' }}>
                            <div
                                style={{
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    color: 'var(--admin-text-secondary)',
                                    marginBottom: '8px',
                                }}
                            >
                                Credit type
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {[
                                    { id: GRANT_KIND.DINE_PAID, label: 'Dine credits — paid pool (purchased-style)' },
                                    { id: GRANT_KIND.DINE_FREE, label: 'Dine credits — free pool (promo / support)' },
                                    { id: GRANT_KIND.PRIVATE_INVITATION, label: 'Private invitation credits only' },
                                ].map((opt) => (
                                    <label
                                        key={opt.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            cursor: 'pointer',
                                            padding: '8px 10px',
                                            borderRadius: '8px',
                                            border:
                                                grantKind === opt.id
                                                    ? '1px solid var(--admin-primary)'
                                                    : '1px solid var(--admin-border)',
                                            background: grantKind === opt.id ? 'var(--admin-primary)12' : 'transparent',
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name="grantKind"
                                            checked={grantKind === opt.id}
                                            onChange={() => setGrantKindAndDefaultAmount(opt.id)}
                                        />
                                        <span style={{ fontSize: '0.88rem' }}>{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <form onSubmit={handleGrant} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div>
                                <label
                                    style={{
                                        fontSize: '0.85rem',
                                        fontWeight: '600',
                                        color: 'var(--admin-text-secondary)',
                                        display: 'block',
                                        marginBottom: '4px',
                                    }}
                                >
                                    Amount
                                </label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {(grantKind === GRANT_KIND.PRIVATE_INVITATION ? privateChips : dineChips).map((n) => (
                                        <button
                                            key={n}
                                            type="button"
                                            onClick={() => setAmount(n)}
                                            style={{
                                                padding: '6px 16px',
                                                borderRadius: '8px',
                                                border: `1px solid ${amount === n ? 'var(--admin-primary)' : 'var(--admin-border)'}`,
                                                background: amount === n ? 'var(--admin-primary)' : 'var(--admin-bg-hover)',
                                                color: amount === n ? '#fff' : 'var(--admin-text-secondary)',
                                                fontWeight: '700',
                                                cursor: 'pointer',
                                                fontSize: '0.9rem',
                                            }}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                    <input
                                        type="number"
                                        min={1}
                                        max={999999}
                                        value={amount}
                                        onChange={(e) => setAmount(Number(e.target.value))}
                                        className="admin-input"
                                        style={{ width: '100px' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label
                                    style={{
                                        fontSize: '0.85rem',
                                        fontWeight: '600',
                                        color: 'var(--admin-text-secondary)',
                                        display: 'block',
                                        marginBottom: '4px',
                                    }}
                                >
                                    Internal note (optional)
                                </label>
                                <input
                                    type="text"
                                    className="admin-input"
                                    placeholder="e.g. QA test account / refund / promo"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    maxLength={200}
                                    style={{ width: '100%' }}
                                />
                            </div>

                            {selectedUser && (
                                <div
                                    style={{
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        background: 'var(--admin-primary)10',
                                        border: '1px solid var(--admin-primary)30',
                                        fontSize: '0.875rem',
                                        color: 'var(--admin-text-secondary)',
                                    }}
                                >
                                    Grant <strong style={{ color: 'var(--admin-primary)' }}>{amount}</strong>{' '}
                                    {grantKind === GRANT_KIND.PRIVATE_INVITATION
                                        ? 'private invitation credit(s)'
                                        : grantKind === GRANT_KIND.DINE_FREE
                                          ? 'free Dine credit(s)'
                                          : 'paid Dine credit(s)'}{' '}
                                    to <strong style={{ color: 'var(--admin-text-primary)' }}>{selectedUser.display_name || selectedUser.displayName || selectedUser.email}</strong>
                                </div>
                            )}

                            <button
                                type="submit"
                                className="admin-btn admin-btn-primary"
                                disabled={granting || !selectedUser || amount < 1}
                                style={{ width: '100%', padding: '10px' }}
                            >
                                {granting ? 'Granting…' : `Grant ${amount}`}
                            </button>
                        </form>

                        {grantSuccess && !grantSuccess.error && (
                            <div
                                style={{
                                    marginTop: '1rem',
                                    padding: '12px 16px',
                                    borderRadius: '10px',
                                    background: '#10b98115',
                                    border: '1px solid #10b98140',
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        color: '#10b981',
                                        fontWeight: '700',
                                        marginBottom: '4px',
                                    }}
                                >
                                    <FaCheckCircle /> Granted successfully
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)' }}>
                                    {grantSuccess.user}: Dine free <strong>{grantSuccess.free}</strong>, paid{' '}
                                    <strong>{grantSuccess.paid}</strong>, private invites <strong>{grantSuccess.private}</strong>{' '}
                                    (+{grantSuccess.added} to selected pool)
                                </div>
                            </div>
                        )}
                        {grantSuccess?.error && (
                            <div
                                style={{
                                    marginTop: '1rem',
                                    padding: '12px 16px',
                                    borderRadius: '10px',
                                    background: '#ef444415',
                                    border: '1px solid #ef444440',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: '700' }}>
                                    <FaTimesCircle /> {grantSuccess.error}
                                </div>
                            </div>
                        )}
                    </div>

                    {selectedUser && (
                        <div className="admin-card">
                            <h2
                                style={{
                                    fontSize: '1rem',
                                    fontWeight: '700',
                                    marginBottom: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                }}
                            >
                                <FaHistory /> Grant history
                            </h2>
                            {historyLoading ? (
                                <p style={{ color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>Loading…</p>
                            ) : history.length === 0 ? (
                                <p style={{ color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>
                                    No admin grants logged for this user yet.
                                </p>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--admin-border)' }}>
                                            {['Date', 'Type', 'Amount', 'By', 'Note'].map((h) => (
                                                <th
                                                    key={h}
                                                    style={{
                                                        textAlign: 'left',
                                                        padding: '6px 8px',
                                                        color: 'var(--admin-text-muted)',
                                                        fontWeight: '600',
                                                    }}
                                                >
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((item) => (
                                            <tr key={item.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                                                <td style={{ padding: '8px', color: 'var(--admin-text-muted)' }}>
                                                    {formatDate(item.grantedAt)}
                                                </td>
                                                <td style={{ padding: '8px', color: 'var(--admin-text-secondary)' }}>
                                                    {item.grantKind === GRANT_KIND.DINE_PAID
                                                        ? 'Dine paid'
                                                        : item.grantKind === GRANT_KIND.DINE_FREE
                                                          ? 'Dine free'
                                                          : item.grantKind === GRANT_KIND.PRIVATE_INVITATION
                                                            ? 'Private'
                                                            : item.grantKind || '—'}
                                                </td>
                                                <td style={{ padding: '8px', fontWeight: '700', color: '#10b981' }}>
                                                    +{item.amount}
                                                </td>
                                                <td style={{ padding: '8px', color: 'var(--admin-text-secondary)' }}>
                                                    {item.grantedByEmail || item.grantedBy}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: '8px',
                                                        color: 'var(--admin-text-muted)',
                                                        fontStyle: item.note ? 'normal' : 'italic',
                                                    }}
                                                >
                                                    {item.note || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminGrantCredits;
