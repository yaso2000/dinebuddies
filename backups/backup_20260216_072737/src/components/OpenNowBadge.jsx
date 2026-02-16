import React from 'react';
import { FaClock } from 'react-icons/fa';

const OpenNowBadge = ({ workingHours }) => {
    if (!workingHours) return null;

    const getCurrentDayAndTime = () => {
        const now = new Date();
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDay = days[now.getDay()];
        const currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes since midnight

        return { currentDay, currentTime };
    };

    const parseTime = (timeStr) => {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const isOpenNow = () => {
        const { currentDay, currentTime } = getCurrentDayAndTime();
        const todayHours = workingHours[currentDay];

        if (!todayHours || !todayHours.isOpen) {
            return { open: false, message: 'Closed today' };
        }

        const openTime = parseTime(todayHours.open);
        const closeTime = parseTime(todayHours.close);

        if (currentTime >= openTime && currentTime < closeTime) {
            // Calculate closing time
            const minutesUntilClose = closeTime - currentTime;
            const hoursUntilClose = Math.floor(minutesUntilClose / 60);
            const minsUntilClose = minutesUntilClose % 60;

            let closingMessage = 'Open now';
            if (minutesUntilClose < 60) {
                closingMessage = `Closes in ${minsUntilClose}min`;
            } else if (hoursUntilClose < 2) {
                closingMessage = `Closes in ${hoursUntilClose}h ${minsUntilClose}min`;
            }

            return { open: true, message: closingMessage };
        } else if (currentTime < openTime) {
            // Opening later today
            const minutesUntilOpen = openTime - currentTime;
            const hoursUntilOpen = Math.floor(minutesUntilOpen / 60);
            const minsUntilOpen = minutesUntilOpen % 60;

            return {
                open: false,
                message: `Opens at ${todayHours.open}`
            };
        } else {
            // Closed for today, check tomorrow
            return { open: false, message: 'Closed now' };
        }
    };

    const status = isOpenNow();

    return (
        <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: '700',
            background: status.open
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.15))'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.15))',
            border: status.open
                ? '1px solid rgba(16, 185, 129, 0.3)'
                : '1px solid rgba(239, 68, 68, 0.3)',
            color: status.open ? '#10b981' : '#ef4444',
            boxShadow: status.open
                ? '0 2px 8px rgba(16, 185, 129, 0.2)'
                : '0 2px 8px rgba(239, 68, 68, 0.2)',
            animation: 'fadeIn 0.3s ease'
        }}>
            <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: status.open ? '#10b981' : '#ef4444',
                boxShadow: status.open
                    ? '0 0 8px rgba(16, 185, 129, 0.6)'
                    : '0 0 8px rgba(239, 68, 68, 0.6)',
                animation: status.open ? 'pulse 2s infinite' : 'none'
            }} />
            <FaClock style={{ fontSize: '0.75rem' }} />
            <span>{status.message}</span>

            <style>{`
                @keyframes pulse {
                    0%, 100% {
                        opacity: 1;
                        transform: scale(1);
                    }
                    50% {
                        opacity: 0.7;
                        transform: scale(1.1);
                    }
                }
                
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(-5px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
};

export default OpenNowBadge;
