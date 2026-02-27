import React, { useState, useRef, useEffect } from 'react';
import { FaVideo, FaStop, FaRedo, FaCheck, FaTimes, FaPlay, FaPause } from 'react-icons/fa';
import './VideoRecorder.css';

/**
 * A robust, simplified video recorder component.
 * Focuses on stability and standard HTML5 MediaRecorder API usage.
 */
const VideoRecorder = ({ maxDuration = 30, onRecordingComplete, onCancel }) => {
    // State
    const [status, setStatus] = useState('idle'); // idle, recording, review
    const [recordingTime, setRecordingTime] = useState(0);
    const [error, setError] = useState(null);
    const [videoBlob, setVideoBlob] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);

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

    // Initialize Camera
    const startCamera = async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                audio: true
            });

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

    // Initial camera start on mount
    useEffect(() => {
        startCamera();
    }, []);

    // Format time helper
    const formatTime = (s) => {
        const min = Math.floor(s / 60);
        const sec = s % 60;
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <div className="video-recorder-wrapper">
            {error && <div className="error-banner">{error}</div>}

            <div className="video-viewport">
                <video
                    ref={videoPreviewRef}
                    autoPlay
                    muted
                    playsInline
                    className="live-feed"
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
                        <button className="btn-record" onClick={handleStartRecording}>
                            <div className="record-icon-inner"></div>
                        </button>
                        <button className="btn-cancel" onClick={onCancel}>
                            Cancel
                        </button>
                    </>
                )}

                {status === 'recording' && (
                    <button className="btn-stop" onClick={handleStopRecording}>
                        <div className="stop-icon-inner"></div>
                    </button>
                )}
            </div>
        </div>
    );
};

export default VideoRecorder;
