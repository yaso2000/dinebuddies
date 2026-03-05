import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';

// User Pages
import CreateInvitation from './pages/CreateInvitation';
import CreatePrivateInvitation from './pages/CreatePrivateInvitation';
import PrivateInvitationPreview from './pages/PrivateInvitationPreview';
import PrivateInvitationDetails from './pages/PrivateInvitationDetails';
import CreatePost from './pages/CreatePost';
import CreateStory from './pages/CreateStory';
import InvitationDetails from './pages/InvitationDetails';
import InvitationPreview from './pages/InvitationPreview';
import InvitationChatRoom from './pages/InvitationChatRoom';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';
import Notifications from './pages/Notifications';
import FriendsFeed from './pages/FriendsFeed';
import RestaurantDirectory from './pages/RestaurantDirectory';
import RestaurantDetails from './pages/RestaurantDetails';
import FollowersList from './pages/FollowersList';
import ChatList from './pages/ChatList';
import Chat from './pages/Chat';
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



import PartnerProfile from './pages/PartnerProfile';
import PremiumOfferPage from './pages/PremiumOfferPage';
import BusinessDashboard from './pages/BusinessDashboard';
import BusinessProDashboard from './pages/BusinessProDashboard';
import MyCommunities from './pages/MyCommunities';
import MyCommunity from './pages/MyCommunity';
import CommunityChatRoom from './pages/CommunityChatRoom';
import PostsFeed from './pages/PostsFeed';
import BusinessLimitsManager from './pages/AdminDashboard';
import AdminPanel from './pages/AdminPanel';
import MigrationPage from './pages/MigrationPage';
import LegalPrivacy from './pages/PrivacyPolicy';
import LegalTerms from './pages/TermsOfService';
import PrivateInvitationOverlay from './components/Invitation/PrivateInvitationOverlay';


// Admin Pages
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import PlanManagement from './pages/admin/PlanManagement';
import PlanEditor from './pages/admin/PlanEditor';
import SubscriptionManagement from './pages/admin/SubscriptionManagement';
import PartnerManagement from './pages/admin/PartnerManagement';
import InvitationManagement from './pages/admin/InvitationManagement';
import ReportsAnalytics from './pages/admin/ReportsAnalytics';
import MigrationTools from './pages/admin/MigrationTools';
import AdminSettings from './pages/admin/AdminSettings';
import CodeBackups from './pages/admin/CodeBackups';
import AdminRoute from './components/AdminRoute';

import BusinessBlockedRoute from './components/BusinessBlockedRoute';
import GuestBlockedRoute from './components/GuestBlockedRoute';



// Contexts
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
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase/config';
import { useParams, useNavigate } from 'react-router-dom';

// Smart profile router: shows PartnerProfile for business accounts, UserProfile for regular users
const SmartProfileRoute = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [accountType, setAccountType] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) { setLoading(false); return; }
        getDoc(doc(db, 'users', userId))
            .then(snap => {
                if (snap.exists()) {
                    const d = snap.data();
                    setAccountType(d.role || 'user');
                } else {
                    setAccountType('user');
                }
            })
            .catch(() => setAccountType('user'))
            .finally(() => setLoading(false));
    }, [userId]);

    // Redirect business accounts to /partner/:userId (PartnerProfile reads 'partnerId' from params)
    useEffect(() => {
        if (accountType === null) return;
        if (accountType === 'business') {
            navigate(`/partner/${userId}`, { replace: true });
        }
    }, [accountType, userId, navigate]);

    if (loading || accountType === 'business') {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
                <div style={{ width: 40, height: 40, border: '4px solid var(--border-color)', borderTop: '4px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    return <UserProfile />;
};

function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <InvitationProvider>
                    <NotificationProvider>
                        <ChatProvider>
                            <StripeProvider>
                                <Router>
                                    <OfflineNotice />
                                    <PrivateInvitationOverlay />

                                    <Routes>
                                        {/* Auth Routes - Blocked if already logged in */}
                                        <Route path="/login" element={
                                            <AuthBlockedRoute>
                                                <QuickLogin />
                                            </AuthBlockedRoute>
                                        } />
                                        <Route path="/auth" element={
                                            <AuthBlockedRoute>
                                                <AuthPage />
                                            </AuthBlockedRoute>
                                        } />
                                        <Route path="/business/signup" element={
                                            <AuthBlockedRoute>
                                                <BusinessSignup />
                                            </AuthBlockedRoute>
                                        } />
                                        <Route path="/complete-profile" element={<CompleteProfile />} />
                                        <Route path="/business-pro" element={<BusinessProDashboard />} />



                                        {/* User Routes with Layout */}
                                        <Route element={<Layout />}>
                                            <Route path="/" element={<PostsFeed />} />
                                            <Route path="/invitations" element={<Home />} />

                                            {/* Protected Create Routes */}
                                            <Route path="/create" element={
                                                <GuestBlockedRoute>
                                                    <StaffBlockedRoute>
                                                        <BusinessBlockedRoute>
                                                            <ProfileGuard>
                                                                <CreateInvitation />
                                                            </ProfileGuard>
                                                        </BusinessBlockedRoute>
                                                    </StaffBlockedRoute>
                                                </GuestBlockedRoute>
                                            } />
                                            <Route path="/create-private" element={
                                                <GuestBlockedRoute>
                                                    <StaffBlockedRoute>
                                                        <BusinessBlockedRoute>
                                                            <ProfileGuard>
                                                                <CreatePrivateInvitation />
                                                            </ProfileGuard>
                                                        </BusinessBlockedRoute>
                                                    </StaffBlockedRoute>
                                                </GuestBlockedRoute>
                                            } />
                                            <Route path="/create-post" element={
                                                <GuestBlockedRoute>
                                                    <StaffBlockedRoute>
                                                        <ProfileGuard>
                                                            <CreatePost />
                                                        </ProfileGuard>
                                                    </StaffBlockedRoute>
                                                </GuestBlockedRoute>
                                            } />
                                            <Route path="/create-story" element={
                                                <GuestBlockedRoute>
                                                    <StaffBlockedRoute>
                                                        <ProfileGuard>
                                                            <CreateStory />
                                                        </ProfileGuard>
                                                    </StaffBlockedRoute>
                                                </GuestBlockedRoute>
                                            } />

                                            <Route path="/invitation/preview/:id" element={<InvitationPreview />} />
                                            <Route path="/invitation/private/preview/:id" element={<PrivateInvitationPreview />} />
                                            <Route path="/invitation/private/:id" element={<PrivateInvitationDetails />} />
                                            <Route path="/invitation/:id" element={<InvitationDetails />} />
                                            <Route path="/invitation/:id/chat" element={<InvitationChatRoom />} />
                                            <Route path="/restaurants" element={<RestaurantDirectory />} />
                                            <Route path="/restaurant/:id" element={<RestaurantDetails />} />

                                            {/* Protected Social Routes */}
                                            <Route path="/friends" element={
                                                <GuestBlockedRoute>
                                                    <FriendsFeed />
                                                </GuestBlockedRoute>
                                            } />
                                            <Route path="/followers" element={
                                                <GuestBlockedRoute>
                                                    <FollowersList />
                                                </GuestBlockedRoute>
                                            } />
                                            <Route path="/messages" element={
                                                <GuestBlockedRoute>
                                                    <ChatList />
                                                </GuestBlockedRoute>
                                            } />
                                            <Route path="/chat/:userId" element={
                                                <GuestBlockedRoute>
                                                    <Chat />
                                                </GuestBlockedRoute>
                                            } />

                                            <Route path="/profile" element={
                                                <GuestBlockedRoute>
                                                    <Profile />
                                                </GuestBlockedRoute>
                                            } />
                                            <Route path="/profile/:userId" element={<SmartProfileRoute />} />

                                            <Route path="/notifications" element={
                                                <GuestBlockedRoute>
                                                    <Notifications />
                                                </GuestBlockedRoute>
                                            } />

                                            <Route path="/pricing" element={<PricingPage />} />
                                            <Route path="/business/pricing" element={<PricingPage />} />
                                            <Route path="/payment-success" element={<PaymentSuccess />} />

                                            {/* Protected Settings Routes */}
                                            <Route path="/settings" element={
                                                <GuestBlockedRoute>
                                                    <Settings />
                                                </GuestBlockedRoute>
                                            } />
                                            <Route path="/settings/email" element={
                                                <GuestBlockedRoute>
                                                    <EmailSettings />
                                                </GuestBlockedRoute>
                                            } />
                                            <Route path="/settings/password" element={
                                                <GuestBlockedRoute>
                                                    <PasswordSettings />
                                                </GuestBlockedRoute>
                                            } />
                                            <Route path="/settings/notifications" element={
                                                <GuestBlockedRoute>
                                                    <NotificationsSettings />
                                                </GuestBlockedRoute>
                                            } />
                                            <Route path="/settings/language" element={
                                                <GuestBlockedRoute>
                                                    <LanguageSettings />
                                                </GuestBlockedRoute>
                                            } />
                                            <Route path="/settings/privacy" element={
                                                <GuestBlockedRoute>
                                                    <PrivacySettings />
                                                </GuestBlockedRoute>
                                            } />
                                            <Route path="/settings/subscription" element={
                                                <GuestBlockedRoute>
                                                    <SubscriptionSettings />
                                                </GuestBlockedRoute>
                                            } />
                                            <Route path="/settings/payment" element={
                                                <GuestBlockedRoute>
                                                    <PaymentSettings />
                                                </GuestBlockedRoute>
                                            } />
                                            <Route path="/settings/billing" element={
                                                <GuestBlockedRoute>
                                                    <BillingSettings />
                                                </GuestBlockedRoute>
                                            } />




                                            <Route path="/business-dashboard" element={<BusinessDashboard />} />
                                            <Route path="/migration" element={<MigrationPage />} />
                                            <Route path="/partners" element={<Navigate to="/restaurants" replace />} />
                                            <Route path="/partner/:partnerId" element={<PartnerProfile />} />
                                            <Route path="/offer/new" element={
                                                <GuestBlockedRoute>
                                                    <PremiumOfferPage />
                                                </GuestBlockedRoute>
                                            } />
                                            <Route path="/offer/edit/:id" element={
                                                <GuestBlockedRoute>
                                                    <PremiumOfferPage />
                                                </GuestBlockedRoute>
                                            } />

                                            {/* Protected Community Routes */}
                                            <Route path="/communities" element={
                                                <GuestBlockedRoute>
                                                    <MyCommunities />
                                                </GuestBlockedRoute>
                                            } />
                                            <Route path="/my-community" element={
                                                <GuestBlockedRoute>
                                                    <MyCommunity />
                                                </GuestBlockedRoute>
                                            } />
                                            <Route path="/community/:partnerId" element={
                                                <GuestBlockedRoute>
                                                    <CommunityChatRoom />
                                                </GuestBlockedRoute>
                                            } />

                                            <Route path="/posts-feed" element={<PostsFeed />} />
                                            <Route path="/admin-panel" element={<AdminPanel />} />
                                        </Route>

                                        {/* Admin Routes */}
                                        <Route path="/admin/*" element={
                                            <AdminRoute>
                                                <AdminLayout />
                                            </AdminRoute>
                                        }>
                                            <Route path="dashboard" element={<AdminDashboard />} />
                                            <Route path="business-limits" element={<BusinessLimitsManager />} />
                                            <Route path="users" element={<UserManagement />} />
                                            <Route path="plans" element={<PlanManagement />} />
                                            <Route path="plans/new" element={<PlanEditor />} />
                                            <Route path="plans/edit/:id" element={<PlanEditor />} />
                                            <Route path="subscriptions" element={<SubscriptionManagement />} />
                                            <Route path="partners" element={<PartnerManagement />} />
                                            <Route path="invitations" element={<InvitationManagement />} />
                                            <Route path="reports" element={<ReportsAnalytics />} />
                                            <Route path="migration" element={<MigrationTools />} />
                                            <Route path="settings" element={<AdminSettings />} />
                                            <Route path="backups" element={<CodeBackups />} />
                                            <Route index element={<Navigate to="/admin/dashboard" replace />} />
                                        </Route>

                                        {/* Public Legal Pages */}
                                        <Route path="/privacy" element={<LegalPrivacy />} />
                                        <Route path="/terms" element={<LegalTerms />} />
                                    </Routes>
                                </Router>
                            </StripeProvider>
                        </ChatProvider>
                    </NotificationProvider>
                </InvitationProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;
