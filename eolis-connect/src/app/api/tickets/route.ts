import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateRef, getUrgency } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const user = session.user as any
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const urgency = searchParams.get('urgency')
  const page = Number(searchParams.get('page') ?? 1)
  const limit = Number(searchParams.get('limit') ?? 20)

  const where: any = {}

  if (user.role === 'CLIENT') {
    where.clientId = user.id
  } else if (user.role === 'AGENT') {
    const agentOnly = searchParams.get('agentOnly')
    if (agentOnly === 'true') where.agentId = user.id
  }

  if (status) where.status = status
  if (urgency) where.urgency = urgency

  const [tickets, total] = await Promise.all([
    db.ticket.findMany({
      where,
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        agent: { select: { id: true, firstName: true, lastName: true } },
        rating: { select: { score: true } },
        _count: { select: { messages: { where: { isRead: false, senderType: { not: 'AGENT' } } } } },
      },
      orderBy: [
        { urgency: 'asc' },
        { createdAt: 'desc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.ticket.count({ where }),
  ])

  // Sort urgency: HIGH first
  const urgencyOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  tickets.sort((a, b) => (urgencyOrder[a.urgency as keyof typeof urgencyOrder] ?? 2) - (urgencyOrder[b.urgency as keyof typeof urgencyOrder] ?? 2))

  return NextResponse.json({ tickets, total, page, totalPages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'CLIENT') return NextResponse.json({ error: 'Réservé aux clients' }, { status: 403 })

  try {
    const body = await req.json()
    const { category, subcategory, equipmentType, shipLine, shipName, voyageNumber, shipDate, optionalCode, description } = body

    if (!category || !subcategory || !description) {
      return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
    }

    const ref = generateRef()
    const urgency = getUrgency(category, subcategory)

    const ticket = await db.ticket.create({
      data: {
        ref,
        clientId: user.id,
        category,
        subcategory,
        equipmentType,
        shipLine,
        shipName,
        voyageNumber,
        shipDate,
        optionalCode,
        description,
        urgency,
        status: 'PENDING',
      },
    })

    await db.log.create({
      data: { userId: user.id, action: 'CREATE_TICKET', entity: 'Ticket', entityId: ticket.id, details: `${ref} — ${category}/${subcategory}` },
    })

    await db.notification.create({
      data: {
        userId: user.id,
        ticketId: ticket.id,
        type: 'TICKET_CREATED',
        title: 'Dossier créé',
        message: `Votre dossier ${ref} a été créé et est en attente de traitement.`,
      },
    })

    return NextResponse.json({ ticket }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
