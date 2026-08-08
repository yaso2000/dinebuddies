import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaApple } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { usePersonalOAuthSignIn } from '../../hooks/usePersonalOAuthSignIn';

const BTN_BASE = {
    width: '100%',
    minHeight: 52,
    padding: '0 16px',
    borderRadius: 14,
    border: '1px solid rgba(255, 255, 255, 0.14)',
    background: '#ffffff',
    color: '#111827',
    fontWeight: 800,
    fontSize: '0.95rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
};

/**
 * @param {{
 *   providers?: Array<'google' | 'apple' | 'facebook'>,
 *   onBeforeOAuth?: () => void,
 *   onOAuthRedirect?: () => void,
 *   disabled?: boolean,
 *   className?: string,
 * }} props
 */
export default function PersonalOAuthButtons({
    providers = ['google', 'apple'],
    onBeforeOAuth,
    onOAuthRedirect,
    disabled = false,
    className = '',
}) {
    const { t } = useTranslation();
    const { loading, error, signInWithGoogle, signInWithApple, signInWithFacebook } =
        usePersonalOAuthSignIn(onBeforeOAuth, onOAuthRedirect);

    const isDisabled = disabled || loading;

    return (
        <div className={`personal-oauth-buttons ${className}`.trim()}>
            {error ? (
                <div className="personal-oauth-buttons__error" role="alert">
                    {error}
                </div>
            ) : null}

            <div className="personal-oauth-buttons__stack">
                {providers.includes('google') ? (
                    <button
                        type="button"
                        onClick={signInWithGoogle}
                        disabled={isDisabled}
                        className="btn-auth-social btn-google personal-oauth-buttons__btn"
                        style={{ ...BTN_BASE, opacity: isDisabled ? 0.65 : 1 }}
                    >
                        <FcGoogle size={22} aria-hidden />
                        {t('social_invite_continue_google', {
                            defaultValue: 'Continue with Google',
                        })}
                    </button>
                ) : null}

                {providers.includes('apple') ? (
                    <button
                        type="button"
                        onClick={signInWithApple}
                        disabled={isDisabled}
                        className="btn-auth-social btn-apple personal-oauth-buttons__btn personal-oauth-buttons__btn--apple"
                        style={{
                            ...BTN_BASE,
                            background: '#000000',
                            color: '#ffffff',
                            border: '1px solid #000000',
                            opacity: isDisabled ? 0.65 : 1,
                        }}
                    >
                        <FaApple size={22} aria-hidden />
                        {t('social_invite_continue_apple', {
                            defaultValue: 'Continue with Apple',
                        })}
                    </button>
                ) : null}

                {providers.includes('facebook') ? (
                    <button
                        type="button"
                        onClick={signInWithFacebook}
                        disabled={isDisabled}
                        className="btn-auth-social btn-facebook personal-oauth-buttons__btn"
                        style={{ ...BTN_BASE, opacity: isDisabled ? 0.65 : 1 }}
                    >
                        {t('continue_with_facebook', 'Continue with Facebook')}
                    </button>
                ) : null}
            </div>
        </div>
    );
}
