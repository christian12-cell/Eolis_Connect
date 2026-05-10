let twilioClient: any = null

function getClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null
  if (!twilioClient) {
    const twilio = require('twilio')
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  }
  return twilioClient
}

export async function sendSMS(to: string, message: string) {
  const client = getClient()
  if (!client) {
    console.log(`[SMS] To: ${to} | Message: ${message}`)
    return
  }
  await client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to,
  })
}

export async function sendTicketUpdateSMS(phone: string, ref: string, status: string, locale = 'fr') {
  const msg = locale === 'fr'
    ? `Eolis Connect: Votre dossier ${ref} est maintenant ${
        status === 'IN_PROGRESS' ? 'en cours de traitement' : 'traité'
      }. Connectez-vous pour voir les détails.`
    : `Eolis Connect: Your file ${ref} is now ${
        status === 'IN_PROGRESS' ? 'in progress' : 'treated'
      }. Log in to see the details.`
  await sendSMS(phone, msg)
}

export async function sendNewMessageSMS(phone: string, ref: string, locale = 'fr') {
  const msg = locale === 'fr'
    ? `Eolis Connect: Le service client a envoyé un message pour votre dossier ${ref}. Connectez-vous à votre espace pour le consulter.`
    : `Eolis Connect: Customer service sent a message for your file ${ref}. Log in to your account to read it.`
  await sendSMS(phone, msg)
}

export async function sendDocumentRequestSMS(phone: string, ref: string, locale = 'fr') {
  const msg = locale === 'fr'
    ? `Eolis Connect: Pour votre dossier ${ref}, le service client a besoin de documents supplémentaires. Connectez-vous à votre espace et consultez votre messagerie.`
    : `Eolis Connect: For your file ${ref}, customer service needs additional documents. Log in to your account and check your messages.`
  await sendSMS(phone, msg)
}
