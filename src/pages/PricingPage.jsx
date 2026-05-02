import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import app, { db } from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FaCheck, FaStar, FaCrown, FaFire } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import { convertFromUSD } from '../utils/currencyConverter';
import { goToLogin } from '../utils/goToLogin';

const PricingPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser, userProfile } = useAuth();
    const { creditPacks, subscriptionPlans: contextPlans } = useInvitations();
    const { showToast } = useToast();

    // Determine page type from URL
    const isBusinessPage = location.pathname.includes('/business/pricing');
    const [selectedPlanType, setSelectedPlanType] = useState(isBusinessPage ? 'business' : 'user');
    const [loading, setLoading] = useState(null);
    const [selectedCreditPack, setSelectedCreditPack] = useState(null);
    const [selectedDatingPack, setSelectedDatingPack] = useState(null);
    const [userCountry, setUserCountry] = useState('United States');
    const { t, i18n } = useTranslation();

    // Detect user country via IP for currency conversion
    useEffect(() => {
        fetch('https://ipapi.co/json/')
            .then(r => r.json())
            .then(data => { if (data?.country_name) setUserCountry(data.country_name); })
            .catch(() => { }); // silently fail — default to USD
    }, []);

    // Set initial selected credit packs
    useEffect(() => {
        if (creditPacks && creditPacks.length > 0) {
            const invPacks = creditPacks.filter(p => p.type === 'invitation');
            const datePacks = creditPacks.filter(p => p.type === 'dating');
            if (!selectedCreditPack && invPacks.length > 0) setSelectedCreditPack(invPacks[0]);
            if (!selectedDatingPack && datePacks.length > 0) setSelectedDatingPack(datePacks[0]);
        }
    }, [creditPacks]);

    // Auto-detect and sync
    useEffect(() => {
        const pageType = isBusinessPage ? 'business' : 'user';
        setSelectedPlanType(pageType);

        // Auto-redirect logged in users to their correct pricing page if they land on wrong one
        if (userProfile) {
            const userType = userProfile.role === 'business' ? 'business' : 'user';

            if (userType === 'business' && !isBusinessPage) {
                console.log('🔄 Redirecting partner to business pricing');
                navigate('/business/pricing', { replace: true });
            } else if (userType === 'user' && isBusinessPage) {
                console.log('🔄 Redirecting user to standard pricing');
                navigate('/pricing', { replace: true });
            }
        }
    }, [isBusinessPage, userProfile, navigate]);

    // Use plans from context
    const subscriptionPlans = contextPlans || [];
    const fetchingPlans = false;

    // Separate packs by type
    const invitationCreditPacks = creditPacks.filter(pack => pack.type === 'invitation');
    const datingCreditPacks = creditPacks.filter(pack => pack.type === 'dating');
    const offerSlotPacks = creditPacks.filter(pack => pack.type === 'offer_slot');

    const filteredPlans = subscriptionPlans.filter(plan => plan.type === selectedPlanType);

    const getDurationText = (duration) => {
        const typeMap = { month: 'month', year: 'year', day: 'day' };
        return `${duration.value > 1 ? duration.value + ' ' : ''}${typeMap[duration.type]}`;
    };

    const handleSubscribe = async (plan) => {
        if (!currentUser) {
            showToast('Please login first to subscribe.', 'error');
            goToLogin();
            return;
        }

        // Free plan
        if (plan.price === 0) {
            showToast('You are already on a free plan or this plan is free.', 'info');
            return;
        }

        // Check for stripePriceId
        if (!plan.stripePriceId || plan.stripePriceId.includes('REPLACE')) {
            showToast('⚠️ Please add Stripe Price ID in the code first.\n\nTo get Price ID:\n1. Go to Stripe Dashboard → Products\n2. Create a new product or choose existing\n3. Copy Price ID\n4. Add it in InvitationContext.jsx', 'warning');
            return;
        }

        setLoading(plan.id);

        try {
            const functions = getFunctions(app, 'us-central1');
            const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');

            const result = await createCheckoutSession({
                priceId: plan.stripePriceId,
                planId: plan.id,
                planName: plan.name,
                successUrl: `${window.location.origin}/payment-success`,
                cancelUrl: `${window.location.origin}/pricing`
            });

            // Redirect to payment page
            window.location.href = result.data.url;
        } catch (error) {
            console.error('Payment Error:', error);
            showToast('Payment Error: ' + error.message + '\n\nMake sure:\n1. Cloud Functions are deployed\n2. Stripe Keys are correct in .env', 'error');
        } finally {
            setLoading(null);
        }
    };

    if (fetchingPlans) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'var(--bg-body)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <div style={{ textAlign: 'center', color: 'white' }}>
                    <div style={{
                        width: '50px',
                        height: '50px',
                        border: '4px solid rgba(255,255,255,0.3)',
                        borderTop: '4px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 1rem'
                    }} />
                    <p>{t("Loading plans...", "Loading plans...")}</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-body)',
            padding: '2rem 1rem 4rem',
            fontFamily: 'var(--font-body)'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-main)' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '0.5rem', textShadow: 'var(--shadow-premium)' }}>
                        {isBusinessPage ? t('Business Plans', 'Business Plans') : t('Choose Your Plan', 'Choose Your Plan')}
                    </h1>
                    <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>
                        {isBusinessPage ? t('Professional solutions to grow your business', 'Professional solutions to grow your business') : t('Flexible plans to suit your needs', 'Flexible plans to suit your needs')}
                    </p>
                </div>

                {/* Plan Type Toggle - HIDDEN per proposal */}
                {/* 
                <div style={{ ... }}> ... </div> 
                */}

                {/* Currency Toggle - REMOVED, now automatic */}

                {/* Pricing Cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: '2rem',
                    alignItems: 'stretch'
                }}>
                    {filteredPlans.map(plan => (
                        <div
                            key={plan.id}
                            className="glass-card"
                            style={{
                                padding: '1.5rem',
                                position: 'relative',
                                transform: plan.recommended ? 'scale(1.03)' : 'scale(1)',
                                transition: 'all 0.3s',
                                border: plan.recommended ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = plan.recommended ? 'scale(1.05)' : 'scale(1.02)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = plan.recommended ? 'scale(1.03)' : 'scale(1)'}
                        >
                            {/* Recommended Badge */}
                            {plan.recommended && (
                                <div style={{
                                    position: 'absolute',
                                    top: '-15px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                    color: 'white',
                                    padding: '0.5rem 1.5rem',
                                    borderRadius: '50px',
                                    fontSize: '0.875rem',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    boxShadow: '0 4px 15px rgba(245, 87, 108, 0.4)'
                                }}>
                                    <FaStar /> {t(plan.title, plan.title)}
                                </div>
                            )}

                            {/* Plan Icon */}
                            <div style={{
                                fontSize: '3rem',
                                marginBottom: '1rem',
                                color: plan.recommended ? '#667eea' : '#764ba2'
                            }}>
                                {plan.price === 0 ? '🎁' : plan.recommended ? <FaCrown /> : <FaFire />}
                            </div>

                            {/* Plan Name & Description */}
                            <h3 style={{
                                fontSize: '1.4rem',
                                fontWeight: '800',
                                marginBottom: '0.25rem',
                                color: 'var(--text-main)'
                            }}>
                                {t(plan.name, plan.name)}
                            </h3>
                            <p style={{
                                color: 'var(--text-muted)',
                                marginBottom: '1rem',
                                fontSize: '0.9rem',
                                lineHeight: '1.5'
                            }}>
                                {t(plan.description, plan.description)}
                            </p>

                            {/* Price */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                {plan.type === 'business' && plan.price > 0 && (
                                    <div style={{
                                        background: 'rgba(72, 187, 120, 0.1)',
                                        color: '#48bb78',
                                        padding: '6px 12px',
                                        borderRadius: '10px',
                                        fontSize: '0.85rem',
                                        fontWeight: '800',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        marginBottom: '0.75rem',
                                        border: '1px solid rgba(72, 187, 120, 0.2)'
                                    }}>
                                        <span>✨</span> {t("First Month FREE", "First Month FREE")}
                                    </div>
                                )}
                                {plan.discount > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                                        <span style={{
                                            textDecoration: 'line-through',
                                            color: '#a0aec0',
                                            fontSize: '1.25rem'
                                        }}>
                                            {(() => {
                                                const conv = convertFromUSD(plan.originalPrice || plan.price, userCountry);
                                                return <>{conv.symbol}{conv.price}</>;
                                            })()}
                                        </span>
                                        <span style={{
                                            background: '#48bb78',
                                            color: 'white',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '50px',
                                            fontSize: '0.875rem',
                                            fontWeight: 'bold'
                                        }}>
                                            {plan.discount}% {t("Off", "Off")}
                                        </span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                                    <span style={{
                                        fontSize: '2.8rem',
                                        fontWeight: '800',
                                        color: 'var(--text-main)',
                                        textShadow: '0 2px 10px rgba(0,0,0,0.3)'
                                    }}>
                                        {(() => {
                                            const conv = convertFromUSD(plan.price, userCountry);
                                            return <>{conv.symbol}{conv.price}</>;
                                        })()}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '1rem', opacity: 0.9 }}>
                                        {t('per', 'per')} {plan.duration?.value > 1 ? plan.duration.value : ''} {plan.duration?.type ? t(plan.duration.type, plan.duration.type) : ''}
                                    </span>
                                </div>
                            </div>

                            {/* Invitation Credits & Offers - Only for User Plans */}
                            {plan.type === 'user' && plan.invitationCredits !== undefined && plan.invitationCredits !== null && (plan.invitationCredits !== 0 || plan.invitationOffers) && (
                                <div style={{
                                    background: 'linear-gradient(135deg, #f093fb20 0%, #f5576c20 100%)',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    marginBottom: '1.5rem',
                                    border: '2px dashed #f5576c'
                                }}>
                                    <div style={{ fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                                        {plan.invitationCredits === -1 ? 'Unlimited Private Invitations' : `${plan.invitationCredits} Private Invitations per month`}
                                    </div>
                                    {plan.invitationOffers && (
                                        <div style={{ fontSize: '0.875rem', color: '#e53e3e', fontWeight: 'bold' }}>
                                            🎁 {plan.invitationOffers}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Features */}
                            <ul style={{
                                listStyle: 'none',
                                padding: 0,
                                margin: '0 0 1.5rem 0',
                                flex: 1
                            }}>
                                {(plan.features || []).map((featureText, idx) => (
                                    <li key={idx} style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '0.6rem',
                                        marginBottom: '0.6rem',
                                        fontSize: '0.875rem',
                                        color: 'var(--text-main)',
                                        opacity: 0.9
                                    }}>
                                        <FaCheck style={{
                                            color: '#48bb78',
                                            fontSize: '0.85rem',
                                            marginTop: '3px',
                                            flexShrink: 0
                                        }} />
                                        <span>{t(featureText, featureText)}</span>
                                    </li>
                                ))}
                            </ul>

                            {/* CTA Button */}
                            <button
                                onClick={() => handleSubscribe(plan)}
                                disabled={loading === plan.id}
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: plan.recommended
                                        ? 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)'
                                        : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', // Gold/Amber theme
                                    color: 'white',
                                    fontSize: '1.125rem',
                                    fontWeight: 'bold',
                                    cursor: loading === plan.id ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.3s',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                                    opacity: loading === plan.id ? 0.6 : 1
                                }}
                                onMouseEnter={(e) => !loading && (e.currentTarget.style.transform = 'translateY(-2px)')}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                {loading === plan.id
                                    ? t('loading', 'Loading...')
                                    : plan.price === 0
                                        ? t('Start for Free', 'Start for Free')
                                        : (plan.type === 'business'
                                            ? t('Start 1 Month Free Trial ✨', '1 Month FREE Trial ✨')
                                            : t('subscribe_now', 'Subscribe Now'))}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Private Invitation Credit Packs - ONLY for Individuals */}
                {!isBusinessPage && invitationCreditPacks.length > 0 && (
                    <div style={{ marginTop: '4rem', textAlign: 'center' }}>
                        <h2 style={{ color: 'var(--text-main)', fontSize: '2rem', fontWeight: '900', marginBottom: '0.75rem' }}>
                            {t("Add-on Packs", "Add-on Packs")}
                        </h2>
                        <p style={{ color: 'var(--text-muted)', opacity: 0.9, marginBottom: '2rem', fontSize: '1rem' }}>
                            {t("No subscription needed to use these packs", "No subscription needed to use these packs")}
                        </p>

                        {/* Credit Selector UI */}
                        <div style={{
                            background: 'var(--bg-card)',
                            backdropFilter: 'blur(20px)',
                            borderRadius: '32px',
                            padding: '2.5rem',
                            maxWidth: '800px',
                            margin: '0 auto',
                            border: '1px solid var(--border-color)',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
                        }}>
                            {/* Selection Pills */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                gap: '0.75rem',
                                flexWrap: 'wrap',
                                marginBottom: '2.5rem'
                            }}>
                                {invitationCreditPacks.map(pack => {
                                    const isSelected = selectedCreditPack?.id === pack.id;
                                    const getIcon = (amount) => {
                                        if (amount >= 20) return '🔥';
                                        if (amount >= 10) return '💎';
                                        if (amount >= 5) return '✨';
                                        if (amount >= 3) return '🌟';
                                        return '📩';
                                    };

                                    return (
                                        <div
                                            key={pack.id}
                                            onClick={() => setSelectedCreditPack(pack)}
                                            style={{
                                                padding: '0.75rem 1.25rem',
                                                background: isSelected ? 'var(--primary)' : 'var(--hover-overlay)',
                                                borderRadius: '50px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.6rem',
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                border: isSelected ? '2px solid var(--primary)' : '2px solid var(--border-color)',
                                                boxShadow: isSelected ? '0 8px 20px rgba(139,92,246,0.25)' : 'none',
                                                transform: isSelected ? 'scale(1.05)' : 'scale(1)'
                                            }}
                                        >
                                            <span style={{ fontSize: '1.2rem' }}>{getIcon(pack.amount)}</span>
                                            <span style={{
                                                fontWeight: '800',
                                                color: isSelected ? 'white' : 'var(--text-main)'
                                            }}>
                                                {pack.amount}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Active Content */}
                            {selectedCreditPack && (
                                <div style={{ transition: 'all 0.5s' }}>
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <h3 style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                                            {t(selectedCreditPack.name, selectedCreditPack.name)}
                                        </h3>
                                        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '1.1rem' }}>
                                            {selectedCreditPack.amount} {t('invitations', 'Invitations')}
                                        </p>
                                    </div>

                                    <div style={{
                                        fontSize: '3.5rem',
                                        fontWeight: '950',
                                        color: 'var(--primary)',
                                        marginBottom: '2rem'
                                    }}>
                                        {(() => {
                                            const conv = convertFromUSD(selectedCreditPack.price, userCountry);
                                            return <>{conv.symbol}{conv.price}</>;
                                        })()} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', marginLeft: '0.5rem', fontWeight: '400' }}>{t("One-time payment", "One-time payment")}</span>
                                    </div>

                                    <button
                                        onClick={() => handleSubscribe(selectedCreditPack)}
                                        disabled={loading === selectedCreditPack.id}
                                        style={{
                                            width: '100%',
                                            maxWidth: '350px',
                                            padding: '1.25rem',
                                            borderRadius: '20px',
                                            border: 'none',
                                            background: 'linear-gradient(135deg, #fff 0%, #f0f0f0 100%)',
                                            color: '#764ba2',
                                            fontSize: '1.25rem',
                                            fontWeight: '900',
                                            cursor: loading === selectedCreditPack.id ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.3s',
                                            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                                            margin: '0 auto'
                                        }}
                                    >
                                        {loading === selectedCreditPack.id ? t('loading', 'Loading...') : t('Buy Now', 'Buy Now')}
                                    </button>

                                    <div style={{ marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                        Instant activation after payment
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Dating Invitation Packs - Separate section */}
                {!isBusinessPage && datingCreditPacks.length > 0 && (
                    <div style={{ marginTop: '3rem', textAlign: 'center' }}>
                        <h2 style={{ color: 'var(--text-main)', fontSize: '2rem', fontWeight: '900', marginBottom: '0.5rem' }}>
                            {t("💕 Dating Invitation Packs", "💕 Dating Invitation Packs")}
                        </h2>
                        <p style={{ color: 'var(--text-muted)', opacity: 0.9, marginBottom: '2rem', fontSize: '1rem' }}>
                            {t("Send exclusive date invitations — no free tier", "Send exclusive date invitations — no free tier")}
                        </p>

                        <div style={{
                            background: 'var(--bg-card)',
                            backdropFilter: 'blur(20px)',
                            borderRadius: '32px',
                            padding: '2.5rem',
                            maxWidth: '800px',
                            margin: '0 auto',
                            border: '1px solid rgba(236, 72, 153, 0.3)',
                            boxShadow: '0 20px 40px rgba(236, 72, 153, 0.1)'
                        }}>
                            {/* Selection Pills */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                gap: '0.75rem',
                                flexWrap: 'wrap',
                                marginBottom: '2.5rem'
                            }}>
                                {datingCreditPacks.map(pack => {
                                    const isSelected = selectedDatingPack?.id === pack.id;
                                    return (
                                        <div
                                            key={pack.id}
                                            onClick={() => setSelectedDatingPack(pack)}
                                            style={{
                                                padding: '0.75rem 1.25rem',
                                                background: isSelected ? 'linear-gradient(135deg, #ec4899, #be185d)' : 'var(--hover-overlay)',
                                                borderRadius: '50px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.6rem',
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                border: isSelected ? '2px solid #ec4899' : '2px solid var(--border-color)',
                                                boxShadow: isSelected ? '0 8px 20px rgba(236,72,153,0.3)' : 'none',
                                                transform: isSelected ? 'scale(1.05)' : 'scale(1)'
                                            }}
                                        >
                                            <span style={{ fontSize: '1.2rem' }}>💕</span>
                                            <span style={{
                                                fontWeight: '800',
                                                color: isSelected ? 'white' : 'var(--text-main)'
                                            }}>
                                                {pack.amount}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Active Content */}
                            {selectedDatingPack && (
                                <div style={{ transition: 'all 0.5s' }}>
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <h3 style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                                            {t(selectedDatingPack.name, selectedDatingPack.name)}
                                        </h3>
                                        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '1.1rem' }}>
                                            {selectedDatingPack.amount} {t('dating_invitations', 'Dating Invitations')}
                                        </p>
                                    </div>

                                    <div style={{
                                        fontSize: '3.5rem',
                                        fontWeight: '950',
                                        color: '#ec4899',
                                        marginBottom: '2rem'
                                    }}>
                                        {(() => {
                                            const conv = convertFromUSD(selectedDatingPack.price, userCountry);
                                            return <>{conv.symbol}{conv.price}</>;
                                        })()} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', marginLeft: '0.5rem', fontWeight: '400' }}>One-time payment</span>
                                    </div>

                                    <button
                                        onClick={() => handleSubscribe(selectedDatingPack)}
                                        disabled={loading === selectedDatingPack.id}
                                        style={{
                                            width: '100%',
                                            maxWidth: '350px',
                                            padding: '1.25rem',
                                            borderRadius: '20px',
                                            border: 'none',
                                            background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                                            color: 'white',
                                            fontSize: '1.25rem',
                                            fontWeight: '900',
                                            cursor: loading === selectedDatingPack.id ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.3s',
                                            boxShadow: '0 10px 30px rgba(236,72,153,0.3)',
                                            margin: '0 auto',
                                            display: 'block'
                                        }}
                                    >
                                        {loading === selectedDatingPack.id ? t('loading', 'Loading...') : t('💕 Buy Now', '💕 Buy Now')}
                                    </button>

                                    <div style={{ marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                        {t("Instant activation after payment", "Instant activation after payment")}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Offer Slot Packs - ONLY for Business pricing */}

                {isBusinessPage && offerSlotPacks.length > 0 && (
                    <div style={{ marginTop: '4rem', textAlign: 'center' }}>
                        <h2 style={{ color: 'var(--text-main)', fontSize: '1.8rem', fontWeight: '900', marginBottom: '0.5rem' }}>
                            {t("🎯 Add-on Offer Slots", "🎯 Add-on Offer Slots")}
                        </h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.95rem' }}>
                            {t("Boost your visibility with extra offer display time", "Boost your visibility with extra offer display time")}
                        </p>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                            gap: '1.5rem',
                            maxWidth: '700px',
                            margin: '0 auto'
                        }}>
                            {offerSlotPacks.map(pack => (
                                <div key={pack.id} className="glass-card" style={{ padding: '1.5rem', textAlign: 'left' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⏱️</div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.4rem' }}>{t(pack.name, pack.name)}</h3>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{t(pack.description, pack.description)}</p>
                                    <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--text-main)', marginBottom: '1rem' }}>
                                        {pack.currencySymbol || '$'}{pack.price}
                                        <span style={{ fontSize: '0.9rem', fontWeight: '400', color: 'var(--text-muted)', marginLeft: '6px' }}>{t("one-time", "one-time")}</span>
                                    </div>
                                    <button
                                        onClick={() => handleSubscribe(pack)}
                                        disabled={loading === pack.id}
                                        style={{
                                            width: '100%', padding: '0.75rem', borderRadius: '10px',
                                            border: 'none', background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                                            color: 'white', fontWeight: '700', cursor: loading === pack.id ? 'not-allowed' : 'pointer',
                                            opacity: loading === pack.id ? 0.6 : 1
                                        }}
                                    >
                                        {loading === pack.id ? t('loading', 'Loading...') : t('Buy Now', 'Buy Now')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer Note */}
                <div style={{
                    textAlign: 'center',
                    marginTop: '3rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.9rem',
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '1.5rem'
                }}>
                    <p>{t("Money back guarantee", "Money back guarantee")}</p>
                    <p>{t("Secure payment processed by Stripe", "Secure payment processed by Stripe")}</p>
                </div>
            </div>
        </div>
    );
};

export default PricingPage;
