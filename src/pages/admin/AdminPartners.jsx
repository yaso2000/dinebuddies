import React from 'react';
import { useInvitations } from '../../context/InvitationContext';
import { FaStore, FaEnvelope, FaStar } from 'react-icons/fa';

const AdminPartners = () => {
    // In a real app, we'd filter users by role='partner_owner' or fetch from a partners endpoint
    // For now we simulate with mock data
    const partners = [
        { id: 'p1', name: 'Le Bistro', owner: 'أحمد', status: 'active', rating: 4.5, joined: '2024-01-01' },
        { id: 'p2', name: 'Sushi Art', owner: 'سارة', status: 'pending', rating: 0, joined: '2024-02-10' },
    ];

    return (
        <div>
            <div className="admin-header">
                <h1 className="admin-title">إدارة الشركاء والمطاعم</h1>
            </div>

            <div className="admin-table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>اسم المنشأة</th>
                            <th>المالك</th>
                            <th>تاريخ الانضمام</th>
                            <th>التقييم</th>
                            <th>الحالة</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {partners.map(p => (
                            <tr key={p.id}>
                                <td style={{ fontWeight: 'bold' }}>{p.name}</td>
                                <td>{p.owner}</td>
                                <td style={{ fontSize: '0.875rem', color: '#6b7280' }}>{p.joined}</td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b' }}>
                                        <FaStar /> <span>{p.rating}</span>
                                    </div>
                                </td>
                                <td>
                                    <span className={`badge ${p.status === 'active' ? 'badge-active' : 'badge-pending'}`}>
                                        {p.status === 'active' ? 'نشط' : 'قيد المراجعة'}
                                    </span>
                                </td>
                                <td>
                                    <button style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                                        التفاصيل
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminPartners;
