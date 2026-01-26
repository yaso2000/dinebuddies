import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import { useTranslation } from 'react-i18next';

import CreateInvitation from './pages/CreateInvitation';
import InvitationDetails from './pages/InvitationDetails';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';
import Notifications from './pages/Notifications';
import { InvitationProvider } from './context/InvitationContext';

import FriendsFeed from './pages/FriendsFeed';
import RestaurantDirectory from './pages/RestaurantDirectory';
import RestaurantDetails from './pages/RestaurantDetails';
import PartnerProfile from './pages/PartnerProfile';
import FollowersList from './pages/FollowersList';
import PrivateChat from './pages/PrivateChat';
import PartnerNotifications from './pages/PartnerNotifications';

function App() {
    return (
        <InvitationProvider>
            <Router>
                <Layout>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/create" element={<CreateInvitation />} />
                        <Route path="/invitation/:id" element={<InvitationDetails />} />
                        <Route path="/restaurants" element={<RestaurantDirectory />} />
                        <Route path="/restaurant/:id" element={<RestaurantDetails />} />
                        <Route path="/partner/:id" element={<PartnerProfile />} />
                        <Route path="/friends" element={<FriendsFeed />} />
                        <Route path="/followers" element={<FollowersList />} />
                        <Route path="/chat/:userId" element={<PrivateChat />} />
                        <Route path="/partner-notifications" element={<PartnerNotifications />} />
                        <Route path="/profile/:userId" element={<UserProfile />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/notifications" element={<Notifications />} />
                    </Routes>
                </Layout>
            </Router>
        </InvitationProvider>
    );
}

export default App;
