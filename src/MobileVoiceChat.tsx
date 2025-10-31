// src/MobileVoiceChat.tsx
import React, { useEffect, useRef, useState } from 'react';
import { authFetch } from './lib/tokenManager';
import './MobileApp.css';
import './MobileVoiceChat.css';
import micIcon from './assets/mic.png';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';

interface MobileVoiceChatProps {
    onClose: () => void;
    onMessage?: (text: string) => void;
    onSellIntent?: () => void; // Callback to open sell modal when sell intent detected
}

export default function MobileVoiceChat({ onClose, onMessage, onSellIntent }: MobileVoiceChatProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [sessionActive, setSessionActive] = useState(false);
    const [isResponding, setIsResponding] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [pendingAudio, setPendingAudio] = useState<string | null>(null); // For iOS playback fallback

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioUrlRef = useRef<string | null>(null);
    const sessionActiveRef = useRef<boolean>(false);
    const awaitingTTSRef = useRef<boolean>(false);
    const isRecordingRef = useRef<boolean>(false);

    // Initialize voice session
    useEffect(() => {
        startVoiceSession();

        return () => {
            stopRecording();
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (audioRef.current) {
                try {
                    audioRef.current.pause();
                    audioRef.current.src = '';
                    if (audioRef.current.parentNode) {
                        audioRef.current.parentNode.removeChild(audioRef.current);
                    }
                } catch { }
            }
            if (audioUrlRef.current) {
                try {
                    URL.revokeObjectURL(audioUrlRef.current);
                } catch { }
            }
            endVoiceSession();
        };
    }, []);

    async function startVoiceSession() {
        try {
            const res = await authFetch(`${API_BASE}/voice/start`, { method: 'POST' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to start voice session');
            }
            const data = await res.json();
            setSessionActive(true);
            sessionActiveRef.current = true;
            setError(null);

            // Request microphone access (don't start recording yet - wait for press)
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;
                // Don't start recording automatically - wait for user to press and hold
            } catch (err: any) {
                setError(err.message || 'Failed to access microphone');
                console.error('Microphone access error:', err);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to start voice session');
            console.error('Start voice session error:', err);
        }
    }

    // Press to talk: Start recording when user presses/holds button
    function startRecording() {
        if (!streamRef.current || isRecordingRef.current || isProcessing) {
            return;
        }

        try {
            const stream = streamRef.current;
            const options = [
                { mimeType: 'audio/webm;codecs=opus', bitrate: 128000 },
                { mimeType: 'audio/webm;codecs=opus' },
                { mimeType: 'audio/webm' },
                { mimeType: 'audio/mp4' }
            ];

            let mediaRecorder: MediaRecorder | null = null;
            for (const opt of options) {
                if (MediaRecorder.isTypeSupported(opt.mimeType)) {
                    try {
                        const config: any = { mimeType: opt.mimeType };
                        if (opt.bitrate) {
                            config.audioBitsPerSecond = opt.bitrate;
                        }
                        mediaRecorder = new MediaRecorder(stream, config);
                        console.log('Using audio format:', opt.mimeType);
                        break;
                    } catch (e) {
                        console.warn('Failed to create MediaRecorder with:', opt.mimeType, e);
                    }
                }
            }

            if (!mediaRecorder) {
                mediaRecorder = new MediaRecorder(stream);
            }

            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            const recordingStartTime = Date.now();

            mediaRecorder.onstop = async () => {
                const recordingDuration = Date.now() - recordingStartTime;
                const minRecordingDuration = 500; // Minimum 500ms (0.5 seconds) - Whisper needs at least 0.1s

                if (audioChunksRef.current.length === 0) {
                    console.log('No audio chunks recorded');
                    isRecordingRef.current = false;
                    setIsRecording(false);
                    setError('No audio recorded. Please hold the button and speak.');
                    setTimeout(() => setError(null), 3000);
                    return;
                }

                const blobType = mediaRecorder?.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunksRef.current, { type: blobType });

                console.log('Recording stopped:', {
                    duration: recordingDuration + 'ms',
                    blobSize: audioBlob.size,
                    chunkCount: audioChunksRef.current.length
                });

                // Validate minimum recording duration (Whisper requires at least 0.1s, we require 0.5s for safety)
                if (recordingDuration < minRecordingDuration) {
                    console.warn('Recording too short:', recordingDuration + 'ms', 'required:', minRecordingDuration + 'ms');
                    setError(`Recording too short (${recordingDuration}ms). Please hold the button for at least 0.5 seconds.`);
                    isRecordingRef.current = false;
                    setIsRecording(false);
                    audioChunksRef.current = [];
                    setTimeout(() => setError(null), 4000);
                    return;
                }

                // Validate minimum audio size (roughly 0.2 seconds of audio at 128kbps)
                const minAudioSize = 2000; // Minimum ~2KB to ensure enough audio data
                if (audioBlob.size < minAudioSize) {
                    console.warn('Audio blob too small:', audioBlob.size + ' bytes', 'required:', minAudioSize + ' bytes');
                    setError('Recording too short. Please speak for at least half a second.');
                    isRecordingRef.current = false;
                    setIsRecording(false);
                    audioChunksRef.current = [];
                    setTimeout(() => setError(null), 4000);
                    return;
                }

                isRecordingRef.current = false;
                setIsRecording(false);
                await processAudio(audioBlob);
            };

            mediaRecorder.onerror = (event: any) => {
                console.error('MediaRecorder error:', event.error);
                setError('Recording error occurred');
                isRecordingRef.current = false;
                setIsRecording(false);
            };

            // Start recording (no timeout - user releases button to stop)
            mediaRecorder.start();
            isRecordingRef.current = true;
            setIsRecording(true);
            setTranscript('');
            setError(null);
        } catch (err: any) {
            console.error('Start recording error:', err);
            setError(err.message || 'Failed to start recording');
            isRecordingRef.current = false;
            setIsRecording(false);
        }
    }

    // Release button: Stop recording and process
    function stopRecording() {
        if (mediaRecorderRef.current && isRecordingRef.current) {
            try {
                if (mediaRecorderRef.current.state === 'recording') {
                    mediaRecorderRef.current.stop();
                }
            } catch (err) {
                console.error('Stop recording error:', err);
            }
        }
        // Don't reset state here - let onstop handler do it
    }

    async function processAudio(audioBlob: Blob) {
        if (!sessionActiveRef.current || audioBlob.size === 0) {
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            // Convert blob to base64
            const reader = new FileReader();
            const audioBase64 = await new Promise<string>((resolve, reject) => {
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(audioBlob);
            });

            // Send to backend for Whisper transcription
            const transcribeRes = await authFetch(`${API_BASE}/voice/transcribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    audioBase64,
                    audioMimeType: audioBlob.type || 'audio/webm'
                }),
            });

            if (!transcribeRes.ok) {
                const errorData = await transcribeRes.json().catch(() => ({}));
                const errorMessage = errorData.message || errorData.error || 'Transcription failed';

                // Handle session expiration - auto-restart session
                if (transcribeRes.status === 410 || errorMessage.includes('expired') || errorMessage.includes('not found')) {
                    console.log('Voice session expired, restarting...');
                    await startVoiceSession();
                    // Retry transcription after session restart
                    const retryRes = await authFetch(`${API_BASE}/voice/transcribe`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            audioBase64,
                            audioMimeType: audioBlob.type || 'audio/webm'
                        }),
                    });

                    if (!retryRes.ok) {
                        const retryErrorData = await retryRes.json().catch(() => ({}));
                        throw new Error(retryErrorData.message || 'Transcription failed after session restart');
                    }

                    // Use the retry response instead
                    const transcribeData = await retryRes.json();
                    const transcribedText = transcribeData.transcript?.trim();

                    if (!transcribedText || transcribedText.length === 0) {
                        setError('No speech detected. Please hold the button longer (at least 0.5s) and speak clearly.');
                        setIsProcessing(false);
                        setTimeout(() => setError(null), 4000);
                        return;
                    }

                    setTranscript(transcribedText);
                    await handleVoiceMessage(transcribedText);
                    return;
                }

                // Handle specific error cases
                if (errorMessage.includes('too short') || errorMessage.includes('Audio file is too short')) {
                    throw new Error('Recording too short. Please hold the button longer (at least 0.5 seconds).');
                }

                throw new Error(errorMessage);
            }

            const transcribeData = await transcribeRes.json();
            const transcribedText = transcribeData.transcript?.trim();

            if (!transcribedText || transcribedText.length === 0) {
                setError('No speech detected. Please speak clearly and try again.');
                setIsProcessing(false);
                return;
            }

            // Update transcript display
            setTranscript(transcribedText);

            // Send transcribed text to get AI response
            await handleVoiceMessage(transcribedText);
        } catch (err: any) {
            console.error('Process audio error:', err);
            setError(err.message || 'Failed to process audio');
            setIsProcessing(false);
        }
    }

    async function endVoiceSession() {
        if (!sessionActiveRef.current) return;
        try {
            stopRecording();
            await authFetch(`${API_BASE}/voice/end`, { method: 'POST' });
            setSessionActive(false);
            sessionActiveRef.current = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        } catch (err) {
            console.error('End voice session error:', err);
        }
    }

    async function handleVoiceMessage(text: string) {
        if (!sessionActiveRef.current || !text.trim()) return;

        try {
            // Mark awaiting TTS/response
            setIsResponding(true);
            awaitingTTSRef.current = true;

            const res = await authFetch(`${API_BASE}/voice/respond`, {
                method: 'POST',
                body: JSON.stringify({ message: text }),
            });

            if (!res.ok) {
                // Handle session expiration for /respond endpoint
                if (res.status === 410) {
                    console.log('Voice session expired during response, restarting...');
                    await startVoiceSession();
                    // Retry the request
                    const retryRes = await authFetch(`${API_BASE}/voice/respond`, {
                        method: 'POST',
                        body: JSON.stringify({ message: text }),
                    });

                    if (!retryRes.ok) {
                        throw new Error('Voice response failed after session restart');
                    }

                    // Use the retry response
                    const data = await retryRes.json();

                    console.log('Voice response received (retry):', {
                        hasAudio: !!data.audioBase64,
                        audioLength: data.audioBase64 ? data.audioBase64.length : 0,
                        success: data.success,
                        intent: data.intent
                    });

                    // Check if sell intent was detected - open sell modal
                    if (data.intent === 'sell' && onSellIntent) {
                        console.log('Sell intent detected in voice chat (retry), opening sell modal');
                        setTimeout(() => {
                            onSellIntent();
                        }, 500);
                    }

                    if (data.audioBase64 && typeof data.audioBase64 === 'string' && data.audioBase64.length > 0) {
                        // Try to play immediately after session restart
                        try {
                            await playAudio(data.audioBase64);
                        } catch (audioErr) {
                            // If playback fails, show play button for iOS
                            setPendingAudio(data.audioBase64);
                        }
                    } else {
                        awaitingTTSRef.current = false;
                        setIsResponding(false);
                        setIsProcessing(false);
                    }
                    return;
                }

                throw new Error('Voice response failed');
            }

            const data = await res.json();

            console.log('Voice response received:', {
                hasAudio: !!data.audioBase64,
                audioLength: data.audioBase64 ? data.audioBase64.length : 0,
                success: data.success,
                intent: data.intent
            });

            // Check if sell intent was detected - open sell modal
            if (data.intent === 'sell' && onSellIntent) {
                console.log('Sell intent detected in voice chat, opening sell modal');
                // Small delay to ensure audio starts playing, then open modal
                setTimeout(() => {
                    onSellIntent();
                }, 500);
            }

            // Play TTS audio if provided
            if (data.audioBase64 && typeof data.audioBase64 === 'string' && data.audioBase64.length > 0) {
                console.log('Attempting to play audio, length:', data.audioBase64.length);

                try {
                    // Try to play audio (preparation is handled inside playAudio for mobile compatibility)
                    await playAudio(data.audioBase64);
                } catch (audioErr: any) {
                    // If playback fails (especially on iOS), show a play button
                    console.warn('Audio playback failed, showing play button:', audioErr);
                    setPendingAudio(data.audioBase64);
                    awaitingTTSRef.current = false;
                    setIsResponding(false);
                    setIsProcessing(false);
                }
            } else {
                console.warn('No audio received in response');
                awaitingTTSRef.current = false;
                setIsResponding(false);
                setIsProcessing(false);
            }
        } catch (err) {
            console.error('Voice message error:', err);
            setError('Failed to process voice message');
            awaitingTTSRef.current = false;
            setIsResponding(false);
            setIsProcessing(false);
            // Ready for next press-to-talk - don't auto-restart
        }
    }


    async function playAudio(base64: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                console.log('playAudio called, base64 length:', base64.length);

                // Stop any existing playback first
                if (audioRef.current) {
                    try {
                        audioRef.current.pause();
                        audioRef.current.src = '';
                        audioRef.current.onended = null;
                        audioRef.current.onerror = null;
                        audioRef.current.load(); // Reset audio element
                        // Remove from DOM if it was added
                        if (audioRef.current.parentNode) {
                            audioRef.current.parentNode.removeChild(audioRef.current);
                        }
                    } catch { }
                }
                // Revoke old object URL if any
                if (audioUrlRef.current) {
                    try {
                        URL.revokeObjectURL(audioUrlRef.current);
                    } catch { }
                    audioUrlRef.current = null;
                }

                // Convert base64 -> Blob -> Object URL (more reliable on iOS)
                const binary = atob(base64);
                const len = binary.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
                const blob = new Blob([bytes], { type: 'audio/mpeg' });
                const objectUrl = URL.createObjectURL(blob);
                audioUrlRef.current = objectUrl;

                console.log('Audio blob created, objectUrl:', objectUrl.substring(0, 50) + '...');

                // Create audio element with mobile-specific settings
                const audio = new Audio();
                audio.src = objectUrl;
                audio.preload = 'auto';
                audio.volume = 1;

                // Mobile/iOS specific attributes for inline playback
                audio.setAttribute('playsinline', 'true');
                audio.setAttribute('webkit-playsinline', 'true');
                audio.setAttribute('preload', 'auto');

                // Attach audio element to body immediately (required for mobile browsers)
                if (typeof document !== 'undefined') {
                    audio.style.position = 'absolute';
                    audio.style.left = '-9999px';
                    audio.style.top = '-9999px';
                    audio.style.width = '1px';
                    audio.style.height = '1px';
                    audio.style.opacity = '0';
                    audio.style.pointerEvents = 'none';
                    audio.style.zIndex = '-1';
                    document.body.appendChild(audio);
                    console.log('Audio element attached to DOM for mobile playback');
                }

                audioRef.current = audio;

                // Play audio and wait for it to finish
                const handleEnded = () => {
                    console.log('Audio playback ended');
                    awaitingTTSRef.current = false;
                    setIsResponding(false);
                    setIsProcessing(false);
                    resolve();
                    // Ready for next press-to-talk
                };

                const handleError: OnErrorEventHandler = (event: Event | string) => {
                    const evt = typeof event === 'string' ? new Event(event) : event;
                    console.error('Audio element error:', evt, audio.error);
                    awaitingTTSRef.current = false;
                    setIsResponding(false);
                    reject(new Error('Audio playback failed'));
                };

                audio.onended = handleEnded;
                audio.onerror = handleError;

                // Try to play immediately - ensure it works even when modal is open
                const tryPlay = async () => {
                    console.log('Attempting to play audio, readyState:', audio.readyState, 'paused:', audio.paused);

                    // Mobile/iOS workaround: Ensure audio is loaded and ready
                    if (audio.readyState < 2) {
                        console.log('Audio not ready, waiting for canplay...');
                        await new Promise<void>((resolve) => {
                            const onCanPlay = () => {
                                audio.removeEventListener('canplay', onCanPlay);
                                resolve();
                            };
                            audio.addEventListener('canplay', onCanPlay);
                            setTimeout(() => {
                                audio.removeEventListener('canplay', onCanPlay);
                                resolve();
                            }, 2000); // Max wait 2 seconds
                        });
                    }

                    try {
                        // Force play - mobile browsers require this within user gesture
                        const playPromise = audio.play();

                        if (playPromise !== undefined) {
                            await playPromise;
                            console.log('Audio play() successful - playing now');
                        } else {
                            console.log('Audio play() returned undefined, audio should be playing');
                        }
                    } catch (e: any) {
                        console.error('Audio play() failed:', e);

                        // Mobile-specific: If autoplay is blocked, show play button instead
                        if (e.name === 'NotAllowedError' || e.message?.includes('play')) {
                            console.log('Autoplay blocked on iOS/mobile - will show play button');
                            // Don't reject - we'll show a play button
                            // Store the audio for manual playback
                            setPendingAudio(base64);
                            awaitingTTSRef.current = false;
                            setIsResponding(false);
                            setIsProcessing(false);
                            resolve(); // Resolve so the promise doesn't hang
                            return;
                        } else {
                            handleError(e);
                        }
                    }
                };

                // Wait for audio to be ready - try multiple times
                const attemptPlayback = () => {
                    // Mobile: Try to play immediately if audio is already prepared
                    if (audio.readyState >= 3) {
                        console.log('Audio already fully loaded, playing immediately');
                        setTimeout(tryPlay, 50);
                    } else if (audio.readyState >= 2) {
                        console.log('Audio has enough data, playing');
                        setTimeout(tryPlay, 100);
                    } else {
                        // Wait for audio to load
                        const onCanPlayThrough = () => {
                            console.log('Audio can play through, readyState:', audio.readyState);
                            tryPlay();
                        };
                        audio.addEventListener('canplaythrough', onCanPlayThrough, { once: true });

                        const onCanPlay = () => {
                            console.log('Audio can play, readyState:', audio.readyState);
                            setTimeout(() => tryPlay(), 100);
                        };
                        audio.addEventListener('canplay', onCanPlay, { once: true });

                        const onLoadedData = () => {
                            console.log('Audio data loaded, readyState:', audio.readyState);
                            if (audio.readyState >= 2) {
                                setTimeout(() => tryPlay(), 150);
                            }
                        };
                        audio.addEventListener('loadeddata', onLoadedData, { once: true });

                        // Force load
                        try {
                            audio.load();
                            console.log('Called audio.load()');
                        } catch (e) {
                            console.error('audio.load() error:', e);
                            // If load fails, try playing anyway after a delay
                            setTimeout(() => tryPlay(), 500);
                        }
                    }
                };

                attemptPlayback();
            } catch (err) {
                console.error('playAudio exception:', err);
                awaitingTTSRef.current = false;
                setIsResponding(false);
                reject(err);
            }
        });
    }

    function handleClose() {
        endVoiceSession();
        onClose();
    }

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'transparent',
                zIndex: 2000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
            }}
            onClick={handleClose}
        >
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '400px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '24px',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={handleClose}
                    style={{
                        position: 'absolute',
                        top: '-48px',
                        right: 0,
                        background: 'transparent',
                        border: 'none',
                        color: '#fff',
                        fontSize: '24px',
                        cursor: 'pointer',
                        padding: '8px',
                        zIndex: 2100,
                    }}
                    aria-label="Close Voice Chat"
                >
                    ✕
                </button>

                {/* Mic icon with press-to-talk button */}
                <button
                    className={`mobile-voice-mic-container ${isRecording ? 'active' : ''}`}
                    style={{
                        width: '120px',
                        height: '120px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isRecording ? 'rgba(0, 115, 55, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: isRecording ? '3px solid var(--accent)' : '3px solid rgba(255, 255, 255, 0.2)',
                        transition: 'all 0.3s ease',
                        boxShadow: isRecording ? '0 0 20px rgba(0, 115, 55, 0.4)' : 'none',
                        outline: 'none',
                        cursor: isProcessing || isResponding ? 'not-allowed' : 'pointer',
                    }}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        if (!isProcessing && !isResponding && !isRecording) {
                            startRecording();
                        }
                    }}
                    onMouseUp={(e) => {
                        e.preventDefault();
                        if (isRecording) {
                            stopRecording();
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (isRecording) {
                            stopRecording();
                        }
                    }}
                    onTouchStart={(e) => {
                        e.preventDefault();
                        if (!isProcessing && !isResponding && !isRecording) {
                            startRecording();
                        }
                    }}
                    onTouchEnd={(e) => {
                        e.preventDefault();
                        if (isRecording) {
                            stopRecording();
                        }
                    }}
                    disabled={isProcessing || isResponding}
                >
                    <img
                        src={micIcon}
                        alt="Microphone"
                        style={{
                            width: '64px',
                            height: '64px',
                            opacity: isRecording ? 1 : 0.6,
                        }}
                    />
                </button>

                {/* Transcript display */}
                {transcript && (
                    <div
                        style={{
                            background: 'rgba(0, 0, 0, 0.6)',
                            padding: '16px',
                            borderRadius: '12px',
                            color: '#fff',
                            fontSize: '16px',
                            textAlign: 'center',
                            minHeight: '60px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            maxWidth: '100%',
                            wordBreak: 'break-word',
                        }}
                    >
                        {transcript}
                    </div>
                )}

                {/* Play button for iOS when autoplay is blocked */}
                {pendingAudio && (
                    <button
                        onClick={async () => {
                            try {
                                setPendingAudio(null);
                                setIsResponding(true);
                                await playAudio(pendingAudio);
                            } catch (err) {
                                console.error('Manual audio play failed:', err);
                                setError('Failed to play audio. Please try again.');
                            }
                        }}
                        style={{
                            background: 'var(--accent)',
                            border: '2px solid var(--accent)',
                            borderRadius: '50%',
                            width: '80px',
                            height: '80px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            padding: 0,
                            boxShadow: '0 0 20px rgba(0, 115, 55, 0.4)',
                            transition: 'all 0.3s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.1)';
                            e.currentTarget.style.boxShadow = '0 0 30px rgba(0, 115, 55, 0.6)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 115, 55, 0.4)';
                        }}
                        aria-label="Play audio response"
                    >
                        <svg
                            width="32"
                            height="32"
                            viewBox="0 0 24 24"
                            fill="white"
                            stroke="white"
                            strokeWidth="2"
                        >
                            <polygon points="8,5 19,12 8,19" />
                        </svg>
                    </button>
                )}

                {/* Status */}
                <div
                    style={{
                        color: '#fff',
                        fontSize: '14px',
                        opacity: 0.8,
                        textAlign: 'center',
                    }}
                >
                    {error ? (
                        <span style={{ color: '#ff6b6b' }}>⚠️ {error}</span>
                    ) : pendingAudio ? (
                        'Tap play button to hear response'
                    ) : isResponding ? (
                        'Playing response...'
                    ) : isProcessing ? (
                        'Processing...'
                    ) : isRecording ? (
                        'Recording... Hold longer, then release to send'
                    ) : sessionActive ? (
                        'Press and hold to speak (hold for at least 0.5s)'
                    ) : (
                        'Starting...'
                    )}
                </div>

                {/* Error message */}
                {error && (
                    <div
                        style={{
                            background: 'rgba(255, 107, 107, 0.2)',
                            border: '1px solid #ff6b6b',
                            padding: '12px',
                            borderRadius: '8px',
                            color: '#ff6b6b',
                            fontSize: '14px',
                            textAlign: 'center',
                            maxWidth: '100%',
                        }}
                    >
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}
