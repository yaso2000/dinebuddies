import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from 'react-i18next';
import { getBusinessSubscriptionAccess } from '../utils/businessSubscription';
import BusinessPaidFeatureGate from '../components/business/BusinessPaidFeatureGate';
import { syncBusinessPublicProfile } from '../services/businessPublicProfileSync';
import { getSafeAvatar } from '../utils/avatarUtils';
import { FaUsers, FaUserPlus, FaHeart, FaComments, FaChartLine, FaArchive, FaEye, FaStar, FaEdit, FaCalendar, FaCog, FaCheckCircle, FaGlobe, FaSearch, FaBell, FaInbox } from 'react-icons/fa';
import { useNotifications } from '../context/NotificationContext';
import { hasBusinessSessionHint } from '../utils/accountRole';
import { AppText } from "../components/base";
import { useConfirm } from '../context/ConfirmContext';

const DASHBOARD_LOADING_STYLE = {
  padding: '2rem',
  minHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
};

const QUICK_ACTION_BTN_STYLE = {
  flex: '1 1 calc(50% - 5px)',
  padding: '12px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  color: 'var(--text-main)',
  fontWeight: '700',
  fontSize: '0.85rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  transition: 'all 0.2s'
};

function QuickActionButton({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={QUICK_ACTION_BTN_STYLE}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
        e.currentTarget.style.borderColor = 'var(--primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-card)';
        e.currentTarget.style.borderColor = 'var(--border-color)';
      }}
    >
      {icon} {label}
    </button>
  );
}

function StatTile({ icon, iconColor, iconBg, value, label, title }) {
  return (
    <div
      title={title}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '1.25rem',
        textAlign: 'center'
      }}
    >
      <div style={{
        width: '50px',
        height: '50px',
        borderRadius: '12px',
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 0.75rem',
        fontSize: '1.3rem',
        color: iconColor
      }}>
        {icon}
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '0.25rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        {label}
      </div>
    </div>
  );
}

function BusinessDashboardLoading({ label }) {
  return (
    <div className="page-container" style={DASHBOARD_LOADING_STYLE}>
      <div
        style={{
          width: '50px',
          height: '50px',
          border: '4px solid var(--border-color)',
          borderTop: '4px solid var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '1rem',
        }}
      />
      <AppText as="p" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
        {label}
      </AppText>
    </div>
  );
}

const PUBLISH_ANCHOR = 'business-publish-profile';
const NOTIFICATIONS_ANCHOR = 'business-notifications';
const SCROLLABLE_ANCHORS = [PUBLISH_ANCHOR, NOTIFICATIONS_ANCHOR];

const BusinessDashboard = () => {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userProfile, loading: authLoading, isBusiness, profileServerSynced } = useAuth();
  const { getCommunityMembers } = useInvitations();
  const { showToast } = useToast();
  const { unreadBellCount } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [memberCountLoading, setMemberCountLoading] = useState(true);
  const [stats, setStats] = useState({
    memberCount: 0,
    activeInvitations: 0,
    profileViews: 0,
    rating: 0,
    reviewCount: 0,
    engagement: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [publishingProfile, setPublishingProfile] = useState(false);

  const tierAccess = getBusinessSubscriptionAccess(userProfile?.subscriptionTier);
  const hasBusinessAccess =
    isBusiness || (currentUser?.uid && hasBusinessSessionHint(currentUser.uid));

  useEffect(() => {
    if (loading) return;
    const hash = location.hash?.replace('#', '');
    if (!hash || !SCROLLABLE_ANCHORS.includes(hash)) return;
    const el = document.getElementById(hash);
    if (!el) return;
    const frame = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, location.hash, loading]);


  // Fast, direct Firestore reads — gates the page's own loading state.
  const fetchCoreStats = async () => {
    try {
      setLoading(true);

      const invitationsQuery = query(
        collection(db, 'invitations'),
        where('restaurantId', '==', currentUser.uid)
      );
      const reviewsQuery = query(
        collection(db, 'reviews'),
        where('partnerId', '==', currentUser.uid)
      );
      const engagementQuery = query(
        collection(db, 'communityPosts'),
        where('partnerId', '==', currentUser.uid)
      );

      const [invitationsSnapshot, reviewsSnapshot, engagementSnapshot] = await Promise.all([
        getDocs(invitationsQuery),
        getDocs(reviewsQuery),
        getDocs(engagementQuery)
      ]);

      // Active = not expired yet; recent activity = same docs, most recent first.
      const now = new Date();
      const invitations = invitationsSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      const activeInvitations = invitations.filter(
        (inv) => new Date(`${inv.date}T${inv.time}`) > now
      ).length;
      const recentData = [...invitations]
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        .slice(0, 5);

      const reviewsData = reviewsSnapshot.docs.map((docSnap) => docSnap.data());
      const reviewCount = reviewsData.length;
      const rating = reviewCount > 0
        ? reviewsData.reduce((sum, review) => sum + review.rating, 0) / reviewCount
        : 0;

      const engagement = engagementSnapshot.docs.reduce((sum, docSnap) => {
        const post = docSnap.data();
        return sum + (post.likes?.length || 0) + (post.comments?.length || 0);
      }, 0);

      setStats((prev) => ({
        ...prev,
        activeInvitations,
        profileViews: userProfile?.businessInfo?.profileViews || 0,
        rating,
        reviewCount,
        engagement
      }));
      setRecentActivity(recentData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cloud Function callable — can cold-start slowly; never blocks the page itself.
  const fetchMemberCount = async () => {
    try {
      setMemberCountLoading(true);
      const memberResult = await getCommunityMembers(currentUser.uid, {
        includeMembers: false,
        limit: 1
      });
      setStats((prev) => ({ ...prev, memberCount: Number(memberResult?.memberCount || 0) }));
    } catch (error) {
      console.error('Error fetching member count:', error);
    } finally {
      setMemberCountLoading(false);
    }
  };

  // Initial loading state and redirection
  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      navigate('/posts-feed', { replace: true });
      return;
    }
    // Never redirect while Firestore profile is still loading — null userProfile caused navigate('/') and felt like "profile → home".
    if (!userProfile && !hasBusinessSessionHint(currentUser.uid)) return;

    const businessOk =
      isBusiness || (currentUser?.uid && hasBusinessSessionHint(currentUser.uid));
    if (!businessOk) {
      navigate('/posts-feed', { replace: true });
      return;
    }

    if (!tierAccess.canAccessDashboard) {
      setLoading(false);
      return;
    }

    if (userProfile) {
      fetchCoreStats();
      fetchMemberCount();
    }
  }, [currentUser, userProfile, authLoading, navigate, isBusiness]);

  if (authLoading || !profileServerSynced || (loading && hasBusinessAccess)) {
    return (
      <BusinessDashboardLoading label={t('loading_dashboard', 'Loading dashboard...')} />
    );
  }

  if (currentUser && !authLoading && !userProfile) {
    return (
      <BusinessDashboardLoading label={t('loading_dashboard', 'Loading dashboard...')} />
    );
  }

  if (!currentUser || !hasBusinessAccess) {
    if (!currentUser) {
      let pendingBusinessRestore = false;
      try {
        pendingBusinessRestore = Boolean(sessionStorage.getItem('dineb_biz_uid'));
      } catch {
        pendingBusinessRestore = false;
      }
      if (authLoading || !profileServerSynced || pendingBusinessRestore) {
        return (
          <BusinessDashboardLoading label={t('loading_dashboard', 'Loading dashboard...')} />
        );
      }
      return <Navigate to="/login?tab=business" replace />;
    }
    if (!profileServerSynced || !userProfile) {
      return (
        <BusinessDashboardLoading label={t('loading_dashboard', 'Loading dashboard...')} />
      );
    }
    return <Navigate to="/posts-feed" replace />;
  }

  if (!tierAccess.canAccessDashboard) {
    return (
      <BusinessPaidFeatureGate
        titleKey="biz_plan_dashboard_paid_only"
        titleDefault="Business dashboard requires Paid Business"
        hintKey="biz_plan_dashboard_paid_hint"
        hintDefault="Upgrade to access your dashboard, stats, and business tools." />);


  }


  const handlePublishProfile = async () => {
    if (!currentUser?.uid) return;
    if (!currentUser.emailVerified) {
      showToast(
        t('business_publish_verify_email_first', 'Verify your email before publishing to the Partners page.'),
        'error'
      );
      return;
    }
    try {
      setPublishingProfile(true);
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { 'businessInfo.isPublished': true });
      try {
        await syncBusinessPublicProfile(currentUser.uid);
      } catch (syncErr) {
        console.warn('public_profiles sync after publish:', syncErr?.message || syncErr);
      }
      showToast(t('business_publish_success', 'Your business is now visible on the Partners page.'), 'success');
    } catch (error) {
      console.error('Error publishing profile:', error);
      showToast(t('business_publish_error', 'Failed to publish profile: ') + error.message, 'error');
    } finally {
      setPublishingProfile(false);
    }
  };

  const handleUnpublishProfile = async () => {
    if (!currentUser?.uid) return;
    const confirmMsg = t('business_unpublish_confirm', 'Hide your business from the Partners page? (e.g. temporarily closed) You can republish anytime.');
    if (!(await confirm({ message: confirmMsg, tone: 'danger' }))) return;
    try {
      setPublishingProfile(true);
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { 'businessInfo.isPublished': false });
      try {
        await syncBusinessPublicProfile(currentUser.uid);
      } catch (syncErr) {
        console.warn('public_profiles sync after unpublish:', syncErr?.message || syncErr);
      }
      showToast(t('business_unpublish_success', 'Your business is now hidden from the Partners page.'), 'success');
    } catch (error) {
      console.error('Error unpublishing profile:', error);
      showToast(t('business_unpublish_error', 'Failed to hide profile: ') + error.message, 'error');
    } finally {
      setPublishingProfile(false);
    }
  };

  const businessInfo = userProfile?.businessInfo || {};
  const isPublished = businessInfo.isPublished === true;
  const emailVerified = currentUser?.emailVerified === true;
  const canAppearPublic = emailVerified && isPublished;

  return (
    <div className="page-container" style={{ paddingBottom: '100px' }}>
            {/* Header */}
            <header className="app-header sticky-header-glass">
                <div style={{ width: '40px' }}></div>
                <AppText as="h3" style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>
                    📊 {t('business_dashboard', 'Business Dashboard')}
                </AppText>
                <div style={{ display: 'flex', align: 'center', gap: '4px' }}>
                    <button
            className="back-btn"
            onClick={() => navigate('/notifications')}
            aria-label={t('notifications', 'Notifications')}
            title={t('notifications', 'Notifications')}
            style={{ position: 'relative' }}>

                        <FaBell />
                        {unreadBellCount > 0 &&
            <AppText as="span"
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 8,
              background: '#ef4444',
              color: '#fff',
              fontSize: '0.65rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>

                                {unreadBellCount > 9 ? '9+' : unreadBellCount}
                            </AppText>
            }
                    </button>
                    <button
            className="back-btn"
            onClick={() => navigate('/search')}
            aria-label="Search"
            title="Search">

                        <FaSearch />
                    </button>
                    <button className="back-btn" onClick={() => currentUser && navigate(`/business/${currentUser.uid}`)}>
                        <FaEdit />
                    </button>
                </div>
            </header>

            {/* Business Info Card */}
            <div style={{
        marginTop: '24px',
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))',
        border: '2px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '20px',
        padding: '1.5rem',
        marginBottom: '1.5rem'
      }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <img
            src={getSafeAvatar(userProfile)}
            alt="Logo"
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '12px',
              objectFit: 'cover',
              border: '2px solid var(--primary)'
            }} />

                    <div style={{ flex: 1 }}>
                        <AppText as="h2" style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '0.25rem' }}>
                            {userProfile?.display_name || t('your_business', 'Your Business')}
                        </AppText>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                            <AppText as="span" style={{
                padding: '4px 10px',
                background: userProfile?.subscriptionTier === 'elite' ?
                'linear-gradient(135deg, #fbbf24, #d97706)' :
                userProfile?.subscriptionTier === 'professional' ?
                'linear-gradient(135deg, #8b5cf6, #d946ef)' :
                'rgba(156, 163, 175, 0.2)',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: '700',
                color: 'white'
              }}>
                                {userProfile?.subscriptionTier === 'elite' ?
                t('elite_partner', 'Elite Partner') :
                userProfile?.subscriptionTier === 'professional' ?
                t('professional_tier', 'Professional') :
                t('free_plan', 'Free Plan')}
                            </AppText>
                            {(!userProfile?.subscriptionTier || userProfile?.subscriptionTier === 'free') &&
              <button
                onClick={() => navigate('/settings/subscription')}
                style={{
                  border: 'none',
                  background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '0.7rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
                  marginLeft: '8px',
                  transition: 'transform 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>

                                    {t('upgrade_now', 'Upgrade Now')}
                                </button>
              }
                        </div>
                        <AppText as="p" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                            {t((businessInfo.businessType || 'business').toLowerCase(), businessInfo.businessType || 'Business')} • {businessInfo.city || t('location', 'Location')}
                        </AppText>
                    </div>
                </div>

                {/* Trial Promo Banner */}
                {(!userProfile?.subscriptionTier || userProfile?.subscriptionTier === 'free') &&
        <div
          onClick={() => navigate('/settings/subscription')}
          style={{
            background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
            padding: '12px 20px',
            borderRadius: '16px',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'white',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(234, 88, 12, 0.3)',
            animation: 'pulse 2s infinite ease-in-out'
          }}>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ fontSize: '1.5rem' }}>🎁</div>
                            <div>
                                <AppText as="h4" style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800' }}>
                                    {t('try_elite_free', 'Try Elite Partner FREE!')}
                                </AppText>
                                <AppText as="p" style={{ margin: 0, fontSize: '0.8rem', opacity: 0.9 }}>
                                    {t('get_elite_features_promo', 'Get a full month of Elite features')}
                                </AppText>
                            </div>
                        </div>
                        <div style={{
            background: 'white',
            color: '#ea580c',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: '900'
          }}>
                            Explore
                        </div>
                    </div>
        }

                {/* Publish Profile banner — public listing needs verified email + opt-in publish */}
                {canAppearPublic ?
        <div style={{
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))',
          border: '1px solid rgba(34, 197, 94, 0.4)',
          padding: '14px 20px',
          borderRadius: '16px',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          color: 'var(--text-main)'
        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <FaCheckCircle style={{ color: '#22c55e', fontSize: '1.25rem' }} />
                            <AppText as="span" style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                                {t('business_visible_page', 'Your business is visible on the Businesses page.')}
                            </AppText>
                        </div>
                        <button
            onClick={handleUnpublishProfile}
            disabled={publishingProfile}
            style={{
              alignSelf: 'flex-start',
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              color: 'var(--text-muted)',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: publishingProfile ? 'wait' : 'pointer',
              opacity: publishingProfile ? 0.7 : 1
            }}>

                            {publishingProfile ? t('please_wait', 'Please wait...') : t('unpublish_profile', 'Hide from Partners (e.g. temporarily closed)')}
                        </button>
                    </div> :
        !emailVerified ?
        <div style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(139, 92, 246, 0.06))',
          border: '1px solid rgba(59, 130, 246, 0.35)',
          padding: '14px 20px',
          borderRadius: '16px',
          marginBottom: '1.5rem',
          color: 'var(--text-main)'
        }}>
                        <AppText as="h4" style={{ margin: '0 0 8px 0', fontSize: '0.95rem', fontWeight: '700' }}>
                            {t('business_publish_need_verify_title', 'Verify your email to publish')}
                        </AppText>
                        <AppText as="p" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            {t('business_publish_need_verify_desc', 'After you verify, you can publish your profile below or hide it anytime (e.g. vacation).')}
                        </AppText>
                    </div> :

        <div
          id={PUBLISH_ANCHOR}
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.05))',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            padding: '14px 20px',
            borderRadius: '16px',
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-main)' }}>
                            <FaGlobe style={{ color: 'var(--primary)', fontSize: '1.25rem' }} />
                            <div>
                                <AppText as="h4" style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700' }}>
                                    {t('business_not_visible_title', 'Your business is not visible on the Partners page')}
                                </AppText>
                                <AppText as="p" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    {t('business_not_visible_desc', 'Publish your profile to appear in the directory and be discoverable by users.')}
                                </AppText>
                            </div>
                        </div>
                        <button
            onClick={handlePublishProfile}
            disabled={publishingProfile}
            style={{
              alignSelf: 'flex-start',
              padding: '10px 20px',
              background: 'var(--primary)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: publishingProfile ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: publishingProfile ? 0.7 : 1
            }}>

                            {publishingProfile ?
            <AppText as="span" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <AppText as="span" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.5)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                    {t('publishing', 'Publishing...')}
                                </AppText> :

            <>
                                    <FaGlobe /> {t('publish_profile', 'Publish Profile')}
                                </>
            }
                        </button>
                    </div>
        }

                {/* Quick Actions */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <QuickActionButton
            icon={<FaInbox />}
            label={t('inbox_and_complaints', 'Inbox & complaints')}
            onClick={() => navigate('/business-dashboard/inbox')} />

                    <QuickActionButton
            icon={<FaEdit />}
            label={t('btn_edit_profile', 'Edit Profile')}
            onClick={() => currentUser && navigate(`/business/${currentUser.uid}`)} />

                    <QuickActionButton
            icon={<FaComments />}
            label={t('chat', 'Chat')}
            onClick={() => currentUser && navigate(`/community/${currentUser.uid}`)} />

                    <QuickActionButton
            icon={<FaChartLine />}
            label={t('analytics', 'Analytics')}
            onClick={() => navigate('/my-community/analytics')} />

                    <QuickActionButton
            icon={<FaArchive />}
            label={t('archive', 'Archive')}
            onClick={() => navigate('/my-community/archive')} />

                    <QuickActionButton
            icon={<FaCog />}
            label={t('btn_settings', 'Settings')}
            onClick={() => navigate('/settings')} />

                </div>
            </div>

            {/* Stats Grid */}
            <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
                <StatTile icon={<FaUsers />} iconColor="#22c55e" iconBg="rgba(34, 197, 94, 0.1)" value={memberCountLoading ? '…' : stats.memberCount} label={t('stat_cmty_members', 'Community Members')} />
                <StatTile icon={<FaUserPlus />} iconColor="var(--primary)" iconBg="rgba(139, 92, 246, 0.1)" value={stats.activeInvitations} label={t('stat_active_invites', 'Active Invitations')} />
                <StatTile icon={<FaEye />} iconColor="#3b82f6" iconBg="rgba(59, 130, 246, 0.1)" value={stats.profileViews} label={t('stat_profile_views', 'Profile Views')} />
                <StatTile icon={<FaStar />} iconColor="#fbbf24" iconBg="rgba(251, 191, 36, 0.1)" value={stats.rating.toFixed(1)} label={`${t('stat_rating_reviews', 'Rating')} (${stats.reviewCount} ${t('stat_reviews', 'reviews')})`} />
                <StatTile icon={<FaHeart />} iconColor="#ef4444" iconBg="rgba(239, 68, 68, 0.1)" value={stats.engagement} label={t('engagement', 'Engagement')} title={t('engagement_tooltip', 'Likes and comments on your community posts')} />
            </div>

            {/* Recent Activity */}
            <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '1.5rem'
      }}>
                <AppText as="h3" style={{
          fontSize: '1.1rem',
          fontWeight: '800',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
                    <FaCalendar style={{ color: 'var(--primary)' }} />
                    {t('recent_activity', 'Recent Activity')}
                </AppText>

                {recentActivity.length === 0 ?
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          color: 'var(--text-muted)'
        }}>
                        <FaUserPlus style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }} />
                        <AppText as="p">{t('no_recent_activity', 'No recent activity')}</AppText>
                    </div> :

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {recentActivity.map((activity) =>
          <div
            key={activity.id}
            onClick={() => navigate(`/invitation/${activity.id}`)}
            style={{
              padding: '1rem',
              background: 'rgba(139, 92, 246, 0.05)',
              border: '1px solid rgba(139, 92, 246, 0.1)',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.1)';
            }}>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--primary), #f97316)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                color: 'var(--btn-text)'
              }}>
                                        <FaUserPlus />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '700', marginBottom: '4px' }}>
                                            {t('new_invitation', 'New Invitation')}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            {activity.createdAt?.toDate?.()?.toLocaleDateString() || t('recent', 'Recent')}
                                        </div>
                                    </div>
                                </div>
                            </div>
          )}
                    </div>
        }
            </div>

        </div>);

};

export default BusinessDashboard;