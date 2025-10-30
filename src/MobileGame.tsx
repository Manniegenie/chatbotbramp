import React, { useState, useEffect, useRef, useCallback } from "react";
import './MobileApp.css';
import './MobileGame.css';
import WallpaperSlideshow from './WallpaperSlideshow';
import asteroidImg from './assets/asteroid.png';

const GRID_ROWS = 3;
const GRID_COLS = 4;
const HOLE_SIZE = 88; // px, fits mobile
const MOLE_POP_TIME = 600;

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
    const gridW = Math.min(width * 0.97, GRID_COLS * (HOLE_SIZE + 18));
    const gridH = Math.min(height * 0.70, GRID_ROWS * (HOLE_SIZE + 18));
    const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu');
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [moleIdx, setMoleIdx] = useState<number | null>(null);
    const [fakeDown, setFakeDown] = useState(false);
    const timeout = useRef<any>(null);
    const difficulty = useRef(1);
    const playing = useRef(false);
    const totalHoles = GRID_ROWS * GRID_COLS;

    const nextMole = useCallback(() => {
        if (!playing.current) return;
        const idx = Math.floor(Math.random() * totalHoles);
        setMoleIdx(idx);
        timeout.current = setTimeout(nextMole, MOLE_POP_TIME / difficulty.current);
        if (difficulty.current < 2.2) difficulty.current += 0.009;
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
        if (timeout.current) clearTimeout(timeout.current);
        setTimeout(nextMole, 90);
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
        <div className="mobile-page" style={{ zIndex: 2000, position: 'fixed', inset: 0 }}>
            <WallpaperSlideshow />
            <div style={{ position: 'absolute', top: 20, right: 18, zIndex: 22 }}>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="mobile-menu-btn"
                        style={{ background: '#f33', color: '#fff', fontWeight: 700 }}
                        aria-label="Close Game"
                    >✕</button>
                )}
            </div>
            <div style={{
                margin: '60px 0 0',
                height: gridH,
                width: gridW,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 18,
                position: 'relative',
                zIndex: 2,
            }}>
                <div className="mobile-wam-scorebar" style={{ justifyContent: 'flex-start', gap: 18, position: 'absolute', top: 16, left: 18, zIndex: 21 }}>
                    <div>Score: {score}</div>
                    <div style={{ color: '#9ef57c' }}>High: {highScore}</div>
                </div>
                <div
                    className="mobile-wam-grid"
                    style={{
                        gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                        gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
                        width: gridW,
                        height: gridH,
                    }}
                >
                    {[...Array(totalHoles)].map((_, idx) => {
                        const whacked = fakeDown && moleIdx === idx;
                        return (
                            <div
                                key={idx}
                                className="mobile-wam-hole"
                                onClick={() => handleWhack(idx)}
                            >
                                <div className="mobile-wam-hole-shadow"></div>
                                {moleIdx === idx && gameState === 'playing' && (
                                    <img
                                        src={asteroidImg}
                                        alt="Mole"
                                        className="mobile-wam-mole"
                                        style={{
                                            width: whacked ? HOLE_SIZE - 18 : HOLE_SIZE - 7,
                                            height: whacked ? HOLE_SIZE - 18 : HOLE_SIZE - 7,
                                            filter: whacked ? 'brightness(1.4) drop-shadow(0 0 22px #ffe49b)' : 'drop-shadow(0 0 6px #ffe49b66)',
                                            transform: whacked ? 'scale(0.92)' : 'scale(1)',
                                        }}
                                        draggable={false}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
                {/* OVERLAY UI */}
                {gameState !== 'playing' && (
                    <div className="mobile-wam-overlay" style={{ width: gridW, height: gridH }}>
                        {gameState === 'menu' && (
                            <>
                                <div className="mobile-wam-title">WHACK-A-MOLE!</div>
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