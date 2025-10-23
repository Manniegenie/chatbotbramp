import React, { useState, useEffect } from 'react'

// Import wallpaper images
import wallpaper1 from './assets/wallpaper1.jpg'
import wallpaper2 from './assets/wallpaper2.jpg'
import wallpaper3 from './assets/wallpaper3.jpg'
import wallpaper4 from './assets/wallpaper4.jpg'
import wallpaper5 from './assets/wallpaper5.jpg'

const WALLPAPERS = [
  wallpaper1,
  wallpaper2,
  wallpaper3,
  wallpaper4,
  wallpaper5
]

interface WallpaperSlideshowProps {
  className?: string
}

const WallpaperSlideshow: React.FC<WallpaperSlideshowProps> = ({ className = '' }) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true)
      
      // Start transition
      setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % WALLPAPERS.length)
        setIsTransitioning(false)
      }, 1500) // Half of transition duration
    }, 15000) // 15 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <div className={`wallpaper-slideshow ${className}`}>
      <style>{`
        .wallpaper-slideshow {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: -1;
          overflow: hidden;
        }

        .wallpaper-slide {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          opacity: 0;
          transition: opacity 3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .wallpaper-slide.active {
          opacity: 1;
        }

        .wallpaper-slide.transitioning {
          opacity: 0.5;
        }
      `}</style>
      {WALLPAPERS.map((wallpaper, index) => (
        <div
          key={index}
          className={`wallpaper-slide ${
            index === currentIndex ? 'active' : ''
          } ${
            isTransitioning && index === (currentIndex + 1) % WALLPAPERS.length ? 'transitioning' : ''
          }`}
          style={{
            backgroundImage: `url(${wallpaper})`
          }}
        />
      ))}
    </div>
  )
}

export default WallpaperSlideshow
