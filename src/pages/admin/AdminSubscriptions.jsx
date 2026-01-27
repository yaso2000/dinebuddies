import React, { useState } from 'react';
import { useInvitations } from '../../context/InvitationContext';
import { FaEdit, FaCheck, FaPlus } from 'react-icons/fa';

const AdminSubscriptions = () => {
    const { subscriptionPlans, updatePlan } = useInvitations();
    const [editMode, setEditMode] = useState(null); // ID of plan being edited
    const [tempPlan, setTempPlan] = useState({});

    const handleEdit = (plan) => {
        setTempPlan(plan);
        setEditMode(plan.id);
    };

    const handleSave = () => {
        updatePlan(editMode, tempPlan);
        setEditMode(null);
    };

    const handleChange = (field, value) => {
        setTempPlan(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div>
            <div className="admin-header">
                <h1 className="admin-title">إدارة الباقات والاشتراكات</h1>
                <button className="btn-primary-admin" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FaPlus /> <span>باقة جديدة</span>
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                {subscriptionPlans.map(plan => (
                    <div key={plan.id} style={{
                        background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        border: editMode === plan.id ? '2px solid #3b82f6' : '2px solid transparent',
                        padding: '24px'
                    }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            {editMode === plan.id ? (
                                <input
                                    type="text"
                                    value={tempPlan.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    style={{ fontWeight: 'bold', fontSize: '1.25rem', border: '1px solid #e5e7eb', padding: '4px', borderRadius: '4px', width: '100%' }}
                                />
                            ) : (
                                <h3 style={{ fontWeight: 'bold', fontSize: '1.25rem', margin: 0 }}>{plan.name}</h3>
                            )}
                            <span className={`badge ${plan.type === 'partner' ? 'badge-pending' : 'badge-active'}`} style={{ marginLeft: '10px' }}>
                                {plan.type === 'partner' ? 'شريك' : 'عضو'}
                            </span>
                        </div>

                        {/* Price */}
                        <div style={{ marginBottom: '24px' }}>
                            {editMode === plan.id ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="number"
                                        value={tempPlan.price}
                                        onChange={(e) => handleChange('price', parseInt(e.target.value))}
                                        style={{ fontSize: '1.875rem', fontWeight: 'bold', width: '100px', border: '1px solid #e5e7eb', padding: '4px', borderRadius: '4px' }}
                                    />
                                    <span style={{ color: '#6b7280' }}>ر.س / شهر</span>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                    <span style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#1f2937' }}>{plan.price}</span>
                                    <span style={{ color: '#6b7280' }}>ر.س / شهر</span>
                                </div>
                            )}
                        </div>

                        {/* Features List */}
                        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', fontSize: '0.9rem', color: '#4b5563', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {plan.features.map((feature, idx) => (
                                <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FaCheck style={{ color: '#10b981', fontSize: '12px' }} />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>

                        {/* Actions */}
                        <div style={{ paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
                            {editMode === plan.id ? (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={handleSave}
                                        style={{ flex: 1, background: '#16a34a', color: 'white', padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                                    >
                                        حفظ
                                    </button>
                                    <button
                                        onClick={() => setEditMode(null)}
                                        style={{ flex: 1, background: '#e5e7eb', color: '#374151', padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                                    >
                                        إلغاء
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => handleEdit(plan)}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#2563eb', background: 'transparent', padding: '8px', borderRadius: '8px', border: '1px solid #dbeafe', cursor: 'pointer' }}
                                >
                                    <FaEdit /> <span>تعديل الباقة</span>
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdminSubscriptions;
