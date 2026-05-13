'use client'
import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export function NavigationSplash() {
  const pathname = usePathname()
  const prevPath = useRef<string | null>(null)
  const [visible, setVisible] = useState(false)
  const [fading, setFading] = useState(false)

  const show = () => {
    setVisible(true)
    setFading(false)
    setTimeout(() => {
      setFading(true)
      setTimeout(() => setVisible(false), 400)
    }, 800)
  }

  useEffect(() => {
    if (prevPath.current === null) {
      prevPath.current = pathname
      return
    }
    if (pathname !== prevPath.current) {
      prevPath.current = pathname
      show()
    }
  }, [pathname])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#0f172a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      opacity: fading ? 0 : 1,
      transition: fading ? 'opacity 0.4s ease' : 'none',
    }}>
      <div style={{ color: '#fff', fontSize: '1.875rem', fontWeight: 700, letterSpacing: '.05em', animation: 'splashUp .6s ease forwards' }}>
        Eolis Connect
      </div>
      <div style={{ color: '#93c5fd', fontSize: '.8rem', letterSpacing: '.2em', textTransform: 'uppercase', marginTop: '.4rem', animation: 'splashUp .6s ease .1s both' }}>
        Global Logistics Platform
      </div>
      <div style={{ display: 'flex', gap: '.5rem', marginTop: '1.5rem' }}>
        {[0, 0.2, 0.4].map((delay, i) => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', animation: `sdBounce 1.2s ease-in-out ${delay}s infinite` }} />
        ))}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 160, overflow: 'hidden' }}>
        {[
          { dur: '6s', dir: 'normal', opacity: 1, h: 120, fill: '#1e3a8a', d: 'M0,80 C180,140 360,20 540,80 C720,140 900,20 1080,80 C1260,140 1440,60 1440,80 L1440,160 L0,160 Z' },
          { dur: '9s', dir: 'reverse', opacity: 0.6, h: 100, fill: '#1e40af', d: 'M0,60 C240,120 480,0 720,60 C960,120 1200,20 1440,60 L1440,160 L0,160 Z' },
          { dur: '12s', dir: 'normal', opacity: 0.4, h: 80, fill: '#2563eb', d: 'M0,40 C360,100 720,0 1080,40 C1260,70 1380,30 1440,40 L1440,160 L0,160 Z' },
        ].map((w, i) => (
          <div key={i} style={{ position: 'absolute', bottom: 0, left: 0, width: '200%', display: 'flex', opacity: w.opacity, animation: `swMove ${w.dur} linear infinite ${w.dir}` }}>
            <svg viewBox="0 0 1440 160" preserveAspectRatio="none" style={{ width: '50%', height: w.h, flexShrink: 0 }}>
              <path d={w.d} fill={w.fill} />
            </svg>
            <svg viewBox="0 0 1440 160" preserveAspectRatio="none" style={{ width: '50%', height: w.h, flexShrink: 0 }}>
              <path d={w.d} fill={w.fill} />
            </svg>
          </div>
        ))}
      </div>
    </div>
  )
}
