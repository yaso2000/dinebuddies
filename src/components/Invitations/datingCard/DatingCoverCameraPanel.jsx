import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import UnifiedCamera from '../../UnifiedCamera';

const ACCENT = '#ec4899';

/**
 * Dating cover: camera opens only when the user taps the Camera tab (parent bumps openNonce)
 * or the explicit “Open camera” control — not on first page load.
 */
export default function DatingCoverCameraPanel({ onMediaSelect, openNonce = 0 }) {
    const { t } = useTranslation();
    const [active, setActive] = useState(false);

    useEffect(() => {
        if (openNonce > 0) setActive(true);
    }, [openNonce]);

    const handleRecording = (file, previewUrl, _type, extras = {}) => {
        onMediaSelect({
            source: 'custom_video',
            file,
            preview: previewUrl,
            type: 'video',
            videoThumbnail: extras.thumbnailUrl || null
        });
        setActive(false);
    };

    if (active) {
        return (
            <UnifiedCamera
                mode="video"
                maxDuration={20}
                allowFilePicker={false}
                accentColor={ACCENT}
                compactCapture
                hintText={t('dating_camera_short_hint')}
                previewRetakeLabel={t('dating_camera_retake', { defaultValue: 'Re-record' })}
                previewVideoConfirmLabel={t('dating_camera_insert', { defaultValue: 'Insert & close' })}
                onMediaCaptured={(file, url, type, extras) => handleRecording(file, url, type, extras)}
                stopCamera={() => setActive(false)}
            />
        );
    }

    /* Idle: no in-page chrome — user opens recorder via Camera tab (parent bumps openNonce). */
    return null;
}
