import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { FaSearch, FaFilter, FaEnvelope, FaTrash, FaEye, FaMapMarkerAlt, FaCalendar, FaUsers, FaDollarSign } from 'react-icons/fa';

const InvitationManagement = () => {
    const [invitations, setInvitations] = useState([]);
    const [filteredInvitations, setFilteredInvitations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [selectedInvitation, setSelectedInvitation] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        fetchInvitations();
    }, []);

    useEffect(() => {
        filterInvitations();
    }, [invitations, searchQuery, filterType]);

    const fetchInvitations = async () => {
        try {
            setLoading(true);
            const invitationsSnapshot = await getDocs(collection(db, 'invitations'));
            const invitationsData = invitationsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log('Invitations:', invitationsData);
            setInvitations(invitationsData);
        } catch (error) {
            console.error('Error fetching invitations:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterInvitations = () => {
        let filtered = [...invitations];

        // Filter by type
        if (filterType !== 'all') {
            filtered = filtered.filter(inv => inv.category === filterType);
        }

        // Filter by search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(inv =>
                inv.title?.toLowerCase().includes(query) ||
                inv.restaurantName?.toLowerCase().includes(query) ||
                inv.creatorName?.toLowerCase().includes(query)
            );
        }

        setFilteredInvitations(filtered);
    };

    const handleDeleteInvitation = async (invitationId) => {
        if (!window.confirm('Are you sure you want to delete this invitation?')) return;

        try {
            await deleteDoc(doc(db, 'invitations', invitationId));
            setInvitations(invitations.filter(inv => inv.id !== invitationId));
            alert('Invitation deleted successfully!');
        } catch (error) {
            console.error('Error deleting invitation:', error);
            alert('Failed to delete invitation');
        }
    };

    const stats = {
        total: invitations.length,
        restaurant: invitations.filter(i => i.category === 'restaurant').length,
        cafe: invitations.filter(i => i.category === 'cafe').length,
        cinema: invitations.filter(i => i.category === 'cinema').length
    };

    if (loading) {
        return (
            <div className="admin-loading">
                <div style={{ textAlign: 'center' }}>
                    <div className="admin-spinner" />
                    <p style={{ color: '#94a3b8', fontSize: '1rem', marginTop: '1rem' }}>Loading invitations...</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="admin-page-header admin-mb-4">
                <h1 className="admin-page-title">Invitation Management</h1>
                <p className="admin-page-subtitle">Monitor and manage all user invitations</p>
            </div>

            {/* Stats */}
            <div className="admin-grid admin-grid-4 admin-mb-4">
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff' }}>{stats.total}</div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Total Invitations</div>
                </div>
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ef4444' }}>{stats.restaurant}</div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Restaurants</div>
                </div>
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#f59e0b' }}>{stats.cafe}</div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Cafes</div>
                </div>
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#8b5cf6' }}>{stats.cinema}</div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Cinemas</div>
                </div>
            </div>

            {/* Filters */}
            <div className="admin-card admin-mb-4">
                <div className="admin-flex admin-gap-2" style={{ flexWrap: 'wrap' }}>
                    <div className="admin-search" style={{ flex: 1, minWidth: '300px' }}>
                        <FaSearch className="admin-search-icon" />
                        <input
                            type="text"
                            placeholder="Search by title, restaurant, or creator..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="admin-search-input"
                        />
                    </div>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="admin-select"
                        style={{ width: '200px' }}
                    >
                        <option value="all">All Types</option>
                        <option value="restaurant">Restaurant</option>
                        <option value="cafe">Cafe</option>
                        <option value="cinema">Cinema</option>
                    </select>
                </div>
            </div>

            {/* Invitations List */}
            {filteredInvitations.length === 0 ? (
                <div className="admin-card">
                    <div className="admin-empty">
                        <div className="admin-empty-icon">✉️</div>
                        <h3 className="admin-empty-title">No Invitations Found</h3>
                        <p className="admin-empty-text">
                            {searchQuery ? 'Try a different search term' : 'No invitations created yet'}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Invitation</th>
                                <th>Creator</th>
                                <th>Category</th>
                                <th>Date & Time</th>
                                <th>Guests</th>
                                <th>Payment</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInvitations.map(invitation => (
                                <tr key={invitation.id}>
                                    {/* Invitation */}
                                    <td>
                                        <div>
                                            <div style={{ fontWeight: '600', color: '#ffffff' }}>
                                                {invitation.title || 'Untitled'}
                                            </div>
                                            <div className="admin-flex admin-gap-1 admin-mt-1" style={{ alignItems: 'center' }}>
                                                <FaMapMarkerAlt style={{ color: '#f59e0b', fontSize: '0.75rem' }} />
                                                <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                                    {invitation.restaurantName || 'Unknown'}
                                                </span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Creator */}
                                    <td>
                                        <div>
                                            <div style={{ fontWeight: '600', color: '#ffffff' }}>
                                                {invitation.creatorName || 'Unknown'}
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                                {invitation.creatorEmail || 'N/A'}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Category */}
                                    <td>
                                        <span className={
                                            invitation.category === 'restaurant'
                                                ? 'admin-badge admin-badge-danger'
                                                : invitation.category === 'cafe'
                                                    ? 'admin-badge admin-badge-warning'
                                                    : 'admin-badge admin-badge-primary'
                                        }>
                                            {invitation.category === 'restaurant' ? '🍽️ Restaurant' :
                                                invitation.category === 'cafe' ? '☕ Cafe' :
                                                    invitation.category === 'cinema' ? '🎬 Cinema' : invitation.category}
                                        </span>
                                    </td>

                                    {/* Date & Time */}
                                    <td>
                                        <div className="admin-flex admin-gap-1" style={{ alignItems: 'center' }}>
                                            <FaCalendar style={{ color: '#60a5fa', fontSize: '0.875rem' }} />
                                            <div>
                                                <div style={{ fontSize: '0.875rem', color: '#ffffff' }}>
                                                    {invitation.date || 'N/A'}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                    {invitation.time || 'N/A'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Guests */}
                                    <td>
                                        <div className="admin-flex admin-gap-1" style={{ alignItems: 'center' }}>
                                            <FaUsers style={{ color: '#22c55e', fontSize: '0.875rem' }} />
                                            <span style={{ fontSize: '0.875rem', color: '#ffffff', fontWeight: '600' }}>
                                                {invitation.acceptedCount || 0} / {invitation.maxGuests || 0}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Payment */}
                                    <td>
                                        <div className="admin-flex admin-gap-1" style={{ alignItems: 'center' }}>
                                            <FaDollarSign style={{ color: '#f59e0b', fontSize: '0.875rem' }} />
                                            <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                                {invitation.paymentType === 'host' ? 'Host Pays' :
                                                    invitation.paymentType === 'split' ? 'Split' : 'N/A'}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Actions */}
                                    <td>
                                        <div className="admin-flex admin-gap-1">
                                            <button
                                                onClick={() => {
                                                    setSelectedInvitation(invitation);
                                                    setShowModal(true);
                                                }}
                                                className="admin-btn admin-btn-sm"
                                                style={{ background: '#3b82f6', color: '#ffffff', padding: '0.5rem' }}
                                            >
                                                <FaEye />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteInvitation(invitation.id)}
                                                className="admin-btn admin-btn-sm admin-btn-danger"
                                                style={{ padding: '0.5rem' }}
                                            >
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Invitation Details Modal */}
            {showModal && selectedInvitation && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 50,
                    padding: '1rem'
                }}>
                    <div className="admin-card" style={{
                        maxWidth: '600px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflowY: 'auto'
                    }}>
                        <div className="admin-flex-between admin-mb-4">
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff' }}>
                                Invitation Details
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#94a3b8',
                                    fontSize: '2rem',
                                    cursor: 'pointer'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <div>
                                <label className="admin-label">Title</label>
                                <div style={{ color: '#ffffff', fontWeight: '600' }}>
                                    {selectedInvitation.title || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="admin-label">Description</label>
                                <div style={{ color: '#ffffff' }}>
                                    {selectedInvitation.description || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="admin-label">Restaurant/Venue</label>
                                <div style={{ color: '#ffffff' }}>
                                    {selectedInvitation.restaurantName || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="admin-label">Category</label>
                                <div style={{ color: '#ffffff' }}>
                                    {selectedInvitation.category || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="admin-label">Creator</label>
                                <div style={{ color: '#ffffff' }}>
                                    {selectedInvitation.creatorName || 'Unknown'}
                                </div>
                            </div>
                            <div>
                                <label className="admin-label">Date & Time</label>
                                <div style={{ color: '#ffffff' }}>
                                    {selectedInvitation.date} at {selectedInvitation.time}
                                </div>
                            </div>
                            <div>
                                <label className="admin-label">Guests</label>
                                <div style={{ color: '#ffffff' }}>
                                    {selectedInvitation.acceptedCount || 0} / {selectedInvitation.maxGuests || 0} accepted
                                </div>
                            </div>
                            <div>
                                <label className="admin-label">Payment Type</label>
                                <div style={{ color: '#ffffff' }}>
                                    {selectedInvitation.paymentType === 'host' ? 'Host Pays' :
                                        selectedInvitation.paymentType === 'split' ? 'Split Bill' : 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="admin-label">Created At</label>
                                <div style={{ color: '#ffffff' }}>
                                    {selectedInvitation.createdAt?.toDate?.()?.toLocaleString() || 'N/A'}
                                </div>
                            </div>
                        </div>

                        <div className="admin-flex admin-gap-2 admin-mt-4">
                            <button
                                onClick={() => {
                                    handleDeleteInvitation(selectedInvitation.id);
                                    setShowModal(false);
                                }}
                                className="admin-btn admin-btn-danger"
                                style={{ flex: 1 }}
                            >
                                Delete Invitation
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvitationManagement;
