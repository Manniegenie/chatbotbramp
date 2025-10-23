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
  const [nextIndex, setNextIndex] = useState(1)

  useEffect(() => {
    // Set initial wallpaper
    document.documentElement.style.setProperty('--wallpaper-url', `url(${WALLPAPERS[0]})`)
    document.documentElement.style.setProperty('--wallpaper-next-url', `url(${WALLPAPERS[1]})`)
    
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIdx = (prevIndex + 1) % WALLPAPERS.length
        const nextNextIdx = (nextIdx + 1) % WALLPAPERS.length
        
        // Smooth crossfade transition
        document.documentElement.style.setProperty('--wallpaper-url', `url(${WALLPAPERS[nextIdx]})`)
        document.documentElement.style.setProperty('--wallpaper-next-url', `url(${WALLPAPERS[nextNextIdx]})`)
        
        setNextIndex(nextNextIdx)
        return nextIdx
      })
    }, 15000) // 15 seconds

    return () => clearInterval(interval)
  }, [])

  return null // This component only sets CSS variables, no DOM elements
}

export default WallpaperSlideshow
