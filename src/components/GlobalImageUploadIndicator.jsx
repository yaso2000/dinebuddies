import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaImage } from 'react-icons/fa';
import { subscribeImageUploadProgress } from '../services/imageUploadProgressStore';
import './GlobalImageUploadIndicator.css';
import { AppText } from "./base";

const PHASE_KEYS = {
  preparing: 'image_upload_preparing',
  uploading: 'image_upload_uploading',
  checking: 'image_upload_checking',
  done: 'image_upload_finishing'
};

export default function GlobalImageUploadIndicator() {
  const { t } = useTranslation();
  const [upload, setUpload] = useState({ active: false, progress: 0, phase: 'preparing' });

  useEffect(() => subscribeImageUploadProgress(setUpload), []);

  if (!upload.active) return null;

  const labelKey = PHASE_KEYS[upload.phase] || PHASE_KEYS.uploading;
  const label = t(labelKey);

  return (
    <div
      className="global-image-upload"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-valuenow={upload.progress}
      aria-valuemin={0}
      aria-valuemax={100}>
      
            <div className="global-image-upload__backdrop" aria-hidden />
            <div className="global-image-upload__panel">
                <div className="global-image-upload__header">
                    <AppText as="span" className="global-image-upload__icon" aria-hidden>
                        <FaImage size={18} />
                    </AppText>
                    <div className="global-image-upload__text">
                        <AppText as="span" className="global-image-upload__label">{label}</AppText>
                        <AppText as="span" className="global-image-upload__hint">
                            {t('image_upload_please_wait', 'Please wait — do not close the app')}
                        </AppText>
                    </div>
                    <AppText as="span" className="global-image-upload__pct">{upload.progress}%</AppText>
                </div>
                <div className="global-image-upload__track">
                    <div
            className="global-image-upload__fill"
            style={{ width: `${upload.progress}%` }} />
          
                </div>
            </div>
        </div>);

}