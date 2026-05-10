import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const locale = searchParams.get('locale') ?? 'fr'
  const category = searchParams.get('category')
  const query = searchParams.get('q')

  const where: any = { isActive: true, locale }
  if (category) where.category = category
  if (query) {
    where.OR = [
      { question: { contains: query } },
      { answer: { contains: query } },
    ]
  }

  const faqs = await db.fAQ.findMany({
    where,
    orderBy: [{ category: 'asc' }, { order: 'asc' }],
  })

  return NextResponse.json({ faqs })
}
