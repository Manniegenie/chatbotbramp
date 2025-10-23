import React, { useState, useEffect } from 'react'

// Import wallpaper images
import wallpaper1 from './assets/wallpaper1.jpeg'
import wallpaper2 from './assets/wallpaper2.jpeg'
import wallpaper3 from './assets/wallpaper3.jpeg'
import wallpaper4 from './assets/wallpaper4.jpeg'
import wallpaper5 from './assets/wallpaper5.jpeg'

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

  useEffect(() => {
    // Start with wallpaper1.jpg (index 0) immediately
    setCurrentIndex(0)
    
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % WALLPAPERS.length)
    }, 15000) // 15 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <>
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
          opacity: 0;
          transition: opacity 2s ease-in-out;
        }

        .wallpaper-slide.active {
          opacity: 1;
        }

        /* Ensure slideshow is behind all content */
        .wallpaper-slideshow::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(18, 18, 26, 0.3);
          z-index: 1;
        }
      `}</style>
      <div className={`wallpaper-slideshow ${className}`}>
        {WALLPAPERS.map((wallpaper, index) => (
          <div
            key={index}
            className={`wallpaper-slide ${index === currentIndex ? 'active' : ''}`}
            style={{
              backgroundImage: `url(${wallpaper})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          />
        ))}
      </div>
    </>
  )
}

export default WallpaperSlideshow
