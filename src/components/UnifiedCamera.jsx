
import React, { useState, useRef, useEffect } from 'react';
import { FaTimes, FaCircle, FaSyncAlt, FaFileUpload, FaPlay, FaPause, FaTrash, FaCheck } from 'react-icons/fa';

/**
 * Unified Camera Component used across Posts, Stories, and Invitations.
 * Features:
 * - Video Recording (max 30s)
 * - Photo Capture (optional via prop)
 * - Front/Back Camera Swith
 * - File Upload Fallback
 * - Preview & Confirm
 */
const UnifiedCamera = ({
    stopCamera,            // Function to close camera UI
    onUnmount,             // Function called when component unmounts (cleanup)
    onMediaCaptured,       // Callback(file, previewUrl, type='video'|'image')
    allowPhoto = false,    // If true, shows photo capture button
    maxDuration = 30,      // Max recording duration in seconds
    mode = 'video',        // 'video' or 'photo' or 'both' (default 'video') in UI
}) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const uploadInputRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [facingMode, setFacingMode] = useState('user'); // 'user' (front) or 'environment' (back)
    const [cameraError, setCameraError] = useState(null);
    const [previewMedia, setPreviewMedia] = useState(null); // { url, type, file }

    // Start Camera on Mount
    useEffect(() => {
        startCameraStream();
        return () => {
            stopStream();
        };
    }, [facingMode]);

    const startCameraStream = async () => {
        stopStream(); // Stop any existing stream
        setCameraError(null);
        try {
            const constraints = {
                video: {
                    facingMode: facingMode, // 'user' or 'environment'
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                    // aspectRatio: { ideal: 9/16 } // Try to prefer vertical for mobile feel?
                },
                audio: true
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.muted = true; // Mute preview to avoid feedback
                try {
                    await videoRef.current.play();
                } catch (e) {
                    console.error("Autoplay prevent:", e);
                }
            }
        } catch (err) {
            console.error("Camera access error:", err);
            setCameraError("Could not access camera. Please check permissions.");
        }
    };

    const stopStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const switchCamera = () => {
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };

    // --- Recording Logic ---
    const startRecording = () => {
        if (!streamRef.current) return;
        chunksRef.current = [];
        try {
            // Check supported mime types
            let mimeType = 'video/webm';
            if (MediaRecorder.isTypeSupported('video/mp4')) mimeType = 'video/mp4';
            else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) mimeType = 'video/webm;codecs=h264';

            const recorder = new MediaRecorder(streamRef.current, { mimeType });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeType });
                const finalFile = new File([blob], `cam_video_${Date.now()}.webm`, { type: mimeType });
                const previewUrl = URL.createObjectURL(blob);
                setPreviewMedia({ file: finalFile, url: previewUrl, type: 'video' });
                setIsRecording(false);
            };

            recorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => {
                    if (prev >= maxDuration) {
                        stopRecording();
                        return maxDuration;
                    }
                    return prev + 1;
                });
            }, 1000);
        } catch (err) {
            console.error("Recording error:", err);
            alert("Failed to start recording.");
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
            onMediaCaptured(previewMedia.file, previewMedia.url, previewMedia.type);
            stopCamera(); // Close UI
        }
    };

    const retake = () => {
        setPreviewMedia(null);
        setRecordingTime(0);
        // Start stream again if needed
        if (!streamRef.current) startCameraStream();
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: '#000', display: 'flex', flexDirection: 'column'
        }}>
            {/* Top Bar */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, padding: '20px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 20
            }}>
                <button onClick={stopCamera} style={{ background: 'rgba(0,0,0,0.3)', border: 'none', color: 'white', padding: '10px', borderRadius: '50%', cursor: 'pointer' }}>
                    <FaTimes size={20} />
                </button>
                {/* Timer (only when recording) */}
                {isRecording && (
                    <div style={{ background: 'red', color: 'white', padding: '5px 12px', borderRadius: '15px', fontWeight: 'bold' }}>
                        00:{recordingTime < 10 ? `0${recordingTime}` : recordingTime} / {maxDuration}s
                    </div>
                )}
                {/* Space for right button (maybe flash later) */}
                <div style={{ width: '40px' }} />
            </div>

            {/* Viewport */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                {previewMedia ? (
                    // Preview captured media
                    previewMedia.type === 'video' ? (
                        <video src={previewMedia.url} controls autoPlay style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                        <img src={previewMedia.url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    )
                ) : (
                    // Live Camera Feed
                    <>
                        {cameraError ? (
                            <div style={{ color: 'white', textAlign: 'center', padding: '20px' }}>
                                <p>{cameraError}</p>
                                <button onClick={() => uploadInputRef.current.click()} style={{ marginTop: '20px', padding: '10px 20px' }}>Upload Instead</button>
                            </div>
                        ) : (
                            <video
                                ref={videoRef}
                                playsInline
                                autoPlay
                                muted
                                style={{
                                    width: '100%', height: '100%', objectFit: 'cover',
                                    transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' // Mirror front cam
                                }}
                            />
                        )}
                    </>
                )}
            </div>

            {/* Bottom Controls */}
            <div style={{
                padding: '30px 20px', paddingBottom: '80px',
                display: 'flex', justifyContent: 'space-around', alignItems: 'center',
                background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)'
            }}>
                {previewMedia ? (
                    // Confirmation Controls
                    <>
                        <button onClick={retake} style={{ color: 'white', background: 'transparent', border: '1px solid white', padding: '10px 30px', borderRadius: '25px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FaTrash /> Retake
                        </button>
                        <button onClick={confirmMedia} style={{ color: 'white', background: '#2563eb', border: 'none', padding: '10px 30px', borderRadius: '25px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                            <FaCheck /> {previewMedia.type === 'video' ? 'Use Video' : 'Use Photo'}
                        </button>
                    </>
                ) : (
                    // Camera Controls
                    <>
                        {/* 1. Upload Button */}
                        <button onClick={() => uploadInputRef.current.click()} style={{ background: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '50%', color: 'white', border: 'none' }}>
                            <FaFileUpload size={20} />
                        </button>

                        {/* 2. Shutter / Record Button */}
                        <button
                            onClick={isRecording ? stopRecording : startRecording}
                            style={{
                                width: '72px', height: '72px', borderRadius: '50%',
                                background: isRecording ? 'transparent' : 'red',
                                border: isRecording ? '4px solid red' : '4px solid white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            {isRecording && <div style={{ width: '32px', height: '32px', background: 'red', borderRadius: '4px' }} />}
                        </button>

                        {/* 3. Switch Camera Button */}
                        <button onClick={switchCamera} style={{ background: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '50%', color: 'white', border: 'none' }}>
                            <FaSyncAlt size={20} />
                        </button>
                    </>
                )}
            </div>

            {/* Hidden Input for Upload */}
            <input
                ref={uploadInputRef}
                type="file"
                accept={mode === 'photo' ? "image/*" : (mode === 'video' ? "video/*" : "image/*,video/*")}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />
        </div>
    );
};

export default UnifiedCamera;
