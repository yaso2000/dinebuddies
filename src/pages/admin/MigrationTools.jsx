import React, { useState } from 'react';
import { migratePlansToFirestore } from '../../utils/migratePlans';
import { FaDatabase, FaCheckCircle, FaExclamationTriangle, FaRocket } from 'react-icons/fa';

const MigrationTools = () => {
    const [migrating, setMigrating] = useState(false);
    const [result, setResult] = useState(null);

    const handleMigrate = async () => {
        if (!window.confirm('This will migrate the 3 existing plans to Firestore.\n\nContinue?')) {
            return;
        }

        setMigrating(true);
        setResult(null);

        try {
            const migrationResult = await migratePlansToFirestore();
            setResult(migrationResult);
        } catch (error) {
            setResult({
                success: false,
                message: error.message
            });
        } finally {
            setMigrating(false);
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="admin-page-header admin-mb-4">
                <h1 className="admin-page-title">Migration Tools</h1>
                <p className="admin-page-subtitle">One-time migration scripts for data setup</p>
            </div>

            {/* User Cleanup Migration Card (MOVED TO TOP) */}
            <div className="admin-card admin-mb-4" style={{ marginBottom: '2rem', border: '1px solid rgba(249, 115, 22, 0.3)', background: 'rgba(249, 115, 22, 0.05)' }}>
                <div className="admin-flex admin-gap-3" style={{ alignItems: 'flex-start' }}>
                    <div style={{
                        width: '3.5rem',
                        height: '3.5rem',
                        borderRadius: '0.75rem',
                        background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <FaRocket style={{ fontSize: '1.75rem', color: '#ffffff' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '0.5rem' }}>
                            Fix User Profiles (Cleanup)
                        </h2>
                        <p style={{ fontSize: '0.9375rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
                            <b>Priority Fix:</b> Convert all "User" names to real names (from email) and remove cartoon avatars.
                        </p>

                        <button
                            onClick={async () => {
                                if (!window.confirm('This will update ALL users named "User" and remove Dicebear avatars.\n\nContinue?')) return;

                                setMigrating(true);
                                try {
                                    const { collection, getDocs, updateDoc, doc } = await import('firebase/firestore');
                                    const { db } = await import('../../firebase/config');

                                    const usersRef = collection(db, 'users');
                                    const snapshot = await getDocs(usersRef);

                                    let updatedCount = 0;
                                    let errors = [];

                                    for (const userDoc of snapshot.docs) {
                                        const data = userDoc.data();
                                        let updates = {};

                                        // Fix Name
                                        if (!data.display_name || data.display_name === 'User') {
                                            if (data.email) {
                                                const emailName = data.email.split('@')[0];
                                                updates.display_name = emailName.charAt(0).toUpperCase() + emailName.slice(1);
                                            } else {
                                                updates.display_name = 'Member';
                                            }
                                        }

                                        // Fix Avatar
                                        if (data.photo_url && data.photo_url.includes('dicebear')) {
                                            updates.photo_url = '';
                                        }

                                        if (Object.keys(updates).length > 0) {
                                            try {
                                                await updateDoc(doc(db, 'users', userDoc.id), updates);
                                                updatedCount++;
                                            } catch (err) {
                                                errors.push(userDoc.id);
                                            }
                                        }
                                    }

                                    alert(`Migration Complete!\n\n✅ Updated: ${updatedCount} profiles`);
                                } catch (err) {
                                    alert('Failed: ' + err.message);
                                } finally {
                                    setMigrating(false);
                                }
                            }}
                            disabled={migrating}
                            className="admin-btn admin-btn-primary"
                            style={{
                                background: migrating ? '#64748b' : 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                                fontSize: '1rem',
                                fontWeight: '700',
                                padding: '0.75rem 2rem'
                            }}
                        >
                            {migrating ? 'Running...' : '🚀 Run Cleanup Now'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Legacy plan migration removed to avoid duplication of old $39/$79 data. 
               Please use PlanManagement.jsx for sync/reset tools. */}

            {/* User Cleanup Migration Card */}
            <div className="admin-card admin-mb-4" style={{ marginTop: '2rem', borderTop: '1px solid #334155', paddingTop: '2rem' }}>
                <div className="admin-flex admin-gap-3" style={{ alignItems: 'flex-start' }}>
                    <div style={{
                        width: '3.5rem',
                        height: '3.5rem',
                        borderRadius: '0.75rem',
                        background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <FaRocket style={{ fontSize: '1.75rem', color: '#ffffff' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', marginBottom: '0.5rem' }}>
                            Fix Legacy User Profiles
                        </h2>
                        <p style={{ fontSize: '0.9375rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
                            Clean up old accounts named "User" and remove cartoon avatars.
                            This will rename users based on their email and clear default avatars.
                        </p>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                            <button
                                onClick={async () => {
                                    if (!window.confirm('This will update ALL users named "User" and remove Dicebear/Avataars.\n\nContinue?')) return;

                                    setMigrating(true);
                                    try {
                                        const { collection, getDocs, updateDoc, doc } = await import('firebase/firestore');
                                        const { db } = await import('../../firebase/config');

                                        const usersRef = collection(db, 'users');
                                        const snapshot = await getDocs(usersRef);

                                        let updatedCount = 0;
                                        let errors = [];

                                        for (const userDoc of snapshot.docs) {
                                            const data = userDoc.data();
                                            let updates = {};

                                            // Fix Name (Robust Check)
                                            const currentName = data.display_name ? data.display_name.toString().trim() : '';

                                            if (!currentName || currentName.toLowerCase() === 'user') {
                                                if (data.email) {
                                                    const emailName = data.email.split('@')[0];
                                                    updates.display_name = emailName.charAt(0).toUpperCase() + emailName.slice(1);
                                                } else {
                                                    updates.display_name = 'Member';
                                                }
                                            }

                                            // Fix Avatar
                                            if (data.photo_url && (data.photo_url.includes('dicebear') || data.photo_url.includes('avataaars'))) {
                                                updates.photo_url = '';
                                            }

                                            if (Object.keys(updates).length > 0) {
                                                try {
                                                    await updateDoc(doc(db, 'users', userDoc.id), updates);
                                                    updatedCount++;
                                                } catch (err) {
                                                    errors.push(userDoc.id);
                                                }
                                            }
                                        }

                                        alert(`Migration Complete!\n\n✅ Updated: ${updatedCount} profiles`);
                                    } catch (err) {
                                        alert('Failed: ' + err.message);
                                    } finally {
                                        setMigrating(false);
                                    }
                                }}
                                disabled={migrating}
                                className="admin-btn admin-btn-primary"
                                style={{
                                    background: migrating ? '#64748b' : 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                                    fontSize: '0.9rem',
                                    fontWeight: '700',
                                    padding: '0.6rem 1.5rem',
                                    flex: 1
                                }}
                            >
                                {migrating ? 'Working...' : '1. Fix Profiles First'}
                            </button>

                            <button
                                onClick={async () => {
                                    if (!window.confirm('This will refresh ALL posts with the latest user names/photos.\n(Run Step 1 first!)\n\nContinue?')) return;

                                    setMigrating(true);
                                    try {
                                        const { collection, getDocs, updateDoc, doc, getDoc } = await import('firebase/firestore');
                                        const { db } = await import('../../firebase/config');

                                        const postsRef = collection(db, 'posts');
                                        const snapshot = await getDocs(postsRef);

                                        let updatedCount = 0;

                                        for (const postDoc of snapshot.docs) {
                                            const post = postDoc.data();
                                            if (!post.userId) continue;

                                            // Fetch LATEST user data
                                            const userSnap = await getDoc(doc(db, 'users', post.userId));
                                            if (userSnap.exists()) {
                                                const userData = userSnap.data();

                                                // Update post with fresh data
                                                await updateDoc(doc(db, 'posts', postDoc.id), {
                                                    userName: userData.display_name || 'Member',
                                                    userPhoto: userData.photo_url || userData.photoURL || ''
                                                });
                                                updatedCount++;
                                            }
                                        }

                                        alert(`Posts Refreshed!\n\n✅ Updated: ${updatedCount} posts with new names/photos`);
                                    } catch (err) {
                                        console.error(err);
                                        alert('Failed: ' + err.message);
                                    } finally {
                                        setMigrating(false);
                                    }
                                }}
                                disabled={migrating}
                                className="admin-btn"
                                style={{
                                    background: migrating ? '#64748b' : '#3b82f6',
                                    color: 'white',
                                    fontSize: '0.9rem',
                                    fontWeight: '700',
                                    padding: '0.6rem 1.5rem',
                                    flex: 1,
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer'
                                }}
                            >
                                {migrating ? 'Working...' : '2. Update Old Posts'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MigrationTools;
