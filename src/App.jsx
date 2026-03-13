import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';

// User Pages
import CreateInvitation from './pages/CreateInvitation';
import CreatePrivateInvitation from './pages/CreatePrivateInvitation';
import CreatePost from './pages/CreatePost';
import PricingPage from './pages/PricingPage';
import AuthPage from './pages/AuthPage';
import QuickLogin from './pages/QuickLogin';
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
import BusinessSignup from './pages/BusinessSignup';

import BusinessDashboard from './pages/BusinessDashboard';
import PostsFeed from './pages/PostsFeed';
import BusinessLimitsManager from './pages/AdminDashboard';
import LegalPrivacy from './pages/PrivacyPolicy';
import LegalTerms from './pages/TermsOfService';
import CommunityGuidelines from './pages/CommunityGuidelines';
import AccountDeletionRequest from './pages/AccountDeletionRequest';
import PrivateInvitationOverlay from './components/Invitation/PrivateInvitationOverlay';

// Admin Pages
import AdminRoute from './components/AdminRoute';

import BusinessBlockedRoute from './components/BusinessBlockedRoute';
import GuestBlockedRoute from './components/GuestBlockedRoute';

// Contexts
import { ToastProvider } from './context/ToastContext';
import { InvitationProvider } from './context/InvitationContext';
import { AuthProvider } from './context/AuthContext';
import { StripeProvider } from './context/StripeContext';
import { ChatProvider } from './context/ChatContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navigate } from 'react-router-dom';

import StaffBlockedRoute from './components/StaffBlockedRoute';
import ProfileGuard from './components/ProfileGuard';
import OfflineNotice from './components/OfflineNotice';
import AuthBlockedRoute from './components/AuthBlockedRoute';
import { usePresence } from './hooks/usePresence';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase/config';
import { useParams, useNavigate } from 'react-router-dom';

const BusinessProDashboard = lazy(() => import('./pages/BusinessProDashboard'));
const SocialCreator = lazy(() => import('./features/social-creator/index.jsx'));
const CreateStory = lazy(() => import('./pages/CreateStory'));
const InvitationDetails = lazy(() => import('./pages/InvitationDetails'));
const InvitationPreview = lazy(() => import('./pages/InvitationPreview'));
const InvitationChatRoom = lazy(() => import('./pages/InvitationChatRoom'));
const PrivateInvitationPreview = lazy(() => import('./pages/PrivateInvitationPreview'));
const PrivateInvitationDetails = lazy(() => import('./pages/PrivateInvitationDetails'));
const Profile = lazy(() => import('./pages/Profile'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const Notifications = lazy(() => import('./pages/Notifications'));
const FriendsFeed = lazy(() => import('./pages/FriendsFeed'));
const BusinessesDirectory = lazy(() => import('./pages/BusinessesDirectory'));
const RestaurantDetails = lazy(() => import('./pages/RestaurantDetails'));
const FollowersList = lazy(() => import('./pages/FollowersList'));
const ChatList = lazy(() => import('./pages/ChatList'));
const Chat = lazy(() => import('./pages/Chat'));
const BusinessProfile = lazy(() => import('./pages/BusinessProfile'));
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

const RedirectPartnerToBusiness = () => {
    const { partnerId } = useParams();
    return <Navigate to={`/business/${partnerId || ''}`} replace />;
};

// Smart profile router: by role only. role business → BusinessProfile, else UserProfile.
const SmartProfileRoute = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [profileRole, setProfileRole] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) { setLoading(false); return; }
        getDoc(doc(db, 'users', userId))
            .then(snap => {
                if (snap.exists()) {
                    const d = snap.data();
                    setProfileRole(d.role || 'user');
                } else {
                    setProfileRole('user');
                }
            })
            .catch(() => setProfileRole('user'))
            .finally(() => setLoading(false));
    }, [userId]);

    useEffect(() => {
        if (profileRole === null) return;
        if (profileRole === 'business') {
            navigate(`/business/${userId}`, { replace: true });
        }
    }, [profileRole, userId, navigate]);

    if (loading || profileRole === 'business') {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
                <div style={{ width: 40, height: 40, border: '4px solid var(--border-color)', borderTop: '4px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    return <UserProfile />;
};

// Activates presence tracking for the logged-in user globally
const PresenceManager = () => { usePresence(); return null; };

function App() {
    return (
        <ThemeProvider>
            <ToastProvider>
                <AuthProvider>
                    <InvitationProvider>
                    <NotificationProvider>
                        <ChatProvider>
                            <StripeProvider>
                                <Router>
                                    <PresenceManager />
                                    <OfflineNotice />
                                    <PrivateInvitationOverlay />
                                    <Suspense fallback={
                                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
                                            <div style={{ width: 38, height: 38, border: '4px solid var(--border-color)', borderTop: '4px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                        </div>
                                    }>
                                        <Routes>
                                        {/* Auth Routes */}
                                        <Route path="/login" element={<AuthBlockedRoute><QuickLogin /></AuthBlockedRoute>} />
                                        <Route path="/auth" element={<AuthBlockedRoute><AuthPage /></AuthBlockedRoute>} />
                                        <Route path="/business/signup" element={<AuthBlockedRoute><BusinessSignup /></AuthBlockedRoute>} />
                                        <Route path="/complete-profile" element={<CompleteProfile />} />
                                        <Route path="/business-pro" element={<BusinessProDashboard />} />
                                        {/* ── Social Creator ── isolated feature */}
                                        <Route path="/social-creator" element={<SocialCreator />} />

                                        {/* User Routes with Layout */}
                                        <Route element={<Layout />}>
                                            <Route path="/" element={<PostsFeed />} />
                                            <Route path="/invitations" element={<Home />} />
                                            <Route path="/create" element={<GuestBlockedRoute><StaffBlockedRoute><BusinessBlockedRoute><ProfileGuard><CreateInvitation /></ProfileGuard></BusinessBlockedRoute></StaffBlockedRoute></GuestBlockedRoute>} />
                                            <Route path="/create-private" element={<GuestBlockedRoute><StaffBlockedRoute><BusinessBlockedRoute><ProfileGuard><CreatePrivateInvitation /></ProfileGuard></BusinessBlockedRoute></StaffBlockedRoute></GuestBlockedRoute>} />
                                            <Route path="/create-post" element={<GuestBlockedRoute><StaffBlockedRoute><ProfileGuard><CreatePost /></ProfileGuard></StaffBlockedRoute></GuestBlockedRoute>} />
                                            <Route path="/create-story" element={<GuestBlockedRoute><StaffBlockedRoute><ProfileGuard><CreateStory /></ProfileGuard></StaffBlockedRoute></GuestBlockedRoute>} />
                                            <Route path="/invitation/preview/:id" element={<InvitationPreview />} />
                                            <Route path="/invitation/private/preview/:id" element={<PrivateInvitationPreview />} />
                                            <Route path="/invitation/private/:id" element={<PrivateInvitationDetails />} />
                                            <Route path="/invitation/:id" element={<InvitationDetails />} />
                                            <Route path="/invitation/:id/chat" element={<InvitationChatRoom />} />
                                            <Route path="/restaurants" element={<BusinessesDirectory />} />
                                            <Route path="/restaurant/:id" element={<RestaurantDetails />} />
                                            <Route path="/friends" element={<GuestBlockedRoute><FriendsFeed /></GuestBlockedRoute>} />
                                            <Route path="/followers" element={<GuestBlockedRoute><FollowersList /></GuestBlockedRoute>} />
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
                                            <Route path="/business-dashboard" element={<BusinessDashboard />} />
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
                                        </Routes>
                                    </Suspense>
                                </Router>
                            </StripeProvider>
                        </ChatProvider>
                    </NotificationProvider>
                    </InvitationProvider>
                </AuthProvider>
            </ToastProvider>
        </ThemeProvider>
    );
}

export default App;
