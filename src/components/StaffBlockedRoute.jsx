import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * StaffBlockedRoute
 * Prevents staff roles (moderator, support) from accessing public activity pages
 * while allowing regular users and super admins.
 */
const StaffBlockedRoute = ({ children }) => {
    const { userProfile } = useAuth();

    const staffRoles = ['moderator', 'support', 'staff'];
    const userRole = userProfile?.role || userProfile?.accountType;

    if (staffRoles.includes(userRole)) {
        console.warn(`Access denied for ${userRole} to public activity route`);
        return <Navigate to="/" replace />;
    }

    return children;
};

export default StaffBlockedRoute;
