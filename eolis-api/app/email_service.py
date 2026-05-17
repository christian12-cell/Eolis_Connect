import resend
from .config import settings

# Logo hosted on Imgur — replace with your own CDN URL for production
LOGO_URL = "https://i.imgur.com/TdBWHcp.png"
SUPPORT_EMAIL = "support@eolisconnect.online"


def _send(to: str, subject: str, html: str):
    if not settings.MAIL_ENABLED or not settings.RESEND_API_KEY or not settings.MAIL_NOREPLY_FROM:
        return
    resend.api_key = settings.RESEND_API_KEY
    try:
        resend.Emails.send({
            "from": f"Eolis Connect <{settings.MAIL_NOREPLY_FROM}>",
            "to": [to],
            "subject": subject,
            "html": html,
        })
        print(f"[email] Sent to {to}")
    except Exception as exc:
        print(f"[email] Failed to send to {to}: {exc}")


def _template(content: str, lang: str = "fr") -> str:
    """Base HTML email template with logo header and branded signature."""
    en = lang == "en"
    t_subtitle = "CLIENT FILE MANAGEMENT PLATFORM" if en else "PLATEFORME DE GESTION DES DOSSIERS CLIENTS"
    t_rights   = "© 2026 Eolis Connect — All rights reserved" if en else "© 2026 Eolis Connect — Tous droits réservés"
    t_auto     = "This email was sent automatically. Please do not reply directly." if en else "Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement."
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:32px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(27,58,92,0.10);max-width:580px;width:100%;">

  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#1B3A5C 0%,#2a5480 100%);padding:28px 40px;text-align:center;">
      <img src="{LOGO_URL}" alt="Eolis Connect" height="52" style="display:block;margin:0 auto 12px;max-width:160px;" />
      <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Eolis Connect</h1>
      <p style="color:#a8c8e8;margin:4px 0 0;font-size:12px;letter-spacing:0.5px;">{t_subtitle}</p>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="padding:32px 40px;">
      {content}
    </td>
  </tr>

  <!-- Divider -->
  <tr>
    <td style="padding:0 40px;">
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" />
    </td>
  </tr>

  <!-- Signature -->
  <tr>
    <td style="padding:24px 40px;background:#f8fafc;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;padding-right:16px;">
            <img src="{LOGO_URL}" alt="Eolis" height="36" style="display:block;max-width:120px;" />
          </td>
          <td style="vertical-align:middle;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#1B3A5C;">Eolis Connect</p>
            <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">Service Client &amp; Support</p>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top:12px;">
            <p style="margin:0;font-size:11px;color:#6b7280;">📧 <a href="mailto:{settings.MAIL_SUPPORT_FROM}" style="color:#4A8FC4;text-decoration:none;">{settings.MAIL_SUPPORT_FROM}</a></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="padding:16px 40px;background:#1B3A5C;text-align:center;">
      <p style="margin:0;color:#a8c8e8;font-size:11px;">{t_rights}</p>
      <p style="margin:4px 0 0;color:#6b90b0;font-size:10px;">{t_auto}</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>"""


# ── Email senders ──────────────────────────────────────────────────────────────

def send_welcome_client(to_email: str, first_name: str, username: str, pwd_hint: str = "", lang: str = "fr"):
    """Sent immediately when a client self-registers (auto-approved)."""
    en = lang == "en"
    base = settings.ALLOWED_ORIGINS.split(",")[0].strip()
    login_url = f"{base}/{'en' if en else 'fr'}/login"
    subject = f"Welcome to Eolis Connect, {first_name}" if en else f"Bienvenue sur Eolis Connect, {first_name}"
    pwd_row = f"""
      <tr>
        <td style="padding:12px 24px 20px;border-top:1px solid #dbeafe;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.8px;">{'Password confirmation' if en else 'Confirmation mot de passe'}</p>
          <p style="margin:0;font-size:22px;font-weight:800;color:#1B3A5C;font-family:monospace;letter-spacing:2px;">{pwd_hint}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;">{'Your password has been successfully saved.' if en else 'Votre mot de passe a bien été enregistré par le système.'}</p>
        </td>
      </tr>
    """ if pwd_hint else ""
    content = f"""
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">{'Hello' if en else 'Bonjour'} <strong style="color:#1B3A5C;">{first_name}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">{'Your <strong>Eolis Connect</strong> account has been successfully created. You can now sign in and submit your requests.' if en else 'Votre compte sur <strong>Eolis Connect</strong> a été créé avec succès. Vous pouvez dès maintenant vous connecter et soumettre vos demandes.'}</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFF6FF;border:1px solid #bfdbfe;border-radius:12px;margin:20px 0;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.8px;">{'Your login identifier' if en else 'Votre identifiant de connexion'}</p>
            <p style="margin:0;font-size:26px;font-weight:800;color:#1B3A5C;font-family:monospace;letter-spacing:1px;">{username}</p>
            <p style="margin:6px 0 0;font-size:12px;color:#4b5563;">{'Keep this identifier safe — it will be required at every login.' if en else 'Conservez cet identifiant précieusement — il vous sera demandé à chaque connexion.'}</p>
          </td>
        </tr>
        {pwd_row}
      </table>

      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">{'Sign in using your identifier above and the password you chose during registration.' if en else "Pour vous connecter, utilisez votre identifiant ci-dessus et le mot de passe que vous avez choisi lors de l'inscription."}</p>

      <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr>
          <td style="background:#1B3A5C;border-radius:10px;padding:0;">
            <a href="{login_url}" style="display:inline-block;padding:13px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">{'Sign in →' if en else 'Se connecter →'}</a>
          </td>
        </tr>
      </table>

      <p style="margin:20px 0 0;font-size:13px;color:#9ca3af;">{'Questions? Our team is available at' if en else 'Des questions ? Notre équipe est disponible à'} <a href="mailto:{settings.MAIL_SUPPORT_FROM}" style="color:#4A8FC4;">{settings.MAIL_SUPPORT_FROM}</a>.</p>
    """
    _send(to_email, subject, _template(content, lang))


def send_welcome_email(to_email: str, first_name: str, username: str):
    """Sent when a non-client registers (pending approval)."""
    subject = "Votre demande de compte Eolis Connect est en cours d'examen"
    content = f"""
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">Bonjour <strong style="color:#1B3A5C;">{first_name}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">Votre demande de compte sur <strong>Eolis Connect</strong> a bien été reçue.</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7ED;border:1px solid #fed7aa;border-radius:12px;margin:20px 0;">
        <tr>
          <td style="padding:18px 24px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9a3412;text-transform:uppercase;letter-spacing:0.8px;">Identifiant réservé</p>
            <p style="margin:0;font-size:22px;font-weight:800;color:#1B3A5C;font-family:monospace;">{username}</p>
            <p style="margin:6px 0 0;font-size:12px;color:#7c2d12;">Cet identifiant est réservé et sera activé dès validation de votre compte.</p>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">Notre équipe examinera votre demande dans les plus brefs délais. Vous recevrez un email de confirmation dès que votre compte sera validé.</p>
      <p style="margin:0 0 0;font-size:13px;color:#9ca3af;">Pour toute question : <a href="mailto:{settings.MAIL_SUPPORT_FROM}" style="color:#4A8FC4;">{settings.MAIL_SUPPORT_FROM}</a></p>
    """
    _send(to_email, subject, _template(content))



def send_account_created_by_admin(to_email: str, first_name: str, username: str, password: str, role: str, setup_url: str, lang: str = "fr"):
    en = lang == "en"
    role_labels_fr = {'AGENT': 'Agent Service Client', 'OPS_ADMIN': 'Administrateur Opérations', 'SYSTEM_ADMIN': 'Administrateur Système', 'CLIENT': 'Client'}
    role_labels_en = {'AGENT': 'Customer Service Agent', 'OPS_ADMIN': 'Operations Administrator', 'SYSTEM_ADMIN': 'System Administrator', 'CLIENT': 'Client'}
    role_label = (role_labels_en if en else role_labels_fr).get(role, role)
    subject = f"Welcome to Eolis Connect — Your access, {first_name}" if en else f"Bienvenue sur Eolis Connect — Vos accès, {first_name}"

    t_greeting    = "Hello" if en else "Bonjour"
    t_role_label  = "Role" if en else "Votre rôle"
    t_created     = "An <strong>Eolis Connect</strong> account has been created for you by the administration." if en else "Un compte <strong>Eolis Connect</strong> a été créé pour vous par l'administration."
    t_identifier  = "Your login identifier" if en else "Votre identifiant de connexion"
    t_temp_pw     = "Your temporary password is available via the secure link below." if en else "Votre mot de passe temporaire est disponible via le lien sécurisé ci-dessous."
    t_keep_id     = "Keep your identifier safe" if en else "Notez bien votre identifiant"
    t_need_it     = "you will need it to sign in." if en else "vous en aurez besoin pour vous connecter."
    t_secure_link = "Secure link to retrieve your temporary password" if en else "Lien sécurisé pour récupérer votre mot de passe temporaire"
    t_single_use  = "This link is <strong>single-use</strong> and expires in <strong>48 hours</strong>." if en else "Ce lien est <strong>à usage unique</strong> et expire dans <strong>48 heures</strong>."
    t_note_pw     = "Once opened, note your password immediately — the page cannot be displayed again." if en else "Une fois ouvert, notez votre mot de passe immédiatement — la page ne pourra pas être réaffichée."
    t_btn         = "Access my credentials →" if en else "Accéder à mes identifiants →"
    t_expire      = "If you do not use this link within 48h, it will expire permanently." if en else "Si vous n'utilisez pas ce lien dans les 48h, il expirera définitivement."
    t_contact     = "Contact the administration for a new one:" if en else "Contactez l'administration pour en obtenir un nouveau :"
    t_help        = "Need help?" if en else "Besoin d'aide ?"

    content = f"""
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">{t_greeting} <strong style="color:#1B3A5C;">{first_name}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
        {t_created}<br/>
        {t_role_label} : <strong style="color:#1B3A5C;">{role_label}</strong>
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFF6FF;border:1px solid #bfdbfe;border-radius:12px;margin:20px 0;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.8px;">{t_identifier}</p>
            <p style="margin:0 0 12px;font-size:24px;font-weight:800;color:#1B3A5C;font-family:monospace;">{username}</p>
            <p style="margin:0;font-size:13px;color:#4b5563;">
              {t_temp_pw}<br/>
              <strong>{t_keep_id}</strong> — {t_need_it}
            </p>
          </td>
        </tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF9C3;border:1px solid #fde047;border-radius:12px;margin:16px 0;">
        <tr>
          <td style="padding:16px 24px;">
            <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#713f12;">🔐 {t_secure_link}</p>
            <p style="margin:0;font-size:12px;color:#92400e;">
              {t_single_use}<br/>
              {t_note_pw}
            </p>
          </td>
        </tr>
      </table>
      <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr>
          <td style="background:#1B3A5C;border-radius:10px;padding:0;">
            <a href="{setup_url}" style="display:inline-block;padding:13px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">{t_btn}</a>
          </td>
        </tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF2F2;border:1px solid #fecaca;border-radius:12px;margin:16px 0;">
        <tr>
          <td style="padding:14px 20px;">
            <p style="margin:0;font-size:12px;color:#7f1d1d;">
              ⚠️ {t_expire}<br/>
              {t_contact} <a href="mailto:{settings.MAIL_SUPPORT_FROM}" style="color:#4A8FC4;">{settings.MAIL_SUPPORT_FROM}</a>
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#9ca3af;">{t_help} <a href="mailto:{settings.MAIL_SUPPORT_FROM}" style="color:#4A8FC4;">{settings.MAIL_SUPPORT_FROM}</a></p>
    """
    _send(to_email, subject, _template(content, lang))


def send_account_deleted(to_email: str, first_name: str, lang: str = "fr"):
    en = lang == "en"
    subject = "Your Eolis Connect account has been deleted" if en else "Votre compte Eolis Connect a été supprimé"

    t_greeting = "Hello" if en else "Bonjour"
    t_deleted   = "We inform you that your <strong>Eolis Connect</strong> account has been deleted by the administration." if en else "Nous vous informons que votre compte sur la plateforme <strong>Eolis Connect</strong> a été supprimé par l'administration."
    t_error     = "If you believe this is an error, please contact our team as soon as possible." if en else "Si vous pensez qu'il s'agit d'une erreur, veuillez contacter notre équipe au plus vite."
    t_thanks    = "Thank you for using Eolis Connect." if en else "Merci d'avoir utilisé Eolis Connect. Bonne continuation."

    content = f"""
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">{t_greeting} <strong style="color:#1B3A5C;">{first_name}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
        {t_deleted}
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF2F2;border:1px solid #fecaca;border-radius:12px;margin:20px 0;">
        <tr>
          <td style="padding:16px 24px;">
            <p style="margin:0;font-size:14px;color:#7f1d1d;">
              {t_error}
            </p>
            <p style="margin:10px 0 0;font-size:14px;">
              <a href="mailto:{settings.MAIL_SUPPORT_FROM}" style="color:#4A8FC4;font-weight:600;">{settings.MAIL_SUPPORT_FROM}</a>
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#6b7280;">{t_thanks}</p>
    """
    _send(to_email, subject, _template(content, lang))


def send_otp_email(to_email: str, first_name: str, code: str, lang: str = "fr"):
    en = lang == "en"
    subject = "Your verification code — Eolis Connect" if en else "Votre code de vérification — Eolis Connect"
    t_greeting = "Hello" if en else "Bonjour"
    t_label    = "Your verification code" if en else "Votre code de vérification"
    t_valid    = "Valid for 10 minutes. Do not share it." if en else "Valable 10 minutes. Ne le partagez pas."
    t_no_req   = "If you did not request this code, ignore this email." if en else "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email."
    content = f"""
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">{t_greeting} <strong style="color:#1B3A5C;">{first_name}</strong>,</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFF6FF;border:1px solid #bfdbfe;border-radius:12px;margin:20px 0;">
        <tr>
          <td style="padding:28px;text-align:center;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.8px;">{t_label}</p>
            <p style="margin:0;font-size:48px;font-weight:800;color:#1B3A5C;font-family:monospace;letter-spacing:8px;">{code}</p>
            <p style="margin:10px 0 0;font-size:12px;color:#6b7280;">{t_valid}</p>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#9ca3af;">{t_no_req}</p>
    """
    _send(to_email, subject, _template(content, lang))


def send_password_reset(to_email: str, first_name: str, reset_url: str, lang: str = "fr"):
    en = lang == "en"
    subject = "Reset your Eolis Connect password" if en else "Réinitialisez votre mot de passe Eolis Connect"

    t_greeting = "Hello" if en else "Bonjour"
    t_request  = "You have requested to reset your <strong>Eolis Connect</strong> password." if en else "Vous avez demandé la réinitialisation de votre mot de passe <strong>Eolis Connect</strong>."
    t_btn      = "Reset my password →" if en else "Réinitialiser mon mot de passe →"
    t_expire   = "This link is <strong>single-use</strong> and expires in <strong>48 hours</strong>." if en else "Ce lien est <strong>à usage unique</strong> et expire dans <strong>48 heures</strong>."
    t_no_req   = "If you did not request this, ignore this email — your password will not be changed." if en else "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe ne sera pas modifié."

    content = f"""
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">{t_greeting} <strong style="color:#1B3A5C;">{first_name}</strong>,</p>
      <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">{t_request}</p>

      <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="background:#1B3A5C;border-radius:10px;padding:0;">
            <a href="{reset_url}" style="display:inline-block;padding:13px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">{t_btn}</a>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF9C3;border:1px solid #fde047;border-radius:12px;margin:0 0 16px;">
        <tr>
          <td style="padding:14px 20px;">
            <p style="margin:0;font-size:12px;color:#92400e;">⏱ {t_expire}</p>
          </td>
        </tr>
      </table>

      <p style="margin:0;font-size:13px;color:#9ca3af;">{t_no_req}</p>
    """
    _send(to_email, subject, _template(content, lang))


def send_maintenance_start(to_email: str, first_name: str, message: str, estimated_return: str | None, lang: str = "fr"):
    en = lang == "en"
    subject = "Eolis Connect — Scheduled maintenance" if en else "Eolis Connect — Maintenance programmée"
    t_greeting  = "Hello" if en else "Bonjour"
    t_intro     = "The <strong>Eolis Connect</strong> platform is currently undergoing scheduled maintenance." if en else "La plateforme <strong>Eolis Connect</strong> est actuellement en maintenance programmée."
    t_eta_label = "Estimated return" if en else "Retour estimé"
    t_data      = "Your account and all your data remain <strong>completely secure</strong>. No information will be lost." if en else "Votre compte et toutes vos données restent <strong>entièrement sécurisés</strong>. Aucune information ne sera perdue."
    t_notif     = "We will notify you as soon as the platform is back online." if en else "Nous vous informerons dès que la plateforme sera de nouveau disponible."
    eta_block = f"""
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF9C3;border:1px solid #fde047;border-radius:12px;margin:16px 0;">
        <tr><td style="padding:14px 20px;">
          <p style="margin:0;font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;">{t_eta_label}</p>
          <p style="margin:4px 0 0;font-size:14px;color:#78350f;">{estimated_return}</p>
        </td></tr>
      </table>""" if estimated_return else ""
    content = f"""
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">{t_greeting} <strong style="color:#1B3A5C;">{first_name}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">{t_intro}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7ED;border:1px solid #fed7aa;border-radius:12px;margin:0 0 16px;">
        <tr><td style="padding:20px 24px;">
          <p style="margin:0;font-size:14px;color:#9a3412;line-height:1.6;">{message}</p>
        </td></tr>
      </table>
      {eta_block}
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#ECFDF5;border:1px solid #6ee7b7;border-radius:12px;margin:16px 0;">
        <tr><td style="padding:14px 20px;">
          <p style="margin:0;font-size:13px;color:#065f46;">🔒 {t_data}</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">{t_notif}</p>
    """
    _send(to_email, subject, _template(content, lang))


def send_maintenance_end(to_email: str, first_name: str, return_message: str | None, lang: str = "fr"):
    en = lang == "en"
    subject    = "Eolis Connect — Platform restored" if en else "Eolis Connect — Plateforme rétablie"
    t_greeting = "Hello" if en else "Bonjour"
    t_intro    = "The <strong>Eolis Connect</strong> platform is now back online. You can access your account normally." if en else "La plateforme <strong>Eolis Connect</strong> est de nouveau en ligne. Vous pouvez accéder à votre compte normalement."
    t_data     = "Your account and all your data are intact." if en else "Votre compte et toutes vos données sont intacts."
    base       = settings.ALLOWED_ORIGINS.split(",")[0].strip()
    login_url  = f"{base}/{'en' if en else 'fr'}/login"
    t_btn      = "Access my account →" if en else "Accéder à mon compte →"
    msg_block = f"""
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFF6FF;border:1px solid #bfdbfe;border-radius:12px;margin:16px 0;">
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">{'What changed' if en else 'Ce qui a changé'}</p>
          <p style="margin:0;font-size:14px;color:#1e3a5f;line-height:1.6;">{return_message}</p>
        </td></tr>
      </table>""" if return_message else ""
    content = f"""
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">{t_greeting} <strong style="color:#1B3A5C;">{first_name}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">{t_intro}</p>
      {msg_block}
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#ECFDF5;border:1px solid #6ee7b7;border-radius:12px;margin:0 0 20px;">
        <tr><td style="padding:14px 20px;">
          <p style="margin:0;font-size:13px;color:#065f46;">✅ {t_data}</p>
        </td></tr>
      </table>
      <table cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr><td style="background:#1B3A5C;border-radius:10px;padding:0;">
          <a href="{login_url}" style="display:inline-block;padding:13px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">{t_btn}</a>
        </td></tr>
      </table>
    """
    _send(to_email, subject, _template(content, lang))
