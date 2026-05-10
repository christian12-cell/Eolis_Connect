import { pbkdf2Sync, randomBytes } from 'node:crypto'

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = pbkdf2Sync(password, salt, 100_000, 32, 'sha256').toString('hex')
  return `pbkdf2:${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [, salt, hash] = stored.split(':')
    if (!salt || !hash) return false
    const newHash = pbkdf2Sync(password, salt, 100_000, 32, 'sha256').toString('hex')
    return hash === newHash
  } catch {
    return false
  }
}
