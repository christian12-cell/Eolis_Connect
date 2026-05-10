import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const user = session.user as any
  const profile = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, status: true, language: true, createdAt: true },
  })

  return NextResponse.json({ user: profile })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const user = session.user as any
  const body = await req.json()

  const profileSchema = z.object({
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    phone: z.string().min(8).optional(),
    language: z.enum(['fr', 'en']).optional(),
  })

  const passwordSchema = z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(8),
  })

  if (body.currentPassword) {
    const data = passwordSchema.parse(body)
    const dbUser = await db.user.findUnique({ where: { id: user.id } })
    if (!dbUser) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    const valid = await bcrypt.compare(data.currentPassword, dbUser.passwordHash)
    if (!valid) return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 400 })
    const passwordHash = await bcrypt.hash(data.newPassword, 12)
    await db.user.update({ where: { id: user.id }, data: { passwordHash } })
    return NextResponse.json({ success: true })
  }

  const data = profileSchema.parse(body)
  const updated = await db.user.update({
    where: { id: user.id },
    data,
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, language: true },
  })

  return NextResponse.json({ user: updated })
}
