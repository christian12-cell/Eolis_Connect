'use client'
import { useEffect } from 'react'

export function SplashHider() {
  useEffect(() => {
    const splash = document.getElementById('eolis-splash')
    if (!splash) return
    splash.style.opacity = '0'
    splash.style.transition = 'opacity 0.4s ease'
    setTimeout(() => splash.remove(), 400)
  }, [])
  return null
}
