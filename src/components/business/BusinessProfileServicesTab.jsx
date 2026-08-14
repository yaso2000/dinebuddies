import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlus, FaSave, FaTimes } from 'react-icons/fa';
import { AppText, AppTextInput } from '../base';
import PremiumBadge from '../PremiumBadge';
import ServiceModal, { SERVICE_ICONS } from '../ServiceModal';

export default function BusinessProfileServicesTab({ profile }) {
  const { t } = useTranslation();
  const {
    activeTab,
    isOwner,
    tc,
    showServiceDraftBanner,
    setShowServiceDraftBanner,
    showServiceAddForm,
    setShowServiceAddForm,
    pendingServices,
    serviceForm,
    setServiceForm,
    serviceIconSearch,
    setServiceIconSearch,
    savingServices,
    services,
    handleAddServiceLocal,
    handleSaveAllServices,
    handleDiscardServices,
    handleDeleteService,
    setEditingService,
    setShowServiceModal,
    showServiceModal,
    editingService,
    handleAddService,
  } = profile;

  return (
    <>
            {activeTab === 'services' &&
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--profile-stack-gap)' }}>

                    {/* Draft Banner - Free Plan */}
                    {showServiceDraftBanner &&
      <div className="ui-banner--warning">
                            <AppText as="span" style={{ fontSize: '1.4rem', flexShrink: 0 }}>⚠️</AppText>
                            <div style={{ flex: 1 }}>
                                <AppText as="p" className="ui-banner--warning__title">{t('business_saved_as_draft', 'Saved as Draft')}</AppText>
                                <AppText as="p" style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                    {t('business_services_draft_body', 'Your services were saved, but they will not appear on your public profile until you upgrade your plan.')}
                                </AppText>
                                <a href="/settings/subscription" className="ui-banner--warning__link">🚀 {t('upgrade_plan', 'Upgrade Plan')}</a>
                            </div>
                            <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setShowServiceDraftBanner(false)} style={{ padding: '4px', color: 'var(--text-muted)', fontSize: '1.1rem', flexShrink: 0 }}>✕</button>
                        </div>
      }

                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', border: `1px solid var(--border-color)`, borderRadius: '24px', padding: '16px 24px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                        <AppText as="h3" style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AppText as="span" style={{ fontSize: '1.2rem' }}>✨</AppText> {t('business_services', 'Business Services')}
                        </AppText>
                        {isOwner &&
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <PremiumBadge mode="pro" text={t('biz_plan_paid_name', 'Paid')} />
                                {/* ＋ Add button toggles inline form */}
                                <button
            onClick={() => setShowServiceAddForm((v) => !v)}
            title={showServiceAddForm ? t('close_form') : t('add_service')}
            style={{
              width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
              border: `1px solid ${showServiceAddForm ? 'var(--color-danger)' : 'var(--color-success)'}`,
              background: showServiceAddForm ? 'color-mix(in srgb, var(--color-danger) 10%, transparent)' : 'color-mix(in srgb, var(--color-success) 10%, transparent)',
              color: showServiceAddForm ? 'var(--color-danger)' : 'var(--color-success)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>

                                    {showServiceAddForm ? <FaTimes size={15} /> : <FaPlus size={15} />}
                                </button>
                            </div>
        }
                    </div>

                    {/* ── Inline Add Form ── */}
                    {isOwner && showServiceAddForm &&
      <div className="ui-form-surface" style={{ background: 'var(--bg-card)' }}>
                            <AppText as="h4" style={{ margin: 0, fontWeight: '800', fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FaPlus style={{ color: 'var(--color-success)' }} /> Add Service
                            </AppText>

                            {/* Pending preview */}
                            {pendingServices.length > 0 &&
        <div style={{
          padding: '0.75rem', borderRadius: '10px',
          background: 'color-mix(in srgb, var(--color-success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-success) 25%, transparent)'
        }}>
                                    <AppText as="p" style={{ margin: '0 0 6px', fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-success)' }}>
                                        ✅ {pendingServices.length} service{pendingServices.length > 1 ? 's' : ''} ready to save:
                                    </AppText>
                                    {pendingServices.map((s, i) =>
        <div key={i} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                            {s.icon} {s.name}
                                        </div>
        )}
                                </div>
        }

                            {/* Icon preview + search */}
                            <div style={{ textAlign: 'center' }}>
                                <div style={{
            width: '64px', height: '64px', borderRadius: '16px', fontSize: '2.4rem',
            background: 'color-mix(in srgb, var(--primary) 10%, transparent)', border: '2px solid color-mix(in srgb, var(--primary) 30%, transparent)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px'
          }}>
                                    {serviceForm.icon}
                                </div>
                            </div>
                            <AppTextInput
        type="text"
        className="ui-form-field"
        value={serviceIconSearch}
        onChange={(e) => setServiceIconSearch(e.target.value)}
        placeholder={t('search_icons')}
        style={{ padding: '8px 12px' }} />

                            {/* Icon grid */}
                            <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px',
          maxHeight: '180px', overflowY: 'auto',
          border: '1px solid var(--border-color)', borderRadius: '12px',
          background: 'var(--bg-body)', padding: '6px'
        }}>
                                {(serviceIconSearch ?
        SERVICE_ICONS.filter((s) => s.label.toLowerCase().includes(serviceIconSearch.toLowerCase())) :
        SERVICE_ICONS).
        map((s) =>
        <button
          key={s.icon} type="button" title={s.label}
          onClick={() => setServiceForm((f) => ({ ...f, icon: s.icon }))}
          style={{
            fontSize: '1.5rem', padding: '6px', borderRadius: '8px', border: 'none',
            background: serviceForm.icon === s.icon ? 'color-mix(in srgb, var(--primary) 25%, transparent)' : 'transparent',
            outline: serviceForm.icon === s.icon ? '2px solid var(--primary)' : 'none',
            cursor: 'pointer'
          }}>
          {s.icon}</button>
        )}
                            </div>

                            {/* Name */}
                            <div>
                                <label className="ui-form-label">{t('service_item_name')} *</label>
                                <AppTextInput
          type="text"
          className="ui-form-field"
          value={serviceForm.name}
          onChange={(e) => setServiceForm((f) => ({ ...f, name: e.target.value }))}
          placeholder={t('business_service_name_placeholder')} />

                            </div>

                            {/* Description */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <label className="ui-form-label" style={{ margin: 0 }}>{t('description')} ({t('optional')})</label>
                                    <AppText as="span" style={{ fontSize: '0.75rem', color: (serviceForm.description?.length || 0) >= 150 ? 'var(--secondary)' : 'var(--text-muted)' }}>
                                        {serviceForm.description?.length || 0}/150
                                    </AppText>
                                </div>
                                <AppTextInput as="textarea"
        className="ui-form-field"
        value={serviceForm.description}
        onChange={(e) => setServiceForm((f) => ({ ...f, description: e.target.value }))}
        maxLength={150}
        rows={2}
        placeholder={t('service_info_placeholder')}
        style={{ resize: 'vertical' }} />

                            </div>

                            {/* Action buttons: Add / Save(N) / ✕ */}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {/* + Add */}
                                <button
        onClick={handleAddServiceLocal}
        disabled={!serviceForm.name.trim()}
        style={{
          flex: 1, padding: '0.65rem 1rem', borderRadius: '10px',
          border: '1px solid rgba(139,92,246,0.4)',
          background: serviceForm.name.trim() ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
          color: serviceForm.name.trim() ? '#a78bfa' : 'var(--text-muted)',
          fontWeight: '700', fontSize: '0.9rem',
          cursor: serviceForm.name.trim() ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
        }}>

                                    <FaPlus size={13} /> + Add
                                </button>

                                {/* 💾 Save all */}
                                <button
        onClick={handleSaveAllServices}
        disabled={savingServices || pendingServices.length === 0}
        style={{
          flex: 2, padding: '0.65rem 1rem', borderRadius: '10px',
          border: '1px solid color-mix(in srgb, var(--color-success) 40%, transparent)',
          background: pendingServices.length > 0 ? 'color-mix(in srgb, var(--color-success) 15%, transparent)' : 'var(--hover-overlay)',
          color: pendingServices.length > 0 ? 'var(--color-success)' : 'var(--text-muted)',
          fontWeight: '700', fontSize: '0.9rem',
          cursor: pendingServices.length > 0 ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
        }}>

                                    <FaSave size={13} /> {savingServices ? t('save_pending') : t('save_count', { count: pendingServices.length })}
                                </button>

                                {/* ✕ Discard */}
                                <button
        type="button"
        className="ui-btn ui-btn--danger-outline"
        onClick={handleDiscardServices}
        style={{ padding: '0.65rem 0.9rem' }}
        title={t('discard_pending')}>

                                    <FaTimes size={14} />
                                </button>
                            </div>
                        </div>
      }

                    {/* Services grid */}
                    {services.length > 0 ?
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
                            {services.map((service, index) =>
        <div key={service.id || index} style={{
          background: 'var(--bg-card)', border: `1px solid var(--border-color)`,
          borderRadius: '20px', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          gap: '12px', position: 'relative', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }} onMouseEnter={(e) => {e.currentTarget.style.transform = 'translateY(-6px)';e.currentTarget.style.boxShadow = '0 8px 24px color-mix(in srgb, var(--brand-primary) 30%, transparent)';}} onMouseLeave={(e) => {e.currentTarget.style.transform = 'translateY(0)';e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';}}>
                                    <div style={{ fontSize: '3rem', filter: tc ? `drop-shadow(0 4px 8px ${tc.accent}55)` : 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}>{service.icon || '⚙️'}</div>
                                    <AppText as="h4" style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>{service.name}</AppText>
                                    {service.description && <AppText as="p" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{service.description}</AppText>}
                                    {isOwner &&
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', opacity: 0.8 }} className="service-actions">
                                            <button onClick={() => {setEditingService(index);setShowServiceModal(true);}} style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: '700', background: 'var(--hover-overlay)', border: 'none', borderRadius: '8px', color: 'var(--text-main)', cursor: 'pointer' }}>{t('edit')}</button>
                                            <button type="button" className="ui-btn ui-btn--danger-outline" onClick={() => handleDeleteService(index)} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>{t('delete')}</button>
                                        </div>
          }
                                </div>
        )}
                        </div> :
      !showServiceAddForm &&
      <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--bg-card)', borderRadius: '24px', border: `1px dashed var(--border-color)` }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🔧</div>
                            <AppText as="p" style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '1rem' }}>{t('business_no_services_listed', 'No services listed yet.')}</AppText>
                            {isOwner &&
        <button onClick={() => setShowServiceAddForm(true)} style={{ padding: '12px 24px', fontSize: '0.9rem', fontWeight: '800', background: 'var(--brand-primary)', border: 'none', borderRadius: '16px', color: 'white', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                                    ➕ Add Your First Service
                                </button>
        }
                        </div>
      }
                </div>
    }

            {showServiceModal &&
    <ServiceModal
      service={editingService !== null ? services[editingService] : null}
      onSave={handleAddService}
      onClose={() => {setShowServiceModal(false);setEditingService(null);}} />


    }
        </>);

}
