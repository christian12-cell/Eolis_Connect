import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST ?? 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

async function send(to: string, subject: string, html: string) {
  if (!process.env.EMAIL_USER) {
    console.log(`[EMAIL] To: ${to} | Subject: ${subject}`)
    return
  }
  await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html })
}

export async function sendWelcomeEmail(to: string, firstName: string, username: string, locale = 'fr') {
  const subject = locale === 'fr' ? 'Bienvenue sur Eolis Connect — Vos identifiants' : 'Welcome to Eolis Connect — Your credentials'
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/${locale}/login`
  const html = locale === 'fr'
    ? `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
        <h2 style="color:#1B3A5C">Bonjour ${firstName},</h2>
        <p>Votre compte Eolis Connect a été créé avec succès et est <strong>actif immédiatement</strong>.</p>
        <div style="background:#F0F4F8;border-radius:12px;padding:20px;margin:20px 0;border-left:4px solid #1B3A5C">
          <p style="margin:0 0 8px 0;color:#666;font-size:13px;text-transform:uppercase;font-weight:bold">Votre nom d'utilisateur</p>
          <p style="margin:0;font-size:22px;font-weight:bold;color:#1B3A5C;font-family:monospace">${username}</p>
          <p style="margin:8px 0 0 0;color:#888;font-size:12px">Utilisez ce nom pour vous connecter. Votre mot de passe est celui que vous avez choisi lors de l'inscription.</p>
        </div>
        <a href="${loginUrl}" style="background:#1B3A5C;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:8px 0;font-weight:bold">Se connecter à Eolis Connect</a>
        <p style="color:#888;font-size:12px;margin-top:24px">Conservez cet email — il contient vos informations de connexion.<br/>Cordialement, l'équipe Eolis Cameroun</p>
      </div>`
    : `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
        <h2 style="color:#1B3A5C">Hello ${firstName},</h2>
        <p>Your Eolis Connect account has been created and is <strong>immediately active</strong>.</p>
        <div style="background:#F0F4F8;border-radius:12px;padding:20px;margin:20px 0;border-left:4px solid #1B3A5C">
          <p style="margin:0 0 8px 0;color:#666;font-size:13px;text-transform:uppercase;font-weight:bold">Your username</p>
          <p style="margin:0;font-size:22px;font-weight:bold;color:#1B3A5C;font-family:monospace">${username}</p>
          <p style="margin:8px 0 0 0;color:#888;font-size:12px">Use this name to log in. Your password is the one you chose during registration.</p>
        </div>
        <a href="${loginUrl}" style="background:#1B3A5C;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:8px 0;font-weight:bold">Log in to Eolis Connect</a>
        <p style="color:#888;font-size:12px;margin-top:24px">Keep this email — it contains your login information.<br/>Best regards, the Eolis Cameroun team</p>
      </div>`
  await send(to, subject, html)
}

export async function sendAccountApprovedEmail(to: string, firstName: string, locale = 'fr') {
  const subject = locale === 'fr' ? 'Compte Eolis Connect activé' : 'Eolis Connect account activated'
  const link = `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/login`
  const html = locale === 'fr'
    ? `<div style="font-family:sans-serif;max-width:600px;margin:auto">
        <img src="${process.env.NEXT_PUBLIC_APP_URL}/logo.png" height="60" alt="Eolis"/>
        <h2>Bonjour ${firstName},</h2>
        <p>Votre compte Eolis Connect a été <strong>activé</strong>. Vous pouvez maintenant vous connecter.</p>
        <a href="${link}" style="background:#1B3A5C;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">Se connecter</a>
        <p>Cordialement,<br/>L'équipe Eolis Cameroun</p>
      </div>`
    : `<div style="font-family:sans-serif;max-width:600px;margin:auto">
        <img src="${process.env.NEXT_PUBLIC_APP_URL}/logo.png" height="60" alt="Eolis"/>
        <h2>Hello ${firstName},</h2>
        <p>Your Eolis Connect account has been <strong>activated</strong>. You can now log in.</p>
        <a href="${link}" style="background:#1B3A5C;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">Log in</a>
        <p>Best regards,<br/>The Eolis Cameroun Team</p>
      </div>`
  await send(to, subject, html)
}

export async function sendAccountRejectedEmail(to: string, firstName: string, locale = 'fr') {
  const subject = locale === 'fr' ? 'Compte Eolis Connect refusé' : 'Eolis Connect account rejected'
  const adminEmail = process.env.EMAIL_USER ?? 'admin@eoliscameroun.com'
  const html = locale === 'fr'
    ? `<div style="font-family:sans-serif;max-width:600px;margin:auto">
        <img src="${process.env.NEXT_PUBLIC_APP_URL}/logo.png" height="60" alt="Eolis"/>
        <h2>Bonjour ${firstName},</h2>
        <p>Votre demande de création de compte Eolis Connect n'a pas pu être approuvée.</p>
        <p>Pour plus d'informations, veuillez contacter notre administrateur : <a href="mailto:${adminEmail}">${adminEmail}</a></p>
        <p>Cordialement,<br/>L'équipe Eolis Cameroun</p>
      </div>`
    : `<div style="font-family:sans-serif;max-width:600px;margin:auto">
        <img src="${process.env.NEXT_PUBLIC_APP_URL}/logo.png" height="60" alt="Eolis"/>
        <h2>Hello ${firstName},</h2>
        <p>Your Eolis Connect account request could not be approved.</p>
        <p>For more information, please contact our administrator: <a href="mailto:${adminEmail}">${adminEmail}</a></p>
        <p>Best regards,<br/>The Eolis Cameroun Team</p>
      </div>`
  await send(to, subject, html)
}

export async function sendPasswordResetEmail(to: string, firstName: string, resetUrl: string, locale = 'fr') {
  const subject = locale === 'fr' ? 'Réinitialisation de votre mot de passe' : 'Password reset'
  const html = locale === 'fr'
    ? `<div style="font-family:sans-serif;max-width:600px;margin:auto">
        <img src="${process.env.NEXT_PUBLIC_APP_URL}/logo.png" height="60" alt="Eolis"/>
        <h2>Bonjour ${firstName},</h2>
        <p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe. Ce lien expire dans 1 heure.</p>
        <a href="${resetUrl}" style="background:#1B3A5C;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">Réinitialiser mon mot de passe</a>
        <p><small>Ce lien expire après utilisation. Ne le partagez pas.</small></p>
        <p>Cordialement,<br/>L'équipe Eolis Cameroun</p>
      </div>`
    : `<div style="font-family:sans-serif;max-width:600px;margin:auto">
        <img src="${process.env.NEXT_PUBLIC_APP_URL}/logo.png" height="60" alt="Eolis"/>
        <h2>Hello ${firstName},</h2>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="background:#1B3A5C;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">Reset my password</a>
        <p><small>This link expires after use. Do not share it.</small></p>
        <p>Best regards,<br/>The Eolis Cameroun Team</p>
      </div>`
  await send(to, subject, html)
}

export async function sendTicketStatusEmail(
  to: string, firstName: string, ref: string, status: string, locale = 'fr'
) {
  const statusFr = status === 'IN_PROGRESS' ? 'en cours de traitement' : 'traité et clôturé'
  const statusEn = status === 'IN_PROGRESS' ? 'in progress' : 'treated and closed'
  const subject = locale === 'fr'
    ? `Dossier ${ref} — Mise à jour`
    : `File ${ref} — Update`
  const link = `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/mes-demandes`
  const html = locale === 'fr'
    ? `<div style="font-family:sans-serif;max-width:600px;margin:auto">
        <img src="${process.env.NEXT_PUBLIC_APP_URL}/logo.png" height="60" alt="Eolis"/>
        <h2>Bonjour ${firstName},</h2>
        <p>Votre dossier <strong>${ref}</strong> est maintenant <strong>${statusFr}</strong>.</p>
        <a href="${link}" style="background:#1B3A5C;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">Voir mon dossier</a>
        <p>Cordialement,<br/>L'équipe Eolis Cameroun</p>
      </div>`
    : `<div style="font-family:sans-serif;max-width:600px;margin:auto">
        <img src="${process.env.NEXT_PUBLIC_APP_URL}/logo.png" height="60" alt="Eolis"/>
        <h2>Hello ${firstName},</h2>
        <p>Your file <strong>${ref}</strong> is now <strong>${statusEn}</strong>.</p>
        <a href="${link}" style="background:#1B3A5C;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">View my file</a>
        <p>Best regards,<br/>The Eolis Cameroun Team</p>
      </div>`
  await send(to, subject, html)
}

export async function sendNewMessageSMS_email(
  to: string, firstName: string, ref: string, locale = 'fr'
) {
  const subject = locale === 'fr'
    ? `Nouveau message pour votre dossier ${ref}`
    : `New message for your file ${ref}`
  const link = `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/mes-demandes`
  const html = locale === 'fr'
    ? `<div style="font-family:sans-serif;max-width:600px;margin:auto">
        <img src="${process.env.NEXT_PUBLIC_APP_URL}/logo.png" height="60" alt="Eolis"/>
        <h2>Bonjour ${firstName},</h2>
        <p>Le service client a envoyé un message concernant votre dossier <strong>${ref}</strong>. Veuillez vous connecter pour consulter votre messagerie.</p>
        <a href="${link}" style="background:#1B3A5C;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">Voir mes messages</a>
        <p>Cordialement,<br/>L'équipe Eolis Cameroun</p>
      </div>`
    : `<div style="font-family:sans-serif;max-width:600px;margin:auto">
        <img src="${process.env.NEXT_PUBLIC_APP_URL}/logo.png" height="60" alt="Eolis"/>
        <h2>Hello ${firstName},</h2>
        <p>The customer service sent a message regarding your file <strong>${ref}</strong>. Please log in to view your messages.</p>
        <a href="${link}" style="background:#1B3A5C;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">View my messages</a>
        <p>Best regards,<br/>The Eolis Cameroun Team</p>
      </div>`
  await send(to, subject, html)
}
