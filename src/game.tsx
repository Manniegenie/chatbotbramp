import React, { useState, useEffect, useRef, useCallback } from "react";

const GRID_ROWS = 3;
const GRID_COLS = 4;
const HOLE_SIZE = 150;
const MOLE_POP_TIME = 600;

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

export default function WhackAMole({ onClose }: { onClose?: () => void }) {
  const { width, height } = useWindowSize();

  const gridW = Math.min(width * 0.93, GRID_COLS * HOLE_SIZE + 30);
  const gridH = Math.min(height * 0.83, GRID_ROWS * HOLE_SIZE + 30);
  const startX = (width - gridW) / 2;
  const startY = (height - gridH) / 2 + 30;

  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [moleIdx, setMoleIdx] = useState<number | null>(null);
  const [fakeDown, setFakeDown] = useState(false);
  const timeout = useRef<NodeJS.Timeout | null>(null);
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
    setTimeout(nextMole, 100);
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
    setHighScore(h => {
      if (score > h) {
        return score;
      }
      return h;
    });
  }, [score]);

  const startGame = useCallback(() => {
    setScore(0);
    setGameState('playing');
    playing.current = true;
    setMoleIdx(null);
  }, []);

  return (
    <div style={{position:'fixed',top:0,left:0,width:'100vw',height:'100vh',background:'#111',zIndex:99999}}>
      {onClose && (
        <button onClick={onClose} style={{position:'absolute',top:18,right:18,zIndex:20,background:'#f33',color:'#fff',fontSize:18,border:'none',padding:'8px 18px',fontWeight:'bold',borderRadius:10}}>
          ✕ Close
        </button>
      )}
      <svg width={width} height={height} style={{position:'absolute',top:0,left:0,background:'#233'}}>
        {/* Score UI */}
        <text x="28" y="54" fontSize="32" fill="#fff" fontWeight="bold" style={{textShadow:'0 0 6px rgba(0,0,0,0.8)'}}>
          Score: {score}
        </text>
        <text x={width - 210} y="50" fontSize="28" fill="#fff" style={{textShadow:'0 0 5px rgba(0,0,0,0.8)'}}>
          High: {highScore}
        </text>

        {/* Holes and moles */}
        {[...Array(totalHoles)].map((_, idx) => {
          const row = Math.floor(idx / GRID_COLS);
          const col = idx % GRID_COLS;
          const x = startX + col * (HOLE_SIZE + 6);
          const y = startY + row * (HOLE_SIZE + 6);
          const whacked = fakeDown && moleIdx === idx;
          
          return (
            <g key={idx} onClick={() => handleWhack(idx)} style={{cursor: 'pointer'}}>
              {/* Hole shadow */}
              <rect x={x + 8} y={y + HOLE_SIZE - 25} width={HOLE_SIZE - 16} height={22} fill="#222" style={{filter:'drop-shadow(0 7px 9px rgba(0,0,0,0.5))'}}/>
              {/* Hole */}
              <rect x={x} y={y} width={HOLE_SIZE} height={HOLE_SIZE} fill="rgba(0,0,0,0.13)" rx={18}/>
              {/* Mole/Asteroid */}
              {moleIdx === idx && (
                <circle 
                  cx={x + HOLE_SIZE/2 + (whacked ? 5 : 0)}
                  cy={y + HOLE_SIZE/2 + (whacked ? 5 : 0)}
                  r={(HOLE_SIZE - 36 - (whacked ? 10 : 0))/2}
                  fill="#f5d21f"
                  style={{filter: `drop-shadow(0 0 ${whacked ? 30 : 14}px #f5d21f)`}}
                />
              )}
            </g>
          );
        })}

        {/* Overlays */}
        {gameState !== 'playing' && (
          <g>
            <rect x="0" y="0" width={width} height={height} fill="#000" opacity="0.75"/>
            {gameState === 'menu' && (
              <g>
                <text x={width/2} y={height/2 - 120} fontSize="58" fill="#18f96e" fontWeight="bold" textAnchor="middle">
                  WHACK-A-MOLE!
                </text>
                <text x={width/2} y={height/2 - 44} fontSize="32" fill="#fff" textAnchor="middle">
                  Hit as many as you can in 60s!
                </text>
                <rect x={width/2 - 112.5} y={height/2 + 18} width="225" height="80" fill="#18f96e" rx={18} onClick={startGame} style={{cursor:'pointer'}}/>
                <text x={width/2} y={height/2 + 63} fontSize="33" fill="#000" fontWeight="bold" textAnchor="middle" onClick={startGame} style={{cursor:'pointer'}}>
                  START GAME
                </text>
              </g>
            )}
            {gameState === 'gameover' && (
              <g>
                <text x={width/2} y={height/2 - 120} fontSize="54" fill="#fff" textAnchor="middle">
                  GAME OVER
                </text>
                <text x={width/2} y={height/2 - 44} fontSize="34" fill="#fff" textAnchor="middle">
                  Final Score: {score}
                </text>
                <rect x={width/2 - 95} y={height/2 + 26} width="190" height="75" fill="#18f96e" rx={18} onClick={startGame} style={{cursor:'pointer'}}/>
                <text x={width/2} y={height/2 + 71} fontSize="33" fill="#000" fontWeight="bold" textAnchor="middle" onClick={startGame} style={{cursor:'pointer'}}>
                  PLAY AGAIN
                </text>
              </g>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}