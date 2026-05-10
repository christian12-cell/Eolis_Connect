import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json()
    if (!token || !password || password.length < 8) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    }

    const reset = await db.passwordReset.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!reset || reset.used || reset.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    await db.user.update({ where: { id: reset.userId }, data: { passwordHash } })
    await db.passwordReset.update({ where: { id: reset.id }, data: { used: true } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
