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
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioUrlRef = useRef<string | null>(null);
    const lastTranscriptRef = useRef<string>('');
    const sessionActiveRef = useRef<boolean>(false);
    const awaitingTTSRef = useRef<boolean>(false);
    const silenceTimeoutRef = useRef<number | null>(null);
    const pendingTranscriptRef = useRef<string>('');

    // Initialize speech recognition
    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setError('Speech recognition not supported in this browser');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        // Clear any existing silence timeout
        function clearSilenceTimeout() {
            if (silenceTimeoutRef.current !== null) {
                clearTimeout(silenceTimeoutRef.current);
                silenceTimeoutRef.current = null;
            }
        }

        // Process pending transcript after silence
        function processAfterSilence() {
            if (pendingTranscriptRef.current.trim()) {
                const text = pendingTranscriptRef.current.trim();
                pendingTranscriptRef.current = '';
                clearSilenceTimeout();
                try {
                    if (recognitionRef.current) {
                        try { recognitionRef.current.stop(); } catch { }
                    }
                    setIsListening(false);
                    setIsActive(false);
                } finally {
                    handleVoiceMessage(text);
                }
            }
        }

        recognition.onstart = () => {
            setIsListening(true);
            setIsActive(true);
            clearSilenceTimeout();
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }

            const fullTranscript = (finalTranscript + interimTranscript).trim();
            if (fullTranscript) {
                setTranscript(fullTranscript);
                lastTranscriptRef.current = fullTranscript;

                // Update pending transcript
                pendingTranscriptRef.current = fullTranscript;

                // Clear existing silence timeout
                clearSilenceTimeout();

                // If we have a final transcript, process immediately
                if (finalTranscript.trim()) {
                    processAfterSilence();
                } else if (interimTranscript.trim()) {
                    // If we have interim results, wait for silence (1 second of no new results)
                    silenceTimeoutRef.current = window.setTimeout(() => {
                        processAfterSilence();
                    }, 1000);
                }
            }
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech') {
                setIsActive(false);
            } else if (event.error !== 'aborted') {
                setError(`Speech recognition error: ${event.error}`);
                setIsListening(false);
            }
        };

        recognition.onend = () => {
            clearSilenceTimeout();

            // Process any pending transcript before restarting
            if (pendingTranscriptRef.current.trim()) {
                const text = pendingTranscriptRef.current.trim();
                pendingTranscriptRef.current = '';
                setIsListening(false);
                setIsActive(false);

                // Process the transcript - restart will happen after TTS finishes
                handleVoiceMessage(text);
                return;
            }

            // Only restart if there's no pending transcript and we are not awaiting TTS
            setIsListening(false);
            setIsActive(false);

            // Restart if session is still active, not awaiting TTS, and no transcript was processed
            if (sessionActiveRef.current && !awaitingTTSRef.current && !error) {
                setTimeout(() => {
                    if (sessionActiveRef.current && recognitionRef.current && !pendingTranscriptRef.current.trim() && !awaitingTTSRef.current) {
                        try {
                            recognitionRef.current.start();
                        } catch (e) {
                            console.error('Failed to restart recognition:', e);
                        }
                    }
                }, 400);
            }
        };

        recognitionRef.current = recognition;

        // Start session
        startVoiceSession();

        return () => {
            clearSilenceTimeout();
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {
                    // Ignore
                }
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

            // Start recognition after session is set
            setTimeout(() => {
                if (recognitionRef.current) {
                    try {
                        recognitionRef.current.start();
                    } catch (e) {
                        console.error('Failed to start recognition:', e);
                    }
                }
            }, 500);
        } catch (err: any) {
            setError(err.message || 'Failed to start voice session');
            console.error('Start voice session error:', err);
        }
    }

    async function endVoiceSession() {
        if (!sessionActiveRef.current) return;
        try {
            await authFetch(`${API_BASE}/voice/end`, { method: 'POST' });
            setSessionActive(false);
            sessionActiveRef.current = false;
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {
                    // Ignore
                }
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

            // Voice chat: Don't add text to chat - only play audio response
            // No onMessage callback - we don't want text responses in voice mode

            // Play TTS audio if provided
            if (data.audioBase64 && typeof data.audioBase64 === 'string') {
                playAudio(data.audioBase64);
            } else {
                // No audio: clear responding state and restart listening after slight delay
                awaitingTTSRef.current = false;
                setIsResponding(false);
                if (sessionActiveRef.current && recognitionRef.current) {
                    setTimeout(() => {
                        if (sessionActiveRef.current && recognitionRef.current) {
                            try { recognitionRef.current.start(); } catch { }
                            setIsListening(true);
                            setIsActive(true);
                        }
                    }, 500);
                }
            }
        } catch (err) {
            console.error('Voice message error:', err);
            setError('Failed to process voice message');
            awaitingTTSRef.current = false;
            setIsResponding(false);
        }
    }

    function playAudio(base64: string) {
        try {
            // Stop any existing playback first
            if (audioRef.current) {
                try { audioRef.current.pause(); } catch { }
            }
            // Revoke old object URL if any
            if (audioUrlRef.current) {
                try { URL.revokeObjectURL(audioUrlRef.current); } catch { }
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

            const audio = new Audio();
            audio.src = objectUrl;
            audio.preload = 'auto';
            audio.autoplay = false;
            audio.volume = 1;
            audioRef.current = audio;
            // Attempt to play once ready
            audio.onended = () => {
                // Resume recognition after TTS finishes
                awaitingTTSRef.current = false;
                setIsResponding(false);
                if (sessionActiveRef.current && recognitionRef.current) {
                    setTimeout(() => {
                        if (sessionActiveRef.current && recognitionRef.current) {
                            try { recognitionRef.current.start(); } catch { }
                            setIsListening(true);
                            setIsActive(true);
                        }
                    }, 300);
                }
            };
            audio.onerror = (e) => {
                console.error('Audio element error:', e);
                awaitingTTSRef.current = false;
                setIsResponding(false);
            };
            const tryPlay = () => {
                audio.play().catch((e) => {
                    console.error('Audio play error:', e);
                    // As a fallback, try again shortly once canplaythrough fires
                });
            };
            audio.oncanplaythrough = () => {
                // small delay helps iOS start
                setTimeout(tryPlay, 100);
                audio.oncanplaythrough = null;
            };
            // If it is already buffered enough
            if (audio.readyState >= 3) {
                setTimeout(tryPlay, 50);
            }
            try { audio.load(); } catch { }
            setTimeout(() => {
                if (!audio.paused) return;
                tryPlay();
            }, 500);
        } catch (err) {
            console.error('Audio play error:', err);
            awaitingTTSRef.current = false;
            setIsResponding(false);
        }
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

