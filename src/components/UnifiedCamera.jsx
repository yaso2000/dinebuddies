import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaSyncAlt, FaFileUpload, FaTrash, FaCheck } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useToast } from '../context/ToastContext';
import { captureVideoThumbnailFromUrl } from '../utils/captureVideoThumbnail';

/**
 * Unified Camera Component used across Posts, Stories, and Invitations.
 * Features:
 * - Video Recording (max 30s)
 * - Photo Capture (optional via prop)
 * - Front/Back Camera Swith
 * - File Upload Fallback
 * - Preview & Confirm
 */import { AppText } from "./base";
const UnifiedCamera = ({
  stopCamera, // Function to close camera UI
  onUnmount, // Function called when component unmounts (cleanup)
  onMediaCaptured, // Callback(file, previewUrl, type='video'|'image')
  allowPhoto = false, // If true, shows photo capture button
  maxDuration = 15, // Max recording duration in seconds
  mode = 'video', // 'video' or 'photo' or 'both' (default 'video') in UI
  /** Optional ref populated synchronously from a user-gesture click before mount (iOS). */
  preOpenedStreamRef = null,
  /** When false, hide gallery/file picker so capture is camera-only (e.g. invitation “Camera” tab). */
  allowFilePicker = true,
  /** Accent for timer / highlights (e.g. dating flow). */
  accentColor = null,
  /** Cap live/preview height so controls + timer fit on one screen (dating cover). */
  compactCapture = false,
  /** Aspect ratio for compact capture frame, e.g. `9/16` or `16/9`. */
  captureAspectRatio = '9/16',
  /** Optional title centered in compact capture header. */
  compactTitle = null,
  className = '',
  /** Single short line (live preview only). */
  hintText = null,
  /** After capture: override button labels (e.g. dating cover). */
  previewRetakeLabel = null,
  previewVideoConfirmLabel = null
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const uploadInputRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const previewMediaRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [facingMode, setFacingMode] = useState('user'); // 'user' (front) or 'environment' (back)
  const [captureMode, setCaptureMode] = useState(mode === 'photo' ? 'photo' : 'video');
  const [cameraError, setCameraError] = useState(null);
  const [previewMedia, setPreviewMedia] = useState(null); // { url, type, file, thumbnailUrl? }

  useEffect(() => {
    previewMediaRef.current = previewMedia;
  }, [previewMedia]);

  useEffect(() => {
    if (mode === 'both') return;
    setCaptureMode(mode === 'photo' ? 'photo' : 'video');
  }, [mode]);

  const activeCaptureMode = mode === 'both' ? captureMode : mode === 'photo' ? 'photo' : 'video';

  // Start camera on mount / when switching front-back
  useEffect(() => {
    startCameraStream();
    return () => {
      stopStream();
    };
  }, [facingMode]);

  const attachStream = async (stream) => {
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      try {
        await videoRef.current.play();
      } catch (e) {
        console.error('Autoplay prevent:', e);
      }
    }
  };

  const startCameraStream = async () => {
    stopStream();
    setCameraError(null);

    const preOpened = preOpenedStreamRef?.current;
    if (preOpened && facingMode === 'user') {
      preOpenedStreamRef.current = null;
      await attachStream(preOpened);
      return;
    }

    try {
      const constraints = {
        video: { facingMode },
        audio: mode !== 'photo',
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      await attachStream(stream);
    } catch (err) {
      console.error("Camera access error:", err);
      const denied =
      err?.name === 'NotAllowedError' ||
      err?.name === 'PermissionDeniedError' ||
      String(err?.message || '').toLowerCase().includes('permission');
      setCameraError(
        denied ?
        t('camera_error_permission', 'Camera access was blocked. Allow camera in browser settings, then try again.') :
        t('camera_error_generic', 'Could not open the camera. Check permissions and try again.')
      );
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const switchCamera = () => {
    setFacingMode((prev) => prev === 'user' ? 'environment' : 'user');
  };

  // --- Recording Logic ---
  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    try {
      // Check supported mime types
      let mimeType = 'video/webm';
      if (MediaRecorder.isTypeSupported('video/mp4')) mimeType = 'video/mp4';else
      if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) mimeType = 'video/webm;codecs=h264';

      const recorder = new MediaRecorder(streamRef.current, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        (async () => {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const finalFile = new File([blob], `cam_video_${Date.now()}.webm`, { type: mimeType });
          const previewUrl = URL.createObjectURL(blob);
          let thumbnailUrl = null;
          try {
            thumbnailUrl = await captureVideoThumbnailFromUrl(previewUrl);
          } catch (e) {
            console.warn('Video thumbnail:', e);
          }
          setPreviewMedia({
            file: finalFile,
            url: previewUrl,
            type: 'video',
            thumbnailUrl
          });
          setIsRecording(false);
        })();
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= maxDuration) {
            stopRecording();
            return maxDuration;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Recording error:", err);
      showToast("Failed to start recording.", 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
  };

  // --- Upload Logic ---
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check format
    const type = file.type.startsWith('image/') ? 'image' : 'video';
    // Validate duration for video if possible (async, tricky in FileReader)
    // For now, accept it.

    const previewUrl = URL.createObjectURL(file);
    setPreviewMedia({ file, url: previewUrl, type });
  };

  // --- Confirmation ---
  const confirmMedia = () => {
    if (previewMedia && onMediaCaptured) {
      onMediaCaptured(previewMedia.file, previewMedia.url, previewMedia.type, {
        thumbnailUrl: previewMedia.thumbnailUrl || null
      });
      stopCamera(); // Close UI
    }
  };

  const retake = () => {
    setPreviewMedia(null);
    previewMediaRef.current = null;
    setRecordingTime(0);
    if (!streamRef.current) {
      startCameraStream();
    }
  };

  // --- Photo Logic ---
  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `cam_photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(blob);
        setPreviewMedia({ file, url: previewUrl, type: 'image' });
      }
    }, 'image/jpeg', 0.95);
  };

  const rootShellStyle = compactCapture ?
  {
    position: 'fixed',
    inset: 0,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    maxWidth: '100%',
    height: '100dvh',
    maxHeight: '100dvh',
    zIndex: 450000,
    background: '#000',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    /* Safe area handled on the top bar + viewport padding so controls are not under status bar */
    paddingTop: 0,
    boxSizing: 'border-box'
  } :
  {
    position: 'fixed',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: '500px',
    height: '100dvh',
    zIndex: 200000,
    background: '#000',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  };

  const padRecSec = (s) => String(Math.max(0, Math.min(s, maxDuration))).padStart(2, '0');

  const topBarPaddingTop = compactCapture ?
  'calc(40px + env(safe-area-inset-top, 0px))' :
  'calc(14px + env(safe-area-inset-top, 0px))';
  const topBarPaddingX = compactCapture ? 16 : 20;
  const closeBtnSize = compactCapture ? 56 : 48;

  /** Capture frame — portrait default; landscape `16/9` for community banners. */
  const ratioToken = String(captureAspectRatio || '9/16').replace(/\s+/g, '');
  const isLandscapeFrame = ratioToken === '16/9';
  const captureFrameStyle = {
    position: 'relative',
    boxSizing: 'border-box',
    aspectRatio: ratioToken.includes('/') ? ratioToken.replace('/', ' / ') : '9 / 16',
    maxHeight: isLandscapeFrame ? 'none' : '100%',
    maxWidth: '100%',
    width: isLandscapeFrame ? 'min(100%, calc((100dvh - 260px) * 16 / 9))' : 'auto',
    height: isLandscapeFrame ? 'auto' : '100%',
    minWidth: 0,
    borderRadius: isLandscapeFrame ? 12 : 14,
    overflow: 'hidden',
    background: '#111',
    margin: '0 auto',
    flexShrink: 1,
    boxShadow: isLandscapeFrame ?
      '0 10px 36px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)' :
      undefined,
  };

  const showPhotoControlLabels = compactCapture && mode === 'photo' && !previewMedia && !cameraError;

  const sideControlWrap = (buttonEl, label) =>
    showPhotoControlLabels ?
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 56 }}>
        {buttonEl}
        <AppText as="span" style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'rgba(255,255,255,0.78)' }}>
          {label}
        </AppText>
      </div> :
      buttonEl;

  const closeButtonEl =
  <button
    type="button"
    onClick={stopCamera}
    aria-label={t('camera_close', 'Close camera')}
    style={{
      background: 'rgba(255,255,255,0.94)',
      color: '#111',
      border: '2px solid rgba(0,0,0,0.12)',
      width: closeBtnSize,
      height: closeBtnSize,
      minWidth: closeBtnSize,
      minHeight: closeBtnSize,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0,
      boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
      touchAction: 'manipulation',
      WebkitTapHighlightColor: 'transparent'
    }}>
    
            <FaTimes size={compactCapture ? 24 : 22} />
        </button>;


  const timerEl =
  isRecording ?
  <div
    style={{
      background: accentColor || '#dc2626',
      color: 'white',
      padding: '8px 14px',
      borderRadius: '999px',
      fontWeight: 800,
      fontSize: '0.95rem',
      letterSpacing: '0.02em',
      boxShadow: '0 4px 20px rgba(0,0,0,0.35)'
    }}>
    
                00:{padRecSec(recordingTime)} / {maxDuration}s
            </div> :
  null;

  const stageInner = previewMedia ?
  previewMedia.type === 'video' ?
  <video src={previewMedia.url} controls autoPlay style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> :

  <img src={previewMedia.url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> :

  cameraError ?
  <div style={{ color: 'white', textAlign: 'center', padding: '20px' }}>
            <AppText as="p">{cameraError}</AppText>
            {allowFilePicker ?
    <button type="button" onClick={() => uploadInputRef.current.click()} style={{ marginTop: '20px', padding: '10px 20px' }}>
                    Upload Instead
                </button> :

    <button type="button" onClick={stopCamera} style={{ marginTop: '20px', padding: '10px 20px' }}>
                    Close
                </button>
    }
        </div> :

  <video
    ref={videoRef}
    playsInline
    autoPlay
    muted
    style={{
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      transform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
    }} />;



  const bottomBarEl =
  <div
    style={
    compactCapture ?
    {
      flexShrink: 0,
      width: '100%',
      boxSizing: 'border-box',
      padding: '12px 16px',
      paddingBottom: 'max(20px, calc(10px + env(safe-area-inset-bottom, 0px)))',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)'
    } :
    {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '40px 20px',
      paddingBottom: `max(20px, env(safe-area-inset-bottom))`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
      zIndex: 30
    }
    }>
    
            {mode === 'both' && !previewMedia && !cameraError ?
    <div
      style={{
        display: 'flex',
        gap: 6,
        padding: 4,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.12)'
      }}>
      
                    {['photo', 'video'].map((option) =>
      <button
        key={option}
        type="button"
        onClick={() => setCaptureMode(option)}
        disabled={isRecording}
        style={{
          border: 'none',
          borderRadius: 999,
          padding: '8px 18px',
          fontSize: '0.82rem',
          fontWeight: 700,
          cursor: isRecording ? 'not-allowed' : 'pointer',
          opacity: isRecording ? 0.5 : 1,
          background: activeCaptureMode === option ? 'white' : 'transparent',
          color: activeCaptureMode === option ? '#111' : 'white'
        }}>
        
                            {option === 'photo' ?
        t('take_photo', { defaultValue: 'Photo' }) :
        t('record_video', { defaultValue: 'Video' })}
                        </button>
      )}
                </div> :
    null}
            <div
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        gap: 8
      }}>
      
            {previewMedia ?
      <>
                    <button
          type="button"
          onClick={retake}
          style={{
            color: 'white',
            background: 'transparent',
            border: '1px solid white',
            padding: '10px 22px',
            borderRadius: '25px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            touchAction: 'manipulation'
          }}>
          
                        <FaTrash /> {previewRetakeLabel || t('camera_retake', 'Retake')}
                    </button>
                    <button
          type="button"
          onClick={confirmMedia}
          style={{
            color: 'white',
            background: accentColor || '#2563eb',
            border: 'none',
            padding: '10px 22px',
            borderRadius: '25px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 'bold',
            touchAction: 'manipulation'
          }}>
          
                        <FaCheck />{' '}
                        {previewMedia.type === 'video' ?
          previewVideoConfirmLabel || t('camera_use_video', 'Use video') :
          t('camera_use_photo', 'Use photo')}
                    </button>
                </> :

      <>
                    {allowFilePicker ?
        sideControlWrap(
          <button
            type="button"
            onClick={() => uploadInputRef.current.click()}
            aria-label={t('gallery', 'Gallery')}
            style={{
              background: 'rgba(255,255,255,0.16)',
              width: 52,
              height: 52,
              padding: 0,
              borderRadius: '50%',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.22)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'manipulation',
            }}
          >
            <FaFileUpload size={20} />
          </button>,
          t('gallery', 'Gallery')
        ) :

        <div style={{ width: 52, flexShrink: 0 }} aria-hidden />
        }

                    <button
          type="button"
          onClick={activeCaptureMode === 'photo' ? capturePhoto : isRecording ? stopRecording : startRecording}
          aria-label={activeCaptureMode === 'photo' ? t('take_photo', 'Take photo') : t('record_video', 'Record')}
          style={{
            width: compactCapture ? 76 : 76,
            height: compactCapture ? 76 : 76,
            borderRadius: '50%',
            background: activeCaptureMode === 'photo' ? 'white' : isRecording ? 'transparent' : accentColor || 'red',
            border:
            activeCaptureMode === 'photo' ?
            `4px solid ${accentColor ? `${accentColor}99` : 'rgba(255,255,255,0.5)'}` :
            isRecording ?
            `4px solid ${accentColor || 'red'}` :
            `5px solid ${accentColor ? 'rgba(255,255,255,0.95)' : 'white'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow:
            activeCaptureMode === 'photo' ?
            (accentColor ?
              `0 0 0 6px ${accentColor}33, 0 8px 28px rgba(0,0,0,0.45)` :
              '0 0 0 4px rgba(255,255,255,0.2)') :
            accentColor ?
            `0 0 0 6px ${accentColor}40, 0 8px 28px rgba(0,0,0,0.45)` :
            '0 8px 28px rgba(0,0,0,0.35)',
            touchAction: 'manipulation'
          }}>
          
                        {isRecording &&
          <div
            style={{
              width: '28px',
              height: '28px',
              background: accentColor || 'red',
              borderRadius: '6px'
            }} />

          }
                    </button>

                    {sideControlWrap(
          <button
          type="button"
          onClick={switchCamera}
          disabled={isRecording}
          aria-label={t('camera_flip', 'Flip camera')}
          style={{
            background: 'rgba(255,255,255,0.16)',
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: isRecording ? 0.35 : 1,
            cursor: isRecording ? 'not-allowed' : 'pointer',
            touchAction: 'manipulation'
          }}>
          
                        <FaSyncAlt size={20} style={{ margin: 'auto' }} />
                    </button>,
          t('camera_flip', 'Flip')
        )}
                </>
      }
            </div>
        </div>;


  const shell =
  <div className={className || undefined} style={rootShellStyle}>
            {compactCapture ?
    <>
                    <header
        style={{
          flexShrink: 0,
          width: '100%',
          boxSizing: 'border-box',
          paddingTop: topBarPaddingTop,
          paddingBottom: 12,
          paddingLeft: topBarPaddingX,
          paddingRight: topBarPaddingX,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.2) 85%, transparent 100%)',
          zIndex: 5
        }}>
        
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', minWidth: 0 }}>{closeButtonEl}</div>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
                          {timerEl ||
                            (compactTitle ?
                              <AppText
                                as="span"
                                style={{
                                  color: '#fff',
                                  fontWeight: 700,
                                  fontSize: '0.9375rem',
                                  letterSpacing: '0.02em',
                                  textShadow: '0 1px 8px rgba(0,0,0,0.65)',
                                }}
                              >
                                {compactTitle}
                              </AppText> :
                              null)}
                        </div>
                        <div style={{ flex: 1, minWidth: closeBtnSize }} aria-hidden />
                    </header>

                    <div
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: isLandscapeFrame ?
            'radial-gradient(ellipse at 50% 30%, #1a2438 0%, #000 70%)' :
            '#000'
        }}>
        
                        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isLandscapeFrame ? '8px 14px 4px' : '4px 10px 2px',
            overflow: 'hidden'
          }}>
          
                            <div style={captureFrameStyle}>{stageInner}</div>
                        </div>
                        {hintText && !previewMedia && !cameraError ?
        <AppText as="p"
        style={{
          flexShrink: 0,
          margin: 0,
          padding: '4px 14px 6px',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.78)',
          fontSize: '0.74rem',
          fontWeight: 600,
          lineHeight: 1.35,
          textShadow: '0 1px 6px rgba(0,0,0,0.65)'
        }}>
          
                                {hintText}
                            </AppText> :
        null}
                    </div>

                    {bottomBarEl}
                </> :

    <>
                    <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: topBarPaddingTop,
          paddingBottom: 12,
          paddingLeft: topBarPaddingX,
          paddingRight: topBarPaddingX,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          zIndex: 100,
          pointerEvents: 'auto'
        }}>
        
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', minWidth: 0 }}>{closeButtonEl}</div>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>{timerEl}</div>
                        <div style={{ flex: 1, minWidth: closeBtnSize }} aria-hidden />
                    </div>

                    <div
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000',
          overflow: 'hidden'
        }}>
        
                        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
          
                            <div style={{ width: '100%', height: '100%', position: 'relative' }}>{stageInner}</div>
                        </div>
                    </div>

                    {hintText && !previewMedia && !cameraError ?
      <AppText as="p"
      style={{
        position: 'absolute',
        bottom: 118,
        left: 16,
        right: 16,
        margin: 0,
        textAlign: 'center',
        color: 'rgba(255,255,255,0.72)',
        fontSize: '0.8rem',
        fontWeight: 600,
        zIndex: 25,
        pointerEvents: 'none',
        textShadow: '0 1px 8px rgba(0,0,0,0.65)'
      }}>
        
                            {hintText}
                        </AppText> :
      null}

                    {bottomBarEl}
                </>
    }

            {allowFilePicker &&
    <input
      ref={uploadInputRef}
      type="file"
      accept={mode === 'photo' ? 'image/*' : mode === 'video' ? 'video/*' : 'image/*,video/*'}
      onChange={handleFileSelect}
      style={{ display: 'none' }} />

    }
        </div>;


  if (compactCapture && typeof document !== 'undefined') {
    return createPortal(shell, document.body);
  }
  return shell;
};

export default UnifiedCamera;