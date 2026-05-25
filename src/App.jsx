import React, { Suspense, lazy, useEffect } from 'react';
import {
    BrowserRouter as Router,
    Routes,
    Route,
    Navigate,
    Outlet,
    useNavigate,
    useParams,
    useLocation,
} from 'react-router-dom';
import Layout from './components/Layout';
import AccountThemeBridge from './components/AccountThemeBridge';

// Core Pages (Eagerly loaded for critical paths)
import LoginHub from './pages/auth/LoginHub';
import CompleteProfile from './pages/CompleteProfile';
import HomeRouter from './components/HomeRouter';
import ReferralJoinPage from './pages/ReferralJoinPage';
import AffiliateDashboard from './pages/affiliate/AffiliateDashboard';
import AffiliatePortal from './pages/affiliate/AffiliatePortal';
import AffiliateForceSignOut from './pages/affiliate/AffiliateForceSignOut';
import AffiliateRouteLayout from './components/affiliate/AffiliateRouteLayout';
import AffiliateSignupPage from './pages/affiliate/AffiliateSignupPage';
import AffiliateLoginPage from './pages/affiliate/AffiliateLoginPage';
import AffiliateSettingsPage from './pages/affiliate/AffiliateSettingsPage';
import NotFound from './pages/NotFound';
import AuthActionHandler from './pages/AuthActionHandler';
import VerifyEmail from './pages/VerifyEmail';
import PostDetails from './pages/PostDetails';
import SearchPage from './pages/SearchPage';
import PostsFeed from './pages/PostsFeed';

// Lazy Pages (Loaded on demand to improve startup speed)
const Profile = lazy(() => import('./pages/Profile'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const BusinessesDirectory = lazy(() => import('./pages/BusinessesDirectory'));
const BusinessRankings = lazy(() => import('./pages/BusinessRankings'));
const RestaurantDetails = lazy(() => import('./pages/RestaurantDetails'));
const Settings = lazy(() => import('./pages/Settings'));
const AdminShell = lazy(() => import('./admin/shell/AdminShell'));
const AdminUsersPage = lazy(() => import('./admin/pages/UsersPage'));
const AdminCreditsPage = lazy(() => import('./admin/pages/CreditsPage'));
const AdminInvitationsPage = lazy(() => import('./admin/pages/InvitationsPage'));
const AdminSmartSenderPage = lazy(() => import('./admin/pages/SmartSenderPage'));
const AdminReportsPage = lazy(() => import('./admin/pages/ReportsPage'));
const AdminPlansSandboxPage = lazy(() => import('./admin/pages/PlansSandboxPage'));
const AdminPlansProductionPage = lazy(() => import('./admin/pages/PlansProductionPage'));
const InvitationDetails = lazy(() => import('./pages/InvitationDetails'));
const InvitationPreview = lazy(() => import('./pages/InvitationPreview'));
const Notifications = lazy(() => import('./pages/Notifications'));
const ChatList = lazy(() => import('./pages/ChatList'));
const Chat = lazy(() => import('./pages/Chat'));
const MyCommunities = lazy(() => import('./pages/MyCommunities'));
const CommunityChatRoom = lazy(() => import('./pages/CommunityChatRoom'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const HomeInvitations = lazy(() => import('./pages/Home'));

const BusinessProfile = lazy(() => import('./pages/BusinessProfile'));
const BusinessSignup = lazy(() => import('./pages/BusinessSignup'));
const BusinessOnboarding = lazy(() => import('./pages/BusinessOnboarding'));
const BusinessDashboard = lazy(() => import('./pages/BusinessDashboard'));
const PrivateInvitationDetails = lazy(() => import('./pages/PrivateInvitationDetails'));
const PrivateInvitationPreview = lazy(() => import('./pages/PrivateInvitationPreview'));
const InvitationChatRoom = lazy(() => import('./pages/InvitationChatRoom'));
const FollowersList = lazy(() => import('./pages/FollowersList'));
const CreateInvitation = lazy(() => import('./pages/CreateInvitation'));
const CreateInvitationManualHub = lazy(() => import('./pages/CreateInvitationManualHub'));
const CreatePrivateInvitation = lazy(() => import('./pages/CreatePrivateInvitation'));
const CreateDatingInvitation = lazy(() => import('./pages/CreateDatingInvitation'));
const CreatePost = lazy(() => import('./pages/CreatePost'));
const BusinessCreatePostGate = lazy(() => import('./components/BusinessCreatePostGate'));
const CreateFeaturedPost = lazy(() => import('./pages/business/CreateFeaturedPost'));
const CreateStory = lazy(() => import('./pages/CreateStory'));
const EmailSettings = lazy(() => import('./pages/EmailSettings'));
const PasswordSettings = lazy(() => import('./pages/PasswordSettings'));
const NotificationsSettings = lazy(() => import('./pages/NotificationsSettings'));
const LanguageSettings = lazy(() => import('./pages/LanguageSettings'));
const PrivacySettings = lazy(() => import('./pages/PrivacySettings'));
const BlockedUsersSettings = lazy(() => import('./pages/BlockedUsersSettings'));
const SubscriptionSettings = lazy(() => import('./pages/SubscriptionSettings'));
const CreditsWallet = lazy(() => import('./pages/CreditsWallet'));
const PaymentSettings = lazy(() => import('./pages/PaymentSettings'));
const BillingSettings = lazy(() => import('./pages/BillingSettings'));
const HelpSupport = lazy(() => import('./pages/HelpSupport'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const CommunityGuidelines = lazy(() => import('./pages/CommunityGuidelines'));
const AccountDeletionRequest = lazy(() => import('./pages/AccountDeletionRequest'));
const MyCommunity = lazy(() => import('./pages/MyCommunity'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));


// Contexts
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { InvitationProvider } from './context/InvitationContext';
import { StripeProvider } from './context/StripeContext';
import { ChatProvider } from './context/ChatContext';
import { NotificationProvider } from './context/NotificationContext';

// Guards & Utils
import GuestBlockedRoute from './components/GuestBlockedRoute';
import AdminRoute from './components/AdminRoute';
import AppRouteLoading from './components/AppRouteLoading';
import { registerLoginRouter, unregisterLoginRouter } from './utils/goToLogin';

/** Layout owns route-level Suspense so the 3-column shell never unmounts during lazy loads. */
function RouteSuspenseLayout() {
    return <Outlet />;
}

/** /business/:businessId/invitations → community hub for that partner */
function RedirectBusinessInvitationsToCommunity() {
    const { businessId } = useParams();
    return <Navigate to={`/community/${businessId}`} replace />;
}

/** Canonical business registration is `/signup/business`; legacy paths keep `?ref=` etc. */
function LegacyBusinessSignupRedirect() {
    const { search, hash } = useLocation();
    return <Navigate to={{ pathname: '/signup/business', search, hash }} replace />;
}

function LoginRouterBridge() {
    const navigate = useNavigate();
    useEffect(() => {
        registerLoginRouter(navigate);
        return () => unregisterLoginRouter();
    }, [navigate]);
    return null;
}

function App() {
    return (
        <ThemeProvider>
            <ToastProvider>
                <Router>
                    <LoginRouterBridge />
                    <AuthProvider>
                        <AccountThemeBridge />
                        <InvitationProvider>
                            <NotificationProvider>
                                <ChatProvider>
                                    <StripeProvider>
                                        <Routes>
                                            {/* Auth routes outside of nested Layout wrappers for maximum reliability */}
                                            <Route path="/login" element={<LoginHub />} />
                                            <Route path="/join" element={<ReferralJoinPage />} />
                                            <Route element={<AffiliateRouteLayout />}>
                                                <Route path="/affiliate/use-laptop" element={<Navigate to="/affiliate/dashboard" replace />} />
                                                <Route path="/affiliate/sign-out" element={<AffiliateForceSignOut />} />
                                                <Route path="/affiliate/signup" element={<AffiliateSignupPage />} />
                                                <Route path="/affiliate/login" element={<AffiliateLoginPage />} />
                                                <Route path="/affiliate/settings" element={<AffiliateSettingsPage />} />
                                                <Route path="/affiliate/dashboard" element={<AffiliateDashboard />} />
                                                <Route path="/affiliate" element={<AffiliatePortal />} />
                                            </Route>
                                            <Route path="/business/login" element={<Navigate to="/login?tab=business" replace />} />
                                            <Route
                                                path="/signup/business"
                                                element={
                                                    <Suspense fallback={<AppRouteLoading variant="route" fullViewport />}>
                                                        <BusinessSignup />
                                                    </Suspense>
                                                }
                                            />
                                            <Route path="/business/signup" element={<LegacyBusinessSignupRedirect />} />
                                            <Route path="/business-signup" element={<LegacyBusinessSignupRedirect />} />
                                            <Route path="/auth/action" element={<AuthActionHandler />} />
                                            <Route path="/__/auth/action" element={<AuthActionHandler />} />
                                            <Route path="/verify-email" element={<GuestBlockedRoute><VerifyEmail /></GuestBlockedRoute>} />
                                            <Route path="/complete-profile" element={<CompleteProfile />} />

                                            <Route path="/business-pro" element={<Navigate to="/business-dashboard" replace />} />
                                            <Route path="/business-pro/*" element={<Navigate to="/business-dashboard" replace />} />

                                            <Route path="/" element={<HomeRouter />} />

                                            <Route element={<RouteSuspenseLayout />}>
                                                <Route element={<Layout />}>
                                                    {/* More specific paths first */}
                                                    <Route path="/post/featured/:featuredId" element={<PostDetails />} />
                                                    <Route path="/post/:postId" element={<PostDetails />} />

                                                    <Route path="/invitation/private/preview/:id" element={<PrivateInvitationPreview />} />
                                                    <Route
                                                        path="/invitation/private/:id/chat"
                                                        element={<GuestBlockedRoute><InvitationChatRoom /></GuestBlockedRoute>}
                                                    />
                                                    <Route path="/invitation/private/:id" element={<PrivateInvitationDetails />} />
                                                    <Route path="/invitation/:id/chat" element={<GuestBlockedRoute><InvitationChatRoom /></GuestBlockedRoute>} />
                                                    <Route path="/invitation/preview/:id" element={<InvitationPreview />} />
                                                    <Route path="/invitation/:id" element={<InvitationDetails />} />

                                                    <Route path="/business/onboarding" element={<GuestBlockedRoute><BusinessOnboarding /></GuestBlockedRoute>} />
                                                    <Route path="/business/pricing" element={<PricingPage />} />
                                                    <Route path="/business/:businessId/invitations" element={<RedirectBusinessInvitationsToCommunity />} />
                                                    <Route path="/business/:businessId" element={<BusinessProfile />} />

                                                    <Route path="/business-dashboard" element={<GuestBlockedRoute><BusinessDashboard /></GuestBlockedRoute>} />

                                                    <Route path="/search" element={<SearchPage />} />
                                                    <Route path="/restaurants" element={<BusinessesDirectory />} />
                                                    <Route path="/rankings" element={<BusinessRankings />} />
                                                    <Route path="/restaurant/:id" element={<RestaurantDetails />} />

                                                    <Route path="/notifications" element={<GuestBlockedRoute><Notifications /></GuestBlockedRoute>} />
                                                    <Route path="/messages" element={<GuestBlockedRoute><ChatList /></GuestBlockedRoute>} />
                                                    <Route path="/chat/:userId" element={<GuestBlockedRoute><Chat /></GuestBlockedRoute>} />

                                                    <Route path="/profile" element={<GuestBlockedRoute><Profile /></GuestBlockedRoute>} />
                                                    <Route path="/profile/:userId" element={<UserProfile />} />

                                                    <Route path="/followers/:userId" element={<GuestBlockedRoute><FollowersList /></GuestBlockedRoute>} />
                                                    <Route path="/followers" element={<GuestBlockedRoute><FollowersList /></GuestBlockedRoute>} />

                                                    <Route path="/create/manual" element={<GuestBlockedRoute><CreateInvitationManualHub /></GuestBlockedRoute>} />
                                                    <Route
                                                        path="/create/ai"
                                                        element={
                                                            <GuestBlockedRoute>
                                                                <Navigate to="/create/manual" replace />
                                                            </GuestBlockedRoute>
                                                        }
                                                    />
                                                    <Route path="/create" element={<GuestBlockedRoute><CreateInvitation /></GuestBlockedRoute>} />
                                                    <Route path="/create-private" element={<GuestBlockedRoute><CreatePrivateInvitation /></GuestBlockedRoute>} />
                                                    <Route path="/create-dating" element={<GuestBlockedRoute><CreateDatingInvitation /></GuestBlockedRoute>} />
                                                    <Route path="/create-post" element={<GuestBlockedRoute><BusinessCreatePostGate /></GuestBlockedRoute>} />
                                                    <Route path="/create-featured-post" element={<GuestBlockedRoute><CreateFeaturedPost /></GuestBlockedRoute>} />
                                                    <Route path="/create-story" element={<GuestBlockedRoute><CreateStory /></GuestBlockedRoute>} />

                                                    <Route path="/settings/email" element={<GuestBlockedRoute><EmailSettings /></GuestBlockedRoute>} />
                                                    <Route path="/settings/password" element={<GuestBlockedRoute><PasswordSettings /></GuestBlockedRoute>} />
                                                    <Route path="/settings/notifications" element={<GuestBlockedRoute><NotificationsSettings /></GuestBlockedRoute>} />
                                                    <Route path="/settings/language" element={<GuestBlockedRoute><LanguageSettings /></GuestBlockedRoute>} />
                                                    <Route path="/settings/privacy" element={<GuestBlockedRoute><PrivacySettings /></GuestBlockedRoute>} />
                                                    <Route path="/settings/blocked-users" element={<GuestBlockedRoute><BlockedUsersSettings /></GuestBlockedRoute>} />
                                                    <Route path="/settings/subscription" element={<GuestBlockedRoute><SubscriptionSettings /></GuestBlockedRoute>} />
                                                    <Route path="/settings/credits" element={<GuestBlockedRoute><CreditsWallet /></GuestBlockedRoute>} />
                                                    <Route path="/settings/payment" element={<GuestBlockedRoute><PaymentSettings /></GuestBlockedRoute>} />
                                                    <Route path="/settings/billing" element={<GuestBlockedRoute><BillingSettings /></GuestBlockedRoute>} />
                                                    <Route path="/settings" element={<GuestBlockedRoute><Settings /></GuestBlockedRoute>} />

                                                    <Route path="/support" element={<HelpSupport />} />
                                                    <Route path="/privacy" element={<PrivacyPolicy />} />
                                                    <Route path="/terms" element={<TermsOfService />} />
                                                    <Route path="/guidelines" element={<CommunityGuidelines />} />
                                                    <Route path="/account-deletion" element={<AccountDeletionRequest />} />

                                                    <Route path="/plans" element={<Navigate to="/pricing" replace />} />
                                                    <Route path="/my-community" element={<GuestBlockedRoute><MyCommunity /></GuestBlockedRoute>} />
                                                    <Route path="/ai-marketing-studio/saved-posts" element={<GuestBlockedRoute><Navigate to="/business-dashboard" replace /></GuestBlockedRoute>} />
                                                    <Route path="/ai-marketing-studio" element={<GuestBlockedRoute><Navigate to="/business-dashboard" replace /></GuestBlockedRoute>} />

                                                    <Route path="/payment-success" element={<GuestBlockedRoute><PaymentSuccess /></GuestBlockedRoute>} />

                                                    <Route path="/pricing" element={<PricingPage />} />
                                                    <Route path="/communities" element={<GuestBlockedRoute><MyCommunities /></GuestBlockedRoute>} />
                                                    <Route path="/community/:partnerId" element={<GuestBlockedRoute><CommunityChatRoom /></GuestBlockedRoute>} />
                                                    <Route path="/posts-feed" element={<PostsFeed />} />
                                                    <Route path="/invitations" element={<HomeInvitations />} />

                                                    <Route path="/admin/*" element={<AdminRoute><AdminShell /></AdminRoute>}>
                                                        <Route path="users" element={<AdminUsersPage />} />
                                                        <Route path="credits" element={<AdminCreditsPage />} />
                                                        <Route path="messaging" element={<AdminSmartSenderPage />} />
                                                        <Route path="invitations" element={<AdminInvitationsPage />} />
                                                        <Route path="reports" element={<AdminReportsPage />} />
                                                        <Route path="plans/sandbox" element={<AdminPlansSandboxPage />} />
                                                        <Route path="plans/production" element={<AdminPlansProductionPage />} />
                                                        <Route path="plans" element={<Navigate to="/admin/plans/production" replace />} />
                                                        <Route path="dashboard" element={<Navigate to="/admin/users" replace />} />
                                                        <Route path="*" element={<Navigate to="/admin/users" replace />} />
                                                        <Route index element={<Navigate to="/admin/users" replace />} />
                                                    </Route>
                                                </Route>
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
