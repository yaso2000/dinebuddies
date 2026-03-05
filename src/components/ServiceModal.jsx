import React, { useState } from 'react';
import { FaTimes } from 'react-icons/fa';

export const SERVICE_ICONS = [
    { icon: '🚗', label: 'Delivery' },
    { icon: '🛵', label: 'Motorbike Delivery' },
    { icon: '🎉', label: 'Events' },
    { icon: '🎂', label: 'Birthday Parties' },
    { icon: '🥂', label: 'Private Dining' },
    { icon: '🏢', label: 'Corporate Events' },
    { icon: '🎵', label: 'Live Music' },
    { icon: '🎤', label: 'Karaoke' },
    { icon: '🎧', label: 'DJ' },
    { icon: '🕺', label: 'Dance Floor' },
    { icon: '🎰', label: 'Slot Machines' },
    { icon: '🎱', label: 'Billiards' },
    { icon: '🎳', label: 'Bowling' },
    { icon: '🎮', label: 'Gaming' },
    { icon: '📺', label: 'Sports Screening' },
    { icon: '🍸', label: 'Full Bar' },
    { icon: '🍺', label: 'Beer Selection' },
    { icon: '🍷', label: 'Wine List' },
    { icon: '🫖', label: 'Tea & Coffee' },
    { icon: '🍰', label: 'Custom Cakes' },
    { icon: '🍔', label: 'Takeaway' },
    { icon: '🥗', label: 'Vegan Options' },
    { icon: '🌾', label: 'Gluten-free' },
    { icon: '🍱', label: 'Catering' },
    { icon: '🅿️', label: 'Parking' },
    { icon: '♿', label: 'Wheelchair Access' },
    { icon: '📶', label: 'Free Wi-Fi' },
    { icon: '🐾', label: 'Pet Friendly' },
    { icon: '👶', label: 'Kids Area' },
    { icon: '🚬', label: 'Smoking Area' },
    { icon: '🌿', label: 'Outdoor Seating' },
    { icon: '❄️', label: 'Air Conditioned' },
    { icon: '🔒', label: 'Private Rooms' },
    { icon: '📸', label: 'Photo Booth' },
    { icon: '🎁', label: 'Gift Shop' },
    { icon: '💰', label: 'Happy Hour' },
    { icon: '🎟️', label: 'VIP Access' },
    { icon: '🛁', label: 'Spa & Wellness' },
    { icon: '🏊', label: 'Pool' },
    { icon: '📋', label: 'Reservations' },
];

const ServiceModal = ({ service, onSave, onClose }) => {
    const [name, setName] = useState(service?.name || '');
    const [description, setDescription] = useState(service?.description || '');
    const [icon, setIcon] = useState(service?.icon || '');
    const [search, setSearch] = useState('');

    const filtered = search
        ? SERVICE_ICONS.filter(s => s.label.toLowerCase().includes(search.toLowerCase()))
        : SERVICE_ICONS;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({
            name: name.trim(),
            description: description.trim(),
            icon: icon || '⚙️',
            id: service?.id || Date.now().toString()
        });
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
            <div style={{
                background: 'var(--bg-card)', borderRadius: '24px', padding: '1.5rem',
                width: '90%', maxWidth: '480px', border: '1px solid var(--border-color)',
                maxHeight: '90vh', overflowY: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>
                        {service ? 'Edit Service' : '✨ Add Service'}
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '1.4rem', cursor: 'pointer' }}>
                        <FaTimes />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Icon Preview */}
                    <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                        <div style={{
                            width: '72px', height: '72px', borderRadius: '18px', fontSize: '2.8rem',
                            background: 'rgba(139,92,246,0.1)', border: '2px solid rgba(139,92,246,0.3)',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            {icon || '⚙️'}
                        </div>
                        <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Select an icon below</p>
                    </div>

                    {/* Search */}
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search icons..."
                        style={{
                            width: '100%', padding: '8px 12px',
                            background: 'var(--bg-body)', border: '1px solid var(--border-color)',
                            borderRadius: '10px', color: 'var(--text-main)', fontSize: '0.9rem',
                            marginBottom: '0.75rem', boxSizing: 'border-box'
                        }}
                    />

                    {/* Icon Grid */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px',
                        maxHeight: '220px', overflowY: 'auto', marginBottom: '1.25rem',
                        padding: '4px', borderRadius: '12px',
                        border: '1px solid var(--border-color)', background: 'var(--bg-body)'
                    }}>
                        {filtered.map(s => (
                            <button
                                key={s.icon}
                                type="button"
                                title={s.label}
                                onClick={() => setIcon(s.icon)}
                                style={{
                                    fontSize: '1.6rem', padding: '8px', borderRadius: '10px', border: 'none',
                                    background: icon === s.icon ? 'rgba(139,92,246,0.25)' : 'transparent',
                                    outline: icon === s.icon ? '2px solid var(--primary)' : 'none',
                                    cursor: 'pointer', transition: 'all 0.15s'
                                }}
                            >
                                {s.icon}
                            </button>
                        ))}
                    </div>

                    {/* Name */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem' }}>
                            Service Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            placeholder="e.g., Home Delivery, Live DJ, Karaoke..."
                            style={{
                                width: '100%', padding: '10px 12px', boxSizing: 'border-box',
                                background: 'var(--bg-body)', border: '1px solid var(--border-color)',
                                borderRadius: '10px', color: 'var(--text-main)', fontSize: '0.9rem'
                            }}
                        />
                    </div>

                    {/* Description */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '0.9rem' }}>
                            Short Description (optional)
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            placeholder="Brief info about this service..."
                            style={{
                                width: '100%', padding: '10px 12px', boxSizing: 'border-box',
                                background: 'var(--bg-body)', border: '1px solid var(--border-color)',
                                borderRadius: '10px', color: 'var(--text-main)', fontSize: '0.9rem',
                                resize: 'vertical'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                flex: 1, padding: '10px', border: '1px solid var(--border-color)',
                                borderRadius: '12px', background: 'transparent',
                                color: 'var(--text-main)', cursor: 'pointer', fontWeight: '600'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            style={{
                                flex: 1, padding: '10px', border: 'none',
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, #8b5cf6, #f97316)',
                                color: 'white', cursor: 'pointer', fontWeight: '700'
                            }}
                        >
                            {service ? 'Update' : 'Add'} Service
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ServiceModal;
