import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) return NextResponse.json({ valid: false }, { status: 400 })

    const user = await db.user.findFirst({
      where: { username },
    })

    if (!user) return NextResponse.json({ valid: false, reason: 'not_found' })
    if (user.status === 'REJECTED' || user.status === 'SUSPENDED') {
      return NextResponse.json({ valid: false, reason: 'blocked' })
    }

    const valid = await verifyPassword(password, user.passwordHash)
    console.log('[verify-password] user:', username, '| hash prefix:', user.passwordHash.slice(0, 20), '| valid:', valid)
    if (!valid) return NextResponse.json({ valid: false, reason: 'wrong_password' })

    return NextResponse.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
        status: user.status,
        language: user.language,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
      },
    })
  } catch (err) {
    console.error('[verify-password]', err)
    return NextResponse.json({ valid: false, reason: 'error' }, { status: 500 })
  }
}
