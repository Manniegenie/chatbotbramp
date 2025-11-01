import React, { useState, useEffect, useRef, useCallback } from "react";
import './MobileApp.css';
import './MobileGame.css';
import asteroidImg from './assets/asteroid.png';
import { authFetch } from './lib/tokenManager';
import AstronautImg from './assets/astronout.png';

const GRID_ROWS = 3;
const GRID_COLS = 4;
// const HOLE_SIZE = 88; // px, fits mobile
const MOLE_POP_TIME = 670;

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';

// Responsive window size hook for mobile
function useWindowSize() {
    const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    useEffect(() => {
        function onResize() {
            setSize({ width: window.innerWidth, height: window.innerHeight });
        }
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);
    return size;
}

export default function MobileGame({ onClose }: { onClose?: () => void }) {
    const { width, height } = useWindowSize();
    // Responsive hole size by viewport for desktop/tablet
    const holeSize = width >= 1200 ? 128 : width >= 1024 ? 120 : width >= 768 ? 104 : 88;
    const gridW = Math.min(width * 0.97, GRID_COLS * (holeSize + 18));
    const gridH = Math.min(height * 0.70, GRID_ROWS * (holeSize + 18));
    const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu');
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [moleIdx, setMoleIdx] = useState<number | null>(null);
    const [fakeDown, setFakeDown] = useState(false);
    const timeout = useRef<any>(null);
    const difficulty = useRef(1);
    const playing = useRef(false);
    const totalHoles = GRID_ROWS * GRID_COLS;
    const [useAltAsset, setUseAltAsset] = useState(false);
    const [explosions, setExplosions] = useState<number[]>([]);

    async function postScoreUpdate() {
        try {
            const resp = await authFetch(`${API_BASE}/game/score`, { method: 'POST' });
            // Intentionally ignore UI updates to avoid touching anything else
            await resp.json().catch(() => ({}));
        } catch (_) { /* silent */ }
    }

    const nextMole = useCallback(() => {
        if (!playing.current) return;
        const idx = Math.floor(Math.random() * totalHoles);
        setMoleIdx(idx);
        timeout.current = setTimeout(nextMole, MOLE_POP_TIME / difficulty.current);
        if (difficulty.current < 2.05) difficulty.current += 0.008;
    }, [totalHoles]);

    useEffect(() => {
        if (gameState !== 'playing') {
            setMoleIdx(null);
            playing.current = false;
            if (timeout.current) clearTimeout(timeout.current);
            return;
        }
        setScore(0);
        playing.current = true;
        difficulty.current = 1;
        nextMole();
        return () => { if (timeout.current) clearTimeout(timeout.current); };
    }, [gameState, nextMole]);

    const handleWhack = (idx: number) => {
        if (!playing.current || idx !== moleIdx) return;
        setFakeDown(true);
        setTimeout(() => setFakeDown(false), 75);
        setScore((s) => s + 1);
        setMoleIdx(null);
        // Light haptic feedback on supported devices
        try { (navigator as any)?.vibrate?.(35); } catch { /* noop */ }
        // trigger explosion animation for this hole
        setExplosions((prev) => [...prev, idx]);
        setTimeout(() => setExplosions((prev) => prev.filter((i) => i !== idx)), 300);
        // fire-and-forget backend update
        postScoreUpdate();
        if (timeout.current) clearTimeout(timeout.current);
        setTimeout(nextMole, 110);
    };

    useEffect(() => {
        if (!playing.current) return;
        const timer = setTimeout(() => {
            endGame();
        }, 60000);
        return () => clearTimeout(timer);
    }, [gameState, score]);

    const endGame = useCallback(() => {
        playing.current = false;
        setGameState('gameover');
        setMoleIdx(null);
        setHighScore(h => (score > h ? score : h));
    }, [score]);

    const startGame = useCallback(() => {
        setScore(0);
        setGameState('playing');
        playing.current = true;
        setMoleIdx(null);
    }, []);

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0, 0, 0, 0.5)',
                zIndex: 2000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 12px',
                overflow: 'hidden',
                touchAction: 'none',
                minHeight: '100vh',
            }}

        >
            {/* REAL NAV BAR (like in MobileApp.tsx) */}
            <div className="mobile-header" style={{ zIndex: 2500, position: 'fixed', top: 0, left: 0, width: '100vw', background: 'transparent', boxShadow: 'none' }}>
                <div className="mobile-header-top" style={{ justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.08)', border: 'none', boxShadow: 'none', minHeight: 56, padding: '12px 16px 8px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                        <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', letterSpacing: 1 }}>Score: {score}</div>
                        <div style={{ color: '#9ef57c', fontWeight: 700, fontSize: 16 }}>High: {highScore}</div>
                    </div>
                    <button
                        onClick={onClose}
                        className="mobile-menu-btn"
                        style={{
                            background: '#f33',
                            color: '#fff',
                            fontWeight: 700,
                            borderRadius: 12,
                            width: 44,
                            height: 44,
                            minWidth: 44,
                            minHeight: 44
                        }}
                        aria-label="Close Game"
                    >✕</button>
                </div>
            </div>
            {/* No modal: render grid directly on transparent background */}
            <div style={{ width: '100%', position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div
                    className="mobile-wam-grid"
                    style={{
                        gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                        gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
                        width: gridW,
                        height: gridH,
                        margin: '0 auto',
                        transform: 'translateY(-30%)',
                    }}
                >
                    {[...Array(totalHoles)].map((_, idx) => {
                        const whacked = fakeDown && moleIdx === idx;
                        const showExplosion = explosions.includes(idx);
                        return (
                            <div
                                key={idx}
                                className="mobile-wam-hole"
                                onClick={() => handleWhack(idx)}
                                style={{ minHeight: holeSize, minWidth: holeSize, padding: 6 }}
                            >
                                <div className="mobile-wam-hole-shadow"></div>
                                {showExplosion && (
                                    <span
                                        className="wam-explosion"
                                        style={{
                                            width: Math.max(24, Math.floor(holeSize * 0.9)),
                                            height: Math.max(24, Math.floor(holeSize * 0.9)),
                                        }}
                                    />
                                )}
                                {moleIdx === idx && gameState === 'playing' && (
                                    <img
                                        src={asteroidImg + '?v=1'}
                                        alt="Mole"
                                        className="mobile-wam-mole"
                                        style={{
                                            width: whacked ? holeSize - 18 : holeSize - 7,
                                            height: whacked ? holeSize - 18 : holeSize - 7,
                                            filter: whacked ? 'brightness(1.4) drop-shadow(0 0 22px #ffe49b)' : 'drop-shadow(0 0 6px #ffe49b66)',
                                            transform: whacked ? 'scale(0.92)' : 'scale(1)',
                                            objectFit: 'contain'
                                        }}
                                        draggable={false}
                                        decoding="async"
                                        loading="eager"
                                        onError={() => setUseAltAsset(true)}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
                {gameState !== 'playing' && (
                    <div className="mobile-wam-overlay" style={{ width: gridW, height: gridH, margin: '0 auto', transform: 'translateY(-30%)' }}>
                        {gameState === 'menu' && (
                            <>
                                <div className="mobile-wam-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <span>Space Watch</span>
                                    <img src={AstronautImg} alt="Astronaut" style={{ width: '1em', height: '1em', objectFit: 'contain' }} />
                                </div>
                                <div style={{ fontWeight: 400, fontSize: 18, color: '#fff', marginBottom: 20, textShadow: '0 1px 8px #121' }}>Hit as many as you can in 60s!</div>
                                <button
                                    onClick={startGame}
                                    style={{ background: '#18f96e', color: '#111', fontSize: 23, fontWeight: 'bold', padding: '18px 44px', border: 'none', borderRadius: 18, marginTop: 14, boxShadow: '0 0 16px #0004', letterSpacing: 1 }}
                                    className="mobile-menu-btn"
                                    autoFocus
                                >START</button>
                            </>
                        )}
                        {gameState === 'gameover' && (
                            <>
                                <div className="mobile-wam-gameover">GAME OVER</div>
                                <div style={{ fontWeight: 600, fontSize: 21, color: '#fff', marginBottom: 18 }}>Final Score: {score}</div>
                                <button
                                    onClick={startGame}
                                    style={{ background: '#18f96e', color: '#111', fontSize: 23, fontWeight: 'bold', padding: '16px 38px', border: 'none', borderRadius: 18, marginTop: 12, boxShadow: '0 0 14px #0004', letterSpacing: 1 }}
                                    className="mobile-menu-btn"
                                >PLAY AGAIN</button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}