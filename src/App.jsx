import React, { Suspense, lazy, useState, useEffect, useLayoutEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
// Home is lazy-loaded to reduce initial bundle size

// User Pages
import CreateInvitation from './pages/CreateInvitation';
import CreatePrivateInvitation from './pages/CreatePrivateInvitation';
import CreateDatingInvitation from './pages/CreateDatingInvitation';
import CreatePost from './pages/CreatePost';
import PostDetails from './pages/PostDetails';
import PricingPage from './pages/PricingPage';
import PersonalAuth from './pages/auth/PersonalAuth';
import BusinessAuthPlaceholder from './pages/auth/BusinessAuthPlaceholder';
import CompleteProfile from './pages/CompleteProfile';
import Settings from './pages/Settings';

import EmailSettings from './pages/EmailSettings';
import PasswordSettings from './pages/PasswordSettings';
import NotificationsSettings from './pages/NotificationsSettings';
import LanguageSettings from './pages/LanguageSettings';
import PrivacySettings from './pages/PrivacySettings';
import SubscriptionSettings from './pages/SubscriptionSettings';
import PaymentSettings from './pages/PaymentSettings';
import BillingSettings from './pages/BillingSettings';
import PaymentSuccess from './pages/PaymentSuccess';
import AuthActionHandler from './pages/AuthActionHandler';
import VerifyEmail from './pages/VerifyEmail';

import BusinessDashboard from './pages/BusinessDashboard';
import BusinessProfile from './pages/BusinessProfile';
import BusinessOnboarding from './pages/BusinessOnboarding';
import PostsFeed from './pages/PostsFeed';
import HomeRouter from './components/HomeRouter';
import BusinessLimitsManager from './pages/AdminDashboard';
import LegalPrivacy from './pages/PrivacyPolicy';
import LegalTerms from './pages/TermsOfService';
import CommunityGuidelines from './pages/CommunityGuidelines';
import AccountDeletionRequest from './pages/AccountDeletionRequest';
import NotFound from './pages/NotFound';
import PrivateInvitationOverlay from './components/Invitation/PrivateInvitationOverlay';

// Admin Pages
import AdminRoute from './components/AdminRoute';

import BusinessBlockedRoute from './components/BusinessBlockedRoute';
import GuestBlockedRoute from './components/GuestBlockedRoute';

// Contexts
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { InvitationProvider } from './context/InvitationContext';
import { StripeProvider } from './context/StripeContext';
import { ChatProvider } from './context/ChatContext';
import { NotificationProvider } from './context/NotificationContext';

import StaffBlockedRoute from './components/StaffBlockedRoute';
import ProfileGuard from './components/ProfileGuard';
import OfflineNotice from './components/OfflineNotice';
import InstallPrompt from './components/InstallPrompt';
import AuthBlockedRoute from './components/AuthBlockedRoute';
import { usePresence } from './hooks/usePresence';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase/config';
import { useParams, useNavigate } from 'react-router-dom';
import { registerLoginRouter, unregisterLoginRouter } from './utils/goToLogin';

import SeoUpdater from './components/SeoUpdater';

const Home = lazy(() => import('./pages/Home'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const BusinessProDashboard = lazy(() => import('./pages/BusinessProDashboard'));
const CreateStory = lazy(() => import('./pages/CreateStory'));
const InvitationDetails = lazy(() => import('./pages/InvitationDetails'));
const InvitationPreview = lazy(() => import('./pages/InvitationPreview'));
const InvitationChatRoom = lazy(() => import('./pages/InvitationChatRoom'));
const PrivateInvitationPreview = lazy(() => import('./pages/PrivateInvitationPreview'));
const PrivateInvitationDetails = lazy(() => import('./pages/PrivateInvitationDetails'));
const Profile = lazy(() => import('./pages/Profile'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const HelpSupport = lazy(() => import('./pages/HelpSupport'));
const Notifications = lazy(() => import('./pages/Notifications'));
const FriendsFeed = lazy(() => import('./pages/FriendsFeed'));
const BusinessesDirectory = lazy(() => import('./pages/BusinessesDirectory'));
const BusinessRankings = lazy(() => import('./pages/BusinessRankings'));
const RestaurantDetails = lazy(() => import('./pages/RestaurantDetails'));
const FollowersList = lazy(() => import('./pages/FollowersList'));
const ChatList = lazy(() => import('./pages/ChatList'));
const Chat = lazy(() => import('./pages/Chat'));
const PremiumOfferPage = lazy(() => import('./pages/PremiumOfferPage'));
const MyCommunities = lazy(() => import('./pages/MyCommunities'));
const MyCommunity = lazy(() => import('./pages/MyCommunity'));
const CommunityChatRoom = lazy(() => import('./pages/CommunityChatRoom'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminHome = lazy(() => import('./pages/admin/AdminHome'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const Plans = lazy(() => import('./pages/admin/Plans'));
const SubscriptionManagement = lazy(() => import('./pages/admin/SubscriptionManagement'));
const BusinessManagement = lazy(() => import('./pages/admin/BusinessManagement'));
const InvitationManagement = lazy(() => import('./pages/admin/InvitationManagement'));
const ReportsAnalytics = lazy(() => import('./pages/admin/ReportsAnalytics'));
const MigrationTools = lazy(() => import('./pages/admin/MigrationTools'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const CodeBackups = lazy(() => import('./pages/admin/CodeBackups'));
const AdminChatCommunity = lazy(() => import('./pages/admin/AdminChatCommunity'));
const AdminNotifications = lazy(() => import('./pages/admin/AdminNotifications'));
const AdminSystemTools = lazy(() => import('./pages/admin/AdminSystemTools'));
const AdminAuditLog = lazy(() => import('./pages/admin/AdminAuditLog'));
const AdminGrantCredits = lazy(() => import('./pages/admin/AdminGrantCredits'));

const RedirectPartnerToBusiness = () => {
    const { partnerId } = useParams();
    return <Navigate to={`/business/${partnerId || ''}`} replace />;
};

const SmartProfileRoute = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [profileRole, setProfileRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const { currentUser, userProfile, isBusiness, loading: authLoading } = useAuth();

    useEffect(() => {
        if (authLoading) return;
        if (!userId) { setLoading(false); return; }

        if (currentUser?.uid === userId) {
            setProfileRole(isBusiness ? 'business' : 'user');
            setLoading(false);
            return;
        }

        getDoc(doc(db, 'public_profiles', userId))
            .then(snap => {
                if (snap.exists()) {
                    setProfileRole(snap.data().profileType === 'business' ? 'business' : 'user');
                } else {
                    setProfileRole((currentUser?.uid === userId && isBusiness) ? 'business' : 'user');
                }
            })
            .catch(() => setProfileRole('user'))
            .finally(() => setLoading(false));
    }, [userId, currentUser?.uid, isBusiness, authLoading]);

    useEffect(() => {
        if (profileRole === 'business' && !authLoading && !loading) {
            navigate(`/business/${userId}`, { replace: true });
        }
    }, [profileRole, userId, navigate, authLoading, loading]);

    if (loading || profileRole === 'business') {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
                <div style={{ width: 40, height: 40, border: '4px solid rgba(148, 163, 184, 0.35)', borderTop: '4px solid #a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    return <UserProfile />;
};

// Activates presence tracking for the logged-in user globally
const PresenceManager = () => { usePresence(); return null; };

/** Fallback for lazy routes: use real colors — var(--primary) may be unset on first paint (invisible spinner ≈ "blank"). */
const routeSuspenseFallback = (
    <div
        style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: '#0f0817',
        }}
    >
        <div
            style={{
                width: 40,
                height: 40,
                border: '4px solid rgba(148, 163, 184, 0.35)',
                borderTop: '4px solid #a855f7',
                borderRadius: '50%',
                animation: 'routeSuspenseSpin 0.9s linear infinite',
            }}
        />
        <style>{`@keyframes routeSuspenseSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
);

function RouteSuspenseLayout() {
    return <Suspense fallback={routeSuspenseFallback}><Outlet /></Suspense>;
}

/** Registers `navigate` for `goToLogin()` so all login CTAs use SPA navigation (reliable paint of /login). */
function LoginRouterBridge() {
    const navigate = useNavigate();
    useLayoutEffect(() => {
        registerLoginRouter(navigate);
        return () => unregisterLoginRouter();
    }, [navigate]);
    return null;
}

function App() {
    return (
        <ThemeProvider>
            <ToastProvider>
                <Router future={{ v7_relativeSplatPath: true }}>
                    <LoginRouterBridge />
                    <AuthProvider>
                        <InvitationProvider>
                            <NotificationProvider>
                                <ChatProvider>
                                    <StripeProvider>
                                        {/* Temporarily disable non-essential global overlays/services while stabilizing auth screens */}
                                        {/* <SeoUpdater /> */}
                                        {/* <PresenceManager /> */}
                                        {/* <OfflineNotice /> */}
                                        {/* <InstallPrompt /> */}
                                        {/* <PrivateInvitationOverlay /> */}
                                        <Routes>
                                                {/* No Suspense wrapper — client navigation to /login must not sit behind lazy-route Suspense */}
                                                <Route path="/auth/action" element={<AuthActionHandler />} />
                                                {/* Firebase Hosting often redirects email action links to /__/auth/action on custom domain */}
                                                <Route path="/__/auth/action" element={<AuthActionHandler />} />
                                                <Route path="/login" element={<AuthBlockedRoute><PersonalAuth /></AuthBlockedRoute>} />
                                                <Route path="/login/user" element={<Navigate to="/login" replace />} />
                                                <Route path="/login/signup" element={<Navigate to="/login" replace />} />
                                                <Route path="/auth" element={<Navigate to="/login" replace />} />
                                                <Route path="/business/signup" element={<AuthBlockedRoute><BusinessAuthPlaceholder /></AuthBlockedRoute>} />
                                                <Route path="/business/login" element={<AuthBlockedRoute><BusinessAuthPlaceholder /></AuthBlockedRoute>} />
                                                <Route path="/verify-email" element={<GuestBlockedRoute><VerifyEmail /></GuestBlockedRoute>} />
                                                <Route path="/complete-profile" element={<CompleteProfile />} />

                                                {/* Landing Page Route (Fullscreen) */}
                                                <Route path="/" element={<HomeRouter />} />

                                                <Route path="/login/" element={<Navigate to="/login" replace />} />
                                                <Route path="/business/login/" element={<Navigate to="/business/login" replace />} />

                                                <Route element={<RouteSuspenseLayout />}>
                                                <Route path="/business-pro/*" element={<GuestBlockedRoute><BusinessProDashboard /></GuestBlockedRoute>} />

                                                {/* User Routes with Layout */}
                                                <Route element={<Layout />}>
                                                    <Route path="/post/:postId" element={<PostDetails />} />
                                                    <Route path="/post/featured/:featuredId" element={<PostDetails />} />
                                                    <Route path="/search" element={<SearchPage />} />
                                                    <Route path="/invitations" element={<Home />} />
                                                    <Route path="/create" element={<GuestBlockedRoute><StaffBlockedRoute><BusinessBlockedRoute><ProfileGuard><CreateInvitation /></ProfileGuard></BusinessBlockedRoute></StaffBlockedRoute></GuestBlockedRoute>} />
                                                    <Route path="/create-private" element={<GuestBlockedRoute><StaffBlockedRoute><BusinessBlockedRoute><ProfileGuard><CreatePrivateInvitation /></ProfileGuard></BusinessBlockedRoute></StaffBlockedRoute></GuestBlockedRoute>} />
                                                    <Route path="/create-dating" element={<GuestBlockedRoute><StaffBlockedRoute><BusinessBlockedRoute><ProfileGuard><CreateDatingInvitation /></ProfileGuard></BusinessBlockedRoute></StaffBlockedRoute></GuestBlockedRoute>} />
                                                    <Route path="/create-post" element={<GuestBlockedRoute><StaffBlockedRoute><ProfileGuard><CreatePost /></ProfileGuard></StaffBlockedRoute></GuestBlockedRoute>} />
                                                    <Route path="/create-story" element={<GuestBlockedRoute><StaffBlockedRoute><ProfileGuard><CreateStory /></ProfileGuard></StaffBlockedRoute></GuestBlockedRoute>} />
                                                    <Route path="/invitation/preview/:id" element={<InvitationPreview />} />
                                                    <Route path="/invitation/private/preview/:id" element={<PrivateInvitationPreview />} />
                                                    <Route path="/invitation/private/:id" element={<PrivateInvitationDetails />} />
                                                    <Route path="/invitation/:id" element={<InvitationDetails />} />
                                                    <Route path="/invitation/:id/chat" element={<InvitationChatRoom />} />
                                                    <Route path="/restaurants" element={<BusinessesDirectory />} />
                                                    <Route path="/rankings" element={<BusinessRankings />} />
                                                    <Route path="/restaurant/:id" element={<RestaurantDetails />} />
                                                    <Route path="/friends" element={<GuestBlockedRoute><FriendsFeed /></GuestBlockedRoute>} />
                                                    <Route path="/followers" element={<GuestBlockedRoute><FollowersList /></GuestBlockedRoute>} />
                                                    <Route path="/followers/:userId" element={<GuestBlockedRoute><FollowersList /></GuestBlockedRoute>} />
                                                    <Route path="/messages" element={<GuestBlockedRoute><ChatList /></GuestBlockedRoute>} />
                                                    <Route path="/chat/:userId" element={<GuestBlockedRoute><Chat /></GuestBlockedRoute>} />
                                                    <Route path="/profile" element={<GuestBlockedRoute><Profile /></GuestBlockedRoute>} />
                                                    <Route path="/profile/:userId" element={<SmartProfileRoute />} />
                                                    <Route path="/notifications" element={<GuestBlockedRoute><Notifications /></GuestBlockedRoute>} />
                                                    <Route path="/pricing" element={<PricingPage />} />
                                                    <Route path="/business/pricing" element={<PricingPage />} />
                                                    <Route path="/payment-success" element={<PaymentSuccess />} />
                                                    <Route path="/settings" element={<GuestBlockedRoute><Settings /></GuestBlockedRoute>} />
                                                    <Route path="/settings/email" element={<GuestBlockedRoute><EmailSettings /></GuestBlockedRoute>} />
                                                    <Route path="/settings/password" element={<GuestBlockedRoute><PasswordSettings /></GuestBlockedRoute>} />
                                                    <Route path="/settings/notifications" element={<GuestBlockedRoute><NotificationsSettings /></GuestBlockedRoute>} />
                                                    <Route path="/settings/language" element={<GuestBlockedRoute><LanguageSettings /></GuestBlockedRoute>} />
                                                    <Route path="/settings/privacy" element={<GuestBlockedRoute><PrivacySettings /></GuestBlockedRoute>} />
                                                    <Route path="/settings/subscription" element={<GuestBlockedRoute><SubscriptionSettings /></GuestBlockedRoute>} />
                                                    <Route path="/settings/payment" element={<GuestBlockedRoute><PaymentSettings /></GuestBlockedRoute>} />
                                                    <Route path="/settings/billing" element={<GuestBlockedRoute><BillingSettings /></GuestBlockedRoute>} />
                                                    <Route path="/business-dashboard" element={<GuestBlockedRoute><BusinessDashboard /></GuestBlockedRoute>} />
                                                    <Route path="/business/onboarding" element={<GuestBlockedRoute><BusinessOnboarding /></GuestBlockedRoute>} />
                                                    <Route path="/partners" element={<Navigate to="/restaurants" replace />} />
                                                    <Route path="/business/:businessId" element={<BusinessProfile />} />
                                                    <Route path="/partner/:partnerId" element={<RedirectPartnerToBusiness />} />
                                                    <Route path="/offer/new" element={<GuestBlockedRoute><PremiumOfferPage /></GuestBlockedRoute>} />
                                                    <Route path="/offer/edit/:id" element={<GuestBlockedRoute><PremiumOfferPage /></GuestBlockedRoute>} />
                                                    <Route path="/communities" element={<GuestBlockedRoute><MyCommunities /></GuestBlockedRoute>} />
                                                    <Route path="/my-community" element={<GuestBlockedRoute><MyCommunity /></GuestBlockedRoute>} />
                                                    <Route path="/community/:partnerId" element={<GuestBlockedRoute><CommunityChatRoom /></GuestBlockedRoute>} />
                                                    <Route path="/posts-feed" element={<PostsFeed />} />
                                                    <Route path="/admin-panel" element={<Navigate to="/admin" replace />} />
                                                </Route>

                                                {/* Admin Routes */}
                                                <Route path="/admin/*" element={<AdminRoute><AdminLayout /></AdminRoute>}>
                                                    <Route path="dashboard" element={<AdminHome />} />
                                                    <Route path="users" element={<UserManagement />} />
                                                    <Route path="invitations" element={<InvitationManagement />} />
                                                    <Route path="chat-community" element={<AdminChatCommunity />} />
                                                    <Route path="businesses" element={<BusinessManagement />} />
                                                    <Route path="partners" element={<Navigate to="/admin/businesses" replace />} />
                                                    <Route path="reports" element={<ReportsAnalytics />} />
                                                    <Route path="notifications" element={<AdminNotifications />} />
                                                    <Route path="subscriptions" element={<SubscriptionManagement />} />
                                                    <Route path="plans" element={<Plans />} />
                                                    <Route path="system-tools" element={<AdminSystemTools />} />
                                                    <Route path="audit-log" element={<AdminAuditLog />} />
                                                    <Route path="grant-credits" element={<AdminGrantCredits />} />
                                                    <Route path="business-limits" element={<BusinessLimitsManager />} />
                                                    <Route path="migration" element={<MigrationTools />} />
                                                    <Route path="settings" element={<AdminSettings />} />
                                                    <Route path="backups" element={<CodeBackups />} />
                                                    <Route index element={<Navigate to="/admin/dashboard" replace />} />
                                                </Route>

                                                {/* Public Legal Pages */}
                                                <Route path="/privacy" element={<LegalPrivacy />} />
                                                <Route path="/terms" element={<LegalTerms />} />
                                                <Route path="/guidelines" element={<CommunityGuidelines />} />
                                                <Route path="/account-deletion" element={<AccountDeletionRequest />} />
                                                <Route path="/support" element={<HelpSupport />} />
                                                </Route>

                                                <Route path="*" element={<NotFound />} />
                                        </Routes>
                                    </StripeProvider>
                                </ChatProvider>
                            </NotificationProvider>
                        </InvitationProvider>
                    </AuthProvider>
                </Router>
            </ToastProvider>
        </ThemeProvider>
    );
}

export default App;
