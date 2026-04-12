import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const DesktopLanding = () => {
    const navigate = useNavigate();

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            background: 'linear-gradient(135deg, var(--bg-main) 0%, var(--bg-elevated) 100%)',
            color: 'var(--text-main)'
        }}>
            {/* Top Navigation */}
            <header style={{
                padding: '1.5rem 2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-elevated)',
                backdropFilter: 'blur(10px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <img src="/db-logo.svg" alt="DineBuddies Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, background: 'linear-gradient(to right, var(--text-main), var(--text-muted))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        DineBuddies
                    </h1>
                </div>
                <div>
                    <Link
                        to="/login"
                        style={{
                            display: 'inline-block',
                            padding: '0.6rem 1.2rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'transparent',
                            color: 'var(--text-main)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            marginRight: '1rem',
                            textDecoration: 'none',
                            boxSizing: 'border-box',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                        Login
                    </Link>
                    <button
                        onClick={() => navigate('/posts-feed')}
                        style={{
                            padding: '0.6rem 1.5rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'var(--primary)',
                            color: 'white',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
                        }}
                    >
                        Launch App
                    </button>
                </div>
            </header>

            {/* Main Content (Hero) */}
            <main style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                textAlign: 'center'
            }}>
                <div style={{
                    maxWidth: '800px',
                    padding: '3rem',
                    background: 'var(--bg-card)',
                    borderRadius: '24px',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(10px)'
                }}>
                    <h2 style={{
                        fontSize: '3.5rem',
                        fontWeight: 900,
                        margin: '0 0 1rem 0',
                        lineHeight: 1.2
                    }}>
                        Never dine <span style={{ color: 'var(--primary)' }}>alone</span> again.
                    </h2>
                    <p style={{
                        fontSize: '1.25rem',
                        color: 'var(--text-secondary)',
                        margin: '0 0 2rem 0',
                        lineHeight: 1.6
                    }}>
                        The social dining app for meeting people and sharing meals. Connect with food lovers, discover amazing restaurants, and create unforgettable memories over great food.
                    </p>
                    
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        <button
                            onClick={() => navigate('/posts-feed')}
                            style={{
                                padding: '1rem 2rem',
                                fontSize: '1.1rem',
                                borderRadius: '12px',
                                border: 'none',
                                background: 'linear-gradient(135deg, var(--primary), #a78bfa)',
                                color: 'white',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'transform 0.2s',
                                boxShadow: '0 8px 20px rgba(167,139,250,0.4)'
                            }}
                            onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                        >
                            Start Exploring
                        </button>
                    </div>
                </div>
            </main>

            {/* Footer with Google Play required links */}
            <footer style={{
                padding: '2rem',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-elevated)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem'
            }}>
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <a href="/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = 'var(--primary)'} onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}>Privacy Policy</a>
                    <a href="/terms" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = 'var(--primary)'} onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}>Terms of Use</a>
                    <a href="/guidelines" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = 'var(--primary)'} onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}>Community Guidelines</a>
                    <a href="/support" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = 'var(--primary)'} onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}>Contact Us</a>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
                    &copy; {new Date().getFullYear()} DineBuddies. All rights reserved.
                </div>
            </footer>
        </div>
    );
};

export default DesktopLanding;
