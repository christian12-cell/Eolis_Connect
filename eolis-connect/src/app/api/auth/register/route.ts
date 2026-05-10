import { NextRequest, NextResponse } from 'next/server'
import { hashPassword } from '@/lib/password'
import { db } from '@/lib/db'
import { sendWelcomeEmail } from '@/lib/email'
import { z } from 'zod'

const schema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  password: z.string().min(8),
  language: z.enum(['fr', 'en']).default('fr'),
})

function generateUsername(firstName: string, lastName: string): string {
  const clean = (s: string) =>
    s.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '')
  const first = clean(firstName)
  const last = clean(lastName)
  const formattedFirst = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
  const formattedLast = last.toUpperCase()
  return `${formattedFirst}.${formattedLast}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = schema.parse(body)

    const existing = await db.user.findUnique({ where: { email: data.email } })
    if (existing) {
      return NextResponse.json({ error: 'Email déjà utilisé' }, { status: 409 })
    }

    // Génère un username unique
    let username = generateUsername(data.firstName, data.lastName)
    const taken = await db.user.findFirst({ where: { username } })
    if (taken) {
      username = `${username}${Math.floor(Math.random() * 900) + 100}`
    }

    const passwordHash = await hashPassword(data.password)
    const user = await db.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        username,
        email: data.email,
        phone: data.phone,
        passwordHash,
        role: 'CLIENT',
        status: 'ACTIVE',   // activation immédiate pour les clients
        language: data.language,
      },
    })

    await db.log.create({
      data: { userId: user.id, action: 'REGISTER', entity: 'User', entityId: user.id, details: `New registration — @${username}` },
    })

    await sendWelcomeEmail(user.email, user.firstName, username, data.language).catch(console.error)

    return NextResponse.json({ success: true, userId: user.id, username }, { status: 201 })
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return NextResponse.json({ error: 'Données invalides', details: err.errors }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
