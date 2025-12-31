// src/components/SpinnerLoader.tsx
import React from 'react'
import './SpinnerLoader.css'

interface SpinnerLoaderProps {
  size?: 'small' | 'medium' | 'large'
  variant?: 'primary' | 'white' | 'accent'
  className?: string
}

export default function SpinnerLoader({ 
  size = 'medium', 
  variant = 'primary',
  className = '' 
}: SpinnerLoaderProps) {
  return (
    <div 
      className={`spinner-loader spinner-loader--${size} spinner-loader--${variant} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <div className="spinner-loader__ring"></div>
    </div>
  )
}

