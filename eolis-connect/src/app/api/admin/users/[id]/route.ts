import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendAccountApprovedEmail, sendAccountRejectedEmail } from '@/lib/email'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/admin/users/[id]'>) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const admin = session.user as any
  if (!['OPS_ADMIN', 'SYSTEM_ADMIN'].includes(admin.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { id } = await ctx.params
  const body = await req.json()
  const { action, role } = body

  const target = await db.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  if (action === 'approve') {
    await db.user.update({ where: { id }, data: { status: 'ACTIVE' } })
    await sendAccountApprovedEmail(target.email, target.firstName, target.language).catch(console.error)
  } else if (action === 'reject') {
    await db.user.update({ where: { id }, data: { status: 'REJECTED' } })
    await sendAccountRejectedEmail(target.email, target.firstName, target.language).catch(console.error)
  } else if (action === 'suspend') {
    await db.user.update({ where: { id }, data: { status: 'SUSPENDED' } })
  } else if (action === 'activate') {
    await db.user.update({ where: { id }, data: { status: 'ACTIVE' } })
  } else if (action === 'changeRole' && role) {
    const allowed = ['CLIENT', 'AGENT', 'OPS_ADMIN', 'SYSTEM_ADMIN']
    if (!allowed.includes(role)) return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
    await db.user.update({ where: { id }, data: { role } })
  } else if (action === 'resetPassword') {
    const tempPassword = crypto.randomBytes(8).toString('hex')
    const passwordHash = await bcrypt.hash(tempPassword, 12)
    await db.user.update({ where: { id }, data: { passwordHash } })
    await db.log.create({
      data: { userId: admin.id, action: 'RESET_PASSWORD', entity: 'User', entityId: id },
    })
    return NextResponse.json({ success: true, tempPassword })
  } else {
    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  }

  await db.log.create({
    data: { userId: admin.id, action: `USER_${action.toUpperCase()}`, entity: 'User', entityId: id },
  })

  return NextResponse.json({ success: true })
}
