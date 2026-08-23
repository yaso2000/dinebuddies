import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import './ImageCropModal.css';

const OUTPUT_SIZE = 512;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function cropImageToFile(imageSrc, croppedAreaPixels) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE
  );
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}

/**
 * @param {{ imageSrc: string, cropShape?: 'round'|'rect', onCancel: () => void, onSave: (file: File) => void }} props
 */
export default function ImageCropModal({ imageSrc, cropShape = 'round', onCancel, onSave }) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleCropComplete = useCallback((_croppedArea, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels || saving) return;
    setSaving(true);
    try {
      const file = await cropImageToFile(imageSrc, croppedAreaPixels);
      onSave(file);
    } finally {
      setSaving(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="image-crop-modal"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onCancel?.();
      }}
    >
      <div className="image-crop-modal__panel">
        <div className="image-crop-modal__stage">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape={cropShape}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        <div className="image-crop-modal__controls">
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="image-crop-modal__zoom-slider"
            aria-label={t('image_crop_zoom', 'Zoom')}
          />
        </div>

        <div className="image-crop-modal__actions">
          <button
            type="button"
            className="image-crop-modal__btn image-crop-modal__btn--cancel"
            onClick={() => onCancel?.()}
            disabled={saving}
          >
            {t('cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className="image-crop-modal__btn image-crop-modal__btn--save"
            onClick={handleSave}
            disabled={saving || !croppedAreaPixels}
          >
            {saving ? t('saving', 'Saving…') : t('save', 'Save')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
