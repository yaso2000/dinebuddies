import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { FaCrown, FaCheckCircle } from 'react-icons/fa';

const QuickAdminSetup = () => {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const makeCurrentUserAdmin = async () => {
        if (!currentUser) {
            alert('No user logged in!');
            return;
        }

        if (!window.confirm('Make yourself an admin?')) return;

        try {
            setLoading(true);
            await updateDoc(doc(db, 'users', currentUser.uid), {
                role: 'admin'
            });
            setSuccess(true);
            alert('Success! You are now an admin. Please refresh the page.');
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (error) {
            console.error('Error making admin:', error);
            alert('Failed: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="admin-card" style={{
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                textAlign: 'center',
                padding: '2rem'
            }}>
                <FaCheckCircle style={{ fontSize: '3rem', color: '#ffffff', marginBottom: '1rem' }} />
                <h2 style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: '700' }}>
                    Success! You are now an admin!
                </h2>
                <p style={{ color: '#ffffff', marginTop: '0.5rem' }}>
                    Refreshing page...
                </p>
            </div>
        );
    }

    return (
        <div className="admin-card" style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            textAlign: 'center',
            padding: '2rem'
        }}>
            <FaCrown style={{ fontSize: '3rem', color: '#fbbf24', marginBottom: '1rem' }} />
            <h2 style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                Quick Admin Setup
            </h2>
            <p style={{ color: '#e0e7ff', marginBottom: '1.5rem' }}>
                Click below to make yourself an admin
            </p>
            <button
                onClick={makeCurrentUserAdmin}
                disabled={loading}
                className="admin-btn"
                style={{
                    background: '#fbbf24',
                    color: '#000000',
                    fontWeight: '700',
                    fontSize: '1.125rem',
                    padding: '0.75rem 2rem'
                }}
            >
                {loading ? 'Processing...' : '👑 Make Me Admin'}
            </button>
            <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#e0e7ff' }}>
                Current User: {currentUser?.email}
            </div>
        </div>
    );
};

export default QuickAdminSetup;
