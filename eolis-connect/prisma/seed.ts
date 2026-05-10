import 'dotenv/config'
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
const dbUrl = 'file:dev.db'
const adapter = new PrismaLibSql({ url: dbUrl })
const db = new PrismaClient({ adapter })

function hash(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const h = pbkdf2Sync(password, salt, 100_000, 32, 'sha256').toString('hex')
  return `pbkdf2:${salt}:${h}`
}

async function main() {
  console.log('🌱 Seeding database...')

  await db.log.deleteMany()
  await db.notification.deleteMany()
  await db.satisfactionRating.deleteMany()
  await db.attachment.deleteMany()
  await db.message.deleteMany()
  await db.ticket.deleteMany()
  await db.passwordReset.deleteMany()
  await db.fAQ.deleteMany()
  await db.user.deleteMany()

  const admin = await db.user.create({
    data: {
      firstName: 'Christian',
      lastName: 'Denmeko',
      username: 'Christian.DENMEKO',
      email: 'admin@eoliscameroun.com',
      phone: '+237690000001',
      passwordHash: hash('Admin@2026!'),
      role: 'SYSTEM_ADMIN',
      status: 'ACTIVE',
      language: 'fr',
    },
  })

  const ops = await db.user.create({
    data: {
      firstName: 'Debora',
      lastName: 'Denmeko',
      username: 'Debora.DENMEKO',
      email: 'ops@eoliscameroun.com',
      phone: '+237690000002',
      passwordHash: hash('Ops@2026!'),
      role: 'OPS_ADMIN',
      status: 'ACTIVE',
      language: 'fr',
    },
  })

  const agent1 = await db.user.create({
    data: {
      firstName: 'Jean',
      lastName: 'Mbarga',
      username: 'Jean.MBARGA',
      email: 'agent1@eoliscameroun.com',
      phone: '+237690000003',
      passwordHash: hash('Agent@2026!'),
      role: 'AGENT',
      status: 'ACTIVE',
      language: 'fr',
    },
  })

  const agent2 = await db.user.create({
    data: {
      firstName: 'Marie',
      lastName: 'Nguema',
      username: 'Marie.NGUEMA',
      email: 'agent2@eoliscameroun.com',
      phone: '+237690000004',
      passwordHash: hash('Agent@2026!'),
      role: 'AGENT',
      status: 'ACTIVE',
      language: 'fr',
    },
  })

  const client1 = await db.user.create({
    data: {
      firstName: 'Thomas',
      lastName: 'Kamga',
      username: 'Thomas.KAMGA',
      email: 'client1@example.com',
      phone: '+237699000001',
      passwordHash: hash('Client@2026!'),
      role: 'CLIENT',
      status: 'ACTIVE',
      language: 'fr',
    },
  })

  const client2 = await db.user.create({
    data: {
      firstName: 'Alice',
      lastName: 'Fono',
      username: 'Alice.FONO',
      email: 'client2@example.com',
      phone: '+237699000002',
      passwordHash: hash('Client@2026!'),
      role: 'CLIENT',
      status: 'ACTIVE',
      language: 'en',
    },
  })

  await db.user.create({
    data: {
      firstName: 'Robert',
      lastName: 'Etoa',
      username: 'Robert.ETOA',
      email: 'pending@example.com',
      phone: '+237699000003',
      passwordHash: hash('Client@2026!'),
      role: 'CLIENT',
      status: 'PENDING',
      language: 'fr',
    },
  })

  // Tickets
  const t1 = await db.ticket.create({
    data: {
      ref: 'REF-2026-0001',
      clientId: client1.id,
      agentId: agent1.id,
      category: 'Livraison',
      subcategory: 'Conteneur bloqué',
      equipmentType: 'Conteneur 40 pieds',
      shipLine: 'MSC',
      shipName: 'MSC Cameroun',
      voyageNumber: 'CM2026-04',
      shipDate: '2026-04-15',
      description: 'Mon conteneur 40 pieds est bloqué au port depuis 3 jours sans explication. J\'ai tous mes documents en règle.',
      urgency: 'HIGH',
      status: 'TREATED',
      takenAt: new Date('2026-04-16T09:00:00'),
      closedAt: new Date('2026-04-16T14:30:00'),
    },
  })

  await db.message.create({
    data: {
      ticketId: t1.id,
      senderId: agent1.id,
      senderType: 'AGENT',
      content: 'Bonjour M. Kamga, nous avons bien reçu votre demande. Nous vérifions la situation de votre conteneur avec le port.',
      isRead: true,
      readAt: new Date('2026-04-16T09:30:00'),
    },
  })

  await db.message.create({
    data: {
      ticketId: t1.id,
      senderId: client1.id,
      senderType: 'CLIENT',
      content: 'Merci de votre retour rapide. J\'attends votre confirmation.',
      isRead: true,
      readAt: new Date('2026-04-16T10:00:00'),
    },
  })

  await db.message.create({
    data: {
      ticketId: t1.id,
      senderId: agent1.id,
      senderType: 'AGENT',
      content: 'Bonne nouvelle ! Votre conteneur a été libéré. Vous pouvez le récupérer à partir de demain matin. Référence de mainlevée : ML-2026-789.',
      isRead: true,
      readAt: new Date('2026-04-16T14:00:00'),
    },
  })

  await db.satisfactionRating.create({
    data: {
      ticketId: t1.id,
      clientId: client1.id,
      agentId: agent1.id,
      score: 5,
      comment: 'Service très rapide et efficace ! Merci beaucoup.',
    },
  })

  const t2 = await db.ticket.create({
    data: {
      ref: 'REF-2026-0002',
      clientId: client1.id,
      agentId: agent1.id,
      category: 'Facturation',
      subcategory: 'Retard de paiement',
      description: 'Je n\'ai pas encore reçu ma facture pour la livraison du mois dernier.',
      urgency: 'MEDIUM',
      status: 'IN_PROGRESS',
      takenAt: new Date(),
    },
  })

  await db.message.create({
    data: {
      ticketId: t2.id,
      senderId: agent1.id,
      senderType: 'AGENT',
      content: 'Bonjour, nous sommes en train de vérifier votre dossier de facturation. Pouvez-vous nous fournir votre numéro de commande ?',
      isRead: false,
    },
  })

  await db.notification.create({
    data: {
      userId: client1.id,
      ticketId: t2.id,
      type: 'NEW_MESSAGE',
      title: 'Nouveau message',
      message: `Vous avez un nouveau message concernant votre dossier REF-2026-0002.`,
      isRead: false,
    },
  })

  const t3 = await db.ticket.create({
    data: {
      ref: 'REF-2026-0003',
      clientId: client2.id,
      category: 'Delivery',
      subcategory: 'Delivery delay',
      equipmentType: '20ft Container',
      shipLine: 'CMA-CGM',
      shipName: 'CMA Douala',
      voyageNumber: 'DLA2026-07',
      description: 'My 20ft container delivery is 5 days late. The expected date was April 20th.',
      urgency: 'HIGH',
      status: 'PENDING',
    },
  })

  const t4 = await db.ticket.create({
    data: {
      ref: 'REF-2026-0004',
      clientId: client2.id,
      agentId: agent2.id,
      category: 'Billing',
      subcategory: 'Refund',
      description: 'I was charged twice for my last delivery. I need a refund for the duplicate charge.',
      urgency: 'LOW',
      status: 'TREATED',
      takenAt: new Date('2026-04-20T10:00:00'),
      closedAt: new Date('2026-04-21T16:00:00'),
    },
  })

  await db.satisfactionRating.create({
    data: {
      ticketId: t4.id,
      clientId: client2.id,
      agentId: agent2.id,
      score: 4,
      comment: 'Good service, resolved my issue. Could have been faster.',
    },
  })

  // FAQs FR
  const faqsFr = [
    { category: 'Livraison', question: 'Comment suivre ma livraison ?', answer: 'Connectez-vous à votre espace Eolis Connect et consultez vos demandes. Votre référence de dossier vous permet de suivre l\'avancement en temps réel.' },
    { category: 'Livraison', question: 'Que faire si mon conteneur est bloqué au port ?', answer: 'Créez une demande dans la catégorie "Livraison > Conteneur bloqué". Notre équipe traitera votre demande en priorité élevée.' },
    { category: 'Livraison', question: 'Quels documents faut-il pour récupérer un conteneur ?', answer: 'Vous aurez besoin de : la facture commerciale, le connaissement (Bill of Lading), la déclaration en douane, et une pièce d\'identité valide.' },
    { category: 'Facturation', question: 'Comment obtenir ma facture ?', answer: 'Vos factures sont disponibles dans votre espace client. Vous pouvez également en faire la demande via le formulaire "Facturation > Demande d\'information".' },
    { category: 'Facturation', question: 'Comment contester une facture ?', answer: 'Créez une demande dans "Facturation > Paiement incomplet" ou "Facturation > Remboursement" selon votre situation. Joignez votre facture et les justificatifs.' },
    { category: 'Dossier', question: 'Quels documents dois-je fournir pour un dossier incomplet ?', answer: 'Les documents requis dépendent du type de prestation. Notre service client vous indiquera exactement ce dont vous avez besoin via la messagerie de votre dossier.' },
    { category: 'Information', question: 'Quels services propose Eolis Cameroun ?', answer: 'Eolis Cameroun propose des services de manutention portuaire, transport de conteneurs (20 et 40 pieds), fret conventionnel, et gestion documentaire.' },
    { category: 'Information', question: 'Quels sont les horaires du service client ?', answer: 'Notre service client est disponible du lundi au vendredi de 8h00 à 18h00. Pour les urgences, un numéro d\'astreinte est disponible.' },
  ]

  for (let i = 0; i < faqsFr.length; i++) {
    await db.fAQ.create({ data: { ...faqsFr[i], locale: 'fr', order: i, subcategory: null } })
  }

  // FAQs EN
  const faqsEn = [
    { category: 'Delivery', question: 'How do I track my delivery?', answer: 'Log in to your Eolis Connect account and check your requests. Your reference number allows you to track the progress in real time.' },
    { category: 'Delivery', question: 'What should I do if my container is blocked at the port?', answer: 'Create a request under "Delivery > Blocked container". Our team will process your request with high priority.' },
    { category: 'Delivery', question: 'What documents are needed to pick up a container?', answer: 'You will need: commercial invoice, Bill of Lading, customs declaration, and a valid ID.' },
    { category: 'Billing', question: 'How do I get my invoice?', answer: 'Your invoices are available in your client area. You can also request one through the form under "Billing > Information request".' },
    { category: 'Billing', question: 'How do I dispute an invoice?', answer: 'Create a request under "Billing > Incomplete payment" or "Billing > Refund" depending on your situation. Attach your invoice and supporting documents.' },
    { category: 'Information', question: 'What services does Eolis Cameroun offer?', answer: 'Eolis Cameroun offers port handling, container transport (20ft and 40ft), conventional freight, and document management services.' },
    { category: 'Information', question: 'What are customer service hours?', answer: 'Our customer service is available Monday to Friday from 8:00 AM to 6:00 PM. For emergencies, an on-call number is available.' },
  ]

  for (let i = 0; i < faqsEn.length; i++) {
    await db.fAQ.create({ data: { ...faqsEn[i], locale: 'en', order: i, subcategory: null } })
  }

  console.log('✅ Database seeded successfully!')
  console.log('')
  console.log('📋 Test accounts (login: username + password):')
  console.log('  System Admin : Christian.DENMEKO / Admin@2026!')
  console.log('  Ops Admin    : Debora.DENMEKO    / Ops@2026!')
  console.log('  Agent 1      : Jean.MBARGA        / Agent@2026!')
  console.log('  Agent 2      : Marie.NGUEMA       / Agent@2026!')
  console.log('  Client 1     : Thomas.KAMGA       / Client@2026!')
  console.log('  Client 2 (EN): Alice.FONO         / Client@2026!')
  console.log('  Pending      : Robert.ETOA        / Client@2026!')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
