'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, FileImage, File } from 'lucide-react'
import { getToken, apiUrl } from '@/lib/api-client'

interface Attachment {
  id: string
  filename: string
  size?: number | null
  mimeType?: string | null
}

interface DocCardProps {
  attachment: Attachment
  onDownload: () => void
  size?: 'sm' | 'md'
}

function fileIcon(mime?: string | null) {
  if (!mime) return <File size={22} className="text-gray-400" />
  if (mime.startsWith('image/')) return <FileImage size={22} className="text-blue-400" />
  return <FileText size={22} className="text-gray-400" />
}

function fileExt(filename: string) {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()!.toUpperCase() : 'FILE'
}

export function DocCard({ attachment, onDownload, size = 'md' }: DocCardProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const isImage = attachment.mimeType?.startsWith('image/')

  useEffect(() => {
    if (!isImage) return
    let url: string | null = null
    const token = getToken()
    fetch(apiUrl(`/api/attachments/${attachment.id}/download`), {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    })
      .then(r => r.blob())
      .then(blob => {
        url = URL.createObjectURL(blob)
        setImgSrc(url)
      })
      .catch(() => {})
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [attachment.id, isImage])

  const w = size === 'sm' ? 'w-20' : 'w-24'
  const h = size === 'sm' ? 'h-24' : 'h-28'

  return (
    <button
      onClick={onDownload}
      title={attachment.filename}
      className={`group relative ${w} ${h} rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-[#4A8FC4] transition-all flex flex-col text-left`}
    >
      {/* Preview area */}
      <div className="flex-1 bg-gray-50 flex items-center justify-center overflow-hidden relative">
        {imgSrc ? (
          <img src={imgSrc} alt={attachment.filename} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 px-1">
            {fileIcon(attachment.mimeType)}
            <span className="text-[8px] font-bold tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              {fileExt(attachment.filename)}
            </span>
          </div>
        )}
        {/* Download overlay on hover */}
        <div className="absolute inset-0 bg-[#1B3A5C]/0 group-hover:bg-[#1B3A5C]/20 transition-all flex items-center justify-center">
          <Download size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
        </div>
      </div>

      {/* Footer */}
      <div className="px-2 py-1.5 bg-white border-t border-gray-100 flex-shrink-0">
        <p className="text-[9px] font-semibold text-gray-700 truncate leading-tight">{attachment.filename}</p>
        {attachment.size != null && (
          <p className="text-[8px] text-gray-400 mt-0.5">
            {attachment.size < 1024 * 1024
              ? `${(attachment.size / 1024).toFixed(0)} KB`
              : `${(attachment.size / 1024 / 1024).toFixed(1)} MB`}
          </p>
        )}
      </div>
    </button>
  )
}

interface DocCardRowProps {
  attachments: Attachment[]
  onDownload: (att: Attachment) => void
  size?: 'sm' | 'md'
}

export function DocCardRow({ attachments, onDownload, size = 'md' }: DocCardRowProps) {
  if (!attachments.length) return null
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map(att => (
        <DocCard key={att.id} attachment={att} onDownload={() => onDownload(att)} size={size} />
      ))}
    </div>
  )
}
