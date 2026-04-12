import React, { useState } from 'react';
import {
    collection, query, where, getDocs, doc,
    getDoc, updateDoc, increment, serverTimestamp, addDoc
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { FaSearch, FaGift, FaUser, FaCheckCircle, FaTimesCircle, FaHistory } from 'react-icons/fa';

const AdminGrantCredits = () => {
    const { currentUser } = useAuth();

    // Search
    const [search, setSearch] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [searchError, setSearchError] = useState('');

    // Selected user
    const [selectedUser, setSelectedUser] = useState(null);

    // Grant form
    const [amount, setAmount] = useState(5);
    const [note, setNote] = useState('');
    const [granting, setGranting] = useState(false);
    const [grantSuccess, setGrantSuccess] = useState(null);

    // History
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // ── Search Users ───────────────────────────────────────────────────────
    const handleSearch = async (e) => {
        e.preventDefault();
        if (!search.trim()) return;
        setSearching(true);
        setSearchError('');
        setSearchResults([]);
        setSelectedUser(null);
        setGrantSuccess(null);

        try {
            const usersRef = collection(db, 'users');
            const term = search.trim().toLowerCase();

            // Try email match first, then display_name prefix
            const [byEmail, byName] = await Promise.all([
                getDocs(query(usersRef, where('email', '==', term))),
                getDocs(query(usersRef, where('display_name', '>=', term), where('display_name', '<=', term + '\uf8ff'))),
            ]);

            const seen = new Set();
            const results = [];
            [...byEmail.docs, ...byName.docs].forEach(d => {
                if (!seen.has(d.id)) {
                    seen.add(d.id);
                    results.push({ id: d.id, ...d.data() });
                }
            });

            if (results.length === 0) setSearchError('No users found. Try their exact email or display name.');
            setSearchResults(results.slice(0, 10));
        } catch (err) {
            console.error(err);
            setSearchError('Search failed. Check your permissions.');
        } finally {
            setSearching(false);
        }
    };

    // ── Load grant history for selected user ───────────────────────────────
    const loadHistory = async (userId) => {
        setHistoryLoading(true);
        try {
            const snap = await getDocs(
                query(collection(db, 'admin_credit_grants'), where('targetUserId', '==', userId))
            );
            const items = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (b.grantedAt?.seconds || 0) - (a.grantedAt?.seconds || 0));
            setHistory(items);
        } catch {
            setHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    const selectUser = (user) => {
        setSelectedUser(user);
        setSearchResults([]);
        setGrantSuccess(null);
        loadHistory(user.id);
    };

    // ── Grant Credits ──────────────────────────────────────────────────────
    const handleGrant = async (e) => {
        e.preventDefault();
        if (!selectedUser || amount < 1) return;
        setGranting(true);
        setGrantSuccess(null);

        try {
            const userRef = doc(db, 'users', selectedUser.id);

            // Refresh user data to get current credits
            const snap = await getDoc(userRef);
            const currentCredits = snap.data()?.purchasedPrivateCredits || 0;

            // Update credits
            await updateDoc(userRef, {
                purchasedPrivateCredits: increment(amount),
                lastCreditGrantedAt: serverTimestamp(),
            });

            // Log the grant
            await addDoc(collection(db, 'admin_credit_grants'), {
                targetUserId: selectedUser.id,
                targetUserName: selectedUser.display_name || selectedUser.email || selectedUser.id,
                targetUserEmail: selectedUser.email || '',
                grantedBy: currentUser?.uid || 'admin',
                grantedByEmail: currentUser?.email || 'admin',
                amount,
                previousBalance: currentCredits,
                newBalance: currentCredits + amount,
                note: note.trim() || null,
                grantedAt: serverTimestamp(),
            });

            setGrantSuccess({
                previous: currentCredits,
                added: amount,
                total: currentCredits + amount,
                user: selectedUser.display_name || selectedUser.email,
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
        return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div>
            <div className="admin-page-header">
                <h1 className="admin-page-title">Grant Private Invitation Credits</h1>
                <p className="admin-page-subtitle">Search a user and gift them free private invitation credits</p>
            </div>

            <div className="admin-grid admin-grid-2" style={{ gap: '1.5rem', alignItems: 'start' }}>

                {/* ── Left: Search + User Card ─────────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    {/* Search box */}
                    <div className="admin-card">
                        <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FaSearch /> Find User
                        </h2>
                        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                className="admin-input"
                                placeholder="Email or display name…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ flex: 1 }}
                            />
                            <button type="submit" className="admin-btn admin-btn-primary" disabled={searching}>
                                {searching ? '…' : 'Search'}
                            </button>
                        </form>
                        {searchError && <p style={{ color: 'var(--admin-danger)', marginTop: '0.5rem', fontSize: '0.875rem' }}>{searchError}</p>}

                        {/* Results */}
                        {searchResults.length > 0 && (
                            <ul style={{ marginTop: '0.75rem', listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {searchResults.map(u => (
                                    <li
                                        key={u.id}
                                        onClick={() => selectUser(u)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                                            padding: '0.6rem 0.75rem', borderRadius: 'var(--admin-radius-sm)',
                                            cursor: 'pointer', background: 'var(--admin-bg-hover)',
                                            border: '1px solid var(--admin-border)',
                                        }}
                                    >
                                        <FaUser style={{ fontSize: '0.9rem', color: 'var(--admin-text-muted)' }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: '600', color: 'var(--admin-text-primary)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {u.display_name || u.displayName || '(no name)'}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{u.email}</div>
                                        </div>
                                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', background: 'var(--admin-primary)20', color: 'var(--admin-primary)' }}>
                                            {u.subscriptionTier || 'free'}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Selected user info */}
                    {selectedUser && (
                        <div className="admin-card" style={{ border: '1px solid var(--admin-primary)40' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: '50%',
                                    background: 'var(--admin-primary)20',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.2rem', fontWeight: '800', color: 'var(--admin-primary)'
                                }}>
                                    {(selectedUser.display_name || selectedUser.email || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontWeight: '700', color: 'var(--admin-text-primary)' }}>
                                        {selectedUser.display_name || selectedUser.displayName || '(no name)'}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>{selectedUser.email}</div>
                                </div>
                                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>Current credits</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--admin-primary)' }}>
                                        {selectedUser.purchasedPrivateCredits || 0}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                                <span style={{ padding: '3px 10px', borderRadius: '999px', background: 'var(--admin-bg-hover)', color: 'var(--admin-text-secondary)' }}>
                                    Plan: {selectedUser.subscriptionTier || 'free'}
                                </span>
                                <span style={{ padding: '3px 10px', borderRadius: '999px', background: 'var(--admin-bg-hover)', color: 'var(--admin-text-secondary)' }}>
                                    Used this month: {selectedUser.usedPrivateCreditsThisMonth || 0}
                                </span>
                                <span style={{ padding: '3px 10px', borderRadius: '999px', background: 'var(--admin-bg-hover)', color: 'var(--admin-text-secondary)' }}>
                                    Role: {selectedUser.role || 'user'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Right: Grant Form + History ──────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    {/* Grant form */}
                    <div className="admin-card" style={{ opacity: selectedUser ? 1 : 0.5, pointerEvents: selectedUser ? 'auto' : 'none' }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FaGift /> Grant Credits
                        </h2>
                        <form onSubmit={handleGrant} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--admin-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                    Number of credits to grant
                                </label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {[1, 3, 5, 10, 20, 50].map(n => (
                                        <button
                                            key={n}
                                            type="button"
                                            onClick={() => setAmount(n)}
                                            style={{
                                                padding: '6px 16px', borderRadius: '8px',
                                                border: `1px solid ${amount === n ? 'var(--admin-primary)' : 'var(--admin-border)'}`,
                                                background: amount === n ? 'var(--admin-primary)' : 'var(--admin-bg-hover)',
                                                color: amount === n ? '#fff' : 'var(--admin-text-secondary)',
                                                fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem'
                                            }}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                    <input
                                        type="number"
                                        min={1}
                                        max={999}
                                        value={amount}
                                        onChange={e => setAmount(Number(e.target.value))}
                                        className="admin-input"
                                        style={{ width: '80px' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--admin-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                    Internal note (optional)
                                </label>
                                <input
                                    type="text"
                                    className="admin-input"
                                    placeholder="e.g. Compensation for reported bug"
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    maxLength={200}
                                    style={{ width: '100%' }}
                                />
                            </div>

                            {/* Confirmation preview */}
                            {selectedUser && (
                                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--admin-primary)10', border: '1px solid var(--admin-primary)30', fontSize: '0.875rem', color: 'var(--admin-text-secondary)' }}>
                                    Grant <strong style={{ color: 'var(--admin-primary)' }}>{amount} credit{amount !== 1 ? 's' : ''}</strong> to{' '}
                                    <strong style={{ color: 'var(--admin-text-primary)' }}>{selectedUser.display_name || selectedUser.email}</strong>
                                    {' '}→ new balance: <strong style={{ color: 'var(--admin-primary)' }}>{(selectedUser.purchasedPrivateCredits || 0) + amount}</strong>
                                </div>
                            )}

                            <button
                                type="submit"
                                className="admin-btn admin-btn-primary"
                                disabled={granting || !selectedUser || amount < 1}
                                style={{ width: '100%', padding: '10px' }}
                            >
                                {granting ? 'Granting…' : `🎁 Grant ${amount} Credit${amount !== 1 ? 's' : ''}`}
                            </button>
                        </form>

                        {/* Success / Error result */}
                        {grantSuccess && !grantSuccess.error && (
                            <div style={{ marginTop: '1rem', padding: '12px 16px', borderRadius: '10px', background: '#10b98115', border: '1px solid #10b98140' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: '700', marginBottom: '4px' }}>
                                    <FaCheckCircle /> Credits granted successfully!
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)' }}>
                                    {grantSuccess.user}: {grantSuccess.previous} → <strong>{grantSuccess.total}</strong> credits (+{grantSuccess.added})
                                </div>
                            </div>
                        )}
                        {grantSuccess?.error && (
                            <div style={{ marginTop: '1rem', padding: '12px 16px', borderRadius: '10px', background: '#ef444415', border: '1px solid #ef444440' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: '700' }}>
                                    <FaTimesCircle /> {grantSuccess.error}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Grant history */}
                    {selectedUser && (
                        <div className="admin-card">
                            <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FaHistory /> Grant History
                            </h2>
                            {historyLoading ? (
                                <p style={{ color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>Loading…</p>
                            ) : history.length === 0 ? (
                                <p style={{ color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>No credits have been granted to this user yet.</p>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--admin-border)' }}>
                                            {['Date', 'Amount', 'By', 'Note'].map(h => (
                                                <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--admin-text-muted)', fontWeight: '600' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map(item => (
                                            <tr key={item.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                                                <td style={{ padding: '8px', color: 'var(--admin-text-muted)' }}>{formatDate(item.grantedAt)}</td>
                                                <td style={{ padding: '8px', fontWeight: '700', color: '#10b981' }}>+{item.amount}</td>
                                                <td style={{ padding: '8px', color: 'var(--admin-text-secondary)' }}>{item.grantedByEmail || item.grantedBy}</td>
                                                <td style={{ padding: '8px', color: 'var(--admin-text-muted)', fontStyle: item.note ? 'normal' : 'italic' }}>
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
