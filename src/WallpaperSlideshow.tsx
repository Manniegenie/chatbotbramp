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
          top: -100px;
          left: 0;
          width: 100vw;
          height: calc(100vh + 200px);
          height: calc(100dvh + 200px);
          z-index: -10;
          background-image: url(${wallpaper1});
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          background-attachment: fixed;
          filter: brightness(1);
        }
      `}</style>
    </div>
  )
}

export default WallpaperSlideshow
