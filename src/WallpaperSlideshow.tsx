import React from 'react'
import wallpaper1 from './assets/wallpaper1.jpg'

interface WallpaperSlideshowProps {
  className?: string
}

const WallpaperSlideshow: React.FC<WallpaperSlideshowProps> = ({ className = '' }) => {
  return (
    <div className={`wallpaper-background ${className}`}>
      <style>{`
        .wallpaper-background {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: -10;
          background-image: url(${wallpaper1});
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          background-attachment: fixed;
        }
      `}</style>
    </div>
  )
}

export default WallpaperSlideshow
