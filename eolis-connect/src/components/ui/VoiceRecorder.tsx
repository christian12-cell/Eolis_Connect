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

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

const BAR_COUNT        = 22
const MAX_SECONDS      = 600        // 10 minutes
const SILENCE_THRESH   = 6          // amplitude avg < 6/255 = silence
const SILENCE_WARN_MS  = 8_000      // show warning after 8s of silence

export function VoiceRecorder({
  onResult, ticketId, onCostUpdate,
  className = '', size = 'md', label, locale = 'fr',
  disabledReason, onDisabledClick,
}: Props) {
  const [supported, setSupported]       = useState(false)
  const [recState, setRecState]         = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const [bars, setBars]                 = useState<number[]>(Array(BAR_COUNT).fill(3))
  const [elapsedSeconds, setElapsedSec] = useState(0)
  const [silentWarning, setSilentWarn]  = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const mimeTypeRef      = useRef('')
  const analyserRef      = useRef<AnalyserNode | null>(null)
  const audioCtxRef      = useRef<AudioContext | null>(null)
  const animFrameRef     = useRef<number>(0)
  const wakeLockRef      = useRef<WakeLockSentinel | null>(null)
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoStopRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const silentSinceRef   = useRef<number | null>(null)

  useEffect(() => {
    setSupported(typeof MediaRecorder !== 'undefined' && !!getSupportedMimeType())
  }, [])

  if (!supported) return null

  const iconSize = size === 'sm' ? 13 : 18
  const isFr     = locale === 'fr'

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
        title={isFr ? 'Crédits insuffisants' : 'Insufficient credits'}>
        <LockKeyhole size={iconSize} />
        {label && <span className="text-xs font-medium">{label}</span>}
      </button>
    )
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function clearTimers() {
    if (timerRef.current)    { clearInterval(timerRef.current);  timerRef.current = null }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null }
  }

  function startWaveform(stream: MediaStream) {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new Ctx() as AudioContext
    audioCtxRef.current = ctx
    const source   = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 64
    source.connect(analyser)
    analyserRef.current = analyser

    function tick() {
      if (!analyserRef.current) return
      const data = new Uint8Array(analyserRef.current.frequencyBinCount)
      analyserRef.current.getByteFrequencyData(data)

      // Silence detection
      const avg = data.reduce((a, b) => a + b, 0) / data.length
      if (avg < SILENCE_THRESH) {
        if (silentSinceRef.current === null) silentSinceRef.current = Date.now()
        else if (Date.now() - silentSinceRef.current > SILENCE_WARN_MS) setSilentWarn(true)
      } else {
        silentSinceRef.current = null
        setSilentWarn(false)
      }

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
    silentSinceRef.current = null
    setSilentWarn(false)
  }

  async function acquireWakeLock() {
    try {
      if ('wakeLock' in navigator)
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
    } catch {}
  }

  function releaseWakeLock() {
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }

  // ── Recording ────────────────────────────────────────────────────────────────

  async function startRecording() {
    if (recState !== 'idle') return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      await acquireWakeLock()

      setElapsedSec(0)
      setSilentWarn(false)
      silentSinceRef.current = null

      // Timer : +1 chaque seconde
      timerRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000)

      // Auto-stop à 10 minutes
      autoStopRef.current = setTimeout(() => {
        mediaRecorderRef.current?.stop()
        mediaRecorderRef.current = null
        releaseWakeLock()
      }, MAX_SECONDS * 1000)

      const mimeType = getSupportedMimeType()
      mimeTypeRef.current = mimeType
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        stopWaveform()
        releaseWakeLock()
        clearTimers()
        setRecState('transcribing')
        try {
          const blobType = mimeTypeRef.current || 'audio/webm'
          const ext      = blobType.includes('mp4') ? 'mp4' : 'webm'
          const blob     = new Blob(chunksRef.current, { type: blobType })
          const fd       = new FormData()
          fd.append('file', blob, `recording.${ext}`)
          const token = getToken()
          const qs    = ticketId ? `?ticket_id=${encodeURIComponent(ticketId)}` : ''
          const res   = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/whisper/transcribe${qs}`, {
            method:  'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body:    fd,
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
      clearTimers()
      setRecState('idle')
    }
  }

  function stopRecording() {
    clearTimers()
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    releaseWakeLock()
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (recState === 'transcribing') {
    return (
      <div className="flex flex-col gap-0.5">
        <button disabled type="button" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 border border-gray-200 opacity-70">
          <Loader2 size={13} className="animate-spin text-gray-500" />
          <span className="text-xs text-gray-500">{isFr ? 'Transcription...' : 'Transcribing...'}</span>
        </button>
      </div>
    )
  }

  if (recState === 'recording') {
    const remaining = MAX_SECONDS - elapsedSeconds
    return (
      <div className="flex flex-col gap-1">
        <button type="button" onClick={stopRecording}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 active:bg-red-100 transition-colors">
          {/* Chrono */}
          <span className="text-xs font-mono font-bold text-red-600 flex-shrink-0 w-9 tabular-nums">
            {formatTime(elapsedSeconds)}
          </span>
          {/* Waveform */}
          <div className="flex items-center gap-[2px]" style={{ height: '20px' }}>
            {bars.map((h, i) => (
              <div key={i} className="w-[2px] bg-red-500 rounded-full"
                style={{ height: `${Math.min(h, 20)}px`, transition: 'height 0.05s linear' }} />
            ))}
          </div>
          {/* Stop */}
          <div className="flex items-center gap-1 text-red-500 flex-shrink-0">
            <Square size={12} className="fill-red-500" />
            <span className="text-xs font-bold">{isFr ? 'Arrêter' : 'Stop'}</span>
          </div>
        </button>

        {/* Silence warning */}
        {silentWarning && (
          <p className="text-[10px] text-amber-600 font-medium">
            {isFr ? '⚠️ Aucun son détecté — parlez ou arrêtez pour éviter des crédits inutiles.' : '⚠️ No sound detected — speak or stop to avoid wasting credits.'}
          </p>
        )}

        {/* Max duration info */}
        <p className="text-[10px] text-gray-400">
          {isFr
            ? `Arrêt automatique dans ${formatTime(remaining)} · max 10 min`
            : `Auto-stop in ${formatTime(remaining)} · max 10 min`}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button type="button" onClick={startRecording}
        className={`flex items-center gap-1.5 ${className}`}
        title={isFr ? 'Dicter un message (max 10 min)' : 'Dictate a message (max 10 min)'}>
        <Mic size={iconSize} className="flex-shrink-0" />
        {label && <span className="text-xs font-medium">{label}</span>}
      </button>
    </div>
  )
}
