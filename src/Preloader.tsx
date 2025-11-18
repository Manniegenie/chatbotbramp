import React, { useMemo } from 'react'

type Star = {
    left: number
    top: number
    delay: number
    duration: number
    size: number
}

export default function Preloader() {
    const stars = useMemo<Star[]>(
        () =>
            Array.from({ length: 20 }, () => ({
                left: Math.random() * 100,
                top: Math.random() * 100,
                delay: Math.random() * 2,
                duration: 3 + Math.random() * 2,
                size: 2 + Math.random() * 3
            })),
        []
    )

    return (
        <div className="preloader" role="status" aria-live="polite">
            <div className="preloader__stars" aria-hidden="true">
                {stars.map((star, idx) => (
                    <span
                        key={`star-${idx}`}
                        className="preloader__star"
                        style={{
                            left: `${star.left}%`,
                            top: `${star.top}%`,
                            animationDelay: `${star.delay}s`,
                            animationDuration: `${star.duration}s`,
                            width: `${star.size}px`,
                            height: `${star.size}px`
                        }}
                    />
                ))}
            </div>
            <div className="preloader__content">
                <div className="preloader__spinner" />
                <p className="preloader__text">Preparing Bramp experience...</p>
            </div>
        </div>
    )
}

