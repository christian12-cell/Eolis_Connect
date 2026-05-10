import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const user = session.user as any
  if (!['OPS_ADMIN', 'SYSTEM_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') ?? 'month'

  const now = new Date()
  let since = new Date()
  if (period === 'week') since = new Date(now.getTime() - 7 * 86400000)
  else if (period === 'month') since = new Date(now.getTime() - 30 * 86400000)
  else if (period === '3months') since = new Date(now.getTime() - 90 * 86400000)

  const agents = await db.user.findMany({
    where: { role: { in: ['AGENT', 'OPS_ADMIN'] }, status: 'ACTIVE' },
    select: { id: true, firstName: true, lastName: true },
  })

  const agentStats = await Promise.all(
    agents.map(async (agent) => {
      const tickets = await db.ticket.findMany({
        where: {
          agentId: agent.id,
          status: 'TREATED',
          closedAt: { gte: since },
        },
        include: { rating: { select: { score: true } } },
      })

      const total = tickets.length
      const byUrgency = { HIGH: 0, MEDIUM: 0, LOW: 0 }
      let totalMs = 0
      let ratingSum = 0
      let ratingCount = 0

      for (const t of tickets) {
        byUrgency[t.urgency as keyof typeof byUrgency]++
        if (t.takenAt && t.closedAt) {
          totalMs += new Date(t.closedAt).getTime() - new Date(t.takenAt).getTime()
        }
        if (t.rating) {
          ratingSum += t.rating.score
          ratingCount++
        }
      }

      const avgResolutionMinutes = total > 0 && totalMs > 0 ? Math.round(totalMs / total / 60000) : 0
      const avgScore = ratingCount > 0 ? ratingSum / ratingCount : 0

      return {
        agent: { id: agent.id, firstName: agent.firstName, lastName: agent.lastName },
        total,
        byUrgency,
        avgResolutionMinutes,
        avgScore: Math.round(avgScore * 10) / 10,
        ratingCount,
      }
    })
  )

  agentStats.sort((a, b) => b.total - a.total)

  const overallTickets = await db.ticket.count({ where: { createdAt: { gte: since } } })
  const treatedTickets = await db.ticket.count({ where: { status: 'TREATED', closedAt: { gte: since } } })

  const dailyTickets = await db.ticket.groupBy({
    by: ['createdAt'],
    where: { createdAt: { gte: since } },
    _count: true,
    orderBy: { createdAt: 'asc' },
  })

  const byCategory = await db.ticket.groupBy({
    by: ['category'],
    where: { createdAt: { gte: since } },
    _count: true,
  })

  const byUrgency = await db.ticket.groupBy({
    by: ['urgency'],
    where: { createdAt: { gte: since } },
    _count: true,
  })

  const byStatus = await db.ticket.groupBy({
    by: ['status'],
    where: { createdAt: { gte: since } },
    _count: true,
  })

  const avgRating = await db.satisfactionRating.aggregate({
    where: { createdAt: { gte: since } },
    _avg: { score: true },
  })

  return NextResponse.json({
    agentStats,
    summary: {
      totalTickets: overallTickets,
      treatedTickets,
      avgScore: Math.round((avgRating._avg.score ?? 0) * 10) / 10,
    },
    charts: {
      byCategory: byCategory.map(r => ({ name: r.category, count: r._count })),
      byUrgency: byUrgency.map(r => ({ name: r.urgency, count: r._count })),
      byStatus: byStatus.map(r => ({ name: r.status, count: r._count })),
    },
  })
}
