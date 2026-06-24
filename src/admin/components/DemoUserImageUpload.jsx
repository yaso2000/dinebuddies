import React, { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { uploadDemoUserAdminImage } from '../utils/demoUserImageUpload';
import { AppText } from '../../components/base';

/**
 * Local file upload for admin demo user photos (avatar, cover, gallery).
 */
export default function DemoUserImageUpload({
  label,
  value = '',
  kind = 'avatar',
  onChange,
  disabled = false,
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const inputId = useId();
  const inputRef = useRef(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const previewStyle =
    kind === 'cover'
      ? { width: '100%', maxWidth: 320, aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 8 }
      : kind === 'gallery'
        ? { width: 96, height: 170, objectFit: 'cover', borderRadius: 8 }
        : { width: 96, height: 96, objectFit: 'cover', borderRadius: '50%' };

  const handleFile = async (file) => {
    if (!file || disabled || uploading) return;
    if (!currentUser?.uid) {
      showToast(t('admin_demo_user_sign_in_upload', 'Sign in as admin to upload images.'), 'error');
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const url = await uploadDemoUserAdminImage(file, currentUser.uid, kind, setProgress);
      onChange?.(url);
      showToast(t('admin_demo_user_image_uploaded', 'Image uploaded.'), 'success');
    } catch (err) {
      console.error('Demo user image upload failed:', err);
      showToast(err?.message || t('failed_upload_image', 'Upload failed.'), 'error');
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      {label ? (
        <label className="db-label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        {value ? (
          <img src={value} alt="" style={previewStyle} />
        ) : (
          <div
            style={{
              ...previewStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-muted, rgba(255,255,255,0.06))',
              border: '1px dashed var(--db-border, var(--border-color))',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              textAlign: 'center',
              padding: '0.35rem',
            }}
          >
            {t('admin_demo_user_no_image', 'No image')}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            disabled={disabled || uploading}
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            className="db-btn"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading
              ? t('admin_demo_user_uploading', { pct: progress, defaultValue: `Uploading ${progress}%…` })
              : value
                ? t('admin_demo_user_replace_image', 'Replace image')
                : t('admin_demo_user_upload_image', 'Upload from device')}
          </button>
          {value ? (
            <button
              type="button"
              className="db-btn db-btn--danger"
              disabled={disabled || uploading}
              onClick={() => onChange?.('')}
            >
              {t('remove', 'Remove')}
            </button>
          ) : null}
        </div>
      </div>

      {!value ? (
        <AppText as="p" className="db-muted" style={{ fontSize: '0.78rem', margin: 0 }}>
          {t(
            'admin_demo_user_upload_hint',
            'JPG, PNG, or WebP — max 8MB. Leave empty to use the gender media pool on publish.'
          )}
        </AppText>
      ) : null}
    </div>
  );
}
