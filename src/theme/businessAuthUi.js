/** Shared business auth visuals — login hub registration block + /business/login */

export const BUSINESS_PANEL_GRADIENT =
    'linear-gradient(135deg, #f59e0b 0%, #ec4899 55%, #a78bfa 100%)';

export const BUSINESS_CTA_GRADIENT = 'linear-gradient(135deg, #f59e0b, #d97706)';

/** Inputs inside business gradient panels (matches LoginHub business form) */
export const businessInputStyle = {
    width: '100%',
    padding: '0.85rem 1rem 0.85rem 2.75rem',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    color: 'var(--text-main)',
    fontSize: '0.95rem',
    boxSizing: 'border-box',
    outline: 'none',
};

export const loginHubCardShell = {
    margin: 'auto',
    maxWidth: 'min(520px, 100%)',
    width: '100%',
    padding: '1.15rem 0.55rem 1.35rem',
    borderRadius: '24px',
    border: '1px solid var(--border-color)',
    boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
    flexShrink: 0,
};
