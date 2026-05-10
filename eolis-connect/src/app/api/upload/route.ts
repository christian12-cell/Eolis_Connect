import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import path from 'path'
import fs from 'fs/promises'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const ticketId = formData.get('ticketId') as string | null
    const messageId = formData.get('messageId') as string | null

    if (!file) return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Type de fichier non autorisé' }, { status: 400 })
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 10MB)' }, { status: 400 })
    }

    const ext = path.extname(file.name)
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
    const filePath = path.join(UPLOAD_DIR, safeName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    const url = `/uploads/${safeName}`
    const attachment = await db.attachment.create({
      data: {
        ticketId: ticketId!,
        messageId: messageId ?? undefined,
        filename: file.name,
        url,
        size: file.size,
        mimeType: file.type,
      },
    })

    return NextResponse.json({ attachment }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erreur lors de l\'upload' }, { status: 500 })
  }
}
