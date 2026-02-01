import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { FaSearch, FaFilter, FaStore, FaCheckCircle, FaTimesCircle, FaBan, FaTrash, FaEye, FaMapMarkerAlt, FaPhone } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const PartnerManagement = () => {
    const navigate = useNavigate();
    const [partners, setPartners] = useState([]);
    const [filteredPartners, setFilteredPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedPartner, setSelectedPartner] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        fetchPartners();
    }, []);

    useEffect(() => {
        filterPartners();
    }, [partners, searchQuery, filterStatus]);

    const fetchPartners = async () => {
        try {
            setLoading(true);
            // Fetch business accounts
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const businessUsers = usersSnapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .filter(user => user.accountType === 'business');

            console.log('Partners:', businessUsers);
            setPartners(businessUsers);
        } catch (error) {
            console.error('Error fetching partners:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterPartners = () => {
        let filtered = [...partners];

        // Filter by status
        if (filterStatus === 'active') {
            filtered = filtered.filter(p => !p.banned && p.businessInfo?.published);
        } else if (filterStatus === 'banned') {
            filtered = filtered.filter(p => p.banned);
        } else if (filterStatus === 'unpublished') {
            filtered = filtered.filter(p => !p.businessInfo?.published);
        }

        // Filter by search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(partner =>
                partner.displayName?.toLowerCase().includes(query) ||
                partner.email?.toLowerCase().includes(query) ||
                partner.businessInfo?.businessName?.toLowerCase().includes(query)
            );
        }

        setFilteredPartners(filtered);
    };

    const handleBanPartner = async (partnerId, currentStatus) => {
        const action = currentStatus ? 'unban' : 'ban';
        if (!window.confirm(`Are you sure you want to ${action} this partner?`)) return;

        try {
            await updateDoc(doc(db, 'users', partnerId), {
                banned: !currentStatus,
                bannedAt: !currentStatus ? new Date() : null
            });

            setPartners(partners.map(p =>
                p.id === partnerId ? { ...p, banned: !currentStatus } : p
            ));

            alert(`Partner ${action}ned successfully!`);
        } catch (error) {
            console.error('Error banning partner:', error);
            alert('Failed to update partner status');
        }
    };

    const handleDeletePartner = async (partnerId) => {
        if (!window.confirm('Are you sure you want to DELETE this partner? This action cannot be undone!')) return;

        try {
            await deleteDoc(doc(db, 'users', partnerId));
            setPartners(partners.filter(p => p.id !== partnerId));
            alert('Partner deleted successfully!');
        } catch (error) {
            console.error('Error deleting partner:', error);
            alert('Failed to delete partner');
        }
    };

    const stats = {
        total: partners.length,
        active: partners.filter(p => !p.banned && p.businessInfo?.published).length,
        banned: partners.filter(p => p.banned).length,
        unpublished: partners.filter(p => !p.businessInfo?.published).length
    };

    if (loading) {
        return (
            <div className="admin-loading">
                <div style={{ textAlign: 'center' }}>
                    <div className="admin-spinner" />
                    <p style={{ color: '#94a3b8', fontSize: '1rem', marginTop: '1rem' }}>Loading partners...</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="admin-page-header admin-mb-4">
                <h1 className="admin-page-title">Partner Management</h1>
                <p className="admin-page-subtitle">Manage business accounts and partners</p>
            </div>

            {/* Stats */}
            <div className="admin-grid admin-grid-4 admin-mb-4">
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff' }}>{stats.total}</div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Total Partners</div>
                </div>
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#22c55e' }}>{stats.active}</div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Active</div>
                </div>
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ef4444' }}>{stats.banned}</div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Banned</div>
                </div>
                <div className="admin-card">
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#f59e0b' }}>{stats.unpublished}</div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Unpublished</div>
                </div>
            </div>

            {/* Filters */}
            <div className="admin-card admin-mb-4">
                <div className="admin-flex admin-gap-2" style={{ flexWrap: 'wrap' }}>
                    <div className="admin-search" style={{ flex: 1, minWidth: '300px' }}>
                        <FaSearch className="admin-search-icon" />
                        <input
                            type="text"
                            placeholder="Search by name, email, or business..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="admin-search-input"
                        />
                    </div>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="admin-select"
                        style={{ width: '200px' }}
                    >
                        <option value="all">All Partners</option>
                        <option value="active">Active</option>
                        <option value="banned">Banned</option>
                        <option value="unpublished">Unpublished</option>
                    </select>
                </div>
            </div>

            {/* Partners List */}
            {filteredPartners.length === 0 ? (
                <div className="admin-card">
                    <div className="admin-empty">
                        <div className="admin-empty-icon">🏪</div>
                        <h3 className="admin-empty-title">No Partners Found</h3>
                        <p className="admin-empty-text">
                            {searchQuery ? 'Try a different search term' : 'No business partners yet'}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Business</th>
                                <th>Owner</th>
                                <th>Contact</th>
                                <th>Location</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPartners.map(partner => (
                                <tr key={partner.id}>
                                    {/* Business */}
                                    <td>
                                        <div className="admin-flex admin-gap-2" style={{ alignItems: 'center' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '50%',
                                                background: '#8b5cf6',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#ffffff',
                                                fontWeight: '700'
                                            }}>
                                                <FaStore />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '600', color: '#ffffff' }}>
                                                    {partner.businessInfo?.businessName || 'No Business Name'}
                                                </div>
                                                <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                                    {partner.businessInfo?.category || 'Uncategorized'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Owner */}
                                    <td>
                                        <div>
                                            <div style={{ fontWeight: '600', color: '#ffffff' }}>
                                                {partner.displayName || 'No Name'}
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                                {partner.email}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Contact */}
                                    <td>
                                        <div className="admin-flex admin-gap-1" style={{ alignItems: 'center' }}>
                                            <FaPhone style={{ color: '#60a5fa', fontSize: '0.875rem' }} />
                                            <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                                {partner.businessInfo?.phone || 'N/A'}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Location */}
                                    <td>
                                        <div className="admin-flex admin-gap-1" style={{ alignItems: 'center' }}>
                                            <FaMapMarkerAlt style={{ color: '#f59e0b', fontSize: '0.875rem' }} />
                                            <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                                {partner.businessInfo?.location || 'N/A'}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Status */}
                                    <td>
                                        <div className="admin-flex admin-gap-1" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                            <span className={partner.banned ? 'admin-badge admin-badge-danger' : 'admin-badge admin-badge-success'}>
                                                {partner.banned ? (
                                                    <>
                                                        <FaTimesCircle style={{ fontSize: '0.75rem' }} />
                                                        Banned
                                                    </>
                                                ) : (
                                                    <>
                                                        <FaCheckCircle style={{ fontSize: '0.75rem' }} />
                                                        Active
                                                    </>
                                                )}
                                            </span>
                                            {partner.businessInfo?.published ? (
                                                <span className="admin-badge admin-badge-primary">Published</span>
                                            ) : (
                                                <span className="admin-badge admin-badge-warning">Unpublished</span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Actions */}
                                    <td>
                                        <div className="admin-flex admin-gap-1">
                                            <button
                                                onClick={() => {
                                                    setSelectedPartner(partner);
                                                    setShowModal(true);
                                                }}
                                                className="admin-btn admin-btn-sm"
                                                style={{ background: '#3b82f6', color: '#ffffff', padding: '0.5rem' }}
                                            >
                                                <FaEye />
                                            </button>
                                            <button
                                                onClick={() => handleBanPartner(partner.id, partner.banned)}
                                                className={`admin-btn admin-btn-sm ${partner.banned ? 'admin-btn-success' : 'admin-btn-danger'}`}
                                                style={{ padding: '0.5rem' }}
                                            >
                                                <FaBan />
                                            </button>
                                            <button
                                                onClick={() => handleDeletePartner(partner.id)}
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

            {/* Partner Details Modal */}
            {showModal && selectedPartner && (
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
                                Partner Details
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
                                <label className="admin-label">Business Name</label>
                                <div style={{ color: '#ffffff', fontWeight: '600' }}>
                                    {selectedPartner.businessInfo?.businessName || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="admin-label">Category</label>
                                <div style={{ color: '#ffffff' }}>
                                    {selectedPartner.businessInfo?.category || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="admin-label">Description</label>
                                <div style={{ color: '#ffffff' }}>
                                    {selectedPartner.businessInfo?.description || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="admin-label">Owner Name</label>
                                <div style={{ color: '#ffffff' }}>
                                    {selectedPartner.displayName || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="admin-label">Email</label>
                                <div style={{ color: '#ffffff' }}>{selectedPartner.email}</div>
                            </div>
                            <div>
                                <label className="admin-label">Phone</label>
                                <div style={{ color: '#ffffff' }}>
                                    {selectedPartner.businessInfo?.phone || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="admin-label">Location</label>
                                <div style={{ color: '#ffffff' }}>
                                    {selectedPartner.businessInfo?.location || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="admin-label">Joined</label>
                                <div style={{ color: '#ffffff' }}>
                                    {selectedPartner.createdAt?.toDate?.()?.toLocaleString() || 'N/A'}
                                </div>
                            </div>
                        </div>

                        <div className="admin-flex admin-gap-2 admin-mt-4">
                            <button
                                onClick={() => {
                                    handleBanPartner(selectedPartner.id, selectedPartner.banned);
                                    setShowModal(false);
                                }}
                                className={`admin-btn ${selectedPartner.banned ? 'admin-btn-success' : 'admin-btn-danger'}`}
                                style={{ flex: 1 }}
                            >
                                {selectedPartner.banned ? 'Unban Partner' : 'Ban Partner'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PartnerManagement;
