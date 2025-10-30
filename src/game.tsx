import React, { useRef, useState, useEffect, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Circle, Text, Group, Rect } from "react-konva";
import { useImage } from './useImage';

const PLAYER_SIZE = 80;
const ENEMY_SIZE = 64;
const BULLET_SIZE = 13;
const PLAYER_SPEED = 7;
const BULLET_SPEED = 12;
const ENEMY_SPAWN_RATE = 58;
const ENEMY_SPEED_BASE = 2.2;
const MAX_BULLETS = 8;

const getHighScore = () => parseInt(localStorage.getItem("konvaGameHighScore") ?? "0");

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

export default function SpaceGame({ onClose }: { onClose: () => void }) {
  const { width, height } = useWindowSize();
  const [playerImg] = useImage('/src/assets/spaceship.png');
  const [asteroidImg] = useImage('/src/assets/asteroid.png');

  const [player, setPlayer] = useState({ x: width / 2, y: height - 110 });
  const [bullets, setBullets] = useState<{ x: number; y: number; id: number }[]>([]);
  const [enemies, setEnemies] = useState<{ x: number; y: number; id: number; speed: number }[]>([]);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameover'>('menu');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(getHighScore());
  const keys = useRef<Set<string>>(new Set());
  const bulletId = useRef(0);
  const enemyId = useRef(0);
  const frame = useRef(0);

  // Responsive player
  useEffect(() => {
    setPlayer((p) => ({ ...p, x: width / 2, y: height - 110 }));
  }, [width, height]);

  // Keyboard controls
  useEffect(() => {
    function down(e: KeyboardEvent) {
      keys.current.add(e.key.toLowerCase());
      if (e.key === " ") e.preventDefault();
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

  // Touch controls: left/right half of screen
  useEffect(() => {
    function touchStart(e: TouchEvent) {
      if (gameState !== "playing") return;
      const touch = e.touches[0];
      if (!touch) return;
      const x = touch.clientX;
      if (x < width / 2) keys.current.add("a");
      if (x >= width / 2) keys.current.add("d");
    }
    function touchEnd() {
      keys.current.delete("a");
      keys.current.delete("d");
    }
    window.addEventListener("touchstart", touchStart);
    window.addEventListener("touchend", touchEnd);
    return () => {
      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchend", touchEnd);
    };
  }, [width, gameState]);

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
        x = Math.max(PLAYER_SIZE / 2, Math.min(width - PLAYER_SIZE / 2, x));
        return { ...p, x };
      });
      // Shooting
      if (keys.current.has(" ")) {
        setBullets((bul) =>
          bul.length < MAX_BULLETS
            ? [...bul, { x: player.x, y: player.y - PLAYER_SIZE / 2 - BULLET_SIZE, id: bulletId.current++ }]
            : bul
        );
        keys.current.delete(" ");
      }
      // Move bullets
      setBullets((bul) => bul.map((b) => ({ ...b, y: b.y - BULLET_SPEED })).filter((b) => b.y > -BULLET_SIZE));
      // Spawn asteroids
      if (frame.current % ENEMY_SPAWN_RATE === 0) {
        setEnemies((enemies) => [
          ...enemies,
          {
            x: Math.random() * (width - ENEMY_SIZE) + ENEMY_SIZE / 2,
            y: -ENEMY_SIZE,
            id: enemyId.current++,
            speed: ENEMY_SPEED_BASE + Math.random() * 2 + score / 700,
          },
        ]);
      }
      // Move asteroids
      setEnemies((es) => es.map((e) => ({ ...e, y: e.y + e.speed })));

      // Bullet-asteroid collisions
      setBullets((bullets) => {
        let newB = [...bullets];
        setEnemies((enemies) => {
          let newEnemies = [...enemies];
          bullets.forEach((b) => {
            const idx = newEnemies.findIndex((e) => Math.abs(b.x - e.x) < ENEMY_SIZE / 2 && Math.abs(b.y - e.y) < ENEMY_SIZE / 2);
            if (idx !== -1) {
              newEnemies.splice(idx, 1);
              newB = newB.filter((bb) => bb.id !== b.id);
              setScore((s) => s + 10);
            }
          });
          return newEnemies;
        });
        return newB;
      });

      // Asteroid-player collision or missed
      setEnemies((enemies) => {
        const hit = enemies.some((e) =>
          Math.abs(player.x - e.x) < (PLAYER_SIZE * 0.45 + ENEMY_SIZE / 2) && Math.abs(player.y - e.y) < (PLAYER_SIZE * 0.45 + ENEMY_SIZE / 2)
        );
        if (hit || enemies.some((e) => e.y > height)) {
          setGameState("gameover");
          setHighScore((h) => {
            const ns = Math.max(score, h);
            localStorage.setItem("konvaGameHighScore", ns.toString());
            return ns;
          });
          return [];
        }
        return enemies.filter((e) => e.y < height + ENEMY_SIZE);
      });
      frame.current++;
      requestAnimationFrame(loop);
    }
    loop();
    return () => {
      running = false;
    };
    // eslint-disable-next-line
  }, [gameState, player.x, player.y, width, height, score]);

  // Start game
  const startGame = useCallback(() => {
    setPlayer({ x: width / 2, y: height - 110 });
    setBullets([]);
    setEnemies([]);
    setScore(0);
    frame.current = 0;
    setGameState("playing");
  }, [width, height]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#000', zIndex: 99999 }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 18, right: 18, zIndex: 20, background: '#f33', color: '#fff', fontSize: 18, border: 'none', padding: '8px 18px', fontWeight: 'bold', borderRadius: 10 }}>
        ✕ Close
      </button>
      <Stage width={width} height={height} style={{ background: '#1b1e33', width: '100vw', height: '100vh' }}>
        <Layer>
          {/* Player as image */}
          {playerImg && (
            <KonvaImage
              image={playerImg}
              x={player.x - PLAYER_SIZE / 2}
              y={player.y - PLAYER_SIZE / 2}
              width={PLAYER_SIZE}
              height={PLAYER_SIZE}
              rotation={-90}
              perfectDrawEnabled={false}
            />
          )}
          {/* Bullets */}
          {bullets.map((b) => (
            <Circle key={b.id} x={b.x} y={b.y} radius={BULLET_SIZE} fill="#f8ea32" shadowBlur={7} />
          ))}
          {/* Asteroids (enemies) as images */}
          {asteroidImg && enemies.map((e) => (
            <KonvaImage
              key={e.id}
              image={asteroidImg}
              x={e.x - ENEMY_SIZE / 2}
              y={e.y - ENEMY_SIZE / 2}
              width={ENEMY_SIZE}
              height={ENEMY_SIZE}
              perfectDrawEnabled={false}
            />
          ))}
          {/* Score */}
          <Text x={18} y={18} text={`Score: ${score}`} fontSize={26} fill="#fff" fontStyle="bold" shadowBlur={6} />
          <Text x={18} y={52} text={`High Score: ${highScore}`} fontSize={20} fill="#fff" shadowBlur={5} />
          {/* Overlays */}
          {gameState === 'menu' && (
            <Group>
              <Rect x={0} y={0} width={width} height={height} fill="#000c" />
              <Text x={width / 2 - 110} y={height / 2 - 80} text="SPACE SHOOTER" fontSize={52} fill="#1af" fontStyle="bold" />
              <Text x={width / 2 - 130} y={height / 2 - 20} text="A/D or ⬅/➡: Move    SPACE: Shoot" fontSize={26} fill="#fff" />
              <Rect x={width / 2 - 110} y={height / 2 + 40} width={225} height={70} fill="#18f96e" cornerRadius={16} onClick={startGame} />
              <Text x={width / 2 - 62} y={height / 2 + 61} text="START GAME" fontSize={32} fill="#000" onClick={startGame} />
            </Group>
          )}
          {gameState === 'gameover' && (
            <Group>
              <Rect x={0} y={0} width={width} height={height} fill="#000d" />
              <Text x={width / 2 - 110} y={height / 2 - 60} text={`GAME OVER`} fontSize={46} fill="#fff" />
              <Text x={width / 2 - 105} y={height / 2} text={`Final: ${score}`} fontSize={28} fill="#fff" />
              <Rect x={width / 2 - 85} y={height / 2 + 44} width={170} height={55} fill="#18f96e" cornerRadius={12} onClick={startGame} />
              <Text x={width / 2 - 61} y={height / 2 + 65} text="PLAY AGAIN" fontSize={27} fill="#000" onClick={startGame} />
            </Group>
          )}
        </Layer>
      </Stage>
    </div>
  );
}