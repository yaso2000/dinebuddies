import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppText } from './base';

/**
 * Short disclosure shown wherever the app generates or edits an image with AI:
 * the content is AI-made, and impersonating real people is prohibited. Required
 * for app-store compliance around AI/deepfake content.
 */
export default function AiContentNotice({ style }) {
    const { t } = useTranslation();
    return (
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', justifyContent: 'center', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 8, ...style }}>
            <span aria-hidden>🤖</span>
            <AppText as="span">
                {t('ai_content_notice', 'Images are AI-generated. Impersonating real people is prohibited and may lead to a ban.')}
            </AppText>
        </div>
    );
}
