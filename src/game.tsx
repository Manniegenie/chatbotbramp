import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Container, Sprite, Text, Graphics } from '@pixi/react';
import { Application, Texture, Graphics as PIXIGraphics, Rectangle } from 'pixi.js';
import * as PIXI from 'pixi.js';

// Import images
import PlayerSpaceship from './assets/spaceship (1).png';
import EnemySpaceship from './assets/spaceship.png';
import AsteroidImage from './assets/asteroid.png';

interface Position {
    x: number;
    y: number;
}

interface Bullet {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
}

interface Enemy {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: 'spaceship' | 'asteroid';
    rotation: number;
}

interface SpaceGameProps {
    onClose: () => void;
}

const SpaceGame: React.FC<SpaceGameProps> = ({ onClose }) => {
    const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameover'>('menu');
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(() => {
        return parseInt(localStorage.getItem('spaceGameHighScore') || '0');
    });
    const [playerPos, setPlayerPos] = useState<Position>({ x: 0, y: 0 });
    const [bullets, setBullets] = useState<Bullet[]>([]);
    const [enemies, setEnemies] = useState<Enemy[]>([]);
    const [keys, setKeys] = useState<{ [key: string]: boolean }>({});

    const appRef = useRef<Application | null>(null);
    const bulletsRef = useRef<Bullet[]>([]);
    const enemiesRef = useRef<Enemy[]>([]);
    const lastBulletTimeRef = useRef(0);
    const lastEnemyTimeRef = useRef(0);
    const gameLoopRef = useRef<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Game constants
    const PLAYER_SIZE = 60;
    const PLAYER_SPEED = 5;
    const BULLET_SPEED = 10;
    const ENEMY_SIZE = 50;
    const ASTEROID_SIZE = 40;
    const BULLET_COOLDOWN = 200; // ms
    const ENEMY_SPAWN_RATE = 2000; // ms

    // Initialize PIXI textures
    const [textures, setTextures] = useState<{
        player: Texture | null;
        enemy: Texture | null;
        asteroid: Texture | null;
    }>({
        player: null,
        enemy: null,
        asteroid: null
    });

    // Load textures
    useEffect(() => {
        const loadTextures = async () => {
            try {
                const playerTexture = await PIXI.Assets.load(PlayerSpaceship);
                const enemyTexture = await PIXI.Assets.load(EnemySpaceship);
                const asteroidTexture = await PIXI.Assets.load(AsteroidImage);

                setTextures({
                    player: playerTexture,
                    enemy: enemyTexture,
                    asteroid: asteroidTexture
                });
            } catch (error) {
                console.error('Error loading textures:', error);
            }
        };

        loadTextures();
    }, []);

    // Initialize game dimensions
    const [gameDimensions, setGameDimensions] = useState({ width: 800, height: 600 });

    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setGameDimensions({
                    width: window.innerWidth,
                    height: window.innerHeight
                });
                setPlayerPos({
                    x: window.innerWidth / 2,
                    y: window.innerHeight - 100
                });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    // Keyboard handling
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            setKeys(prev => ({ ...prev, [e.code]: true }));

            if (e.code === 'Space') {
                e.preventDefault();
                if (gameState === 'playing') {
                    shootBullet();
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            setKeys(prev => ({ ...prev, [e.code]: false }));
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [gameState]);

    // Touch handling for mobile
    useEffect(() => {
        const handleTouch = (e: TouchEvent) => {
            e.preventDefault();
            if (gameState === 'playing') {
                shootBullet();
            }
        };

        if (containerRef.current) {
            containerRef.current.addEventListener('touchstart', handleTouch, { passive: false });
            return () => {
                if (containerRef.current) {
                    containerRef.current.removeEventListener('touchstart', handleTouch);
                }
            };
        }
    }, [gameState]);

    const shootBullet = useCallback(() => {
        const now = Date.now();
        if (now - lastBulletTimeRef.current < BULLET_COOLDOWN) return;

        lastBulletTimeRef.current = now;
        const newBullet: Bullet = {
            id: Math.random().toString(36).substr(2, 9),
            x: playerPos.x,
            y: playerPos.y - PLAYER_SIZE / 2,
            vx: 0,
            vy: -BULLET_SPEED
        };

        setBullets(prev => [...prev, newBullet]);
    }, [playerPos]);

    // Game loop
    useEffect(() => {
        if (gameState !== 'playing') return;

        const gameLoop = () => {
            setPlayerPos(prev => {
                let newX = prev.x;
                let newY = prev.y;

                if (keys['ArrowLeft'] || keys['KeyA']) {
                    newX = Math.max(PLAYER_SIZE / 2, newX - PLAYER_SPEED);
                }
                if (keys['ArrowRight'] || keys['KeyD']) {
                    newX = Math.min(gameDimensions.width - PLAYER_SIZE / 2, newX + PLAYER_SPEED);
                }
                if (keys['ArrowUp'] || keys['KeyW']) {
                    newY = Math.max(PLAYER_SIZE / 2, newY - PLAYER_SPEED);
                }
                if (keys['ArrowDown'] || keys['KeyS']) {
                    newY = Math.min(gameDimensions.height - PLAYER_SIZE / 2, newY + PLAYER_SPEED);
                }

                return { x: newX, y: newY };
            });

            // Update bullets
            setBullets(prev => {
                const updated = prev
                    .map(bullet => ({
                        ...bullet,
                        x: bullet.x + bullet.vx,
                        y: bullet.y + bullet.vy
                    }))
                    .filter(bullet => bullet.y > -20 && bullet.x > -20 && bullet.x < gameDimensions.width + 20);

                bulletsRef.current = updated;
                return updated;
            });

            // Spawn enemies
            const now = Date.now();
            if (now - lastEnemyTimeRef.current > ENEMY_SPAWN_RATE) {
                lastEnemyTimeRef.current = now;
                const isAsteroid = Math.random() < 0.3;
                const newEnemy: Enemy = {
                    id: Math.random().toString(36).substr(2, 9),
                    x: Math.random() * (gameDimensions.width - 50) + 25,
                    y: -50,
                    vx: (Math.random() - 0.5) * 2,
                    vy: Math.random() * 2 + 1,
                    type: isAsteroid ? 'asteroid' : 'spaceship',
                    rotation: 0
                };

                setEnemies(prev => [...prev, newEnemy]);
            }

            // Update enemies
            setEnemies(prev => {
                const updated = prev
                    .map(enemy => ({
                        ...enemy,
                        x: enemy.x + enemy.vx,
                        y: enemy.y + enemy.vy,
                        rotation: enemy.rotation + 0.1
                    }))
                    .filter(enemy => enemy.y < gameDimensions.height + 50);

                enemiesRef.current = updated;
                return updated;
            });

            // Check collisions
            checkCollisions();

            gameLoopRef.current = requestAnimationFrame(gameLoop);
        };

        gameLoopRef.current = requestAnimationFrame(gameLoop);

        return () => {
            if (gameLoopRef.current) {
                cancelAnimationFrame(gameLoopRef.current);
            }
        };
    }, [gameState, keys, gameDimensions, playerPos]);

    const checkCollisions = () => {
        const currentBullets = bulletsRef.current;
        const currentEnemies = enemiesRef.current;

        // Bullet vs Enemy collisions
        currentBullets.forEach((bullet, bulletIndex) => {
            currentEnemies.forEach((enemy, enemyIndex) => {
                const distance = Math.sqrt(
                    Math.pow(bullet.x - enemy.x, 2) + Math.pow(bullet.y - enemy.y, 2)
                );
                const enemySize = enemy.type === 'asteroid' ? ASTEROID_SIZE : ENEMY_SIZE;

                if (distance < enemySize / 2 + 10) {
                    // Collision detected
                    setBullets(prev => prev.filter((_, i) => i !== bulletIndex));
                    setEnemies(prev => prev.filter((_, i) => i !== enemyIndex));
                    setScore(prev => prev + (enemy.type === 'asteroid' ? 10 : 20));
                }
            });
        });

        // Player vs Enemy collisions
        currentEnemies.forEach((enemy) => {
            const distance = Math.sqrt(
                Math.pow(playerPos.x - enemy.x, 2) + Math.pow(playerPos.y - enemy.y, 2)
            );
            const enemySize = enemy.type === 'asteroid' ? ASTEROID_SIZE : ENEMY_SIZE;

            if (distance < PLAYER_SIZE / 2 + enemySize / 2) {
                // Game over
                setGameState('gameover');
                if (score > highScore) {
                    setHighScore(score);
                    localStorage.setItem('spaceGameHighScore', score.toString());
                }
            }
        });
    };

    const startGame = () => {
        setGameState('playing');
        setScore(0);
        setBullets([]);
        setEnemies([]);
        setPlayerPos({
            x: gameDimensions.width / 2,
            y: gameDimensions.height - 100
        });
    };

    const resetGame = () => {
        setGameState('menu');
        setScore(0);
        setBullets([]);
        setEnemies([]);
    };

    const pauseGame = () => {
        setGameState(gameState === 'playing' ? 'paused' : 'playing');
    };

    // Render game objects
    const renderBullets = () => {
        return bullets.map(bullet => (
            <Graphics
                key={bullet.id}
                draw={(g) => {
                    g.clear();
                    g.beginFill(0x00ff00);
                    g.drawRect(bullet.x - 2, bullet.y - 8, 4, 16);
                    g.endFill();
                }}
            />
        ));
    };

    const renderEnemies = () => {
        return enemies.map(enemy => {
            const texture = enemy.type === 'asteroid' ? textures.asteroid : textures.enemy;
            const size = enemy.type === 'asteroid' ? ASTEROID_SIZE : ENEMY_SIZE;

            if (!texture) return null;

            return (
                <Sprite
                    key={enemy.id}
                    texture={texture}
                    x={enemy.x}
                    y={enemy.y}
                    width={size}
                    height={size}
                    rotation={enemy.rotation}
                    anchor={0.5}
                />
            );
        });
    };

    const renderPlayer = () => {
        if (!textures.player) return null;

        return (
            <Sprite
                texture={textures.player}
                x={playerPos.x}
                y={playerPos.y}
                width={PLAYER_SIZE}
                height={PLAYER_SIZE}
                anchor={0.5}
            />
        );
    };

    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: '#000',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            <Stage
                width={gameDimensions.width}
                height={gameDimensions.height}
                options={{
                    backgroundColor: 0x000011,
                    antialias: true
                }}
            >
                <Container>
                    {gameState === 'playing' && (
                        <>
                            {renderPlayer()}
                            {renderBullets()}
                            {renderEnemies()}
                        </>
                    )}

                    {gameState === 'menu' && (
                        <Container>
                            <Text
                                text="SPACE SHOOTER"
                                x={gameDimensions.width / 2}
                                y={gameDimensions.height / 2 - 100}
                                anchor={0.5}
                                style={{
                                    fontSize: 48,
                                    fill: 0x00ff00,
                                    fontWeight: 'bold'
                                }}
                            />
                            <Text
                                text="High Score: " + highScore
                            x={gameDimensions.width / 2}
                            y={gameDimensions.height / 2 - 40}
                            anchor={0.5}
                            style={{
                                fontSize: 24,
                                fill: 0xffffff
                            }}
              />
                        </Container>
                    )}

                    {gameState === 'paused' && (
                        <Text
                            text="PAUSED"
                            x={gameDimensions.width / 2}
                            y={gameDimensions.height / 2}
                            anchor={0.5}
                            style={{
                                fontSize: 48,
                                fill: 0xffff00,
                                fontWeight: 'bold'
                            }}
                        />
                    )}

                    {gameState === 'gameover' && (
                        <Container>
                            <Text
                                text="GAME OVER"
                                x={gameDimensions.width / 2}
                                y={gameDimensions.height / 2 - 50}
                                anchor={0.5}
                                style={{
                                    fontSize: 48,
                                    fill: 0xff0000,
                                    fontWeight: 'bold'
                                }}
                            />
                            <Text
                                text={`Score: ${score}`}
                                x={gameDimensions.width / 2}
                                y={gameDimensions.height / 2 + 10}
                                anchor={0.5}
                                style={{
                                    fontSize: 24,
                                    fill: 0xffffff
                                }}
                            />
                        </Container>
                    )}

                    {/* UI Elements */}
                    {gameState === 'playing' && (
                        <>
                            <Text
                                text={`Score: ${score}`}
                                x={20}
                                y={20}
                                style={{
                                    fontSize: 24,
                                    fill: 0x00ff00,
                                    fontWeight: 'bold'
                                }}
                            />
                            <Text
                                text={`High Score: ${highScore}`}
                                x={20}
                                y={50}
                                style={{
                                    fontSize: 18,
                                    fill: 0xffffff
                                }}
                            />
                        </>
                    )}
                </Container>
            </Stage>

            {/* Game Controls */}
            <div style={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap',
                justifyContent: 'center'
            }}>
                {gameState === 'menu' && (
                    <>
                        <button
                            onClick={startGame}
                            style={{
                                padding: '12px 24px',
                                fontSize: '18px',
                                fontWeight: 'bold',
                                backgroundColor: '#00ff00',
                                color: '#000',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                boxShadow: '0 0 20px #00ff00',
                                minWidth: '120px'
                            }}
                        >
                            START GAME
                        </button>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '12px 24px',
                                fontSize: '18px',
                                fontWeight: 'bold',
                                backgroundColor: '#ff0000',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                boxShadow: '0 0 20px #ff0000',
                                minWidth: '120px'
                            }}
                        >
                            CLOSE
                        </button>
                    </>
                )}

                {gameState === 'playing' && (
                    <button
                        onClick={pauseGame}
                        style={{
                            padding: '12px 24px',
                            fontSize: '18px',
                            fontWeight: 'bold',
                            backgroundColor: '#ffff00',
                            color: '#000',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            boxShadow: '0 0 20px #ffff00',
                            minWidth: '120px'
                        }}
                    >
                        PAUSE
                    </button>
                )}

                {gameState === 'paused' && (
                    <>
                        <button
                            onClick={pauseGame}
                            style={{
                                padding: '12px 24px',
                                fontSize: '18px',
                                fontWeight: 'bold',
                                backgroundColor: '#00ff00',
                                color: '#000',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                boxShadow: '0 0 20px #00ff00',
                                minWidth: '120px'
                            }}
                        >
                            RESUME
                        </button>
                        <button
                            onClick={resetGame}
                            style={{
                                padding: '12px 24px',
                                fontSize: '18px',
                                fontWeight: 'bold',
                                backgroundColor: '#ff0000',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                boxShadow: '0 0 20px #ff0000',
                                minWidth: '120px'
                            }}
                        >
                            MENU
                        </button>
                    </>
                )}

                {gameState === 'gameover' && (
                    <>
                        <button
                            onClick={startGame}
                            style={{
                                padding: '12px 24px',
                                fontSize: '18px',
                                fontWeight: 'bold',
                                backgroundColor: '#00ff00',
                                color: '#000',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                boxShadow: '0 0 20px #00ff00',
                                minWidth: '120px'
                            }}
                        >
                            PLAY AGAIN
                        </button>
                        <button
                            onClick={resetGame}
                            style={{
                                padding: '12px 24px',
                                fontSize: '18px',
                                fontWeight: 'bold',
                                backgroundColor: '#ff0000',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                boxShadow: '0 0 20px #ff0000',
                                minWidth: '120px'
                            }}
                        >
                            MENU
                        </button>
                    </>
                )}
            </div>

            {/* Instructions */}
            <div style={{
                position: 'absolute',
                top: 20,
                right: 20,
                color: '#ffffff',
                fontSize: '14px',
                textAlign: 'right',
                maxWidth: '200px'
            }}>
                {gameState === 'playing' && (
                    <div>
                        <div>WASD or Arrow Keys to move</div>
                        <div>Space or Tap to shoot</div>
                        <div>P to pause</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SpaceGame;