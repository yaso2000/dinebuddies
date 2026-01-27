import React, { useState } from 'react';
import { useInvitations } from '../../context/InvitationContext';
import { FaBan, FaCheckCircle, FaSearch, FaEnvelope } from 'react-icons/fa';

const AdminUsers = () => {
    const { allUsers, banUser, sendSystemMessage } = useInvitations();
    const [searchTerm, setSearchTerm] = useState('');
    const [messageModal, setMessageModal] = useState(null); // ID of user being messaged

    const filteredUsers = allUsers.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSendMessage = (e) => {
        e.preventDefault();
        const msg = e.target.msg.value;
        sendSystemMessage(messageModal, msg);
        setMessageModal(null);
    };

    return (
        <div>
            <div className="admin-header">
                <h1 className="admin-title">إدارة الأعضاء</h1>
                <div style={{ position: 'relative' }}>
                    <input
                        type="text"
                        placeholder="بحث عن عضو..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <FaSearch style={{ position: 'absolute', left: '10px', top: '12px', color: '#9ca3af' }} />
                </div>
            </div>

            <div className="admin-table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>الاسم</th>
                            <th>البريد الإلكتروني</th>
                            <th>تاريخ الانضمام</th>
                            <th>الحالة</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(user => (
                            <tr key={user.id}>
                                <td style={{ fontWeight: '500' }}>{user.name}</td>
                                <td style={{ color: '#4b5563' }}>{user.email}</td>
                                <td style={{ fontSize: '0.875rem', color: '#6b7280' }}>{user.joinDate}</td>
                                <td>
                                    <span className={`badge ${user.status === 'active' ? 'badge-active' : 'badge-banned'}`}>
                                        {user.status === 'active' ? 'نشط' : 'محظور'}
                                    </span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex' }}>
                                        <button
                                            onClick={() => setMessageModal(user.id)}
                                            className="btn-action btn-blue"
                                            title="إرسال رسالة"
                                        >
                                            <FaEnvelope />
                                        </button>
                                        <button
                                            onClick={() => banUser(user.id)}
                                            className={`btn-action ${user.status === 'active' ? 'btn-red' : 'btn-blue'}`}
                                            title={user.status === 'active' ? 'حظر العضو' : 'فك الحظر'}
                                        >
                                            {user.status === 'active' ? <FaBan /> : <FaCheckCircle />}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Message Modal */}
            {messageModal && (
                <div style={{
                    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px' }}>
                        <h3 style={{ fontWeight: 'bold', fontSize: '1.125rem', marginBottom: '16px' }}>إرسال رسالة إدارية</h3>
                        <form onSubmit={handleSendMessage}>
                            <textarea
                                name="msg"
                                style={{ width: '100%', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '16px', minHeight: '100px' }}
                                placeholder="اكتب نص الرسالة هنا..."
                                required
                            ></textarea>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => setMessageModal(null)}
                                    style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#f3f4f6', cursor: 'pointer' }}
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary-admin"
                                >
                                    إرسال
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminUsers;
