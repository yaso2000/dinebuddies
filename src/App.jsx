import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';

// User Pages
import CreateInvitation from './pages/CreateInvitation';
import InvitationDetails from './pages/InvitationDetails';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';
import Notifications from './pages/Notifications';
import FriendsFeed from './pages/FriendsFeed';
import RestaurantDirectory from './pages/RestaurantDirectory';
import RestaurantDetails from './pages/RestaurantDetails';
import FollowersList from './pages/FollowersList';
import PrivateChat from './pages/PrivateChat';
import GroupChat from './pages/GroupChat';
import ChatList from './pages/ChatList';
import PricingPage from './pages/PricingPage';
import AuthPage from './pages/AuthPage';
import QuickLogin from './pages/QuickLogin';
import Settings from './pages/Settings';
import PaymentSuccess from './pages/PaymentSuccess';
import ConvertToBusiness from './pages/ConvertToBusiness';
import BusinessProfile from './pages/BusinessProfile';
import EditBusinessProfile from './pages/EditBusinessProfile';
import Partners from './pages/Partners';
import PartnerProfile from './pages/PartnerProfile';
import MyCommunities from './pages/MyCommunities';
import CommunityChat from './pages/CommunityChat';
import MyCommunity from './pages/MyCommunity';
import PostsFeed from './pages/PostsFeed';

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


// Contexts
import { InvitationProvider } from './context/InvitationContext';
import { AuthProvider } from './context/AuthContext';
import { StripeProvider } from './context/StripeContext';
import { ChatProvider } from './context/ChatContext';
import { NotificationProvider } from './context/NotificationContext';
import { Navigate } from 'react-router-dom';

function App() {
    React.useEffect(() => {
        // Theme Initialization
        const isDark = localStorage.getItem('darkMode') === 'true';
        if (localStorage.getItem('darkMode') === 'false') {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
    }, []);

    return (
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
                                    <Route path="/auth" element={<AuthPage />} />
                                    <Route path="/convert-to-business" element={<ConvertToBusiness />} />

                                    {/* User Routes with Layout */}
                                    <Route element={<Layout />}>
                                        <Route path="/" element={<Home />} />
                                        <Route path="/create" element={<CreateInvitation />} />
                                        <Route path="/invitation/:id" element={<InvitationDetails />} />
                                        <Route path="/restaurants" element={<RestaurantDirectory />} />
                                        <Route path="/restaurant/:id" element={<RestaurantDetails />} />
                                        <Route path="/friends" element={<FriendsFeed />} />
                                        <Route path="/followers" element={<FollowersList />} />
                                        <Route path="/messages" element={<ChatList />} />
                                        <Route path="/chat/:userId" element={<PrivateChat />} />
                                        <Route path="/group/:conversationId" element={<GroupChat />} />
                                        <Route path="/profile" element={<Profile />} />
                                        <Route path="/profile/:userId" element={<UserProfile />} />
                                        <Route path="/notifications" element={<Notifications />} />
                                        <Route path="/pricing" element={<PricingPage />} />
                                        <Route path="/payment-success" element={<PaymentSuccess />} />
                                        <Route path="/settings" element={<Settings />} />
                                        <Route path="/business-profile" element={<BusinessProfile />} />
                                        <Route path="/edit-business-profile" element={<EditBusinessProfile />} />
                                        <Route path="/partners" element={<Partners />} />
                                        <Route path="/partner/:partnerId" element={<PartnerProfile />} />
                                        <Route path="/communities" element={<MyCommunities />} />
                                        <Route path="/community/:communityId" element={<CommunityChat />} />
                                        <Route path="/my-community" element={<MyCommunity />} />
                                        <Route path="/posts-feed" element={<PostsFeed />} />
                                    </Route>

                                    {/* Admin Routes */}
                                    <Route path="/admin/*" element={
                                        <AdminRoute>
                                            <AdminLayout />
                                        </AdminRoute>
                                    }>
                                        <Route path="dashboard" element={<AdminDashboard />} />
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
                                </Routes>
                            </Router>
                        </StripeProvider>
                    </ChatProvider>
                </NotificationProvider>
            </InvitationProvider>
        </AuthProvider>
    );
}

export default App;
