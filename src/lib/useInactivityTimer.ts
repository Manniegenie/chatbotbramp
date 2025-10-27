import { useEffect, useRef, useCallback } from 'react'

interface UseInactivityTimerOptions {
  timeout: number // in milliseconds
  onInactive: () => void
  events?: string[]
}

export function useInactivityTimer({ 
  timeout, 
  onInactive, 
  events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'] 
}: UseInactivityTimerOptions) {
  const timeoutRef = useRef<number | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now()
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current
      if (timeSinceLastActivity >= timeout) {
        onInactive()
      }
    }, timeout)
  }, [timeout, onInactive])

  useEffect(() => {
    // Set up event listeners
    events.forEach(event => {
      document.addEventListener(event, resetTimer, true)
    })

    // Start the timer
    resetTimer()

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimer, true)
      })
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [events, resetTimer])

  return { resetTimer }
}
