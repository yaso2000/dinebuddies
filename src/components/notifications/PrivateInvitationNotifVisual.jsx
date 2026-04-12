import React from 'react';
import {
    FaBirthdayCake,
    FaUsers,
    FaBriefcase,
    FaMoon,
    FaUtensils,
    FaCoffee,
    FaGamepad,
    FaHome,
    FaStar,
    FaFilm,
    FaFutbol,
    FaFire,
    FaLock
} from 'react-icons/fa';

/**
 * Normalize occasion stored on private invitations (English labels from create flow, or legacy values).
 */
export function normalizePrivateOccasionKey(raw) {
    const s = String(raw || 'Social')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    if (s.includes('birthday')) return 'birthday';
    if (s.includes('nightlife')) return 'nightlife';
    if (s.includes('dining')) return 'dining';
    if (s.includes('cafe') || s.includes('café')) return 'cafe';
    if (s.includes('gaming')) return 'gaming';
    if (s.includes('family')) return 'family';
    if (s.includes('celebration')) return 'celebration';
    if (s.includes('cinema')) return 'cinema';
    if (s.includes('sport')) return 'sports';
    if (s.includes('bbq') || s.includes('barbecue')) return 'bbq';
    if (s.includes('work')) return 'work';
    if (s.includes('social')) return 'social';
    return 'social';
}

const OCCASION_VISUAL = {
    birthday: {
        Icon: FaBirthdayCake,
        gradient: 'linear-gradient(145deg, #f9a8d4 0%, #db2777 55%, #9d174d 100%)',
        iconColor: '#fff'
    },
    social: {
        Icon: FaUsers,
        gradient: 'linear-gradient(145deg, #c4b5fd 0%, #7c3aed 50%, #5b21b6 100%)',
        iconColor: '#fff'
    },
    work: {
        Icon: FaBriefcase,
        gradient: 'linear-gradient(145deg, #ddd6fe 0%, #7c3aed 45%, #4c1d95 100%)',
        iconColor: '#fff'
    },
    nightlife: {
        Icon: FaMoon,
        gradient: 'linear-gradient(145deg, #312e81 0%, #1e1b4b 60%, #0f172a 100%)',
        iconColor: '#fde68a'
    },
    dining: {
        Icon: FaUtensils,
        gradient: 'linear-gradient(145deg, #fed7aa 0%, #ea580c 50%, #9a3412 100%)',
        iconColor: '#fff'
    },
    cafe: {
        Icon: FaCoffee,
        gradient: 'linear-gradient(145deg, #d4a574 0%, #92400e 55%, #451a03 100%)',
        iconColor: '#fffbeb'
    },
    gaming: {
        Icon: FaGamepad,
        gradient: 'linear-gradient(145deg, #6ee7b7 0%, #059669 50%, #064e3b 100%)',
        iconColor: '#fff'
    },
    family: {
        Icon: FaHome,
        gradient: 'linear-gradient(145deg, #93c5fd 0%, #2563eb 50%, #1e3a8a 100%)',
        iconColor: '#fff'
    },
    celebration: {
        Icon: FaStar,
        gradient: 'linear-gradient(145deg, #fde047 0%, #eab308 45%, #a16207 100%)',
        iconColor: '#422006'
    },
    cinema: {
        Icon: FaFilm,
        gradient: 'linear-gradient(145deg, #94a3b8 0%, #475569 50%, #0f172a 100%)',
        iconColor: '#f8fafc'
    },
    sports: {
        Icon: FaFutbol,
        gradient: 'linear-gradient(145deg, #86efac 0%, #16a34a 50%, #14532d 100%)',
        iconColor: '#fff'
    },
    bbq: {
        Icon: FaFire,
        gradient: 'linear-gradient(145deg, #fdba74 0%, #ea580c 50%, #7c2d12 100%)',
        iconColor: '#fff'
    }
};

const DEFAULT_VISUAL = {
    Icon: FaLock,
    gradient: 'linear-gradient(145deg, #a78bfa 0%, #6d28d9 50%, #4c1d95 100%)',
    iconColor: '#fff'
};

/**
 * Large animated icon for private-invitation rows in the notifications list.
 */
export default function PrivateInvitationNotifVisual({ occasionType, hostAvatarUrl, hostName }) {
    const key = normalizePrivateOccasionKey(occasionType);
    const { Icon, gradient, iconColor } = OCCASION_VISUAL[key] || DEFAULT_VISUAL;

    return (
        <div className="private-inv-notif-visual">
            <div
                className="private-inv-notif-visual__ring"
                style={{ background: gradient }}
            >
                <Icon className="private-inv-notif-visual__icon" style={{ color: iconColor }} />
            </div>
            {hostAvatarUrl ? (
                <div className="private-inv-notif-visual__host" title={hostName || ''}>
                    <img src={hostAvatarUrl} alt="" referrerPolicy="no-referrer" />
                </div>
            ) : null}
        </div>
    );
}
