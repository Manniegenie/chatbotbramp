import React, { useRef, useEffect, useState, useCallback } from "react";
import { Stage, Layer, Rect, Circle, Text, Group } from "react-konva";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 40;
const BULLET_SIZE = 8;
const ENEMY_SIZE = 32;
const PLAYER_SPEED = 6;
const BULLET_SPEED = 10;
const ENEMY_SPEED_BASE = 2;
const ENEMY_SPAWN_RATE = 60; // frames

function randomX() {
  return Math.random() * (CANVAS_WIDTH - ENEMY_SIZE) + ENEMY_SIZE / 2;
}

const getHighScore = () =>
  parseInt(localStorage.getItem("konvaGameHighScore") ?? "0");

export default function SpaceGame({ onClose }: { onClose: () => void }) {
  const [player, setPlayer] = useState({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 60 });
  const [bullets, setBullets] = useState<{ x: number; y: number; id: number }[]>([]);
  const [enemies, setEnemies] = useState<{ x: number; y: number; id: number; speed: number }[]>([]);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameover'>('menu');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(getHighScore());
  const keys = useRef<Set<string>>(new Set());
  const bulletId = useRef(0);
  const enemyId = useRef(0);
  const frame = useRef(0);

  // Keyboard input
  useEffect(() => {
    function down(e: KeyboardEvent) {
      keys.current.add(e.key.toLowerCase());
      if (e.key === " ") {
        e.preventDefault();
      }
    }
    function up(e: KeyboardEvent) {
      keys.current.delete(e.key.toLowerCase());
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Main game loop
  useEffect(() => {
    if (gameState !== "playing") return;
    let running = true;
    function loop() {
      if (!running) return;
      // Move player
      setPlayer((p) => {
        let x = p.x;
        if (keys.current.has("a") || keys.current.has("arrowleft")) x -= PLAYER_SPEED;
        if (keys.current.has("d") || keys.current.has("arrowright")) x += PLAYER_SPEED;
        x = Math.max(PLAYER_SIZE / 2, Math.min(CANVAS_WIDTH - PLAYER_SIZE / 2, x));
        return { ...p, x };
      });
      // Shoot
      if (keys.current.has(" ")) {
        setBullets((bullets) =>
          bullets.length < 10
            ? [...bullets, { x: player.x, y: player.y - PLAYER_SIZE / 2, id: bulletId.current++ }]
            : bullets
        );
        keys.current.delete(" ");
      }
      // Move bullets
      setBullets((bullets) => bullets.map((b) => ({ ...b, y: b.y - BULLET_SPEED })).filter((b) => b.y > -BULLET_SIZE));
      // Spawn enemies
      if (frame.current % ENEMY_SPAWN_RATE === 0) {
        setEnemies((enemies) => [
          ...enemies,
          { x: randomX(), y: -ENEMY_SIZE, id: enemyId.current++, speed: ENEMY_SPEED_BASE + Math.random() * 2 }
        ]);
      }
      // Move enemies
      setEnemies((enemies) => enemies.map((e) => ({ ...e, y: e.y + e.speed })));
      // Collisions
      setBullets((bullets) => {
        let newBullets = [...bullets];
        setEnemies((enemies) => {
          let newEnemies = [...enemies];
          bullets.forEach((b) => {
            const idx = newEnemies.findIndex((e) => Math.abs(b.x - e.x) < ENEMY_SIZE / 2 && Math.abs(b.y - e.y) < ENEMY_SIZE / 2);
            if (idx !== -1) {
              newEnemies.splice(idx, 1);
              newBullets = newBullets.filter((bb) => bb.id !== b.id);
              setScore((s) => s + 10);
            }
          });
          return newEnemies;
        });
        return newBullets;
      });
      // Player-enemy collision or missed enemy
      setEnemies((enemies) => {
        const hit = enemies.some(
          (e) => Math.abs(player.x - e.x) < (PLAYER_SIZE + ENEMY_SIZE) / 2 && Math.abs(player.y - e.y) < (PLAYER_SIZE + ENEMY_SIZE) / 2
        );
        if (hit || enemies.some((e) => e.y > CANVAS_HEIGHT)) {
          setGameState("gameover");
          // Update high score
          setHighScore((h) => {
            const ns = Math.max(score, h);
            localStorage.setItem("konvaGameHighScore", ns.toString());
            return ns;
          });
          return [];
        }
        return enemies.filter((e) => e.y < CANVAS_HEIGHT + ENEMY_SIZE);
      });
      frame.current++;
      requestAnimationFrame(loop);
    }
    loop();
    return () => {
      running = false;
    };
    // eslint-disable-next-line
  }, [gameState, player.x, player.y, score]);

  // Reset game
  const startGame = useCallback(() => {
    setPlayer({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 60 });
    setBullets([]);
    setEnemies([]);
    setScore(0);
    frame.current = 0;
    setGameState("playing");
  }, []);

  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'#000c',zIndex:9999,display:'flex',justifyContent:'center',alignItems:'center'}}>  
      <div style={{position:'absolute',top:16,right:16}}>
        <button onClick={onClose} style={{background:'#f33',color:'#fff',fontWeight:'bold',border:'none',padding:'8px 18px',borderRadius:8}}>✕ Close</button>
      </div>
      <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={{border:'2px solid #2f6',borderRadius:10,background:'#111'}}>  
        <Layer>
          {/* Player */}
          <Group>
            <Rect x={player.x - PLAYER_SIZE / 2} y={player.y - PLAYER_SIZE / 2} width={PLAYER_SIZE} height={PLAYER_SIZE} fill="#18f96e" rotation={45}/>
          </Group>
          {/* Bullets */}
          {bullets.map((b) => (
            <Circle key={b.id} x={b.x} y={b.y} radius={BULLET_SIZE} fill="#ff2" />
          ))}
          {/* Enemies */}
          {enemies.map((e) => (
            <Circle key={e.id} x={e.x} y={e.y} radius={ENEMY_SIZE/2} fill="#f33" />
          ))}
          {/* Score */}
          <Text x={16} y={12} text={`Score: ${score}`} fontSize={24} fill="#fff" />
          <Text x={16} y={42} text={`High Score: ${highScore}`} fontSize={20} fill="#fff" />
          {/* Menu/Gameover overlay */}
          {gameState === 'menu' && (
            <Group>
              <Rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#000d"/>
              <Text x={CANVAS_WIDTH/2-120} y={CANVAS_HEIGHT/2-60} text="SPACE GAME" fontSize={48} fill="#fff" />
              <Text x={CANVAS_WIDTH/2-120} y={CANVAS_HEIGHT/2} text="A/D or ⬅/➡: Move  SPACE: Shoot" fontSize={22} fill="#fff" />
              <Rect x={CANVAS_WIDTH/2-90} y={CANVAS_HEIGHT/2+48} width={180} height={54} fill="#1f5" cornerRadius={12} onClick={startGame}/>
              <Text x={CANVAS_WIDTH/2-70} y={CANVAS_HEIGHT/2+60} text="START GAME" fontSize={30} fill="#000" onClick={startGame}/>
            </Group>
          )}
          {gameState === 'gameover' && (
            <Group>
              <Rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#000a"/>
              <Text x={CANVAS_WIDTH/2-110} y={CANVAS_HEIGHT/2-60} text={`GAME OVER`} fontSize={42} fill="#fff" />
              <Text x={CANVAS_WIDTH/2-120} y={CANVAS_HEIGHT/2} text={`Final: ${score}`} fontSize={28} fill="#fff" />
              <Rect x={CANVAS_WIDTH/2-85} y={CANVAS_HEIGHT/2+48} width={170} height={50} fill="#1f5" cornerRadius={10} onClick={startGame}/>
              <Text x={CANVAS_WIDTH/2-60} y={CANVAS_HEIGHT/2+60} text="PLAY AGAIN" fontSize={28} fill="#000" onClick={startGame}/>
            </Group>
          )}
        </Layer>
      </Stage>
    </div>
  );
}