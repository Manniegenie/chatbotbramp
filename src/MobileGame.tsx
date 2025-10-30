import React, { useState, useEffect, useRef, useCallback } from "react";
import './MobileApp.css';
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
        {/* Score Board */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', color: '#fff', fontWeight: 700, fontSize: 20, marginBottom: 10 }}>
          <div style={{ color: '#fff', textShadow: '0 0 10px #000', letterSpacing: 2 }}>Score: {score}</div>
          <div style={{ color: '#9ef57c', textShadow: '0 0 6px #222' }}>High: {highScore}</div>
        </div>
        {/* GAME GRID */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          gap: 13,
          width: gridW,
          height: gridH,
          background: 'rgba(0,0,0,0.08)',
          borderRadius: 18,
          boxShadow: '0 0 22px #0005',
          border: '2px solid var(--border)',
        }}>
          {[...Array(totalHoles)].map((_, idx) => {
            const whacked = fakeDown && moleIdx === idx;
            return (
              <div
                key={idx}
                style={{
                  background: 'rgba(0,0,0,0.13)',
                  borderRadius: 18,
                  position: 'relative',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.32)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: HOLE_SIZE,
                  minWidth: HOLE_SIZE,
                  aspectRatio: '1 / 1',
                  cursor: gameState === 'playing' ? 'pointer' : 'default',
                  touchAction: 'manipulation'
                }}
                className="whack-mole-hole-mobile"
                onClick={() => handleWhack(idx)}
              >
                {/* Hole shadow */}
                <div style={{
                  position: 'absolute',
                  bottom: 12,
                  left: '14%',
                  width: '72%',
                  height: 15,
                  borderRadius: '50%',
                  background: '#181818',
                  filter: 'blur(2px)',
                  opacity: 0.66
                }}></div>
                {/* Mole display */}
                {moleIdx === idx && gameState === 'playing' && (
                  <img
                    src={asteroidImg}
                    alt="Mole"
                    style={{
                      width: whacked ? HOLE_SIZE - 18 : HOLE_SIZE - 7,
                      height: whacked ? HOLE_SIZE - 18 : HOLE_SIZE - 7,
                      filter: whacked ? 'brightness(1.4) drop-shadow(0 0 22px #ffe49b)' : 'drop-shadow(0 0 6px #ffe49b66)',
                      transition: 'transform 70ms',
                      transform: whacked ? 'scale(0.92)' : 'scale(1)',
                      touchAction: 'none'
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
          <div style={{
            position: 'absolute', top: 0, left: 0, width: gridW, height: gridH, zIndex: 10,
            background: 'rgba(0,0,0,0.84)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 18
          }}>
            {gameState === 'menu' && (
              <>
                <div style={{ fontWeight: 700, fontSize: 32, color: '#18f96e', marginBottom: 24, textAlign: 'center', letterSpacing: 2, textShadow: '0 4px 24px #111' }}>WHACK-A-MOLE!</div>
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
                <div style={{ fontWeight: 700, fontSize: 32, color: '#ffe985', marginBottom: 18, letterSpacing: 2, textShadow: '0 2px 18px #000' }}>GAME OVER</div>
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