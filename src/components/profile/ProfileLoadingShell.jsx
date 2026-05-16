import React, { memo } from 'react';

function ProfileLoadingShell({ t }) {
    return (
        <div
            className="page-container"
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                background: 'var(--bg-body)',
                padding: '2rem',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <div className="loader-ring" />
            <p style={{ marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {t('loading_profile', 'Loading Profile...')}
            </p>
        </div>
    );
}

export default memo(ProfileLoadingShell);
