import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateRef(): string {
  const year = new Date().getFullYear()
  const num = Math.floor(Math.random() * 9000) + 1000
  return `REF-${year}-${num}`
}

export function getUrgency(category: string, subcategory: string): string {
  const map: Record<string, Record<string, string>> = {
    Livraison: {
      'Conteneur bloqué': 'HIGH',
      'Retard de livraison': 'HIGH',
      'Problème à la réception': 'HIGH',
    },
    Facturation: {
      'Retard de paiement': 'MEDIUM',
      'Paiement incomplet': 'MEDIUM',
      Remboursement: 'LOW',
    },
    Dossier: {
      'Dossier incomplet': 'MEDIUM',
      'Document manquant': 'MEDIUM',
      'Validation de dossier': 'LOW',
    },
    Information: {
      "Demande d'information": 'LOW',
      Procédure: 'LOW',
    },
    Delivery: {
      'Blocked container': 'HIGH',
      'Delivery delay': 'HIGH',
      'Reception issue': 'HIGH',
    },
    Billing: {
      'Late payment': 'MEDIUM',
      'Incomplete payment': 'MEDIUM',
      Refund: 'LOW',
    },
    File: {
      'Incomplete file': 'MEDIUM',
      'Missing document': 'MEDIUM',
      'File validation': 'LOW',
    },
    Information_en: {
      'Information request': 'LOW',
      Procedure: 'LOW',
    },
  }
  return map[category]?.[subcategory] ?? 'LOW'
}

export function urgencyLabel(urgency: string, locale = 'fr') {
  const labels: Record<string, Record<string, string>> = {
    HIGH: { fr: 'Élevée', en: 'High' },
    MEDIUM: { fr: 'Moyenne', en: 'Medium' },
    LOW: { fr: 'Faible', en: 'Low' },
  }
  return labels[urgency]?.[locale] ?? urgency
}

export function statusLabel(status: string, locale = 'fr') {
  const labels: Record<string, Record<string, string>> = {
    PENDING: { fr: 'En attente', en: 'Pending' },
    IN_PROGRESS: { fr: 'En cours', en: 'In progress' },
    TREATED: { fr: 'Traité', en: 'Treated' },
  }
  return labels[status]?.[locale] ?? status
}

export function roleLabel(role: string, locale = 'fr') {
  const labels: Record<string, Record<string, string>> = {
    CLIENT: { fr: 'Client', en: 'Client' },
    AGENT: { fr: 'Agent Service Client', en: 'Customer Service Agent' },
    OPS_ADMIN: { fr: 'Admin Opérations', en: 'Operations Admin' },
    SYSTEM_ADMIN: { fr: 'Administrateur Système', en: 'System Administrator' },
  }
  return labels[role]?.[locale] ?? role
}

export function getBrowserTimezone(): string {
  return 'Africa/Douala'
}

// Treat bare ISO strings (no tz info) as UTC by appending 'Z'
function normalizeDate(date: Date | string): Date {
  if (date instanceof Date) return date
  if (!date.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(date)) {
    return new Date(date + 'Z')
  }
  return new Date(date)
}

// Returns epoch ms of midnight today in Cameroon time (WAT = UTC+1)
export function startOfTodayWAT(): number {
  const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Douala' })
  return new Date(dateStr + 'T00:00:00+01:00').getTime()
}

export function formatDate(date: Date | string, locale = 'fr') {
  const d = normalizeDate(date)
  return d.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: getBrowserTimezone(),
  })
}

export function timeAgo(date: Date | string, locale = 'fr') {
  const now = new Date()
  const d = normalizeDate(date)
  const diff = now.getTime() - d.getTime()
  if (diff < 0) {
    return locale === 'fr' ? "À l'instant" : 'Just now'
  }
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (locale === 'fr') {
    if (minutes < 1) return "À l'instant"
    if (minutes < 60) return `Il y a ${minutes} min`
    if (hours < 24) return `Il y a ${hours}h`
    return `Il y a ${days} jour${days > 1 ? 's' : ''}`
  }
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days} day${days > 1 ? 's' : ''} ago`
}
