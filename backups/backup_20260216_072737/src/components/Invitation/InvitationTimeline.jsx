import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheckCircle, FaMapMarkerAlt, FaWalking, FaFlagCheckered } from 'react-icons/fa';

/**
 * InvitationTimeline Component
 * Displays the progress of a meeting (Planning -> On Way -> Arrived -> Completed)
 * Adapts to individual user status (myStatus).
 */
const InvitationTimeline = ({ myStatus, isAccepted, isHost, onUpdateStatus, isUpdatingStatus }) => {
    const { t } = useTranslation();

    // Calculate progress width based on status
    const getProgressWidth = () => {
        switch (myStatus) {
            case 'planning': return '0%';
            case 'on_way': return '40%';
            case 'arrived': return '80%';
            case 'completed': return '100%';
            default: return '0%';
        }
    };

    const steps = [
        { id: 'planning', icon: FaCheckCircle, label: t('planning') },
        { id: 'on_way', icon: FaWalking, label: t('on_way') },
        { id: 'arrived', icon: FaMapMarkerAlt, label: t('arrived') },
        { id: 'completed', icon: FaFlagCheckered, label: t('completed') }
    ];

    // Helper to determine if a step is active/completed
    const isStepActive = (stepId) => {
        if (myStatus === 'completed') return true;
        if (myStatus === 'arrived' && stepId !== 'completed') return true;
        if (myStatus === 'on_way' && (stepId === 'planning' || stepId === 'on_way')) return true;
        if (myStatus === 'planning' && stepId === 'planning') return true;
        return false;
    };

    return (
        <div className="meeting-timeline" style={{ marginBottom: '2rem', background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>


            <div style={{ position: 'relative', padding: '0 10px' }}>
                {/* Progress Bar Background */}
                <div style={{ position: 'absolute', top: '24px', left: '0', right: '0', height: '4px', background: 'var(--border-color)', borderRadius: '2px', zIndex: 1 }}></div>

                {/* Active Progress Bar */}
                <div style={{
                    position: 'absolute',
                    top: '24px',
                    left: '0',
                    width: getProgressWidth(),
                    height: '4px',
                    background: 'var(--primary)',
                    borderRadius: '2px',
                    zIndex: 2,
                    transition: 'width 0.5s ease-in-out',
                    boxShadow: '0 0 10px var(--primary)'
                }}></div>

                {/* Steps */}
                <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 3 }}>
                    {steps.map((step, index) => {
                        const active = isStepActive(step.id);
                        const Icon = step.icon;
                        return (
                            <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px' }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: active ? 'var(--primary)' : 'var(--bg-body)',
                                    border: `2px solid ${active ? 'var(--primary)' : 'var(--border-color)'}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '8px',
                                    transition: 'all 0.3s ease',
                                    color: active ? 'white' : 'var(--text-muted)',
                                    boxShadow: active ? '0 0 15px rgba(249, 115, 22, 0.4)' : 'none'
                                }}>
                                    <Icon size={14} />
                                </div>
                                <span style={{
                                    fontSize: '0.65rem',
                                    color: active ? 'var(--text-white)' : 'var(--text-muted)',
                                    fontWeight: active ? '700' : '400',
                                    textAlign: 'center'
                                }}>
                                    {step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Action Buttons */}
            {(isAccepted || isHost) && myStatus !== 'completed' && (
                <div className="timeline-actions" style={{ marginTop: '2rem', display: 'flex', gap: '10px' }}>
                    {myStatus === 'planning' && (
                        <button
                            onClick={() => onUpdateStatus('on_way')}
                            disabled={isUpdatingStatus}
                            className="btn btn-primary"
                            style={{ flex: 1, padding: '12px', borderRadius: '12px', fontSize: '0.9rem', opacity: isUpdatingStatus ? 0.7 : 1 }}
                        >
                            {isUpdatingStatus ? 'Updating...' : t('im_on_way')}
                        </button>
                    )}

                    {myStatus === 'on_way' && (
                        <button
                            onClick={() => onUpdateStatus('arrived')}
                            disabled={isUpdatingStatus}
                            className="btn btn-secondary"
                            style={{ flex: 1, padding: '12px', borderRadius: '12px', fontSize: '0.9rem', background: '#10b981', border: 'none', color: 'white', opacity: isUpdatingStatus ? 0.7 : 1 }}
                        >
                            {isUpdatingStatus ? 'Updating...' : t('ive_arrived')}
                        </button>
                    )}

                    {myStatus === 'arrived' && isHost && (
                        <button
                            onClick={onComplete} // Changed from onUpdateStatus
                            disabled={isUpdatingStatus}
                            style={{ flex: 1, padding: '12px', borderRadius: '12px', fontSize: '0.9rem', background: 'var(--luxury-gold)', border: 'none', color: 'black', fontWeight: 'bold' }}
                        >
                            {t('complete_meeting')}
                        </button>
                    )}

                    {myStatus === 'arrived' && !isHost && (
                        <div style={{ flex: 1, textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {t('waiting_host_complete', 'Waiting for host to complete...')}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default InvitationTimeline;
