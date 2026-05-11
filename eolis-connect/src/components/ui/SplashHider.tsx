'use client'
import { useEffect } from 'react'

export function SplashHider() {
  useEffect(() => {
    const splash = document.getElementById('eolis-splash')
    if (!splash) return
    // Wait for page to paint before fading out
    setTimeout(() => {
      splash.style.opacity = '0'
      splash.style.transition = 'opacity 0.4s ease'
      setTimeout(() => splash.remove(), 400)
    }, 1500)
  }, [])
  return null
}
