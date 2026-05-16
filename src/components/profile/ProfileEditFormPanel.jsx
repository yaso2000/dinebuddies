import React, { memo } from 'react';
import { FaHeart, FaBan } from 'react-icons/fa';
import { FavoritePlaces } from '../ProfileEnhancementsExtended';

function ProfileEditFormPanel({
    formData,
    setFormData,
    t,
    currentUser,
    handleSave,
    isSaving,
    cancelEditing,
}) {
    return (
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
                <label
                    className="ui-form-label"
                    style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px', textAlign: 'center' }}
                >
                    {t('profile_name')}
                </label>
                <input
                    type="text"
                    className="ui-form-field"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: '900' }}
                />
            </div>

            <div className="form-group">
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0 4px',
                        marginBottom: '5px',
                    }}
                >
                    <label className="ui-form-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                        {t('profile_bio')}
                    </label>
                    <span
                        style={{
                            fontSize: '0.7rem',
                            color: formData.bio?.length >= 150 ? 'var(--secondary)' : 'var(--text-muted)',
                        }}
                    >
                        {formData.bio?.length || 0} / 150
                    </span>
                </div>
                <textarea
                    className="ui-form-field"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder={t('profile_bio_placeholder')}
                    maxLength={150}
                    style={{ textAlign: 'center', fontSize: '0.9rem', minHeight: '80px' }}
                />
            </div>

            <div
                className="form-group"
                style={{
                    border: '1px solid color-mix(in srgb, var(--primary) 30%, var(--border-color))',
                    borderRadius: '14px',
                    padding: '12px',
                    background: 'color-mix(in srgb, var(--primary) 10%, var(--bg-card))',
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {t('dating_invitation_preference_title', 'Dating invitation preference')}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {t('dating_invitation_preference_desc', 'Control whether others can send you dating invitations.')}
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, availableForDating: true }))}
                        style={{
                            padding: '11px',
                            borderRadius: '12px',
                            border: formData.availableForDating ? '2px solid #16a34a' : '1px solid var(--border-color)',
                            background: formData.availableForDating ? 'rgba(22,163,74,0.16)' : 'var(--bg-card)',
                            color: formData.availableForDating ? 'var(--text-main)' : 'var(--text-muted)',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '7px',
                        }}
                    >
                        <FaHeart color={formData.availableForDating ? '#ef4444' : 'currentColor'} />
                        {t('dating_invites_accept', 'Accept')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, availableForDating: false }))}
                        style={{
                            padding: '11px',
                            borderRadius: '12px',
                            border: !formData.availableForDating ? '2px solid #ef4444' : '1px solid var(--border-color)',
                            background: !formData.availableForDating ? 'rgba(239,68,68,0.16)' : 'var(--bg-card)',
                            color: !formData.availableForDating ? 'var(--text-main)' : 'var(--text-muted)',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '7px',
                        }}
                    >
                        <FaBan color={!formData.availableForDating ? '#ef4444' : 'currentColor'} />
                        {t('dating_invites_reject', 'Reject')}
                    </button>
                </div>
            </div>

            <FavoritePlaces userId={currentUser?.uid || currentUser?.id} readOnly={false} />

            <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="ui-btn ui-btn--primary" onClick={handleSave} disabled={isSaving} style={{ flex: 1 }}>
                    {isSaving ? t('saving') : t('save_btn')}
                </button>
                <button type="button" className="ui-btn ui-btn--ghost" onClick={cancelEditing} disabled={isSaving} style={{ flex: 1 }}>
                    {t('cancel_btn')}
                </button>
            </div>
        </div>
    );
}

export default memo(ProfileEditFormPanel);
