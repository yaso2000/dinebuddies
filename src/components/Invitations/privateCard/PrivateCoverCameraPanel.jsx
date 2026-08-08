import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import UnifiedCamera from '../../UnifiedCamera';
import { useCameraOverlayHistoryTrap } from '../../../hooks/useCameraOverlayHistoryTrap';

const ACCENT = '#ec4899';

/**
 * Private invitation cover: camera opens when the user taps the Camera tab (parent bumps openNonce).
 * Parent should call getUserMedia in the click handler and pass the stream via preOpenedStreamRef (iOS).
 */
export default function PrivateCoverCameraPanel({
    onMediaSelect,
    openNonce = 0,
    preOpenedStreamRef = null
}) {
    const { t } = useTranslation();
    const [active, setActive] = useState(false);
    const handledNonceRef = useRef(0);

    const deactivate = useCallback(() => setActive(false), []);
    const closeCamera = useCameraOverlayHistoryTrap(active, deactivate);

    useEffect(() => {
        if (openNonce > handledNonceRef.current) {
            setActive(true);
            handledNonceRef.current = openNonce;
        }
    }, [openNonce]);

    const handleRecording = (file, previewUrl, _type, extras = {}) => {
        onMediaSelect({
            source: 'custom_video',
            file,
            preview: previewUrl,
            type: 'video',
            videoThumbnail: extras.thumbnailUrl || null
        });
        closeCamera();
    };

    if (active) {
        return (
            <UnifiedCamera
                mode="video"
                maxDuration={20}
                allowFilePicker={false}
                accentColor={ACCENT}
                compactCapture
                preOpenedStreamRef={preOpenedStreamRef}
                hintText={t('private_camera_short_hint')}
                previewRetakeLabel={t('private_camera_retake', { defaultValue: 'Re-record' })}
                previewVideoConfirmLabel={t('private_camera_insert', { defaultValue: 'Insert & close' })}
                onMediaCaptured={(file, url, type, extras) => handleRecording(file, url, type, extras)}
                stopCamera={closeCamera}
            />
        );
    }

    return null;
}
