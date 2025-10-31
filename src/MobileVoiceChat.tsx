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
    isMobile?: boolean; // Whether this is mobile (show play button) or desktop (auto-play)
}

export default function MobileVoiceChat({ onClose, onMessage, onSellIntent, isMobile = true }: MobileVoiceChatProps) {
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
    // Track current recording instance ID to prevent stale handlers
    const currentRecordingIdRef = useRef<string | null>(null);

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
        // Prevent multiple simultaneous recordings
        if (!streamRef.current || isRecordingRef.current) {
            console.log('startRecording blocked:', { hasStream: !!streamRef.current, isRecording: isRecordingRef.current });
            return;
        }

        // Ensure previous recording state is fully cleared
        if (isProcessing || isResponding) {
            console.log('startRecording blocked: still processing/responding');
            // Don't block if we're just waiting - let the user retry
            // But ensure we're not in a recording state
            if (isRecordingRef.current) {
                return;
            }
        }

        try {
            // Clean up any existing MediaRecorder before starting new one
            if (mediaRecorderRef.current) {
                try {
                    // Capture the old recorder to compare later
                    const oldRecorder = mediaRecorderRef.current;

                    // Remove old event handlers to prevent them from firing
                    oldRecorder.onstop = null;
                    oldRecorder.ondataavailable = null;
                    oldRecorder.onerror = null;

                    // Stop and clean up if it's still active
                    if (oldRecorder.state === 'recording' || oldRecorder.state === 'paused') {
                        try {
                            oldRecorder.stop();
                        } catch (stopErr) {
                            console.warn('Error stopping old MediaRecorder:', stopErr);
                        }
                    }
                } catch (cleanupErr) {
                    console.warn('Error cleaning up previous MediaRecorder:', cleanupErr);
                }
                mediaRecorderRef.current = null;
            }

            // Ensure all state is reset before starting
            isRecordingRef.current = false;
            setIsRecording(false);
            audioChunksRef.current = [];
            setError(null);

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

            // Generate UNIQUE recording ID for THIS recording session
            const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Set current recording ID IMMEDIATELY to track this session
            currentRecordingIdRef.current = recordingId;

            console.log('🔵 Preparing NEW recording:', recordingId);

            // CRITICAL: Clear ALL previous state FIRST
            audioChunksRef.current = [];
            isRecordingRef.current = false;
            setIsRecording(false);

            // Create isolated chunk storage for THIS recording
            const recordingChunks: Blob[] = [];

            mediaRecorder.ondataavailable = (event) => {
                // Verify this is the current recording session
                if (currentRecordingIdRef.current !== recordingId) {
                    console.log('⚠️ Ignoring chunk from old recording:', currentRecordingIdRef.current, 'vs', recordingId);
                    return;
                }

                // Verify MediaRecorder is still current
                if (mediaRecorderRef.current !== mediaRecorder) {
                    console.log('⚠️ Ignoring chunk from old MediaRecorder');
                    return;
                }

                if (event.data.size > 0) {
                    console.log('✅ Audio chunk received for', recordingId, ':', event.data.size, 'bytes');
                    recordingChunks.push(event.data);
                    audioChunksRef.current.push(event.data);
                }
            };

            // Set the MediaRecorder reference BEFORE starting
            mediaRecorderRef.current = mediaRecorder;

            // Capture start time RIGHT when start() fires
            let recordingStartTime: number | null = null;
            mediaRecorder.onstart = () => {
                // Verify this is still the current recording
                if (currentRecordingIdRef.current !== recordingId) {
                    console.log('⚠️ Ignoring onstart from old recording');
                    return;
                }

                recordingStartTime = Date.now();
                console.log('🟢 Recording ACTUALLY started:', recordingId, { startTime: recordingStartTime });
            };

            mediaRecorder.onstop = async () => {
                console.log('🟡 onstop fired for recording:', recordingId, 'currentRecording:', currentRecordingIdRef.current);

                // CRITICAL: Verify this is STILL the current recording session
                if (currentRecordingIdRef.current !== recordingId) {
                    console.log('❌ IGNORING onstop from OLD recording:', recordingId, 'current is:', currentRecordingIdRef.current);
                    return;
                }

                // Verify MediaRecorder is still current
                if (mediaRecorderRef.current !== mediaRecorder) {
                    console.log('❌ IGNORING onstop from OLD MediaRecorder');
                    return;
                }

                // Get start time (should be set by onstart)
                if (!recordingStartTime) {
                    console.error('❌ No start time found! Recording may have failed to start');
                    // Clear state
                    currentRecordingIdRef.current = null;
                    isRecordingRef.current = false;
                    setIsRecording(false);
                    audioChunksRef.current = [];
                    mediaRecorderRef.current = null;
                    setError('Recording failed: start time not captured');
                    setTimeout(() => setError(null), 3000);
                    return;
                }

                const stopTime = Date.now();
                const recordingDuration = stopTime - recordingStartTime;
                const minRecordingDuration = 500; // Minimum 500ms (0.5 seconds)

                console.log('🟡 Recording stopped:', {
                    recordingId,
                    duration: recordingDuration + 'ms',
                    startTime: recordingStartTime,
                    endTime: stopTime,
                    chunkCount: recordingChunks.length,
                    refChunkCount: audioChunksRef.current.length,
                    timestamp: new Date().toISOString()
                });

                // IMMEDIATELY clear recording ID to prevent this handler from running again
                currentRecordingIdRef.current = null;
                isRecordingRef.current = false;
                setIsRecording(false);

                // Use the isolated chunks array (more reliable)
                const chunksToUse = recordingChunks.length > 0 ? recordingChunks : audioChunksRef.current;

                if (chunksToUse.length === 0) {
                    console.error('❌ No audio chunks recorded');
                    audioChunksRef.current = [];
                    mediaRecorderRef.current = null;
                    setError('No audio recorded. Please hold the button and speak.');
                    setTimeout(() => setError(null), 3000);
                    return;
                }

                const blobType = mediaRecorder?.mimeType || 'audio/webm';
                const audioBlob = new Blob(chunksToUse, { type: blobType });

                console.log('✅ Recording validation:', {
                    recordingId,
                    duration: recordingDuration + 'ms',
                    blobSize: audioBlob.size,
                    chunkCount: chunksToUse.length
                });

                // Validate minimum recording duration
                if (recordingDuration < minRecordingDuration) {
                    console.error('❌ Recording too short:', recordingDuration + 'ms', 'required:', minRecordingDuration + 'ms', 'recordingId:', recordingId);
                    audioChunksRef.current = [];
                    mediaRecorderRef.current = null;
                    setError(`Recording too short (${recordingDuration}ms). Please hold the button for at least 0.5 seconds.`);
                    setTimeout(() => setError(null), 4000);
                    return;
                }

                // Validate minimum audio size
                const minAudioSize = 2000; // Minimum ~2KB
                if (audioBlob.size < minAudioSize) {
                    console.error('❌ Audio blob too small:', audioBlob.size + ' bytes', 'required:', minAudioSize + ' bytes');
                    audioChunksRef.current = [];
                    mediaRecorderRef.current = null;
                    setError('Recording too short. Please speak for at least half a second.');
                    setTimeout(() => setError(null), 4000);
                    return;
                }

                // Clear ALL state before processing
                audioChunksRef.current = [];
                mediaRecorderRef.current = null;

                console.log('✅ Passing validated recording to processAudio:', recordingId, audioBlob.size, 'bytes');
                await processAudio(audioBlob);
            };

            mediaRecorder.onerror = (event: any) => {
                // Verify this is still the current recording
                if (currentRecordingIdRef.current !== recordingId || mediaRecorderRef.current !== mediaRecorder) {
                    console.log('⚠️ Ignoring error from old recording');
                    return;
                }

                console.error('❌ MediaRecorder error for', recordingId, ':', event.error);
                setError('Recording error occurred');
                currentRecordingIdRef.current = null;
                isRecordingRef.current = false;
                setIsRecording(false);
                audioChunksRef.current = [];
                mediaRecorderRef.current = null;
            };

            // Start recording (no timeout - user releases button to stop)
            try {
                console.log('🚀 Calling mediaRecorder.start() for:', recordingId);
                mediaRecorder.start();
                // Set state immediately (onstart will fire soon and set the actual start time)
                isRecordingRef.current = true;
                setIsRecording(true);
                setTranscript('');
                setError(null);
                console.log('✅ mediaRecorder.start() called, waiting for onstart event:', recordingId);
            } catch (startErr: any) {
                console.error('❌ Failed to start MediaRecorder for', recordingId, ':', startErr);
                currentRecordingIdRef.current = null;
                setError('Failed to start recording: ' + (startErr.message || 'Unknown error'));
                isRecordingRef.current = false;
                setIsRecording(false);
                mediaRecorderRef.current = null;
            }
        } catch (err: any) {
            console.error('Start recording error:', err);
            setError(err.message || 'Failed to start recording');
            isRecordingRef.current = false;
            setIsRecording(false);
        }
    }

    // Release button: Stop recording and process
    function stopRecording() {
        const recorder = mediaRecorderRef.current;
        if (!recorder) {
            console.log('stopRecording: No active recorder');
            // Force cleanup even if no recorder
            isRecordingRef.current = false;
            setIsRecording(false);
            return;
        }

        if (recorder.state === 'recording' || recorder.state === 'paused') {
            try {
                console.log('stopRecording called, MediaRecorder state:', recorder.state, 'chunks:', audioChunksRef.current.length);
                recorder.stop();
            } catch (err) {
                console.error('Stop recording error:', err);
                // Force cleanup on error
                isRecordingRef.current = false;
                setIsRecording(false);
                audioChunksRef.current = [];
                mediaRecorderRef.current = null;
            }
        } else if (recorder.state === 'inactive') {
            console.log('stopRecording: Recorder already stopped/inactive');
            // Already stopped, but ensure state is cleared
            isRecordingRef.current = false;
            setIsRecording(false);
        } else {
            console.log('stopRecording: Recorder in unexpected state:', recorder.state);
            // Try to stop anyway, or force cleanup
            try {
                if (recorder.state !== 'inactive') {
                    recorder.stop();
                }
            } catch (err) {
                console.warn('Could not stop recorder:', err);
            }
            isRecordingRef.current = false;
            setIsRecording(false);
        }
        // State reset is handled in onstop handler (if it fires)
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
            // Ensure recording state is cleared
            isRecordingRef.current = false;
            setIsRecording(false);
            audioChunksRef.current = [];
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
                        // Auto-play on desktop, show play button on mobile
                        if (isMobile) {
                            setPendingAudio(data.audioBase64);
                        } else {
                            // Desktop: auto-play
                            await playAudio(data.audioBase64);
                        }
                    }
                    // Always clear processing/responding state
                    awaitingTTSRef.current = false;
                    setIsResponding(false);
                    setIsProcessing(false);
                    // Ensure recording state is cleared
                    isRecordingRef.current = false;
                    setIsRecording(false);
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

            // Auto-play on desktop, show play button on mobile
            if (data.audioBase64 && typeof data.audioBase64 === 'string' && data.audioBase64.length > 0) {
                if (isMobile) {
                    console.log('Audio received, showing play button for mobile:', data.audioBase64.length);
                    setPendingAudio(data.audioBase64);
                } else {
                    console.log('Audio received, auto-playing on desktop:', data.audioBase64.length);
                    // Desktop: auto-play
                    await playAudio(data.audioBase64);
                }
            } else {
                console.warn('No audio received in response');
            }
            // Always clear processing/responding state when response received
            awaitingTTSRef.current = false;
            setIsResponding(false);
            setIsProcessing(false);
            // Ensure recording state is cleared
            isRecordingRef.current = false;
            setIsRecording(false);
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
                    setTranscript(''); // Clear transcript after playback on mobile
                    // Ensure recording state is fully cleared
                    isRecordingRef.current = false;
                    setIsRecording(false);
                    audioChunksRef.current = [];
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

                        // If autoplay is blocked (mobile or desktop), show play button instead
                        if (e.name === 'NotAllowedError' || e.message?.includes('play')) {
                            console.log('Autoplay blocked - will show play button as fallback');
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

                {/* Mic icon OR Play button (conditional) - in same position */}
                {pendingAudio ? (
                    // Play button replaces mic when pending audio exists (mobile only, or desktop fallback if autoplay fails)
                    <button
                        onClick={async () => {
                            try {
                                const audioToPlay = pendingAudio;
                                setPendingAudio(null);
                                setIsResponding(true);
                                await playAudio(audioToPlay);
                                // Transcript is cleared in playAudio's handleEnded
                            } catch (err) {
                                console.error('Manual audio play failed:', err);
                                setError('Failed to play audio. Please try again.');
                            }
                        }}
                        onContextMenu={(e) => e.preventDefault()} // Prevent context menu on long-press
                        style={{
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'var(--accent)',
                            border: '3px solid var(--accent)',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 0 20px rgba(0, 115, 55, 0.4)',
                            outline: 'none',
                            cursor: 'pointer',
                            padding: 0,
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
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="white"
                            stroke="white"
                            strokeWidth="2"
                        >
                            <polygon points="8,5 19,12 8,19" />
                        </svg>
                    </button>
                ) : (
                    // Mic button for recording
                    <button
                        className={`mobile-voice-mic-container ${isRecording ? 'active' : ''} ${isProcessing || isResponding ? 'thinking' : ''}`}
                        style={{
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: isRecording ? 'rgba(0, 115, 55, 0.2)' : (isProcessing || isResponding) ? 'rgba(0, 115, 55, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                            border: isRecording ? '3px solid var(--accent)' : (isProcessing || isResponding) ? '3px solid var(--accent)' : '3px solid rgba(255, 255, 255, 0.2)',
                            transition: 'all 0.3s ease',
                            boxShadow: isRecording ? '0 0 20px rgba(0, 115, 55, 0.4)' : (isProcessing || isResponding) ? '0 0 20px rgba(0, 115, 55, 0.4)' : 'none',
                            outline: 'none',
                            cursor: isProcessing || isResponding ? 'not-allowed' : 'pointer',
                        }}
                        onContextMenu={(e) => e.preventDefault()} // Prevent context menu on long-press
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
                        onTouchCancel={(e) => {
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
                                userSelect: 'none', // Prevent image selection
                                pointerEvents: 'none', // Prevent image drag
                            }}
                            draggable={false} // Prevent image drag
                        />
                    </button>
                )}

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
                    ) : pendingAudio ? (
                        'Tap play button to hear response'
                    ) : (isProcessing || isResponding) ? (
                        'Thinking'
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
