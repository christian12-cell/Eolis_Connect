from .config import settings


def _e164(phone: str) -> str:
    """Normalize to E.164: strip spaces and dashes, keep leading +."""
    return phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")


def send_sms(to: str, body: str):
    """
    Send an SMS via Twilio.
    - TWILIO_FROM_NUMBER can be a phone number (+1XXXXXXXXXX)
      OR an alphanumeric sender ID (e.g. "Eolis") — Twilio handles both.
    - Silently skips if disabled, not configured, or phone is invalid.
    """
    if not settings.TWILIO_ENABLED or not settings.TWILIO_ACCOUNT_SID or not to:
        return
    phone = _e164(to)
    if not phone.startswith("+"):
        return
    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        msg = client.messages.create(
            body=body,
            from_=settings.TWILIO_FROM_NUMBER,
            to=phone,
        )
        print(f"[sms] Sent to {phone} — SID: {msg.sid}")
    except ImportError:
        print("[sms] twilio not installed — run: pip install twilio")
    except Exception as exc:
        print(f"[sms] Failed to {phone}: {exc}")


# ── Notification wrappers ──────────────────────────────────────────────────────

def sms_otp(to: str, code: str):
    body = f"Eolis Connect\nCode de verification : {code}\nValable 10 min. Ne le partagez pas."
    send_sms(to, body)


def sms_welcome_client(to: str, first_name: str, username: str, login_url: str):
    body = (
        f"Bienvenue sur Eolis Connect, {first_name} !\n"
        f"Identifiant : {username}\n"
        f"Connexion : {login_url}"
    )
    send_sms(to, body)


def sms_account_approved(to: str, first_name: str, username: str, login_url: str):
    body = (
        f"Eolis Connect : Votre compte est approuve, {first_name} !\n"
        f"Identifiant : {username}\n"
        f"Connexion : {login_url}"
    )
    send_sms(to, body)


def sms_account_rejected(to: str, first_name: str):
    body = (
        f"Eolis Connect : Votre demande de compte n'a pas ete validee, {first_name}. "
        f"Contactez : support@containeriq.app"
    )
    send_sms(to, body)


def sms_new_message(to: str, ticket_ref: str, login_url: str):
    body = f"Eolis Connect : Nouveau message sur votre dossier {ticket_ref}.\nConsultez : {login_url}"
    send_sms(to, body)


def sms_ticket_closed(to: str, first_name: str, ticket_ref: str):
    body = (
        f"Eolis Connect : Votre dossier {ticket_ref} a ete traite et cloture, {first_name}. "
        f"Merci de votre confiance."
    )
    send_sms(to, body)


def sms_ticket_assigned(to: str, first_name: str, ticket_ref: str, urgency: str, login_url: str):
    label = {"HIGH": "URGENT", "MEDIUM": "Normal", "LOW": "Faible"}.get(urgency, urgency)
    body = (
        f"Eolis Connect [{label}] : Le dossier {ticket_ref} vous a ete assigne, {first_name}.\n"
        f"Consultez : {login_url}"
    )
    send_sms(to, body)


def sms_final_response(client_phone: str, client_first_name: str, agent_first_name: str, ticket_ref: str, lang: str):
    if lang == 'en':
        body = (f"Hello {client_first_name}, agent {agent_first_name} from Eolis has sent a final "
                f"response to your request {ticket_ref} and closed it. "
                f"Log in to Eolis Connect to view the response and rate your experience.")
    else:
        body = (f"Bonjour {client_first_name}, l'agent {agent_first_name} d'Eolis a envoye une reponse "
                f"finale a votre demande {ticket_ref} et l'a cloturee. "
                f"Connectez-vous sur Eolis Connect pour consulter la reponse et evaluer votre experience.")
    send_sms(client_phone, body)


def sms_docs_submitted(agent_phone: str, client_first_name: str, ticket_ref: str):
    body = (f"{client_first_name} a envoye les documents demandes pour le dossier {ticket_ref}. "
            f"Connectez-vous sur Eolis Connect pour les consulter et poursuivre le traitement.")
    send_sms(agent_phone, body)


def sms_document_requested(client_phone: str, client_first_name: str, ticket_ref: str, lang: str):
    if lang == 'en':
        body = f"Hello {client_first_name}, the agent needs additional documents for your request {ticket_ref}. Please log in to Eolis Connect to provide them."
    else:
        body = f"Bonjour {client_first_name}, l'agent a besoin de documents supplementaires pour votre demande {ticket_ref}. Connectez-vous sur Eolis Connect pour les fournir."
    send_sms(client_phone, body)


def sms_account_deleted(to: str, first_name: str):
    body = (
        f"Eolis Connect : Bonjour {first_name}, votre compte a ete supprime par l'administration. "
        f"Contactez le support si necessaire : support@eolisconnect.online"
    )
    send_sms(to, body)


def sms_account_created_by_admin(to: str, first_name: str, username: str):
    body = (
        f"Eolis Connect : Bonjour {first_name} ! Votre compte a ete cree. "
        f"Identifiant : {username}. "
        f"Consultez votre email pour vos acces complets et connectez-vous sur Eolis Connect."
    )
    send_sms(to, body)


def sms_password_reset(to: str, first_name: str, reset_url: str, lang: str = "fr"):
    if lang == "en":
        body = (f"Eolis Connect: Hello {first_name}, here is your password reset link "
                f"(single use, valid 48h):\n{reset_url}")
    else:
        body = (f"Eolis Connect : Bonjour {first_name}, voici votre lien de reinitialisation "
                f"(usage unique, valable 48h) :\n{reset_url}")
    send_sms(to, body)


def sms_test(to: str):
    body = "Eolis Connect : Ceci est un SMS de test. Configuration Twilio operationnelle."
    send_sms(to, body)
