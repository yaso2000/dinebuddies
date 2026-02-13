import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaCamera, FaFont, FaPalette, FaTimes, FaPhotoVideo, FaSmile, FaVideo, FaCircle, FaStopCircle, FaFileUpload } from 'react-icons/fa';


import { uploadImage } from '../utils/imageUpload';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import './CreateStory.css';

const GRADIENTS = [
    { id: 'black', bg: '#000000', label: 'Black' },
    { id: 'white', bg: '#ffffff', label: 'White' },
    { id: 'classic', bg: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', label: 'Classic' },
    { id: 'purple', bg: 'linear-gradient(to bottom right, #8B5CF6, #3B82F6)', label: 'Galaxy' },
    { id: 'ocean', bg: 'linear-gradient(to bottom right, #00c6ff, #0072ff)', label: 'Ocean' },
    { id: 'sunset', bg: 'linear-gradient(to top right, #ff0844, #ffb199)', label: 'Sunset' },
    { id: 'neon', bg: 'linear-gradient(to right, #00f260, #0575e6)', label: 'Neon' },
    { id: 'gold', bg: 'linear-gradient(to right, #bf953f, #fcf6ba, #b38728, #fbf5b7, #aa771c)', label: 'Gold' }
];

const FONTS = [
    { id: 'modern', family: "'Outfit', sans-serif", label: 'Modern' },
    { id: 'typewriter', family: "'Courier New', monospace", label: 'Typewriter' },
    { id: 'hand', family: "'Comic Sans MS', cursive", label: 'Playful' },
    { id: 'bold', family: "Impact, sans-serif", label: 'Strong' },
];

const TEXT_COLORS = [
    '#ffffff', '#000000', '#ff0000', '#ffff00', '#00ff00', '#0000ff', '#800080'
];

const MOOD_EMOJIS = [
    '😄', '🥰', '🤤', '😋', '🥳', '🎂', '☕', '🍕', '🍔', '🥂', '🔥', '✨'
];

const CreateStory = () => {
    const navigate = useNavigate();
    const { currentUser, userProfile, loading: authLoading } = useAuth();

    // State
    const [backgroundType, setBackgroundType] = useState('GRADIENT'); // 'GRADIENT' | 'IMAGE' | 'VIDEO'

    // Auth Loading Check
    if (authLoading) {
        return (<div className="loading-spinner" />);
    }

    const [mediaFile, setMediaFile] = useState(null);
    const [mediaPreview, setMediaPreview] = useState(null);

    // Text Overlay State
    const [text, setText] = useState('');
    const [isTextMode, setIsTextMode] = useState(true);
    const [bgIndex, setBgIndex] = useState(0);
    const [fontIndex, setFontIndex] = useState(0);
    const [textColor, setTextColor] = useState('#ffffff');
    const [textColorIndex, setTextColorIndex] = useState(0);
    const [showMoodPicker, setShowMoodPicker] = useState(false);
    const [loading, setLoading] = useState(false);

    // Camera Stats
    const [showCamera, setShowCamera] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    const fileInputRef = useRef(null);
    const videoUploadRef = useRef(null);

    // Initial setup
    useEffect(() => {
        // Start in gradient mode
    }, []);

    // Cleanup stream on unmount
    useEffect(() => {
        return () => {
            stopCameraStream();
        };
    }, []);

    // Attach stream when camera UI opens
    useEffect(() => {
        if (showCamera && streamRef.current && videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.play().catch(e => console.log("Play error:", e));
        }
    }, [showCamera]);

    // Access Control
    useEffect(() => {
        if (!authLoading && userProfile) {
            const type = userProfile.accountType;
            if (type !== 'business' && type !== 'individual') {
                let msg = "Stories are available for Business and Personal accounts only.";
                if (type === 'guest') msg = "Guests cannot post stories. Please sign up.";
                alert(msg);
                navigate('/');
            }
        }
    }, [authLoading, userProfile, navigate]);

    const stopCameraStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const startCamera = async () => {
        try {
            // Request vertical aspect ratio if possible (mobile-like)
            const constraints = {
                audio: true,
                video: {
                    facingMode: 'user', // Default to selfie for stories
                    width: { ideal: 720 },
                    height: { ideal: 1280 },
                    aspectRatio: { ideal: 0.5625 } // 9:16
                }
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            setShowCamera(true);
        } catch (err) {
            console.error("Camera Error:", err);
            // Fallback to basic constraints if vertical/HD fails
            try {
                const basicStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                streamRef.current = basicStream;
                setShowCamera(true);
            } catch (fallbackErr) {
                alert("Could not access camera. Please allow permissions or use upload.");
            }
        }
    };

    const startRecording = () => {
        if (!streamRef.current) return;

        chunksRef.current = [];
        const recorder = new MediaRecorder(streamRef.current);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            const file = new File([blob], "story-video.webm", { type: 'video/webm' });

            // Success
            setBackgroundType('VIDEO');
            setMediaFile(file);
            setMediaPreview(URL.createObjectURL(file));

            setShowCamera(false);
            stopCameraStream();
        };

        recorder.start();
        setIsRecording(true);
        setRecordingTime(0);

        timerRef.current = setInterval(() => {
            setRecordingTime(prev => {
                if (prev >= 15) { // 15s Limit for Story
                    stopRecording();
                    return 15;
                }
                return prev + 1;
            });
        }, 1000);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
    };


    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type.startsWith('video/')) {
            const videoEl = document.createElement('video');
            videoEl.preload = 'metadata';
            videoEl.onloadedmetadata = function () {
                window.URL.revokeObjectURL(videoEl.src);
                if (videoEl.duration > 16) { // Allow 16s buffer
                    alert("Video is too long (Max 15s). Please choose a shorter video.");
                    e.target.value = "";
                    return;
                }
                setBackgroundType('VIDEO');
                setMediaFile(file);
                setMediaPreview(URL.createObjectURL(file));
            };
            videoEl.onerror = () => { alert("Failed to load video."); e.target.value = ""; };
            videoEl.src = URL.createObjectURL(file);
        } else {
            setBackgroundType('IMAGE');
            setMediaFile(file);
            setMediaPreview(URL.createObjectURL(file));
        }
    };

    const cycleTextColor = () => {
        const nextIndex = (textColorIndex + 1) % TEXT_COLORS.length;
        setTextColorIndex(nextIndex);
        setTextColor(TEXT_COLORS[nextIndex]);
    };

    const cycleBackground = () => {
        if (backgroundType !== 'GRADIENT') {
            setBackgroundType('GRADIENT');
            setMediaFile(null);
            setMediaPreview(null);
        } else {
            setBgIndex((prev) => (prev + 1) % GRADIENTS.length);
        }
    };

    const cycleFont = () => {
        setFontIndex((prev) => (prev + 1) % FONTS.length);
    };

    const handleShare = async () => {
        if (loading) return;
        if (backgroundType === 'GRADIENT' && !text.trim()) return;
        if ((backgroundType === 'IMAGE' || backgroundType === 'VIDEO') && !mediaFile) return;

        setLoading(true);
        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userDocSnap = await import('firebase/firestore').then(({ getDoc }) => getDoc(userDocRef));
            const freshUserData = userDocSnap.exists() ? userDocSnap.data() : {};

            const finalUserNameFresh = freshUserData.businessInfo?.businessName || freshUserData.name || freshUserData.displayName || currentUser.displayName || 'User';
            const finalUserPhotoFresh = freshUserData.businessInfo?.logoImage || freshUserData.businessInfo?.logo || freshUserData.avatar || freshUserData.photoURL || freshUserData.profilePicture || currentUser.photoURL;

            let mediaUrl = null;
            let finalType = 'text';

            if (mediaFile) {
                const sanitizedName = mediaFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                const path = `stories/${currentUser.uid}/${Date.now()}_${sanitizedName}`;
                mediaUrl = await uploadImage(mediaFile, path);
                finalType = backgroundType === 'VIDEO' ? 'video' : 'image';
            } else {
                finalType = 'text';
            }

            const storyData = {
                userId: String(currentUser.uid),
                userPhoto: finalUserPhotoFresh,
                userName: finalUserNameFresh,
                type: finalType,
                url: mediaUrl,
                text: text.trim(),
                fontFamily: FONTS[fontIndex].family,
                textColor: textColor,
                backgroundColor: backgroundType === 'GRADIENT' ? GRADIENTS[bgIndex].bg : null,
                createdAt: serverTimestamp(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            };

            await addDoc(collection(db, 'stories'), storyData);
            navigate('/');
        } catch (error) {
            console.error("Error creating story:", error);
            alert("Failed to share story: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-story-container">
            <div className="story-header">
                <button onClick={() => { stopCameraStream(); navigate(-1); }} className="icon-btn"><FaTimes /></button>
                <div className="story-title">{backgroundType === 'GRADIENT' ? 'Create' : 'Edit'} Story</div>
                <button onClick={handleShare} className="share-btn" disabled={loading || (backgroundType === 'GRADIENT' && !text.trim())}>
                    {loading ? 'Posting...' : 'Share'}
                </button>
            </div>

            {/* Canvas */}
            <div
                className="story-canvas"
                style={{
                    backgroundColor: backgroundType === 'GRADIENT' && !GRADIENTS[bgIndex].bg.includes('gradient') ? GRADIENTS[bgIndex].bg : '#000',
                    backgroundImage: backgroundType === 'GRADIENT' && GRADIENTS[bgIndex].bg.includes('gradient')
                        ? GRADIENTS[bgIndex].bg
                        : (backgroundType === 'IMAGE' && mediaPreview ? `url(${mediaPreview})` : 'none'),
                    backgroundSize: backgroundType === 'IMAGE' ? 'contain' : 'cover',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    fontFamily: FONTS[fontIndex].family
                }}
            >
                {backgroundType === 'VIDEO' && mediaPreview && (
                    <video src={mediaPreview} autoPlay loop muted playsInline className="story-video-preview" />
                )}

                {isTextMode && (
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={backgroundType === 'GRADIENT' ? "Tap to type..." : "Add a caption..."}
                        className={`story-textarea ${backgroundType !== 'GRADIENT' ? 'text-overlay' : ''}`}
                        style={{ fontFamily: FONTS[fontIndex].family, color: textColor }}
                        maxLength={200}
                    />
                )}
                {isTextMode && (
                    <style>
                        {` .story-textarea::placeholder { color: ${textColor} !important; opacity: 0.7; }
                           .story-textarea::-webkit-input-placeholder { color: ${textColor} !important; opacity: 0.7; } `}
                    </style>
                )}
            </div>

            {/* Sidebar Tools */}
            <div className="story-tools">
                <button className={`tool-btn ${isTextMode ? 'active' : ''}`} onClick={() => setIsTextMode(!isTextMode)} title="Text">
                    <FaFont />
                </button>

                {isTextMode && (
                    <>
                        <button className="tool-btn" onClick={cycleFont}> <span style={{ fontFamily: FONTS[(fontIndex + 1) % FONTS.length].family, fontSize: '1rem', fontWeight: 'bold' }}>Aa</span> </button>
                        <button className="tool-btn" onClick={cycleTextColor}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: textColor, border: '2px solid white' }}></div>
                        </button>
                    </>
                )}

                {isTextMode && (
                    <div style={{ position: 'relative' }}>
                        <button className={`tool-btn ${showMoodPicker ? 'active' : ''}`} onClick={() => setShowMoodPicker(!showMoodPicker)}>
                            <FaSmile />
                        </button>
                        {showMoodPicker && (
                            <div style={{
                                position: 'absolute', right: '60px', top: '-20px', background: 'rgba(0,0,0,0.85)',
                                backdropFilter: 'blur(10px)', borderRadius: '16px', padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', zIndex: 100
                            }}>
                                {MOOD_EMOJIS.map((emoji) => (
                                    <button
                                        key={emoji} onClick={() => { setText((prev) => prev + emoji); setShowMoodPicker(false); }}
                                        style={{ background: 'transparent', border: 'none', fontSize: '1.8rem', cursor: 'pointer' }}
                                    > {emoji} </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div style={{ height: '20px' }}></div>

                {backgroundType === 'GRADIENT' && (
                    <button className="tool-btn" onClick={cycleBackground} title="Background">
                        <FaPalette />
                    </button>
                )}

                <button className={`tool-btn ${backgroundType !== 'GRADIENT' ? 'active' : ''}`} onClick={() => fileInputRef.current?.click()} title="Upload">
                    <FaPhotoVideo />
                </button>

                <button className={`tool-btn`} onClick={startCamera} title="Camera">
                    <FaVideo />
                </button>

                {backgroundType !== 'GRADIENT' && (
                    <button
                        className="tool-btn"
                        onClick={() => {
                            setMediaFile(null); setMediaPreview(null); setBackgroundType('GRADIENT');
                        }}
                        style={{ background: 'rgba(239, 68, 68, 0.6)', marginTop: '10px' }}
                    >
                        <FaTimes />
                    </button>
                )}
            </div>

            {/* CAMERA OVERLAY */}
            {showCamera && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 10000,
                    background: 'black', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{ position: 'relative', width: '100%', height: '100%', maxWidth: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

                        <div style={{
                            position: 'absolute', bottom: '150px', left: 0, right: 0,
                            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '30px'
                        }}>
                            <button
                                onClick={() => { setShowCamera(false); stopCameraStream(); videoUploadRef.current.click(); }}
                                style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', padding: '12px', border: 'none', color: 'white' }}
                                title="Upload instead"
                            >
                                <FaFileUpload size={24} />
                            </button>

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

                            <button
                                onClick={() => { setShowCamera(false); stopCameraStream(); }}
                                style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', padding: '12px', border: 'none', color: 'white' }}
                            >
                                <FaTimes size={24} />
                            </button>
                        </div>

                        {isRecording && (
                            <div style={{
                                position: 'absolute', top: '20px',
                                background: 'red', color: 'white', padding: '4px 12px', borderRadius: '12px', fontWeight: 'bold'
                            }}>
                                00:{recordingTime < 10 ? `0${recordingTime}` : recordingTime} / 00:15
                            </div>
                        )}
                    </div>
                </div>
            )}

            <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileSelect} />
            <input type="file" ref={videoUploadRef} className="hidden" accept="video/*" onChange={handleFileSelect} />
        </div>
    );
};
export default CreateStory;
