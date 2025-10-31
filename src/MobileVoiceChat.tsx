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
}

export default function MobileVoiceChat({ onClose, onMessage }: MobileVoiceChatProps) {
    const [isListening, setIsListening] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [sessionActive, setSessionActive] = useState(false);
    const [isResponding, setIsResponding] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioUrlRef = useRef<string | null>(null);
    const sessionActiveRef = useRef<boolean>(false);
    const awaitingTTSRef = useRef<boolean>(false);
    const silenceTimeoutRef = useRef<number | null>(null);
    const isRecordingRef = useRef<boolean>(false);

    // Initialize audio recording
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
                    // Remove from DOM if it was added
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

            // Request microphone access and start recording
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;
                startRecording(stream);
            } catch (err: any) {
                setError(err.message || 'Failed to access microphone');
                console.error('Microphone access error:', err);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to start voice session');
            console.error('Start voice session error:', err);
        }
    }

    function startRecording(stream: MediaStream) {
        try {
            // Try to use the best available audio format for better transcription accuracy
            // Prefer formats that Whisper handles well (webm/opus is excellent for quality)
            const options = [
                { mimeType: 'audio/webm;codecs=opus', bitrate: 128000 }, // High quality for better transcription
                { mimeType: 'audio/webm;codecs=opus' },
                { mimeType: 'audio/webm' },
                { mimeType: 'audio/mp4' },
                { mimeType: 'audio/ogg;codecs=opus' }
            ];

            let mediaRecorder: MediaRecorder | null = null;
            for (const opt of options) {
                if (MediaRecorder.isTypeSupported(opt.mimeType)) {
                    try {
                        // Try with bitrate if specified, fallback to default
                        const config: any = { mimeType: opt.mimeType };
                        if (opt.bitrate) {
                            config.audioBitsPerSecond = opt.bitrate;
                        }
                        mediaRecorder = new MediaRecorder(stream, config);
                        console.log('Using audio format:', opt.mimeType, opt.bitrate ? `at ${opt.bitrate}bps` : '');
                        break;
                    } catch (e) {
                        console.warn('Failed to create MediaRecorder with:', opt.mimeType, e);
                    }
                }
            }

            if (!mediaRecorder) {
                mediaRecorder = new MediaRecorder(stream); // Fallback to default
                console.log('Using default MediaRecorder');
            }

            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                if (audioChunksRef.current.length === 0) return;

                const blobType = mediaRecorder?.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
                await processAudio(audioBlob);

                // Resume recording after processing
                if (sessionActiveRef.current && streamRef.current && !isRecordingRef.current) {
                    setTimeout(() => {
                        if (sessionActiveRef.current && streamRef.current) {
                            startRecording(streamRef.current);
                        }
                    }, 500);
                }
            };

            mediaRecorder.onerror = (event: any) => {
                console.error('MediaRecorder error:', event.error);
                setError('Recording error occurred');
            };

            // Use smaller chunks for faster processing (500ms)
            mediaRecorder.start(500);
            isRecordingRef.current = true;
            setIsListening(true);
            setIsActive(true);

            // Clear any existing silence timeout
            if (silenceTimeoutRef.current) {
                clearTimeout(silenceTimeoutRef.current);
            }

            // Set timeout to stop and process after 4 seconds of recording (slightly longer for better context)
            silenceTimeoutRef.current = window.setTimeout(() => {
                stopAndProcess();
            }, 4000);
        } catch (err: any) {
            console.error('Start recording error:', err);
            setError(err.message || 'Failed to start recording');
        }
    }

    function stopRecording() {
        if (mediaRecorderRef.current && isRecordingRef.current) {
            try {
                if (mediaRecorderRef.current.state !== 'inactive') {
                    mediaRecorderRef.current.stop();
                }
                isRecordingRef.current = false;
                setIsListening(false);
                setIsActive(false);
            } catch (err) {
                console.error('Stop recording error:', err);
            }
        }
        if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
        }
    }

    async function stopAndProcess() {
        stopRecording();
        if (audioChunksRef.current.length > 0) {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            audioChunksRef.current = [];
            await processAudio(audioBlob);
        }
    }

    async function processAudio(audioBlob: Blob) {
        if (!sessionActiveRef.current || audioBlob.size === 0) {
            // Restart recording if session is active
            if (sessionActiveRef.current && streamRef.current) {
                setTimeout(() => {
                    if (sessionActiveRef.current && streamRef.current) {
                        startRecording(streamRef.current);
                    }
                }, 500);
            }
            return;
        }

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

            // Send to backend for Whisper transcription with audio format info
            const transcribeRes = await authFetch(`${API_BASE}/voice/transcribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    audioBase64,
                    audioMimeType: audioBlob.type || 'audio/webm' // Include MIME type for better format detection
                }),
            });

            if (!transcribeRes.ok) {
                throw new Error('Transcription failed');
            }

            const transcribeData = await transcribeRes.json();
            const transcribedText = transcribeData.transcript?.trim();

            if (!transcribedText || transcribedText.length === 0) {
                // No speech detected, restart recording
                if (sessionActiveRef.current && streamRef.current) {
                    setTimeout(() => {
                        if (sessionActiveRef.current && streamRef.current) {
                            startRecording(streamRef.current);
                        }
                    }, 500);
                }
                return;
            }

            // Update transcript display
            setTranscript(transcribedText);

            // Send transcribed text to get AI response
            await handleVoiceMessage(transcribedText);
        } catch (err) {
            console.error('Process audio error:', err);
            // Restart recording on error
            if (sessionActiveRef.current && streamRef.current) {
                setTimeout(() => {
                    if (sessionActiveRef.current && streamRef.current) {
                        startRecording(streamRef.current);
                    }
                }, 500);
            }
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
                throw new Error('Voice response failed');
            }

            const data = await res.json();

            console.log('Voice response received:', {
                hasAudio: !!data.audioBase64,
                audioLength: data.audioBase64 ? data.audioBase64.length : 0,
                success: data.success
            });

            // Play TTS audio if provided
            if (data.audioBase64 && typeof data.audioBase64 === 'string' && data.audioBase64.length > 0) {
                console.log('Attempting to play audio, length:', data.audioBase64.length);
                await playAudio(data.audioBase64);
            } else {
                console.warn('No audio received in response');
                awaitingTTSRef.current = false;
                setIsResponding(false);
                // Restart recording
                if (sessionActiveRef.current && streamRef.current) {
                    setTimeout(() => {
                        if (sessionActiveRef.current && streamRef.current) {
                            startRecording(streamRef.current);
                        }
                    }, 500);
                }
            }
        } catch (err) {
            console.error('Voice message error:', err);
            setError('Failed to process voice message');
            awaitingTTSRef.current = false;
            setIsResponding(false);
            // Restart recording on error
            if (sessionActiveRef.current && streamRef.current) {
                setTimeout(() => {
                    if (sessionActiveRef.current && streamRef.current) {
                        startRecording(streamRef.current);
                    }
                }, 500);
            }
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

                const audio = new Audio();
                audio.src = objectUrl;
                audio.preload = 'auto';
                audio.volume = 1;
                // Ensure audio plays even when modal/page is in background
                audio.setAttribute('playsinline', 'true');
                audio.setAttribute('webkit-playsinline', 'true');
                // Attach audio element to body to ensure it's in the DOM and can play
                if (!audio.parentNode && typeof document !== 'undefined') {
                    audio.style.position = 'absolute';
                    audio.style.left = '-9999px';
                    audio.style.top = '-9999px';
                    audio.style.width = '1px';
                    audio.style.height = '1px';
                    audio.style.opacity = '0';
                    audio.style.pointerEvents = 'none';
                    document.body.appendChild(audio);
                }
                audioRef.current = audio;

                // Play audio and wait for it to finish
                const handleEnded = () => {
                    console.log('Audio playback ended');
                    awaitingTTSRef.current = false;
                    setIsResponding(false);
                    resolve();
                    // Restart recording after audio finishes
                    if (sessionActiveRef.current && streamRef.current) {
                        setTimeout(() => {
                            if (sessionActiveRef.current && streamRef.current && !isRecordingRef.current) {
                                startRecording(streamRef.current);
                            }
                        }, 300);
                    }
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
                    try {
                        // Force play even if browser thinks it's paused
                        const playPromise = audio.play();

                        if (playPromise !== undefined) {
                            await playPromise;
                            console.log('Audio play() successful - playing now');
                        } else {
                            console.log('Audio play() returned undefined, audio should be playing');
                        }
                    } catch (e: any) {
                        console.error('Audio play() failed:', e);
                        // If it's an autoplay policy error, try with user interaction simulation
                        if (e.name === 'NotAllowedError' || e.message?.includes('play')) {
                            console.log('Autoplay blocked, trying alternative method...');
                            // Try again after a short delay
                            setTimeout(async () => {
                                try {
                                    await audio.play();
                                    console.log('Audio play() retry successful');
                                } catch (retryErr) {
                                    console.error('Audio play() retry failed:', retryErr);
                                    // If still failing, try to focus the window/modal to get user gesture context
                                    if (typeof window !== 'undefined') {
                                        window.focus();
                                    }
                                    // One more retry
                                    setTimeout(async () => {
                                        try {
                                            await audio.play();
                                            console.log('Audio play() final retry successful');
                                        } catch (finalErr) {
                                            console.error('Audio play() final retry failed:', finalErr);
                                            handleError(new Event('error'));
                                        }
                                    }, 300);
                                }
                            }, 200);
                        } else {
                            handleError(e);
                        }
                    }
                };

                // Wait for audio to be ready - try multiple times
                const attemptPlayback = () => {
                    if (audio.readyState >= 2) {
                        setTimeout(tryPlay, 50);
                    } else {
                        const onCanPlay = () => {
                            console.log('Audio can play, readyState:', audio.readyState);
                            tryPlay();
                        };
                        audio.addEventListener('canplay', onCanPlay, { once: true });
                        audio.addEventListener('canplaythrough', () => {
                            console.log('Audio can play through');
                            if (audio.paused) {
                                tryPlay();
                            }
                        }, { once: true });
                        audio.addEventListener('loadeddata', () => {
                            console.log('Audio data loaded, readyState:', audio.readyState);
                            if (audio.readyState >= 2) {
                                tryPlay();
                            }
                        }, { once: true });
                        // Force load
                        try {
                            audio.load();
                            console.log('Called audio.load()');
                        } catch (e) {
                            console.error('audio.load() error:', e);
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

                {/* Mic icon with green border animation */}
                <div
                    className={`mobile-voice-mic-container ${isActive ? 'active' : ''}`}
                    style={{
                        width: '120px',
                        height: '120px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: isActive ? '3px solid var(--accent)' : '3px solid rgba(255, 255, 255, 0.2)',
                        transition: 'all 0.3s ease',
                        boxShadow: isActive ? '0 0 20px rgba(0, 115, 55, 0.4)' : 'none',
                        outline: isActive ? '2px solid var(--accent)' : 'none',
                        outlineOffset: isActive ? '4px' : '0',
                    }}
                >
                    <img
                        src={micIcon}
                        alt="Microphone"
                        style={{
                            width: '64px',
                            height: '64px',
                            opacity: isListening ? 1 : 0.6,
                        }}
                    />
                </div>

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
                    ) : isResponding ? (
                        'Processing…'
                    ) : isListening ? (
                        'Listening...'
                    ) : sessionActive ? (
                        'Say something...'
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
