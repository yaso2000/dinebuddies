import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminRoute = ({ children }) => {
    const { currentUser, userProfile } = useAuth();

    if (!currentUser) {
        return <Navigate to="/login" />;
    }

    // Check if user is admin
    const adminEmails = ['admin@dinebuddies.com', 'y.abohamed@gmail.com'];
    const isAdmin = adminEmails.includes(currentUser.email?.toLowerCase()) ||
        userProfile?.role === 'admin';

    if (!isAdmin) {
        return <Navigate to="/" />;
    }

    return children;
};

export default AdminRoute;
