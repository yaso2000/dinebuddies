import React, { useState, useRef, useEffect } from 'react';
import { FaVideo, FaStop, FaRedo, FaCheck, FaTimes, FaPlay, FaPause } from 'react-icons/fa';
import './VideoRecorder.css';

/**
 * A robust, simplified video recorder component.
 * Focuses on stability and standard HTML5 MediaRecorder API usage.
 */
const VideoRecorder = ({ maxDuration = 30, onRecordingComplete, onCancel, mode = 'video' }) => {
    // State
    const [status, setStatus] = useState('idle'); // idle, recording, review
    const [recordingTime, setRecordingTime] = useState(0);
    const [error, setError] = useState(null);
    const [videoBlob, setVideoBlob] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);

    // Camera Config
    const [facingMode, setFacingMode] = useState('user'); // 'user' | 'environment'
    const [orientation, setOrientation] = useState('portrait'); // 'portrait' | 'landscape'

    // Refs
    const streamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const videoPreviewRef = useRef(null);
    const timerRef = useRef(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopStream();
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // Restart Camera when config changes
    useEffect(() => {
        stopStream();
        startCamera();
    }, [facingMode]);

    // Initialize Camera
    const startCamera = async () => {
        try {
            setError(null);

            // Constraints based on orientation and facing mode
            const constraints = {
                video: {
                    facingMode: facingMode,
                    width: { ideal: orientation === 'landscape' ? 1280 : 720 },
                    height: { ideal: orientation === 'landscape' ? 720 : 1280 }
                },
                audio: true
            };

            console.log('📷 Starting camera with constraints:', constraints);
            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            streamRef.current = stream;

            if (videoPreviewRef.current) {
                videoPreviewRef.current.srcObject = stream;
            }
            setStatus('idle');
        } catch (err) {
            console.error("Camera access error:", err);
            setError("Cannot access camera. Please allow permissions.");
        }
    };

    const toggleCamera = () => {
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };

    const toggleOrientation = () => {
        setOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait');
    };

    // Capture Photo Logic
    const takePhoto = () => {
        if (!videoPreviewRef.current) return;

        const video = videoPreviewRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        // Mirror if front camera
        if (facingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
            if (onRecordingComplete) {
                onRecordingComplete(file);
            }
            // Optional: Don't stop stream immediately if we want to confirm, but for now simplify
            stopStream();
        }, 'image/jpeg', 0.9);
    };

    // Stop Camera Stream
    const stopStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    // Start Recording
    const handleStartRecording = () => {
        if (!streamRef.current) return;

        chunksRef.current = [];
        try {
            // Priority: MP4 -> WebM (VP9) -> WebM (Standard)
            let mimeType = 'video/webm';
            if (MediaRecorder.isTypeSupported('video/mp4')) {
                mimeType = 'video/mp4';
            } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                mimeType = 'video/webm;codecs=vp9';
            }

            console.log(`🎥 Starting recording with mimeType: ${mimeType}`);
            const recorder = new MediaRecorder(streamRef.current, { mimeType });

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeType });
                console.log(`⏹️ Recording stopped. Blob size: ${blob.size} bytes`);

                // Immediately confirm and pass data up
                const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
                const file = new File([blob], `video_${Date.now()}.${ext}`, { type: blob.type });

                if (onRecordingComplete) {
                    onRecordingComplete(file);
                }

                stopStream(); // Stop camera when recording is complete
            };

            recorder.start(1000); // 1s chunks
            mediaRecorderRef.current = recorder;
            setStatus('recording');

            // Timer logic
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => {
                    if (prev >= maxDuration) {
                        handleStopRecording();
                        return prev;
                    }
                    return prev + 1;
                });
            }, 1000);

        } catch (err) {
            setError("Failed to start recording.");
            console.error(err);
        }
    };

    // Stop Recording
    const handleStopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    // Format time helper
    const formatTime = (s) => {
        const min = Math.floor(s / 60);
        const sec = s % 60;
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <div className="video-recorder-wrapper">
            {error && <div className="error-banner">{error}</div>}

            <div className="video-viewport" style={{
                aspectRatio: orientation === 'landscape' ? '16/9' : '9/16',
                maxHeight: orientation === 'landscape' ? '400px' : '600px',
                transition: 'all 0.3s ease'
            }}>
                <video
                    ref={videoPreviewRef}
                    autoPlay
                    muted
                    playsInline
                    className="live-feed"
                    style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                />

                {status === 'recording' && (
                    <div className="recording-badge">
                        <div className="pulsing-dot"></div>
                        <span>{formatTime(recordingTime)} / {formatTime(maxDuration)}</span>
                    </div>
                )}
            </div>

            <div className="controls-bar">
                {status === 'idle' && (
                    <>
                        <div className="camera-toggles" style={{ display: 'flex', gap: '15px', marginRight: '20px' }}>
                            <button
                                type="button"
                                className="toggle-btn"
                                onClick={toggleCamera}
                                title="Flip Camera"
                                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                                <FaRedo />
                            </button>
                            <button
                                type="button"
                                className="toggle-btn"
                                onClick={toggleOrientation}
                                title={orientation === 'portrait' ? 'Switch to Landscape' : 'Switch to Portrait'}
                                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                                {orientation === 'portrait' ? '📱' : '💻'}
                            </button>
                        </div>

                        {mode === 'photo' ? (
                            <button type="button" className="btn-record" onClick={takePhoto} style={{ border: '4px solid white', background: 'white' }}>
                                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'white' }}></div>
                            </button>
                        ) : (
                            <button type="button" className="btn-record" onClick={handleStartRecording}>
                                <div className="record-icon-inner"></div>
                            </button>
                        )}

                        <button type="button" className="btn-cancel" onClick={onCancel}>
                            <FaTimes />
                        </button>
                    </>
                )}

                {status === 'recording' && (
                    <button type="button" className="btn-stop" onClick={handleStopRecording}>
                        <div className="stop-icon-inner"></div>
                    </button>
                )}
            </div>
        </div>
    );
};

export default VideoRecorder;
