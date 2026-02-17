import React, { useState } from 'react';
import { FaFilter, FaTimes, FaCalendar, FaDollarSign, FaMapMarkerAlt, FaUsers } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const AdvancedFilters = ({ onApplyFilters }) => {
    const { t, i18n } = useTranslation();
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        paymentType: 'all',
        dateRange: 'all',
        distance: 'all',
        guestsMin: '',
        ageRange: 'all',
        genderPreference: 'all'
    });

    const handleApply = () => {
        onApplyFilters(filters);
        setShowFilters(false);
    };

    const handleReset = () => {
        const resetFilters = {
            paymentType: 'all',
            dateRange: 'all',
            distance: 'all',
            guestsMin: '',
            ageRange: 'all',
            genderPreference: 'all'
        };
        setFilters(resetFilters);
        onApplyFilters(resetFilters);
    };

    const activeFiltersCount = Object.values(filters).filter(v => v && v !== 'all' && v !== '').length;

    return (
        <>
            {/* Filter Button */}
            <button
                onClick={() => setShowFilters(!showFilters)}
                style={{
                    position: 'relative',
                    background: activeFiltersCount > 0 ? 'var(--accent)' : 'var(--bg-card)',
                    border: `1px solid ${activeFiltersCount > 0 ? 'var(--accent)' : 'var(--border-color)'}`,
                    color: 'var(--text-main)',
                    padding: '10px 16px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s'
                }}
            >
                <FaFilter />
                {activeFiltersCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '-6px',
                        right: '-6px',
                        background: '#ef4444',
                        color: 'var(--btn-text)',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        fontSize: '0.7rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '900'
                    }}>
                        {activeFiltersCount}
                    </span>
                )}
            </button>

            {/* Filter Modal */}
            {showFilters && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.8)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    animation: 'fadeIn 0.2s'
                }}>
                    <div className="hide-scrollbar" style={{
                        background: 'var(--bg-body)',
                        borderRadius: '24px 24px 0 0',
                        width: '100%',
                        maxWidth: '600px',
                        maxHeight: '85vh',
                        overflowY: 'auto',
                        padding: '1.5rem',
                        animation: 'slideUp 0.3s ease-out'
                    }}>
                        {/* Header */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1.5rem'
                        }}>
                            <h3 style={{ fontSize: '1.3rem', fontWeight: '900' }}>
                                {t('advanced_filters')}
                            </h3>
                            <button
                                onClick={() => setShowFilters(false)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    fontSize: '1.5rem',
                                    cursor: 'pointer',
                                    padding: '4px'
                                }}
                            >
                                <FaTimes />
                            </button>
                        </div>

                        {/* Filters */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Payment Type */}
                            <div>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '0.9rem',
                                    fontWeight: '700',
                                    color: 'var(--text-secondary)',
                                    marginBottom: '0.75rem'
                                }}>
                                    <FaDollarSign style={{ color: 'var(--accent)' }} />
                                    {t('payment_type')}
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                                    {['all', 'Host Pays', 'Split', 'Each pays'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setFilters({ ...filters, paymentType: type })}
                                            style={{
                                                padding: '10px',
                                                background: filters.paymentType === type ? 'var(--accent)' : 'var(--bg-card)',
                                                border: `1px solid ${filters.paymentType === type ? 'var(--accent)' : 'var(--border-color)'}`,
                                                borderRadius: '10px',
                                                color: 'var(--text-main)',
                                                fontSize: '0.8rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {type === 'all' ? t('all') : type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Date Range */}
                            <div>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '0.9rem',
                                    fontWeight: '700',
                                    color: 'var(--text-secondary)',
                                    marginBottom: '0.75rem'
                                }}>
                                    <FaCalendar style={{ color: 'var(--accent)' }} />
                                    {t('date_range')}
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                                    {[
                                        { value: 'all', label: t('anytime') },
                                        { value: 'today', label: t('today') },
                                        { value: 'week', label: t('this_week') },
                                        { value: 'month', label: t('this_month') }
                                    ].map(option => (
                                        <button
                                            key={option.value}
                                            onClick={() => setFilters({ ...filters, dateRange: option.value })}
                                            style={{
                                                padding: '10px',
                                                background: filters.dateRange === option.value ? 'var(--accent)' : 'var(--bg-card)',
                                                border: `1px solid ${filters.dateRange === option.value ? 'var(--accent)' : 'var(--border-color)'}`,
                                                borderRadius: '10px',
                                                color: 'var(--text-main)',
                                                fontSize: '0.8rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Distance */}
                            <div>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '0.9rem',
                                    fontWeight: '700',
                                    color: 'var(--text-secondary)',
                                    marginBottom: '0.75rem'
                                }}>
                                    <FaMapMarkerAlt style={{ color: 'var(--accent)' }} />
                                    {t('distance')}
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                                    {[
                                        { value: 'all', label: t('all') },
                                        { value: '10km', label: '< 10km' },
                                        { value: '25km', label: '< 25km' },
                                        { value: '50km', label: '< 50km' }
                                    ].map(option => (
                                        <button
                                            key={option.value}
                                            onClick={() => setFilters({ ...filters, distance: option.value })}
                                            style={{
                                                padding: '10px',
                                                background: filters.distance === option.value ? 'var(--accent)' : 'var(--bg-card)',
                                                border: `1px solid ${filters.distance === option.value ? 'var(--accent)' : 'var(--border-color)'}`,
                                                borderRadius: '10px',
                                                color: 'var(--text-main)',
                                                fontSize: '0.8rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Gender Preference */}
                            <div>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '0.9rem',
                                    fontWeight: '700',
                                    color: 'var(--text-secondary)',
                                    marginBottom: '0.75rem'
                                }}>
                                    <FaUsers style={{ color: 'var(--accent)' }} />
                                    {t('gender')}
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                                    {[
                                        { value: 'all', label: t('all') },
                                        { value: 'Male', label: t('male') },
                                        { value: 'Female', label: t('female') },
                                        { value: 'Any', label: t('mixed') }
                                    ].map(option => (
                                        <button
                                            key={option.value}
                                            onClick={() => setFilters({ ...filters, genderPreference: option.value })}
                                            style={{
                                                padding: '10px',
                                                background: filters.genderPreference === option.value ? 'var(--accent)' : 'var(--bg-card)',
                                                border: `1px solid ${filters.genderPreference === option.value ? 'var(--accent)' : 'var(--border-color)'}`,
                                                borderRadius: '10px',
                                                color: 'var(--text-main)',
                                                fontSize: '0.8rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{
                            display: 'flex',
                            gap: '0.75rem',
                            marginTop: '2rem',
                            paddingTop: '1.5rem',
                            borderTop: '1px solid var(--border-color)',
                            paddingBottom: '120px' // Drastically increased padding to clear the bottom nav
                        }}>
                            <button
                                onClick={handleReset}
                                style={{
                                    flex: 1,
                                    padding: '14px',
                                    background: 'transparent',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-main)',
                                    borderRadius: '12px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    fontSize: '1rem'
                                }}
                            >
                                {t('reset')}
                            </button>
                            <button
                                onClick={handleApply}
                                style={{
                                    flex: 2,
                                    padding: '14px',
                                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                                    border: 'none',
                                    color: 'var(--btn-text)',
                                    borderRadius: '12px',
                                    fontWeight: '900',
                                    cursor: 'pointer',
                                    fontSize: '1rem'
                                }}
                            >
                                {t('apply_filters')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AdvancedFilters;
