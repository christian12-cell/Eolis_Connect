'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Camera, Loader2, RotateCcw, Check, Edit3 } from 'lucide-react'
import jsPDF from 'jspdf'

interface ScannerModalProps {
  onScan: (file: File) => void
  onClose: () => void
  isFr: boolean
}

type Phase = 'camera' | 'preview'

export function ScannerModal({ onScan, onClose, isFr }: ScannerModalProps) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)

  const [phase, setPhase]             = useState<Phase>('camera')
  const [ready, setReady]             = useState(false)
  const [processing, setProcessing]   = useState(false)
  const [error, setError]             = useState(false)
  const [processedUrl, setProcessedUrl] = useState('')
  const [canvasDims, setCanvasDims]   = useState({ w: 0, h: 0 })
  const [fileName, setFileName]       = useState('scan')
  const [editingName, setEditingName] = useState(false)

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = '@keyframes scan-move{0%,100%{top:2%}50%{top:96%}}'
    document.head.appendChild(style)
    startCamera()
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      style.remove()
    }
  }, [])

  // Re-attach stream to video element when returning to camera phase after preview
  useEffect(() => {
    if (phase !== 'camera') return
    const video = videoRef.current
    const stream = streamRef.current
    if (video && stream) {
      video.srcObject = stream
      video.play().catch(() => {})
    }
  }, [phase])

  async function startCamera() {
    setError(false)
    setReady(false)
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      streamRef.current = s
      if (videoRef.current) {
        videoRef.current.srcObject = s
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
          setReady(true)
        }
      }
    } catch {
      setError(true)
    }
  }

  function capture() {
    if (!videoRef.current || !canvasRef.current || processing) return
    setProcessing(true)

    const video  = videoRef.current
    const canvas = canvasRef.current
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)

    const url = canvas.toDataURL('image/jpeg', 0.92)
    setProcessedUrl(url)
    setCanvasDims({ w: canvas.width, h: canvas.height })
    setFileName(`scan_${new Date().toISOString().slice(0, 10)}`)
    setPhase('preview')
    setProcessing(false)
  }

  function retake() {
    setPhase('camera')
    setProcessedUrl('')
    setEditingName(false)
  }

  function confirm() {
    if (!processedUrl || processing) return
    setProcessing(true)
    const { w, h } = canvasDims
    const pdf = new jsPDF({
      orientation: w > h ? 'landscape' : 'portrait',
      unit: 'px',
      format: [w, h],
      hotfixes: ['px_scaling'],
    })
    pdf.addImage(processedUrl, 'JPEG', 0, 0, w, h)
    const blob = pdf.output('blob')
    const safeName = fileName.trim() || 'scan'
    const file = new File([blob], `${safeName}.pdf`, { type: 'application/pdf' })
    streamRef.current?.getTracks().forEach(t => t.stop())
    onScan(file)
  }

  // ── Preview phase ─────────────────────────────────────────────────────────────

  if (phase === 'preview') {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3">
          <p className="text-white font-semibold text-sm">
            {isFr ? 'Aperçu du scan' : 'Scan preview'}
          </p>
          <button onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <X size={18} className="text-white" />
          </button>
        </div>

        {/* Preview image */}
        <div className="flex-1 overflow-hidden flex items-center justify-center bg-[#0a1520] px-2">
          <img
            src={processedUrl}
            alt="scan preview"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
          />
        </div>

        {/* Filename + actions */}
        <div className="flex-shrink-0 bg-[#0D1F33] px-4 py-5 space-y-4">
          {/* Filename editor */}
          <div>
            <p className="text-xs text-blue-300 font-semibold mb-2 uppercase tracking-wide">
              {isFr ? 'Nom du fichier' : 'File name'}
            </p>
            {editingName ? (
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={fileName}
                  onChange={e => setFileName(e.target.value)}
                  autoFocus
                  onBlur={() => setEditingName(false)}
                  onKeyDown={e => { if (e.key === 'Enter') setEditingName(false) }}
                  className="flex-1 px-3 py-2 rounded-xl bg-white/15 text-white text-sm outline-none border border-white/30 focus:border-[#4A8FC4]"
                />
                <span className="text-white/40 text-sm">.pdf</span>
              </div>
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 hover:bg-white/15 text-left">
                <span className="flex-1 text-white text-sm font-mono truncate">{fileName}.pdf</span>
                <Edit3 size={13} className="text-white/50 flex-shrink-0" />
              </button>
            )}
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={retake}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-white/30 text-white text-sm font-semibold active:opacity-70">
              <RotateCcw size={15} /> {isFr ? 'Reprendre' : 'Retake'}
            </button>
            <button onClick={confirm} disabled={processing}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#4A8FC4] text-white text-sm font-bold disabled:opacity-50 active:opacity-80">
              {processing
                ? <Loader2 size={16} className="animate-spin" />
                : <Check size={16} />}
              {isFr ? 'Utiliser ce scan' : 'Use this scan'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Camera phase ──────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3">
        <p className="text-white font-semibold text-sm">
          {isFr ? 'Scanner un document' : 'Scan a document'}
        </p>
        <button onClick={onClose}
          className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center active:bg-white/30">
          <X size={18} className="text-white" />
        </button>
      </div>

      {/* Camera area */}
      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted
          className="absolute inset-0 w-full h-full object-cover" />

        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <Loader2 size={36} className="text-white animate-spin" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0D1F33] gap-4 px-8 text-center">
            <p className="text-white font-semibold">
              {isFr ? 'Impossible d\'accéder à la caméra' : 'Unable to access camera'}
            </p>
            <p className="text-blue-200 text-sm">
              {isFr ? 'Vérifiez les permissions dans les paramètres.' : 'Check camera permissions in device settings.'}
            </p>
            <button onClick={startCamera}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/20 text-white text-sm font-semibold">
              <RotateCcw size={14} /> {isFr ? 'Réessayer' : 'Retry'}
            </button>
          </div>
        )}

        {/* Guide overlay */}
        {ready && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute" style={{
              top: '7%', left: '5%', right: '5%', bottom: '16%',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.58)',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.25)',
            }}>
              {/* Corner markers */}
              <div className="absolute -top-px -left-px w-8 h-8"
                style={{ borderTop: '3px solid #4A8FC4', borderLeft: '3px solid #4A8FC4', borderRadius: '8px 0 0 0' }} />
              <div className="absolute -top-px -right-px w-8 h-8"
                style={{ borderTop: '3px solid #4A8FC4', borderRight: '3px solid #4A8FC4', borderRadius: '0 8px 0 0' }} />
              <div className="absolute -bottom-px -left-px w-8 h-8"
                style={{ borderBottom: '3px solid #4A8FC4', borderLeft: '3px solid #4A8FC4', borderRadius: '0 0 0 8px' }} />
              <div className="absolute -bottom-px -right-px w-8 h-8"
                style={{ borderBottom: '3px solid #4A8FC4', borderRight: '3px solid #4A8FC4', borderRadius: '0 0 8px 0' }} />
              {/* Scan line */}
              <div className="absolute left-0 right-0" style={{
                height: 2,
                background: 'linear-gradient(90deg, transparent 0%, #4A8FC4 30%, #7EC8F4 50%, #4A8FC4 70%, transparent 100%)',
                animation: 'scan-move 2.5s ease-in-out infinite',
                borderRadius: 1,
              }} />
            </div>
            {/* Instruction */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center">
              <div className="bg-black/65 rounded-full px-4 py-1.5">
                <p className="text-white text-xs font-medium">
                  {isFr ? 'Cadrez le document puis appuyez sur le bouton' : 'Frame the document then press the button'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Capture button */}
      <div className="flex-shrink-0 flex items-center justify-center py-7 bg-black">
        <button onClick={capture} disabled={!ready || processing}
          className="relative flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
          style={{ width: 76, height: 76, borderRadius: '50%', background: 'white', boxShadow: '0 0 0 5px rgba(255,255,255,0.25)' }}>
          {processing
            ? <Loader2 size={30} className="text-[#1B3A5C] animate-spin" />
            : <Camera size={30} className="text-[#1B3A5C]" />}
        </button>
      </div>
    </div>
  )
}
