import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'CLIENT') return NextResponse.json({ error: 'Réservé aux clients' }, { status: 403 })

  try {
    const { ticketId, score, comment } = await req.json()

    if (!ticketId || !score || score < 1 || score > 5) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    }

    const ticket = await db.ticket.findUnique({ where: { id: ticketId } })
    if (!ticket || ticket.clientId !== user.id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }
    if (ticket.status !== 'TREATED') {
      return NextResponse.json({ error: 'Le dossier doit être traité pour être évalué' }, { status: 400 })
    }

    const existing = await db.satisfactionRating.findUnique({ where: { ticketId } })
    if (existing) {
      return NextResponse.json({ error: 'Déjà évalué' }, { status: 409 })
    }

    const rating = await db.satisfactionRating.create({
      data: {
        ticketId,
        clientId: user.id,
        agentId: ticket.agentId ?? undefined,
        score,
        comment,
      },
    })

    return NextResponse.json({ rating }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
