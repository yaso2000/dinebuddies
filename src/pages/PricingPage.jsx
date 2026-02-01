import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FaCheck, FaStar, FaCrown, FaFire } from 'react-icons/fa';

const PricingPage = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [subscriptionPlans, setSubscriptionPlans] = useState([]);
    const [selectedPlanType, setSelectedPlanType] = useState('user'); // user or partner
    const [loading, setLoading] = useState(null);
    const [fetchingPlans, setFetchingPlans] = useState(true);

    // Fetch plans from Firestore
    useEffect(() => {
        const fetchPlans = async () => {
            try {
                setFetchingPlans(true);
                const plansQuery = query(
                    collection(db, 'subscriptionPlans'),
                    where('active', '==', true),
                    where('published', '==', true)
                );
                const snapshot = await getDocs(plansQuery);
                const plansData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                // Sort by order
                plansData.sort((a, b) => (a.order || 0) - (b.order || 0));
                setSubscriptionPlans(plansData);
            } catch (error) {
                console.error('Error fetching plans:', error);
            } finally {
                setFetchingPlans(false);
            }
        };

        fetchPlans();
    }, []);

    const filteredPlans = subscriptionPlans.filter(plan => plan.type === selectedPlanType);

    const getDurationText = (duration) => {
        const typeMap = { month: 'شهر', year: 'سنة', day: 'يوم' };
        return `${duration.value > 1 ? duration.value + ' ' : ''}${typeMap[duration.type]}`;
    };

    const handleSubscribe = async (plan) => {
        if (!currentUser) {
            alert('يرجى تسجيل الدخول أولاً');
            navigate('/login');
            return;
        }

        // الباقة المجانية
        if (plan.price === 0) {
            alert('أنت بالفعل في الباقة المجانية!');
            return;
        }

        // تحقق من وجود stripePriceId
        if (!plan.stripePriceId || plan.stripePriceId.includes('REPLACE')) {
            alert('⚠️ يرجى إضافة Stripe Price ID في الكود أولاً.\n\nللحصول على Price ID:\n1. اذهب إلى Stripe Dashboard → Products\n2. أنشئ منتج جديد أو اختر موجود\n3. انسخ Price ID\n4. أضفه في InvitationContext.jsx');
            return;
        }

        setLoading(plan.id);

        try {
            const functions = getFunctions();
            const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');

            const result = await createCheckoutSession({
                priceId: plan.stripePriceId,
                planId: plan.id,
                planName: plan.name,
                successUrl: `${window.location.origin}/payment-success`,
                cancelUrl: `${window.location.origin}/pricing`
            });

            // التوجيه لصفحة الدفع
            window.location.href = result.data.url;
        } catch (error) {
            console.error('Payment Error:', error);
            alert('حدث خطأ في الدفع: ' + error.message + '\n\nتأكد من:\n1. Cloud Functions منشورة\n2. Stripe Keys صحيحة في .env');
        } finally {
            setLoading(null);
        }
    };

    if (fetchingPlans) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
                    <p>Loading plans...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '4rem 1rem',
            fontFamily: 'Inter, sans-serif'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '3rem', color: 'white' }}>
                    <h1 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '1rem' }}>
                        اختر الباقة المناسبة لك
                    </h1>
                    <p style={{ fontSize: '1.25rem', opacity: 0.9 }}>
                        خطط مرنة بأسعار تنافسية لجميع الاحتياجات
                    </p>
                </div>

                {/* Plan Type Toggle */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: '3rem',
                    gap: '1rem'
                }}>
                    <button
                        onClick={() => setSelectedPlanType('user')}
                        style={{
                            padding: '0.75rem 2rem',
                            borderRadius: '50px',
                            border: 'none',
                            background: selectedPlanType === 'user' ? 'white' : 'rgba(255,255,255,0.2)',
                            color: selectedPlanType === 'user' ? '#667eea' : 'white',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                            boxShadow: selectedPlanType === 'user' ? '0 4px 15px rgba(0,0,0,0.2)' : 'none'
                        }}
                    >
                        للأفراد
                    </button>
                    <button
                        onClick={() => setSelectedPlanType('partner')}
                        style={{
                            padding: '0.75rem 2rem',
                            borderRadius: '50px',
                            border: 'none',
                            background: selectedPlanType === 'partner' ? 'white' : 'rgba(255,255,255,0.2)',
                            color: selectedPlanType === 'partner' ? '#667eea' : 'white',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                            boxShadow: selectedPlanType === 'partner' ? '0 4px 15px rgba(0,0,0,0.2)' : 'none'
                        }}
                    >
                        للمطاعم
                    </button>
                </div>

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
                            style={{
                                background: 'white',
                                borderRadius: '20px',
                                padding: '2.5rem',
                                position: 'relative',
                                boxShadow: plan.recommended
                                    ? '0 20px 60px rgba(0,0,0,0.3)'
                                    : '0 10px 30px rgba(0,0,0,0.15)',
                                transform: plan.recommended ? 'scale(1.05)' : 'scale(1)',
                                transition: 'all 0.3s',
                                border: plan.recommended ? '3px solid #667eea' : 'none',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = plan.recommended ? 'scale(1.08)' : 'scale(1.03)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = plan.recommended ? 'scale(1.05)' : 'scale(1)'}
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
                                    <FaStar /> {plan.title}
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
                                fontSize: '1.75rem',
                                fontWeight: '800',
                                marginBottom: '0.5rem',
                                color: '#1a202c'
                            }}>
                                {plan.name}
                            </h3>
                            <p style={{
                                color: '#718096',
                                marginBottom: '1.5rem',
                                fontSize: '0.95rem',
                                lineHeight: '1.6'
                            }}>
                                {plan.description}
                            </p>

                            {/* Price */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                {plan.discount > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                                        <span style={{
                                            textDecoration: 'line-through',
                                            color: '#a0aec0',
                                            fontSize: '1.25rem'
                                        }}>
                                            {plan.originalPrice} ر.س
                                        </span>
                                        <span style={{
                                            background: '#48bb78',
                                            color: 'white',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '50px',
                                            fontSize: '0.875rem',
                                            fontWeight: 'bold'
                                        }}>
                                            خصم {plan.discount}%
                                        </span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                    <span style={{
                                        fontSize: '3.5rem',
                                        fontWeight: '800',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent'
                                    }}>
                                        {plan.price}
                                    </span>
                                    <span style={{ color: '#718096', fontSize: '1.125rem' }}>
                                        ر.س / {getDurationText(plan.duration)}
                                    </span>
                                </div>
                            </div>

                            {/* Invitation Credits & Offers */}
                            {plan.invitationCredits !== null && (
                                <div style={{
                                    background: 'linear-gradient(135deg, #f093fb20 0%, #f5576c20 100%)',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    marginBottom: '1.5rem',
                                    border: '2px dashed #f5576c'
                                }}>
                                    <div style={{ fontWeight: 'bold', color: '#1a202c', marginBottom: '0.5rem' }}>
                                        {plan.invitationCredits === -1 ? '🔥 دعوات غير محدودة' : `📋 ${plan.invitationCredits} دعوة شهرياً`}
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
                                margin: '0 0 2rem 0',
                                flex: 1
                            }}>
                                {plan.features.map((feature, idx) => (
                                    <li key={idx} style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '0.75rem',
                                        marginBottom: '0.875rem',
                                        fontSize: '0.95rem',
                                        color: '#4a5568'
                                    }}>
                                        <FaCheck style={{
                                            color: '#48bb78',
                                            fontSize: '1rem',
                                            marginTop: '2px',
                                            flexShrink: 0
                                        }} />
                                        <span>{feature}</span>
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
                                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                        : 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
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
                                {loading === plan.id ? '⏳ جاري التحميل...' : plan.price === 0 ? 'ابدأ مجاناً' : '🚀 اشترك الآن'}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Footer Note */}
                <div style={{
                    textAlign: 'center',
                    marginTop: '3rem',
                    color: 'white',
                    fontSize: '0.95rem',
                    opacity: 0.9
                }}>
                    <p>💳 جميع الباقات تشمل ضمان استرجاع المبلغ خلال 14 يوم</p>
                    <p>🔒 دفع آمن ومشفر بالكامل</p>
                </div>
            </div>
        </div>
    );
};

export default PricingPage;
