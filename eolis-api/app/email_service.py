import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from .config import settings

# Logo hosted on Imgur — replace with your own CDN URL for production
LOGO_URL = "https://i.imgur.com/TdBWHcp.png"
SUPPORT_EMAIL = "support@eolisconnect.online"


def _send(to: str, subject: str, html: str):
    if not settings.MAIL_ENABLED or not settings.MAIL_NOREPLY_FROM or not settings.MAIL_NOREPLY_PASSWORD:
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"Eolis Connect <{settings.MAIL_NOREPLY_FROM}>"
        msg["To"] = to
        msg.attach(MIMEText(html, "html", "utf-8"))
        ctx = ssl.create_default_context()
        with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT) as srv:
            srv.ehlo()
            srv.starttls(context=ctx)
            srv.login(settings.MAIL_NOREPLY_FROM, settings.MAIL_NOREPLY_PASSWORD)
            srv.sendmail(settings.MAIL_NOREPLY_FROM, to, msg.as_string())
    except Exception as exc:
        print(f"[email] Failed to send to {to}: {exc}")


def _template(content: str) -> str:
    """Base HTML email template with logo header and branded signature."""
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
      <p style="color:#a8c8e8;margin:4px 0 0;font-size:12px;letter-spacing:0.5px;">PLATEFORME DE GESTION DES DOSSIERS CLIENTS</p>
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
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:20px;font-size:11px;color:#6b7280;">📞 {SUPPORT_EMAIL}</td>
                <td style="font-size:11px;color:#6b7280;">📧 <a href="mailto:{settings.MAIL_SUPPORT_FROM}" style="color:#4A8FC4;text-decoration:none;">{settings.MAIL_SUPPORT_FROM}</a></td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="padding:16px 40px;background:#1B3A5C;text-align:center;">
      <p style="margin:0;color:#a8c8e8;font-size:11px;">© 2026 Eolis Connect — Tous droits réservés</p>
      <p style="margin:4px 0 0;color:#6b90b0;font-size:10px;">Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement.</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>"""


# ── Email senders ──────────────────────────────────────────────────────────────

def send_welcome_client(to_email: str, first_name: str, username: str):
    """Sent immediately when a client self-registers (auto-approved)."""
    subject = f"Bienvenue sur Eolis Connect, {first_name} ! 🎉"
    content = f"""
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">Bonjour <strong style="color:#1B3A5C;">{first_name}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">Votre compte sur <strong>Eolis Connect</strong> a été créé avec succès. Vous pouvez dès maintenant vous connecter et soumettre vos demandes.</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFF6FF;border:1px solid #bfdbfe;border-radius:12px;margin:20px 0;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.8px;">Votre identifiant de connexion</p>
            <p style="margin:0;font-size:26px;font-weight:800;color:#1B3A5C;font-family:monospace;letter-spacing:1px;">{username}</p>
            <p style="margin:6px 0 0;font-size:12px;color:#4b5563;">Conservez cet identifiant précieusement — il vous sera demandé à chaque connexion.</p>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">Pour vous connecter, utilisez votre identifiant ci-dessus et le mot de passe que vous avez choisi lors de l'inscription.</p>

      <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr>
          <td style="background:#1B3A5C;border-radius:10px;padding:0;">
            <a href="{settings.ALLOWED_ORIGINS.split(",")[0].strip()}/fr/login" style="display:inline-block;padding:13px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">Se connecter →</a>
          </td>
        </tr>
      </table>

      <p style="margin:20px 0 0;font-size:13px;color:#9ca3af;">Des questions ? Notre équipe est disponible à <a href="mailto:{settings.MAIL_SUPPORT_FROM}" style="color:#4A8FC4;">{settings.MAIL_SUPPORT_FROM}</a> ou au {SUPPORT_EMAIL}.</p>
    """
    _send(to_email, subject, _template(content))


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


def send_account_approved(to_email: str, first_name: str, username: str):
    subject = f"✓ Votre compte Eolis Connect est approuvé, {first_name} !"
    content = f"""
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">Bonjour <strong style="color:#1B3A5C;">{first_name}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">Bonne nouvelle ! Votre compte sur <strong>Eolis Connect</strong> a été approuvé par notre équipe. Vous avez désormais accès à toute la plateforme.</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#ECFDF5;border:1px solid #a7f3d0;border-radius:12px;margin:20px 0;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:0.8px;">Votre identifiant de connexion</p>
            <p style="margin:0;font-size:26px;font-weight:800;color:#1B3A5C;font-family:monospace;letter-spacing:1px;">{username}</p>
          </td>
        </tr>
      </table>

      <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr>
          <td style="background:#059669;border-radius:10px;padding:0;">
            <a href="{settings.ALLOWED_ORIGINS.split(",")[0].strip()}/fr/login" style="display:inline-block;padding:13px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Accéder à la plateforme →</a>
          </td>
        </tr>
      </table>

      <p style="margin:0;font-size:13px;color:#9ca3af;">Des questions ? <a href="mailto:{settings.MAIL_SUPPORT_FROM}" style="color:#4A8FC4;">{settings.MAIL_SUPPORT_FROM}</a> — {SUPPORT_EMAIL}</p>
    """
    _send(to_email, subject, _template(content))


def send_account_rejected(to_email: str, first_name: str):
    subject = "Votre demande de compte Eolis Connect"
    content = f"""
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">Bonjour <strong style="color:#1B3A5C;">{first_name}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">Nous avons bien examiné votre demande de création de compte sur <strong>Eolis Connect</strong>.</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">Nous sommes au regret de vous informer que votre demande n'a pas pu être validée à ce stade.</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF2F2;border:1px solid #fecaca;border-radius:12px;margin:20px 0;">
        <tr>
          <td style="padding:18px 24px;">
            <p style="margin:0;font-size:14px;color:#7f1d1d;">Si vous pensez qu'il s'agit d'une erreur ou souhaitez plus d'informations, n'hésitez pas à nous contacter :</p>
            <p style="margin:10px 0 0;font-size:14px;"><a href="mailto:{settings.MAIL_SUPPORT_FROM}" style="color:#4A8FC4;font-weight:600;">{settings.MAIL_SUPPORT_FROM}</a> &nbsp;|&nbsp; <span style="color:#1B3A5C;font-weight:600;">{SUPPORT_EMAIL}</span></p>
          </td>
        </tr>
      </table>

      <p style="margin:0;font-size:14px;color:#6b7280;">Nous restons à votre disposition et vous souhaitons bonne continuation.</p>
    """
    _send(to_email, subject, _template(content))


def send_account_created_by_admin(to_email: str, first_name: str, username: str, password: str, role: str, setup_url: str):
    role_labels = {
        'AGENT': 'Agent Service Client', 'OPS_ADMIN': 'Administrateur Opérations',
        'SYSTEM_ADMIN': 'Administrateur Système', 'CLIENT': 'Client',
    }
    role_label = role_labels.get(role, role)
    subject = f"Bienvenue sur Eolis Connect — Vos accès, {first_name}"
    content = f"""
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">Bonjour <strong style="color:#1B3A5C;">{first_name}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
        Un compte <strong>Eolis Connect</strong> a été créé pour vous par l'administration.<br/>
        Votre rôle : <strong style="color:#1B3A5C;">{role_label}</strong>
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFF6FF;border:1px solid #bfdbfe;border-radius:12px;margin:20px 0;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.8px;">Votre identifiant de connexion</p>
            <p style="margin:0 0 12px;font-size:24px;font-weight:800;color:#1B3A5C;font-family:monospace;">{username}</p>
            <p style="margin:0;font-size:13px;color:#4b5563;">
              Votre mot de passe temporaire est disponible via le lien sécurisé ci-dessous.<br/>
              <strong>Notez bien votre identifiant</strong> — vous en aurez besoin pour vous connecter.
            </p>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF9C3;border:1px solid #fde047;border-radius:12px;margin:16px 0;">
        <tr>
          <td style="padding:16px 24px;">
            <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#713f12;">🔐 Lien sécurisé pour récupérer votre mot de passe temporaire</p>
            <p style="margin:0;font-size:12px;color:#92400e;">
              Ce lien est <strong>à usage unique</strong> et expire dans <strong>48 heures</strong>.<br/>
              Une fois ouvert, notez votre mot de passe immédiatement — la page ne pourra pas être réaffichée.
            </p>
          </td>
        </tr>
      </table>

      <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr>
          <td style="background:#1B3A5C;border-radius:10px;padding:0;">
            <a href="{setup_url}" style="display:inline-block;padding:13px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Accéder à mes identifiants →</a>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF2F2;border:1px solid #fecaca;border-radius:12px;margin:16px 0;">
        <tr>
          <td style="padding:14px 20px;">
            <p style="margin:0;font-size:12px;color:#7f1d1d;">
              ⚠️ Si vous n'utilisez pas ce lien dans les 48h, il expirera définitivement.<br/>
              Contactez l'administration pour en obtenir un nouveau : <a href="mailto:{settings.MAIL_SUPPORT_FROM}" style="color:#4A8FC4;">{settings.MAIL_SUPPORT_FROM}</a>
            </p>
          </td>
        </tr>
      </table>

      <p style="margin:0;font-size:13px;color:#9ca3af;">Besoin d'aide ? <a href="mailto:{settings.MAIL_SUPPORT_FROM}" style="color:#4A8FC4;">{settings.MAIL_SUPPORT_FROM}</a> — {SUPPORT_EMAIL}</p>
    """
    _send(to_email, subject, _template(content))


def send_account_deleted(to_email: str, first_name: str):
    subject = "Votre compte Eolis Connect a été supprimé"
    content = f"""
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">Bonjour <strong style="color:#1B3A5C;">{first_name}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
        Nous vous informons que votre compte sur la plateforme <strong>Eolis Connect</strong> a été supprimé par l'administration.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF2F2;border:1px solid #fecaca;border-radius:12px;margin:20px 0;">
        <tr>
          <td style="padding:16px 24px;">
            <p style="margin:0;font-size:14px;color:#7f1d1d;">
              Si vous pensez qu'il s'agit d'une erreur, veuillez contacter notre équipe au plus vite.
            </p>
            <p style="margin:10px 0 0;font-size:14px;">
              <a href="mailto:{settings.MAIL_SUPPORT_FROM}" style="color:#4A8FC4;font-weight:600;">{settings.MAIL_SUPPORT_FROM}</a>
              &nbsp;|&nbsp;
              <span style="color:#1B3A5C;font-weight:600;">{SUPPORT_EMAIL}</span>
            </p>
          </td>
        </tr>
      </table>

      <p style="margin:0;font-size:13px;color:#6b7280;">Merci d'avoir utilisé Eolis Connect. Bonne continuation.</p>
    """
    _send(to_email, subject, _template(content))


def send_new_message_notification(to_email: str, first_name: str, ticket_ref: str, agent_name: str):
    subject = f"Nouveau message — Dossier {ticket_ref}"
    content = f"""
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">Bonjour <strong style="color:#1B3A5C;">{first_name}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">Votre agent vous a envoyé un nouveau message concernant votre dossier <strong style="color:#1B3A5C;">{ticket_ref}</strong>.</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFF6FF;border:1px solid #bfdbfe;border-radius:12px;margin:20px 0;">
        <tr>
          <td style="padding:16px 24px;">
            <p style="margin:0;font-size:13px;color:#4b5563;">Agent : <strong style="color:#1B3A5C;">{agent_name}</strong></p>
          </td>
        </tr>
      </table>

      <table cellpadding="0" cellspacing="0" style="margin:20px 0;">
        <tr>
          <td style="background:#1B3A5C;border-radius:10px;padding:0;">
            <a href="{settings.ALLOWED_ORIGINS.split(",")[0].strip()}/fr/mes-demandes" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Lire le message →</a>
          </td>
        </tr>
      </table>
    """
    _send(to_email, subject, _template(content))
