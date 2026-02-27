import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminRoute = ({ children, allowedRoles = ['admin', 'moderator', 'support', 'staff'] }) => {
    const { currentUser, userProfile } = useAuth();

    if (!currentUser) {
        return <Navigate to="/login" />;
    }

    // Master account and standard logic
    const isSuperAdmin = currentUser.uid === 'xTgHC1v00LZIZ6ESA9YGjGU5zW33' ||
        userProfile?.role === 'admin' ||
        userProfile?.accountType === 'admin';

    const userRole = userProfile?.role || userProfile?.accountType;
    const hasPermission = isSuperAdmin || allowedRoles.includes(userRole);

    if (!hasPermission) {
        console.warn(`Unauthorized admin access attempt by role: ${userRole}`);
        return <Navigate to="/" />;
    }

    return children;
};

export default AdminRoute;
