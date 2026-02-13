import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaStore, FaSearch, FaFilter, FaCrown, FaStar, FaUsers, FaNewspaper, FaEdit, FaChartLine } from 'react-icons/fa';
import { getPlanById, PLAN_BADGES } from '../config/subscriptionPlans';
import BusinessLimitsEditor from '../components/BusinessLimitsEditor';
import CreateBusinessAccount from '../components/CreateBusinessAccount';

const AdminDashboard = () => {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const [businesses, setBusinesses] = useState([]);
    const [filteredBusinesses, setFilteredBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPlan, setFilterPlan] = useState('all');
    const [filterCustomLimits, setFilterCustomLimits] = useState('all');
    const [selectedBusiness, setSelectedBusiness] = useState(null);
    const [showEditor, setShowEditor] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Check if user is admin and fix missing fields
    useEffect(() => {
        if (!userProfile) return;

        console.log('🔍 Admin Check:', {
            role: userProfile.role,
            accountType: userProfile.accountType,
            email: userProfile.email,
            uid: userProfile.uid
        });

        // Auto-fix admin account if missing accountType or role
        const fixAdminAccount = async () => {
            if (!userProfile.accountType || !userProfile.role) {
                console.log('⚠️ Missing accountType or role, attempting to fix...');

                try {
                    const { doc, updateDoc } = await import('firebase/firestore');
                    const userRef = doc(db, 'users', userProfile.uid);

                    await updateDoc(userRef, {
                        accountType: 'admin',
                        role: 'admin'
                    });

                    console.log('✅ Admin account fixed! Please refresh the page.');
                    alert('Admin account updated! Please refresh the page.');
                    window.location.reload();
                    return;
                } catch (error) {
                    console.error('❌ Failed to fix admin account:', error);
                }
            }
        };

        fixAdminAccount();

        if (userProfile.role !== 'admin' && userProfile.accountType !== 'admin') {
            console.log('❌ Not admin, redirecting...');
            navigate('/');
        } else {
            console.log('✅ Admin access granted!');
        }
    }, [userProfile, navigate]);

    // Fetch all businesses
    useEffect(() => {
        const fetchBusinesses = async () => {
            try {
                setLoading(true);
                const q = query(
                    collection(db, 'users'),
                    where('accountType', '==', 'business'),
                    orderBy('created_at', 'desc')
                );

                const snapshot = await getDocs(q);
                const businessList = snapshot.docs.map(doc => ({
                    uid: doc.id,
                    ...doc.data()
                }));

                setBusinesses(businessList);
                setFilteredBusinesses(businessList);
            } catch (error) {
                console.error('Error fetching businesses:', error);
            } finally {
                setLoading(false);
            }
        };

        if (userProfile?.role === 'admin' || userProfile?.accountType === 'admin') {
            fetchBusinesses();
        }
    }, [userProfile]);

    // Apply filters
    useEffect(() => {
        let filtered = [...businesses];

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(business => {
                const name = business.businessInfo?.businessName || business.display_name || '';
                const email = business.email || '';
                return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    email.toLowerCase().includes(searchTerm.toLowerCase());
            });
        }

        // Plan filter
        if (filterPlan !== 'all') {
            filtered = filtered.filter(business => {
                const plan = business.businessInfo?.subscriptionPlan || 'free';
                return plan === filterPlan;
            });
        }

        // Custom limits filter
        if (filterCustomLimits !== 'all') {
            filtered = filtered.filter(business => {
                const hasCustomLimits = business.businessInfo?.customLimits &&
                    Object.keys(business.businessInfo.customLimits).length > 0;
                return filterCustomLimits === 'yes' ? hasCustomLimits : !hasCustomLimits;
            });
        }

        setFilteredBusinesses(filtered);
    }, [searchTerm, filterPlan, filterCustomLimits, businesses]);

    const handleEditLimits = (business) => {
        setSelectedBusiness(business);
        setShowEditor(true);
    };

    const handleEditorClose = () => {
        setShowEditor(false);
        setSelectedBusiness(null);
    };

    const handleEditorSave = () => {
        // Refresh businesses list
        const fetchBusinesses = async () => {
            const q = query(
                collection(db, 'users'),
                where('accountType', '==', 'business'),
                orderBy('created_at', 'desc')
            );
            const snapshot = await getDocs(q);
            const businessList = snapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data()
            }));
            setBusinesses(businessList);
        };
        fetchBusinesses();
    };

    const BusinessCard = ({ business }) => {
        const planId = business.businessInfo?.subscriptionPlan || 'free';
        const plan = getPlanById(planId);
        const hasCustomLimits = business.businessInfo?.customLimits &&
            Object.keys(business.businessInfo.customLimits).length > 0;

        const customLimits = business.businessInfo?.customLimits || {};
        const memberCount = business.businessInfo?.memberCount || 0;
        const postsThisMonth = business.businessInfo?.postsThisMonth || 0;

        const effectiveMaxMembers = customLimits.maxMembers ?? plan.maxMembers;
        const effectiveMaxPosts = customLimits.maxPostsPerMonth ?? plan.maxPostsPerMonth;

        return (
            <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '1.5rem',
                marginBottom: '1rem',
                transition: 'all 0.2s'
            }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
            >
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    {/* Icon */}
                    <div style={{
                        width: '60px',
                        height: '60px',
                        background: 'linear-gradient(135deg, var(--primary), #f97316)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.8rem',
                        flexShrink: 0
                    }}>
                        {business.businessInfo?.logoImage ? (
                            <img
                                src={business.businessInfo.logoImage}
                                alt="Logo"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    borderRadius: '12px'
                                }}
                            />
                        ) : (
                            <FaStore style={{ color: 'white' }} />
                        )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <h3 style={{
                                fontSize: '1.1rem',
                                fontWeight: '700',
                                color: 'var(--text-primary)',
                                margin: 0
                            }}>
                                {business.businessInfo?.businessName || business.display_name || 'Unnamed Business'}
                            </h3>

                            {/* Plan Badge */}
                            {plan.badge && PLAN_BADGES[plan.badge] && (
                                <span style={{
                                    padding: '2px 8px',
                                    background: `${PLAN_BADGES[plan.badge].color}20`,
                                    color: PLAN_BADGES[plan.badge].color,
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    {PLAN_BADGES[plan.badge].icon} {plan.name}
                                </span>
                            )}

                            {!plan.badge && (
                                <span style={{
                                    padding: '2px 8px',
                                    background: 'rgba(156, 163, 175, 0.2)',
                                    color: '#9ca3af',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600'
                                }}>
                                    {plan.name}
                                </span>
                            )}

                            {/* Custom Limits Badge */}
                            {hasCustomLimits && (
                                <span style={{
                                    padding: '2px 8px',
                                    background: 'rgba(139, 92, 246, 0.2)',
                                    color: 'var(--primary)',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    <FaCrown /> Custom
                                </span>
                            )}
                        </div>

                        <p style={{
                            fontSize: '0.85rem',
                            color: 'var(--text-secondary)',
                            marginBottom: '0.75rem'
                        }}>
                            {business.email}
                        </p>

                        {/* Stats */}
                        <div style={{
                            display: 'flex',
                            gap: '1.5rem',
                            flexWrap: 'wrap'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FaUsers style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }} />
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    Members: <strong>{memberCount}/{effectiveMaxMembers === Infinity ? '∞' : effectiveMaxMembers}</strong>
                                    {customLimits.maxMembers && (
                                        <span style={{ color: 'var(--primary)', marginLeft: '4px' }}>*</span>
                                    )}
                                </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FaNewspaper style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }} />
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    Posts: <strong>{postsThisMonth}/{effectiveMaxPosts === Infinity ? '∞' : effectiveMaxPosts}</strong>
                                    {customLimits.maxPostsPerMonth !== undefined && (
                                        <span style={{ color: 'var(--primary)', marginLeft: '4px' }}>*</span>
                                    )}
                                </span>
                            </div>
                        </div>

                        {/* Admin Notes */}
                        {business.businessInfo?.adminNotes && (
                            <div style={{
                                marginTop: '0.75rem',
                                padding: '0.5rem',
                                background: 'rgba(139, 92, 246, 0.1)',
                                borderLeft: '3px solid var(--primary)',
                                borderRadius: '4px'
                            }}>
                                <p style={{
                                    fontSize: '0.8rem',
                                    color: 'var(--text-secondary)',
                                    margin: 0,
                                    fontStyle: 'italic'
                                }}>
                                    📝 {business.businessInfo.adminNotes}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <button
                            onClick={() => handleEditLimits(business)}
                            style={{
                                padding: '0.5rem 1rem',
                                background: 'linear-gradient(135deg, var(--primary), #f97316)',
                                border: 'none',
                                borderRadius: '8px',
                                color: 'white',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <FaEdit /> Edit Limits
                        </button>

                        <button
                            onClick={() => navigate(`/partner/${business.uid}`)}
                            style={{
                                padding: '0.5rem 1rem',
                                background: 'var(--bg-body)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            View Profile
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'var(--bg-body)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '60px',
                        height: '60px',
                        border: '4px solid var(--border-color)',
                        borderTop: '4px solid var(--primary)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 1rem'
                    }} />
                    <p style={{ color: 'var(--text-secondary)' }}>Loading businesses...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-body)',
            padding: '2rem 1rem'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                        <h1 style={{
                            fontSize: '2rem',
                            fontWeight: '900',
                            marginBottom: '0.5rem',
                            background: 'linear-gradient(135deg, var(--primary), #f97316)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            Business Partners Management
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
                            Manage subscription limits and features for business partners
                        </p>
                    </div>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        style={{
                            padding: '0.875rem 1.5rem',
                            background: 'linear-gradient(135deg, var(--primary), #f97316)',
                            border: 'none',
                            borderRadius: '12px',
                            color: 'white',
                            fontSize: '1rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <FaStore />
                        Create Business
                    </button>
                </div>

                {/* Stats Cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    marginBottom: '2rem'
                }}>
                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '1.5rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <FaStore style={{ color: 'var(--primary)', fontSize: '1.5rem' }} />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                                Total Businesses
                            </span>
                        </div>
                        <p style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--text-primary)', margin: 0 }}>
                            {businesses.length}
                        </p>
                    </div>

                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '1.5rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <FaCrown style={{ color: '#f59e0b', fontSize: '1.5rem' }} />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                                Custom Limits
                            </span>
                        </div>
                        <p style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--text-primary)', margin: 0 }}>
                            {businesses.filter(b => b.businessInfo?.customLimits && Object.keys(b.businessInfo.customLimits).length > 0).length}
                        </p>
                    </div>

                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '1.5rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <FaStar style={{ color: '#8b5cf6', fontSize: '1.5rem' }} />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                                Pro+ Partners
                            </span>
                        </div>
                        <p style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--text-primary)', margin: 0 }}>
                            {businesses.filter(b => {
                                const plan = b.businessInfo?.subscriptionPlan || 'free';
                                return plan === 'pro' || plan === 'premium';
                            }).length}
                        </p>
                    </div>
                </div>

                {/* Filters */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    marginBottom: '1.5rem'
                }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: '1rem'
                    }}>
                        {/* Search */}
                        <div style={{ position: 'relative' }}>
                            <FaSearch style={{
                                position: 'absolute',
                                left: '1rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-muted)',
                                fontSize: '0.9rem'
                            }} />
                            <input
                                type="text"
                                placeholder="Search businesses..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem 0.75rem 2.75rem',
                                    background: 'var(--bg-body)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '10px',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </div>

                        {/* Plan Filter */}
                        <select
                            value={filterPlan}
                            onChange={(e) => setFilterPlan(e.target.value)}
                            style={{
                                padding: '0.75rem 1rem',
                                background: 'var(--bg-body)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '10px',
                                color: 'var(--text-primary)',
                                fontSize: '0.9rem',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="all">All Plans</option>
                            <option value="free">Free</option>
                            <option value="basic">Basic</option>
                            <option value="pro">Pro</option>
                            <option value="premium">Premium</option>
                        </select>

                        {/* Custom Limits Filter */}
                        <select
                            value={filterCustomLimits}
                            onChange={(e) => setFilterCustomLimits(e.target.value)}
                            style={{
                                padding: '0.75rem 1rem',
                                background: 'var(--bg-body)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '10px',
                                color: 'var(--text-primary)',
                                fontSize: '0.9rem',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="all">All Businesses</option>
                            <option value="yes">With Custom Limits</option>
                            <option value="no">Default Limits Only</option>
                        </select>
                    </div>

                    <div style={{
                        marginTop: '1rem',
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)'
                    }}>
                        Showing {filteredBusinesses.length} of {businesses.length} businesses
                    </div>
                </div>

                {/* Business List */}
                {filteredBusinesses.length === 0 ? (
                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '16px',
                        padding: '3rem',
                        textAlign: 'center'
                    }}>
                        <FaStore style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: '1rem' }} />
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
                            No businesses found
                        </p>
                    </div>
                ) : (
                    filteredBusinesses.map(business => (
                        <BusinessCard key={business.uid} business={business} />
                    ))
                )}
            </div>

            {/* Limits Editor Modal */}
            {showEditor && selectedBusiness && (
                <BusinessLimitsEditor
                    business={selectedBusiness}
                    onClose={handleEditorClose}
                    onSave={handleEditorSave}
                />
            )}

            {/* Create Business Modal */}
            {showCreateModal && (
                <CreateBusinessAccount
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => {
                        // Refresh businesses list
                        const fetchBusinesses = async () => {
                            const q = query(
                                collection(db, 'users'),
                                where('accountType', '==', 'business'),
                                orderBy('created_at', 'desc')
                            );
                            const snapshot = await getDocs(q);
                            const businessList = snapshot.docs.map(doc => ({
                                uid: doc.id,
                                ...doc.data()
                            }));
                            setBusinesses(businessList);
                        };
                        fetchBusinesses();
                    }}
                />
            )}

            {/* Spinner Animation */}
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default AdminDashboard;
