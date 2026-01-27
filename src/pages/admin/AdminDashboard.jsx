import React from 'react';
import { useInvitations } from '../../context/InvitationContext';
import { FaUsers, FaStore, FaCalendarAlt, FaMoneyBillWave, FaExclamationTriangle } from 'react-icons/fa';

const StatCard = ({ title, value, icon, color, subtext }) => (
    <div className="stat-card" style={{ borderColor: color }}>
        <div className="stat-content">
            <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
            <h3>{value}</h3>
            {subtext && <p>{subtext}</p>}
        </div>
        <div className="stat-icon" style={{ backgroundColor: color + '20', color: color }}>
            {icon}
        </div>
    </div>
);

const AdminDashboard = () => {
    const { allUsers, restaurants, invitations, reports } = useInvitations();

    // Calculate Stats
    const totalUsers = allUsers.filter(u => u.role === 'user').length;
    const totalPartners = restaurants.filter(r => r.isPartner).length;
    const totalRevenue = 12500;
    const pendingReports = reports.filter(r => r.status === 'pending').length;

    return (
        <div className="space-y-6">
            <div className="admin-header">
                <h1 className="admin-title">نظرة عامة</h1>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <StatCard
                    title="إجمالي الأعضاء"
                    value={totalUsers}
                    icon={<FaUsers />}
                    color="#3B82F6"
                    subtext="+12% هذا الشهر"
                />
                <StatCard
                    title="الشركاء النشطين"
                    value={totalPartners}
                    icon={<FaStore />}
                    color="#10B981"
                    subtext="3 طلبات انضمام جديدة"
                />
                <StatCard
                    title="إجمالي الدعوات"
                    value={invitations.length}
                    icon={<FaCalendarAlt />}
                    color="#8B5CF6"
                    subtext="آخر 30 يوم"
                />
                <StatCard
                    title="إجمالي الإيرادات"
                    value={`${totalRevenue} ر.س`}
                    icon={<FaMoneyBillWave />}
                    color="#F59E0B"
                    subtext="المتوقع: 15,000 ر.س"
                />
            </div>

            {/* Quick Actions & Alerts */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                {/* Reports Widget */}
                <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ fontWeight: 'bold' }}>البلاغات الأخيرة</h3>
                        {pendingReports > 0 && <span className="badge badge-banned">{pendingReports} جديد</span>}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {reports.slice(0, 3).map(report => (
                            <div key={report.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px', background: '#f9fafb', borderRadius: '8px' }}>
                                <FaExclamationTriangle color="#ef4444" />
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>{report.target}</h4>
                                    <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{report.details}</p>
                                </div>
                                <span className={`badge ${report.status === 'resolved' ? 'badge-active' : 'badge-pending'}`}>
                                    {report.status === 'resolved' ? 'تم الحل' : 'قيد المراجعة'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* System Status Mock */}
                <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', height: 'fit-content' }}>
                    <h3 style={{ fontWeight: 'bold', marginBottom: '15px' }}>حالة النظام</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '14px', color: '#6b7280' }}>الخوادم</span>
                            <span style={{ color: '#10B981', fontSize: '12px', fontWeight: 'bold' }}>● تعمل بكفاءة</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '14px', color: '#6b7280' }}>قاعدة البيانات</span>
                            <span style={{ color: '#10B981', fontSize: '12px', fontWeight: 'bold' }}>● متصلة</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '14px', color: '#6b7280' }}>إصدار التطبيق</span>
                            <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>v1.2.0</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
