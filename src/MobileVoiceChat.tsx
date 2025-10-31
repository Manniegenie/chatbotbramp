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
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const lastTranscriptRef = useRef<string>('');
    const sessionActiveRef = useRef<boolean>(false);

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

        recognition.onstart = () => {
            setIsListening(true);
            setIsActive(true);
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

                // If we have a final transcript, send it to the backend
                if (finalTranscript.trim()) {
                    handleVoiceMessage(finalTranscript.trim());
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
            setIsListening(false);
            setIsActive(false);
            // Restart if session is still active
            if (sessionActiveRef.current && !error) {
                setTimeout(() => {
                    if (sessionActiveRef.current && recognitionRef.current) {
                        try {
                            recognitionRef.current.start();
                        } catch (e) {
                            console.error('Failed to restart recognition:', e);
                        }
                    }
                }, 100);
            }
        };

        recognitionRef.current = recognition;

        // Start session
        startVoiceSession();

        return () => {
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
            const res = await authFetch(`${API_BASE}/voice/respond`, {
                method: 'POST',
                body: JSON.stringify({ message: text }),
            });

            if (!res.ok) {
                throw new Error('Voice response failed');
            }

            const data = await res.json();

            // Call onMessage callback if provided
            if (onMessage && data.reply) {
                onMessage(data.reply);
            }

            // Play TTS audio if provided
            if (data.audioBase64 && typeof data.audioBase64 === 'string') {
                playAudio(data.audioBase64);
            }
        } catch (err) {
            console.error('Voice message error:', err);
            setError('Failed to process voice message');
        }
    }

    function playAudio(base64: string) {
        try {
            // Stop any existing playback first
            if (audioRef.current) {
                try { audioRef.current.pause(); } catch { }
            }
            const audio = new Audio(`data:audio/mp3;base64,${base64}`);
            audioRef.current = audio;
            // Attempt to play (mobile may require user gesture; mic press counts)
            audio.play().catch((e) => {
                console.error('Audio play error:', e);
            });
        } catch (err) {
            console.error('Audio play error:', err);
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

