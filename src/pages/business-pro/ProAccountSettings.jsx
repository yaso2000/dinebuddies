import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider, sendEmailVerification, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { useNavigate } from 'react-router-dom';
import {
    FaEnvelope, FaLock, FaBell, FaShieldAlt, FaCreditCard,
    FaChevronDown, FaChevronUp, FaEye, FaEyeSlash,
    FaMoon, FaSun, FaCheckCircle, FaSignOutAlt, FaTrash,
    FaMobileAlt, FaVolumeUp, FaUserPlus, FaCommentAlt, FaHeart, FaExclamationCircle
} from 'react-icons/fa';

// ---- Shared Styles ----
const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    color: '#f1f5f9',
    fontSize: '0.9rem',
    outline: 'none',
    marginTop: 6,
};
const labelStyle = { fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', marginTop: 12 };
const errStyle = { color: '#ef4444', fontSize: '0.8rem', marginTop: 6 };
const okStyle = { color: '#10b981', fontSize: '0.8rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 };

// ---- Toggle Switch ----
const Toggle = ({ checked, onChange }) => (
    <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer', flexShrink: 0 }}>
        <input type="checkbox" checked={checked} onChange={onChange} style={{ opacity: 0, width: 0, height: 0 }} />
        <span style={{
            position: 'absolute', inset: 0,
            background: checked ? '#7c3aed' : 'rgba(255,255,255,0.12)',
            borderRadius: 24,
            transition: 'background 0.2s',
        }}>
            <span style={{
                position: 'absolute',
                top: 2, left: checked ? 22 : 2,
                width: 20, height: 20,
                background: 'white',
                borderRadius: '50%',
                transition: 'left 0.2s',
                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }} />
        </span>
    </label>
);

// ---- Accordion Item Wrapper ----
const AccordionItem = ({ icon, iconColor, label, sublabel, children, defaultOpen = false }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${open ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: 14,
            overflow: 'hidden',
            transition: 'border-color 0.2s',
            marginBottom: 10,
        }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    width: '100%', padding: '16px 18px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    textAlign: 'left',
                }}
            >
                <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: `${iconColor}18`, color: iconColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
                }}>{icon}</div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f1f5f9' }}>{label}</div>
                    {sublabel && <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{sublabel}</div>}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>
                    {open ? <FaChevronUp /> : <FaChevronDown />}
                </div>
            </button>

            {open && (
                <div style={{ padding: '0 18px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    {children}
                </div>
            )}
        </div>
    );
};

// ---- Email Section ----
const EmailSection = ({ currentUser }) => {
    const [newEmail, setNewEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!newEmail || newEmail === currentUser.email) { setError('Enter a different email.'); return; }
        setLoading(true); setError(''); setSuccess(false);
        try {
            await updateEmail(currentUser, newEmail);
            await sendEmailVerification(currentUser);
            setSuccess(true); setNewEmail('');
        } catch (err) {
            setError(err.code === 'auth/requires-recent-login'
                ? 'Please log out and log back in before changing your email.'
                : 'Failed to update email. Please try again.');
        } finally { setLoading(false); }
    };

    return (
        <form onSubmit={handleUpdate} style={{ marginTop: 14 }}>
            <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
                Current: <strong style={{ color: '#f1f5f9' }}>{currentUser?.email}</strong>
                {currentUser?.emailVerified && <span style={{ marginLeft: 8, color: '#10b981', fontSize: '0.75rem' }}>✓ Verified</span>}
            </div>
            <label className="ui-form-label" style={{ ...labelStyle, marginBottom: 6 }}>New Email Address</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Enter new email" className="ui-form-field" style={{ marginTop: 6 }} required />
            {error && <div style={errStyle}>{error}</div>}
            {success && <div style={okStyle}><FaCheckCircle /> Email updated! Check your inbox to verify.</div>}
            <button type="submit" disabled={loading || !newEmail} className="ui-btn ui-btn--primary" style={{ marginTop: 14, width: '100%' }}>
                {loading ? 'Updating...' : 'Update Email'}
            </button>
        </form>
    );
};

// ---- Password Section ----
const PasswordSection = ({ currentUser }) => {
    const [cur, setCur] = useState('');
    const [nw, setNw] = useState('');
    const [conf, setConf] = useState('');
    const [showCur, setShowCur] = useState(false);
    const [showNw, setShowNw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (nw !== conf) { setError('Passwords do not match.'); return; }
        if (nw.length < 6) { setError('Min 6 characters.'); return; }
        setLoading(true); setError(''); setSuccess(false);
        try {
            const cred = EmailAuthProvider.credential(currentUser.email, cur);
            await reauthenticateWithCredential(currentUser, cred);
            await updatePassword(currentUser, nw);
            setSuccess(true); setCur(''); setNw(''); setConf('');
        } catch (err) {
            setError(err.code === 'auth/wrong-password' ? 'Current password is incorrect.' : 'Failed to update. Please try again.');
        } finally { setLoading(false); }
    };

    const pwInput = (val, setVal, show, setShow, placeholder) => (
        <div style={{ position: 'relative', marginTop: 6 }}>
            <input type={show ? 'text' : 'password'} value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder}
                className="ui-form-field" style={{ paddingRight: 40 }} />
            <button type="button" onClick={() => setShow(s => !s)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', paddingTop: 6 }}>
                {show ? <FaEyeSlash /> : <FaEye />}
            </button>
        </div>
    );

    return (
        <form onSubmit={handleUpdate} style={{ marginTop: 14 }}>
            <label className="ui-form-label" style={{ ...labelStyle, marginBottom: 6 }}>Current Password</label>
            {pwInput(cur, setCur, showCur, setShowCur, 'Enter current password')}
            <label className="ui-form-label" style={{ ...labelStyle, marginBottom: 6 }}>New Password</label>
            {pwInput(nw, setNw, showNw, setShowNw, 'Enter new password')}
            <label className="ui-form-label" style={{ ...labelStyle, marginBottom: 6 }}>Confirm New Password</label>
            {pwInput(conf, setConf, false, () => { }, 'Confirm new password')}
            {error && <div style={errStyle}>{error}</div>}
            {success && <div style={okStyle}><FaCheckCircle /> Password updated!</div>}
            <button type="submit" disabled={loading || !cur || !nw || !conf} className="ui-btn ui-btn--primary" style={{ marginTop: 14, width: '100%' }}>
                {loading ? 'Updating...' : 'Update Password'}
            </button>
        </form>
    );
};

// ---- Notifications Section ----
const NotificationsSection = ({ currentUser }) => {
    const defaultSettings = { pushEnabled: true, emailEnabled: false, soundEnabled: true };
    const [settings, setSettings] = useState(defaultSettings);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!currentUser?.uid) return;
        getDoc(doc(db, 'users', currentUser.uid, 'preferences', 'notifications'))
            .then(d => { if (d.exists()) setSettings(s => ({ ...s, ...d.data() })); })
            .catch(() => { });
    }, [currentUser?.uid]);

    const save = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, 'users', currentUser.uid, 'preferences', 'notifications'), settings, { merge: true });
        } catch (_) { }
        finally { setSaving(false); }
    };

    const row = (label, key) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)' }}>{label}</span>
            <Toggle checked={settings[key]} onChange={e => setSettings(s => ({ ...s, [key]: e.target.checked }))} />
        </div>
    );

    return (
        <div style={{ marginTop: 14 }}>
            {row('Push Notifications', 'pushEnabled')}
            {row('Email Notifications', 'emailEnabled')}
            {row('Sound', 'soundEnabled')}
            <button type="button" className="ui-btn ui-btn--primary" style={{ marginTop: 14 }} onClick={save} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
            </button>
        </div>
    );
};

// ---- Appearance Section ----
const AppearanceSection = () => {
    const { isDark, toggleTheme } = useTheme();
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isDark ? <FaMoon style={{ color: '#a78bfa' }} /> : <FaSun style={{ color: '#f97316' }} />}
                <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)' }}>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
            </div>
            <Toggle checked={isDark} onChange={toggleTheme} />
        </div>
    );
};

// ---- Delete Account Section ----
const DeleteSection = ({ currentUser }) => {
    const navigate = useNavigate();
    const { deleteUserAccount } = useAuth();
    const [confirm, setConfirm] = useState(false);
    const [loading, setLoading] = useState(false);

    const handle = async () => {
        if (!confirm) { setConfirm(true); return; }
        setLoading(true);
        try {
            await deleteUserAccount();
            navigate('/login');
        } catch (_) { setLoading(false); setConfirm(false); }
    };

    return (
        <div style={{ marginTop: 14 }}>
            {confirm && <div style={{ ...errStyle, marginBottom: 10 }}>⚠️ This cannot be undone. Click again to confirm.</div>}
            <button onClick={handle} disabled={loading}
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                {loading ? 'Deleting...' : confirm ? 'Confirm Delete Account' : 'Delete My Account'}
            </button>
        </div>
    );
};

// ---- Main Component ----
const ProAccountSettings = () => {
    const { currentUser, userProfile } = useAuth();

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                {/* User info banner */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.12)', borderRadius: 14, marginBottom: 20 }}>
                    <img
                        src={userProfile?.avatar_url || userProfile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile?.display_name || 'U')}&background=7c3aed&color=fff`}
                        alt=""
                        style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid rgba(167,139,250,0.4)' }}
                    />
                    <div>
                        <div style={{ fontWeight: 700, color: '#f1f5f9' }}>{userProfile?.display_name || userProfile?.displayName || 'User'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>{currentUser?.email}</div>
                    </div>
                </div>

                <AccordionItem icon={<FaEnvelope />} iconColor="#3b82f6" label="Email Address" sublabel={currentUser?.email} defaultOpen={true}>
                    <EmailSection currentUser={currentUser} />
                </AccordionItem>

                <AccordionItem icon={<FaLock />} iconColor="#8b5cf6" label="Password" sublabel="Change your account password">
                    <PasswordSection currentUser={currentUser} />
                </AccordionItem>


            </div>
        </div>
    );
};

export default ProAccountSettings;
