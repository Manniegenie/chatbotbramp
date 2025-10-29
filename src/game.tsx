import React, { useState, useEffect, useRef, useCallback } from 'react'

interface Position {
    x: number
    y: number
}

interface Bullet extends Position {
    id: UPCounter
}

interface Enemy extends Position {
    id: UPCounter
    speed: number
}

type UPCounter = number

export default function SpaceGame({ onClose }: { onClose: () => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameover'>('menu')
    const [score, setScore] = useState(0)
    const [highScore, setHighScore] = useState(() => {
        const saved = localStorage.getItem('spaceGameHighScore')
        return saved ? parseInt(saved, 10) : 0
    })

    const playerRef = useRef<Position>({ x: 400, y: 550 })
    const bulletsRef = useRef<Bullet[]>([])
    const enemiesRef = useRef<Enemy[]>([])
    const keysRef = useRef<Set<string>>(new Set())
    const animationFrameRef = useRef<number>()
    const lastEnemySpawnRef = useRef<number>(0)
    const enemyIdCounterRef = useRef<UPCounter>(0)
    const bulletIdCounterRef = useRef<UPCounter>(0)

    const PLAYER_SIZE = 40
    const BULLET_SIZE = 5
    const ENEMY_SIZE = 30
    const CANVAS_WIDTH = 800
    const CANVAS_HEIGHT = 600
    const PLAYER_SPEED = 5
    const BULLET_SPEED = 8
    const ENEMY_SPAWN_RATE = 60 // frames

    // Handle keyboard input
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            keysRef.current.add(e.key.toLowerCase())
            if (e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault()
                if (gameState === 'playing') {
                    shootBullet()
                }
            }
            if (e.key === 'Escape') {
                if (gameState === 'playing') {
                    setGameState('paused')
                } else if (gameState === 'paused') {
                    setGameState('playing')
                }
            }
        }

        const handleKeyUp = (e: KeyboardEvent) => {
            keysRef.current.delete(e.key.toLowerCase())
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [gameState])

    const shootBullet = useCallback(() => {
        const player = playerRef.current
        bulletsRef.current.push({
            id: bulletIdCounterRef.current++,
            x: player.x,
            y: player.y - PLAYER_SIZE / 2
        })
    }, [])

    const updateGame = useCallback(() => {
        if (gameState !== 'playing') return

        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const player = playerRef.current
        const keys = keysRef.current

        // Move player
        if (keys.has('a') || keys.has('arrowleft')) {
            player.x = Math.max(PLAYER_SIZE / 2, player.x - PLAYER_SPEED)
        }
        if (keys.has('d') || keys.has('arrowright')) {
            player.x = Math.min(CANVAS_WIDTH - PLAYER_SIZE / 2, player.x + PLAYER_SPEED)
        }

        // Update bullets
        bulletsRef.current = bulletsRef.current
            .map(bullet => ({ ...bullet, y: bullet.y - BULLET_SPEED }))
            .filter(bullet => bullet.y > -BULLET_SIZE)

        // Spawn enemies
        lastEnemySpawnRef.current++
        if (lastEnemySpawnRef.current >= ENEMY_SPAWN_RATE) {
            lastEnemySpawnRef.current = 0
            const speed = 2 + Math.random() * 2 + Math.floor(score / 500) * 0.5
            enemiesRef.current.push({
                id: enemyIdCounterRef.current++,
                x: Math.random() * (CANVAS_WIDTH - ENEMY_SIZE) + ENEMY_SIZE / 2,
                y: -ENEMY_SIZE,
                speed
            })
        }

        // Update enemies
        enemiesRef.current = enemiesRef.current.map(enemy => ({
            ...enemy,
            y: enemy.y + enemy.speed
        }))

        // Collision: bullets vs enemies
        bulletsRef.current = bulletsRef.current.filter(bullet => {
            const hitEnemy = enemiesRef.current.findIndex(enemy => {
                const dx = bullet.x - enemy.x
                const dy = bullet.y - enemy.y
                const distance = Math.sqrt(dx * dx + dy * dy)
                return distance < ENEMY_SIZE / 2 + BULLET_SIZE
            })

            if (hitEnemy !== -1) {
                enemiesRef.current.splice(hitEnemy, 1)
                setScore(prev => {
                    const newScore = prev + 10
                    if (newScore > highScore) {
                        setHighScore(newScore)
                        localStorage.setItem('spaceGameHighScore', newScore.toString())
                    }
                    return newScore
                })
                return false
            }
            return true
        })

        // Collision: player vs enemies
        const playerHit = enemiesRef.current.some(enemy => {
            const dx = player.x - enemy.x
            const dy = player.y - enemy.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            return distance < PLAYER_SIZE / 2 + ENEMY_SIZE / 2
        })

        if (playerHit || enemiesRef.current.some(e => e.y > CANVAS_HEIGHT + ENEMY_SIZE)) {
            setGameState('gameover')
            return
        }

        // Remove enemies that passed the player (optional: could be a penalty)
        enemiesRef.current = enemiesRef.current.filter(enemy => enemy.y < CANVAS_HEIGHT + ENEMY_SIZE)
    }, [gameState, highScore])

    const draw = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Clear canvas
        ctx.fillStyle = '#000011'
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

        // Draw stars (background)
        ctx.fillStyle = '#ffffff'
        for (let i = 0; i < 50; i++) {
            const x = (i * 73) % CANVAS_WIDTH
            const y = ((Date.now() / 10 + i * 37) % CANVAS_HEIGHT)
            ctx.fillRect(x, y, 2, 2)
        }

        if (gameState === 'menu') updateGame()
        if (gameState === 'playing') {
            updateGame()

            // Draw player
            const player = playerRef.current
            ctx.fillStyle = '#00ff00'
            ctx.beginPath()
            ctx.moveTo(player.x, player.y - PLAYER_SIZE / 2)
            ctx.lineTo(player.x - PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2)
            ctx.lineTo(player.x + PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2)
            ctx.closePath()
            ctx.fill()

            // Draw bullets
            ctx.fillStyle = '#ffff00'
            bulletsRef.current.forEach(bullet => {
                ctx.beginPath()
                ctx.arc(bullet.x, bullet.y, BULLET_SIZE, 0, Math.PI * 2)
                ctx.fill()
            })

            // Draw enemies
            ctx.fillStyle = '#ff0000'
            enemiesRef.current.forEach(enemy => {
                ctx.beginPath()
                ctx.arc(enemy.x, enemy.y, ENEMY_SIZE / 2, 0, Math.PI * 2)
                ctx.fill()
            })

            // Draw score
            ctx.fillStyle = '#ffffff'
            ctx.font = '20px monospace'
            ctx.fillText(`Score: ${score}`, 10, 30)
            ctx.fillText(`High Score: ${highScore}`, 10, 55)
        }

        if (gameState === 'paused') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
            ctx.fillStyle = '#ffffff'
            ctx.font = '40px monospace'
            ctx.textAlign = 'center'
            ctx.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
            ctx.font = '20px monospace'
            ctx.fillText('Press ESC to resume', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40)
        }

        if (gameState === 'gameover') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
            ctx.fillStyle = '#ffffff'
            ctx.font = '40px monospace'
            ctx.textAlign = 'center'
            ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40)
            ctx.font = '24px monospace'
            ctx.fillText(`Final Score: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
            ctx.font = '18px monospace'
            ctx.fillText(`High Score: ${highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40)
        }

        if (gameState !== 'gameover') {
            animationFrameRef.current = requestAnimationFrame(draw)
        }
    }, [gameState, score, highScore, updateGame])

    useEffect(() => {
        if (gameState === 'playing' || gameState === 'menu') {
            draw()
        }
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }
    }, [gameState, draw])

    const startGame = () => {
        // Reset game state
        playerRef.current = { x: CANVAS_WIDTH / 2, y: 550 }
        bulletsRef.current = []
        enemiesRef.current = []
        keysRef.current.clear()
        lastEnemySpawnRef.current = 0
        setScore(0)
        setGameState('playing')
    }

    const restartGame = () => {
        startGame()
    }

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0, 0, 0, 0.9)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '20px',
                boxSizing: 'border-box'
            }}
        >
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '20px',
                        right: '20px',
                        background: '#ff0000',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 20px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        fontWeight: 'bold'
                    }}
                >
                    ✕ Close
                </button>

                {gameState === 'menu' && (
                    <div style={{ textAlign: 'center', color: '#fff' }}>
                        <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>SPACE GAME</h1>
                        <p style={{ fontSize: '18px', marginBottom: '30px' }}>
                            Use A/D or Arrow Keys to move, SPACE to shoot
                        </p>
                        <button
                            onClick={startGame}
                            style={{
                                background: '#00ff00',
                                color: '#000',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '15px 40px',
                                cursor: 'pointer',
                                fontSize: '20px',
                                fontWeight: 'bold'
                            }}
                        >
                            START GAME
                        </button>
                    </div>
                )}

                {gameState === 'gameover' && (
                    <div style={{ textAlign: 'center', color: '#fff' }}>
                        <button
                            onClick={restartGame}
                            style={{
                                background: '#00ff00',
                                color: '#000',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '15px 40px',
                                cursor: 'pointer',
                                fontSize: '20px',
                                fontWeight: 'bold',
                                marginTop: '20px'
                            }}
                        >
                            PLAY AGAIN
                        </button>
                    </div>
                )}
            </div>

            <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                style={{
                    border: '2px solid #00ff00',
                    borderRadius: '8px',
                    maxWidth: '100%',
                    maxHeight: 'calc(100vh - 200px)',
                    width: 'auto',
                    height: 'auto',
                    touchAction: 'none'
                }}
            />
        </div>
    )
}

