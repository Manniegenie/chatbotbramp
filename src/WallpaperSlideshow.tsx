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
    // Set initial wallpaper
    document.documentElement.style.setProperty('--wallpaper-url', `url(${WALLPAPERS[0]})`)
    
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % WALLPAPERS.length
        // Update CSS variable with new wallpaper
        document.documentElement.style.setProperty('--wallpaper-url', `url(${WALLPAPERS[nextIndex]})`)
        return nextIndex
      })
    }, 15000) // 15 seconds

    return () => clearInterval(interval)
  }, [])

  return null // This component only sets CSS variables, no DOM elements
}

export default WallpaperSlideshow
