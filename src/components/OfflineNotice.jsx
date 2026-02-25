import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaWifi, FaExclamationTriangle } from 'react-icons/fa';

const OfflineNotice = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const { t, i18n } = useTranslation();

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (isOnline) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            background: '#ef4444',
            color: 'white',
            padding: '10px',
            textAlign: 'center',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
        }}>
            <FaWifi style={{ opacity: 0.8 }} />
            {i18n.language === 'ar'
                ? 'لا يوجد اتصال بالإنترنت. يرجى التحقق من الشبكة.'
                : 'No internet connection. Please check your network.'}
        </div>
    );
};

export default OfflineNotice;
