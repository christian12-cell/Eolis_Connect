import path from 'path'
import { createClient } from '@libsql/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from './src/generated/prisma/client.js'

const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db')
const urlPath = dbPath.split('\\').join('/')
console.log('URL:', `file:${urlPath}`)

const libsql = createClient({ url: `file:${urlPath}` })
const adapter = new PrismaLibSql(libsql)
const db = new PrismaClient({ adapter })

try {
  const count = await db.user.count()
  console.log('User count:', count)
} catch (e) {
  console.error('Error:', e.message)
} finally {
  await db.$disconnect()
}
