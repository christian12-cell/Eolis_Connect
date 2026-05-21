'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, Loader2, WifiOff, LockKeyhole, Square } from 'lucide-react'
import { getToken } from '@/lib/api-client'

interface Props {
  onResult: (text: string) => void
  ticketId?: string
  onCostUpdate?: (creditsUsed: number, creditsRemaining: number) => void
  className?: string
  size?: 'sm' | 'md'
  label?: string
  locale?: string
  disabledReason?: 'offline' | 'no_credits' | null
  onDisabledClick?: () => void
}

function getSupportedMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  if (typeof MediaRecorder === 'undefined') return ''
  return types.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
}

const BAR_COUNT = 22

export function VoiceRecorder({
  onResult, ticketId, onCostUpdate,
  className = '', size = 'md', label, locale = 'fr',
  disabledReason, onDisabledClick,
}: Props) {
  const [supported, setSupported] = useState(false)
  const [recState, setRecState]   = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const [bars, setBars]           = useState<number[]>(Array(BAR_COUNT).fill(3))

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const mimeTypeRef      = useRef('')
  const analyserRef      = useRef<AnalyserNode | null>(null)
  const audioCtxRef      = useRef<AudioContext | null>(null)
  const animFrameRef     = useRef<number>(0)
  const wakeLockRef      = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    setSupported(typeof MediaRecorder !== 'undefined' && !!getSupportedMimeType())
  }, [])

  if (!supported) return null

  const iconSize = size === 'sm' ? 13 : 18

  // ── Disabled states ─────────────────────────────────────────────────────────

  if (disabledReason === 'offline') {
    return (
      <div className={`flex items-center gap-1.5 opacity-40 cursor-not-allowed select-none ${className}`}>
        <WifiOff size={iconSize} />
        {label && <span className="text-xs font-medium line-through">{label}</span>}
      </div>
    )
  }

  if (disabledReason === 'no_credits') {
    return (
      <button type="button" onClick={onDisabledClick}
        className={`flex items-center gap-1.5 opacity-60 ${className}`}
        title="Crédits insuffisants">
        <LockKeyhole size={iconSize} />
        {label && <span className="text-xs font-medium">{label}</span>}
      </button>
    )
  }

  // ── Waveform helpers ─────────────────────────────────────────────────────────

  function startWaveform(stream: MediaStream) {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new Ctx() as AudioContext
    audioCtxRef.current = ctx
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 64
    source.connect(analyser)
    analyserRef.current = analyser
    function tick() {
      if (!analyserRef.current) return
      const data = new Uint8Array(analyserRef.current.frequencyBinCount)
      analyserRef.current.getByteFrequencyData(data)
      const step = Math.max(1, Math.floor(data.length / BAR_COUNT))
      setBars(Array.from({ length: BAR_COUNT }, (_, i) => {
        const v = data[Math.min(i * step, data.length - 1)] / 255
        return Math.max(3, Math.round(v * 26))
      }))
      animFrameRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  function stopWaveform() {
    cancelAnimationFrame(animFrameRef.current)
    analyserRef.current = null
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    setBars(Array(BAR_COUNT).fill(3))
  }

  // ── Recording ────────────────────────────────────────────────────────────────

  async function acquireWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
      }
    } catch {}
  }

  function releaseWakeLock() {
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }

  async function startRecording() {
    if (recState !== 'idle') return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      await acquireWakeLock()
      const mimeType = getSupportedMimeType()
      mimeTypeRef.current = mimeType
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        stopWaveform()
        releaseWakeLock()
        setRecState('transcribing')
        try {
          const blobType = mimeTypeRef.current || 'audio/webm'
          const ext = blobType.includes('mp4') ? 'mp4' : 'webm'
          const blob = new Blob(chunksRef.current, { type: blobType })
          const fd = new FormData()
          fd.append('file', blob, `recording.${ext}`)
          const token = getToken()
          const qs = ticketId ? `?ticket_id=${encodeURIComponent(ticketId)}` : ''
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/whisper/transcribe${qs}`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: fd,
          })
          if (res.ok) {
            const data = await res.json()
            if (data.text) onResult(data.text)
            if (onCostUpdate) onCostUpdate(data.creditsUsed ?? 0, data.creditsRemaining ?? 0)
          }
        } finally {
          setRecState('idle')
        }
      }
      mediaRecorderRef.current = mr
      mr.start()
      setRecState('recording')
      startWaveform(stream)
    } catch {
      setRecState('idle')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    releaseWakeLock()
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (recState === 'transcribing') {
    return (
      <button disabled type="button" className={`flex items-center gap-1.5 ${className}`}>
        <Loader2 size={iconSize} className="animate-spin" />
        {label && <span className="text-xs">...</span>}
      </button>
    )
  }

  if (recState === 'recording') {
    return (
      <button type="button" onClick={stopRecording}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 active:bg-red-100 transition-colors">
        {/* Waveform */}
        <div className="flex items-center gap-[2px]" style={{ height: '20px' }}>
          {bars.map((h, i) => (
            <div key={i} className="w-[2px] bg-red-500 rounded-full"
              style={{ height: `${Math.min(h, 20)}px`, transition: 'height 0.05s linear' }} />
          ))}
        </div>
        {/* Stop icon + label toujours visibles */}
        <div className="flex items-center gap-1 text-red-500 flex-shrink-0">
          <Square size={12} className="fill-red-500" />
          <span className="text-xs font-bold">{locale === 'fr' ? 'Arrêter' : 'Stop'}</span>
        </div>
      </button>
    )
  }

  return (
    <button type="button" onClick={startRecording}
      className={`flex items-center gap-1.5 ${className}`}
      title="Dicter un message">
      <Mic size={iconSize} className="flex-shrink-0" />
      {label && <span className="text-xs font-medium">{label}</span>}
    </button>
  )
}
