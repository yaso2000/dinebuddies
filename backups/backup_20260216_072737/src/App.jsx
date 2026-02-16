import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';

// User Pages
import CreateInvitation from './pages/CreateInvitation';
import CreatePost from './pages/CreatePost';
import CreateStory from './pages/CreateStory';
import InvitationDetails from './pages/InvitationDetails';
import InvitationPreview from './pages/InvitationPreview';
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


import EditBusinessProfile from './pages/EditBusinessProfile';
import PartnerProfile from './pages/PartnerProfile';
import BusinessDashboard from './pages/BusinessDashboard';
import MyCommunities from './pages/MyCommunities';
import MyCommunity from './pages/MyCommunity';
import CommunityChatRoom from './pages/CommunityChatRoom';
import PostsFeed from './pages/PostsFeed';
import BusinessLimitsManager from './pages/AdminDashboard';
import AdminPanel from './pages/AdminPanel';
import MigrationPage from './pages/MigrationPage';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';


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

function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <InvitationProvider>
                    <NotificationProvider>
                        <ChatProvider>
                            <StripeProvider>
                                <Router>

                                    <Routes>
                                        {/* Auth Routes */}
                                        <Route path="/login" element={<QuickLogin />} />
                                        <Route path="/auth" element={<AuthPage />} />
                                        <Route path="/business/signup" element={<BusinessSignup />} />
                                        <Route path="/auth" element={<AuthPage />} />


                                        {/* User Routes with Layout */}
                                        <Route element={<Layout />}>
                                            <Route path="/" element={<PostsFeed />} />
                                            <Route path="/invitations" element={<Home />} />

                                            {/* Protected Create Routes */}
                                            <Route path="/create" element={
                                                <GuestBlockedRoute>
                                                    <BusinessBlockedRoute>
                                                        <CreateInvitation />
                                                    </BusinessBlockedRoute>
                                                </GuestBlockedRoute>
                                            } />
                                            <Route path="/create-post" element={
                                                <GuestBlockedRoute>
                                                    <CreatePost />
                                                </GuestBlockedRoute>
                                            } />
                                            <Route path="/create-story" element={
                                                <GuestBlockedRoute>
                                                    <CreateStory />
                                                </GuestBlockedRoute>
                                            } />

                                            <Route path="/invitation/preview/:id" element={<InvitationPreview />} />
                                            <Route path="/invitation/:id" element={<InvitationDetails />} />
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
                                            <Route path="/profile/:userId" element={<UserProfile />} />

                                            <Route path="/notifications" element={
                                                <GuestBlockedRoute>
                                                    <Notifications />
                                                </GuestBlockedRoute>
                                            } />

                                            <Route path="/pricing" element={<PricingPage />} />
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


                                            <Route path="/edit-business-profile" element={<EditBusinessProfile />} />
                                            <Route path="/business-dashboard" element={<BusinessDashboard />} />
                                            <Route path="/migration" element={<MigrationPage />} />
                                            {/* Redirect old /partners to new /restaurants */}
                                            <Route path="/partners" element={<Navigate to="/restaurants" replace />} />
                                            <Route path="/partner/:partnerId" element={<PartnerProfile />} />

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
                                            <Route index element={<Navigate to="/admin/dashboard" replace />} />
                                        </Route>

                                        {/* Public Legal Pages */}
                                        <Route path="/privacy" element={<Privacy />} />
                                        <Route path="/terms" element={<Terms />} />
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
