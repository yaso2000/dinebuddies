import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { FaSearchMinus, FaSearchPlus } from 'react-icons/fa';
import './ImageCropModal.css';

const OUTPUT_SIZE = 512;

/**
 * The slider runs on an exponential scale so its rest position is the middle of
 * the track: -1 → half size, 0 → the photo as it lands in the frame, +1 → double.
 * A linear 0.5–2 range would park 1× a fifth of the way along instead.
 */
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const sliderToZoom = (value) => 2 ** Number(value);
const zoomToSlider = (zoom) => Math.log2(zoom);

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function cropImageToFile(imageSrc, croppedAreaPixels, { width, height, fileName }) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Zooming out puts frame area outside the photo. Paint the backdrop first so
  // those margins come out white rather than as black JPEG transparency.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Clip the source rect to the photo and place it proportionally, so an
  // out-of-bounds crop keeps its scale instead of stretching to fill.
  const scaleX = width / croppedAreaPixels.width;
  const scaleY = height / croppedAreaPixels.height;
  const sx = Math.max(0, croppedAreaPixels.x);
  const sy = Math.max(0, croppedAreaPixels.y);
  const sw = Math.min(image.width, croppedAreaPixels.x + croppedAreaPixels.width) - sx;
  const sh = Math.min(image.height, croppedAreaPixels.y + croppedAreaPixels.height) - sy;

  if (sw > 0 && sh > 0) {
    ctx.drawImage(
      image,
      sx,
      sy,
      sw,
      sh,
      (sx - croppedAreaPixels.x) * scaleX,
      (sy - croppedAreaPixels.y) * scaleY,
      sw * scaleX,
      sh * scaleY
    );
  }

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  return new File([blob], fileName, { type: 'image/jpeg' });
}

/**
 * @param {{
 *   imageSrc: string,
 *   cropShape?: 'round'|'rect',
 *   aspect?: number,
 *   outputWidth?: number,
 *   fileName?: string,
 *   onCancel: () => void,
 *   onSave: (file: File) => void,
 * }} props
 */
export default function ImageCropModal({
  imageSrc,
  cropShape = 'round',
  aspect = 1,
  outputWidth = OUTPUT_SIZE,
  fileName = 'avatar.jpg',
  onCancel,
  onSave,
}) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleCropComplete = useCallback((_croppedArea, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  /* Below 1× the whole photo already fits the frame, so there is nothing to pan
     to — and panning there could drag it clean out of frame and save a blank
     avatar. Recentre on the way down and ignore drags while zoomed out. */
  const applyZoom = (next) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    if (clamped < 1) setCrop({ x: 0, y: 0 });
    setZoom(clamped);
  };

  const handleCropChange = (next) => {
    if (zoom < 1) return;
    setCrop(next);
  };

  const nudgeZoom = (factor) => {
    applyZoom(zoom * factor);
  };

  const handleSave = async () => {
    if (!croppedAreaPixels || saving) return;
    setSaving(true);
    try {
      const file = await cropImageToFile(imageSrc, croppedAreaPixels, {
        width: outputWidth,
        height: Math.round(outputWidth / aspect),
        fileName,
      });
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
        <div className="image-crop-modal__stage" style={{ '--crop-stage-aspect': aspect }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={false}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            /* Must be off to zoom below 1 — otherwise the photo is pinned to
               cover the frame and can never be made smaller than it. Kept on
               from 1× up so a zoomed-in photo still can't leave the frame. */
            restrictPosition={zoom >= 1}
            onCropChange={handleCropChange}
            onZoomChange={applyZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        <div className="image-crop-modal__controls">
          <button
            type="button"
            className="image-crop-modal__zoom-btn"
            onClick={() => nudgeZoom(1 / 1.15)}
            aria-label={t('image_crop_zoom_out', 'Zoom out')}
          >
            <FaSearchMinus aria-hidden />
          </button>
          <div className="image-crop-modal__zoom-track">
            <input
              type="range"
              min={zoomToSlider(MIN_ZOOM)}
              max={zoomToSlider(MAX_ZOOM)}
              step={0.01}
              value={zoomToSlider(zoom)}
              onChange={(event) => applyZoom(sliderToZoom(event.target.value))}
              onDoubleClick={() => applyZoom(1)}
              className="image-crop-modal__zoom-slider"
              aria-label={t('image_crop_zoom', 'Zoom')}
            />
            <span className="image-crop-modal__zoom-detent" aria-hidden />
          </div>
          <button
            type="button"
            className="image-crop-modal__zoom-btn"
            onClick={() => nudgeZoom(1.15)}
            aria-label={t('image_crop_zoom_in', 'Zoom in')}
          >
            <FaSearchPlus aria-hidden />
          </button>
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
