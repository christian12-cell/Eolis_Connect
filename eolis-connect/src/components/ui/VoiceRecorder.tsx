'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import { getToken } from '@/lib/api-client'

interface Props {
  onResult: (text: string) => void
  className?: string
  disabled?: boolean
}

function getSupportedMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  if (typeof MediaRecorder === 'undefined') return ''
  return types.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
}

export function VoiceRecorder({ onResult, className = '', disabled }: Props) {
  const [supported, setSupported] = useState(false)
  const [state, setState] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mimeTypeRef = useRef('')

  useEffect(() => {
    setSupported(typeof MediaRecorder !== 'undefined' && !!getSupportedMimeType())
  }, [])

  if (!supported) return null

  async function startRecording() {
    if (state !== 'idle' || disabled) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getSupportedMimeType()
      mimeTypeRef.current = mimeType
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      chunksRef.current = []

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }

      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setState('transcribing')
        try {
          const blobType = mimeTypeRef.current || 'audio/webm'
          const ext = blobType.includes('mp4') ? 'mp4' : 'webm'
          const blob = new Blob(chunksRef.current, { type: blobType })
          const fd = new FormData()
          fd.append('file', blob, `recording.${ext}`)
          const token = getToken()
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/whisper/transcribe`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: fd,
          })
          if (res.ok) {
            const data = await res.json()
            if (data.text) onResult(data.text)
          }
        } finally {
          setState('idle')
        }
      }

      mediaRecorderRef.current = mr
      mr.start()
      setState('recording')
    } catch {
      setState('idle')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
  }

  if (state === 'transcribing') {
    return (
      <button disabled type="button" className={`flex items-center justify-center ${className}`}>
        <Loader2 size={18} className="animate-spin text-[#4A8FC4]" />
      </button>
    )
  }

  if (state === 'recording') {
    return (
      <button
        type="button"
        onClick={stopRecording}
        className={`relative flex items-center justify-center ${className}`}
        title="Arrêter l'enregistrement"
      >
        <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />
        <MicOff size={18} className="relative text-red-500" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={startRecording}
      disabled={disabled}
      className={`flex items-center justify-center ${className}`}
      title="Dicter un message"
    >
      <Mic size={18} className="text-gray-400 active:text-[#1B3A5C] transition-colors" />
    </button>
  )
}
