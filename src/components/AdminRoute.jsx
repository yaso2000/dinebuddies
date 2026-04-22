import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { goToLogin } from '../utils/goToLogin';
import { isAdminIdentity } from '../utils/adminAccess';

const AdminRoute = ({ children, allowedRoles = ['admin', 'moderator', 'support', 'staff'] }) => {
    const { currentUser, userProfile } = useAuth();

    useEffect(() => {
        if (!currentUser) goToLogin({ replace: true });
    }, [currentUser]);

    if (!currentUser) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0817', color: '#94a3b8' }}>
                …
            </div>
        );
    }

    const isSuperAdmin = isAdminIdentity(currentUser, userProfile);

    const userRole = userProfile?.role;
    const hasPermission = isSuperAdmin || allowedRoles.includes(userRole);

    if (!hasPermission) {
        console.warn(`Unauthorized admin access attempt by role: ${userRole}`);
        return <Navigate to="/" />;
    }

    return children;
};

export default AdminRoute;
