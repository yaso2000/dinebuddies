import React, { useState } from 'react';
import { useInvitations } from '../../context/InvitationContext';
import { FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';

const AdminSupport = () => {
    const { reports, resolveReport } = useInvitations();
    const [filter, setFilter] = useState('all'); // all, pending, resolved

    const filteredReports = reports.filter(r => filter === 'all' || r.status === filter);

    return (
        <div>
            <div className="admin-header">
                <h1 className="admin-title">الدعم الفني والبلاغات</h1>
                <div style={{ display: 'flex', background: 'white', borderRadius: '8px', padding: '4px', border: '1px solid #e5e7eb', gap: '4px' }}>
                    <button
                        onClick={() => setFilter('all')}
                        style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '14px', border: 'none', cursor: 'pointer', background: filter === 'all' ? '#f3f4f6' : 'transparent', fontWeight: filter === 'all' ? 'bold' : 'normal', color: filter === 'all' ? 'black' : '#6b7280' }}
                    >
                        الكل
                    </button>
                    <button
                        onClick={() => setFilter('pending')}
                        style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '14px', border: 'none', cursor: 'pointer', background: filter === 'pending' ? '#fef3c7' : 'transparent', fontWeight: filter === 'pending' ? 'bold' : 'normal', color: filter === 'pending' ? '#92400e' : '#6b7280' }}
                    >
                        قيد الانتظار
                    </button>
                    <button
                        onClick={() => setFilter('resolved')}
                        style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '14px', border: 'none', cursor: 'pointer', background: filter === 'resolved' ? '#d1fae5' : 'transparent', fontWeight: filter === 'resolved' ? 'bold' : 'normal', color: filter === 'resolved' ? '#065f46' : '#6b7280' }}
                    >
                        تم الحل
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {filteredReports.map(report => (
                    <div key={report.id} style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <div style={{ padding: '12px', borderRadius: '50%', height: 'fit-content', background: report.type === 'violation' ? '#fef2f2' : '#eff6ff', color: report.type === 'violation' ? '#dc2626' : '#2563eb' }}>
                                <FaExclamationCircle style={{ fontSize: '20px' }} />
                            </div>
                            <div>
                                <h3 style={{ fontWeight: 'bold', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 4px 0' }}>
                                    {report.target}
                                    <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px' }}>
                                        {report.type === 'violation' ? 'مخالفة' : 'مشكلة تقنية'}
                                    </span>
                                </h3>
                                <p style={{ color: '#4b5563', marginTop: '4px', marginBottom: '8px' }}>{report.details}</p>
                                <div style={{ fontSize: '12px', color: '#9ca3af', display: 'flex', gap: '16px' }}>
                                    <span>بواسطة: {report.reporter}</span>
                                    <span>التاريخ: {report.date}</span>
                                </div>
                            </div>
                        </div>

                        {report.status === 'pending' && (
                            <button
                                onClick={() => resolveReport(report.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#16a34a', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                            >
                                <FaCheckCircle /> <span>تحديد كـ محلول</span>
                            </button>
                        )}
                        {report.status === 'resolved' && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', background: '#d1fae5', padding: '4px 12px', borderRadius: '999px', fontSize: '14px', fontWeight: 'bold' }}>
                                <FaCheckCircle /> <span>تم الحل</span>
                            </span>
                        )}
                    </div>
                ))}

                {filteredReports.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
                        لا توجد بلاغات مطابقة للفلتر المحدد
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminSupport;
