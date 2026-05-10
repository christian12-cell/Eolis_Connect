import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')
  if (!username) return NextResponse.json({ error: 'Missing username' }, { status: 400 })

  try {
    const user = await db.user.findFirst({
      where: { username },
      select: { id: true, status: true },
    })

    if (!user) return NextResponse.json({ exists: false }, { status: 404 })
    return NextResponse.json({ exists: true, status: user.status })
  } catch (err) {
    console.error('[check-username] DB error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
