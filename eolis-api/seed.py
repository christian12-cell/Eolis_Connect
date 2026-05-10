import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine
from app.models import Base, User, Ticket, Message, SatisfactionRating, Notification, FAQ, Log
from app.security import hash_password
from datetime import datetime

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    print("[1/4] Clearing existing data...")
    from sqlalchemy import text
    db.execute(text(
        "TRUNCATE TABLE otp_codes, password_resets, logs, notifications, satisfaction_ratings, attachments, messages, tickets, faqs, users RESTART IDENTITY CASCADE"
    ))
    db.commit()

    print("[2/4] Creating users...")
    admin = User(first_name="Christian", last_name="Denmeko", username="Christian.DENMEKO",
                 email="admin@eoliscameroun.com", phone="+237690000001",
                 password_hash=hash_password("Admin@2026!"), role="SYSTEM_ADMIN", status="ACTIVE", language="fr")

    ops = User(first_name="Debora", last_name="Denmeko", username="Debora.DENMEKO",
               email="ops@eoliscameroun.com", phone="+237690000002",
               password_hash=hash_password("Ops@2026!"), role="OPS_ADMIN", status="ACTIVE", language="fr")

    agent1 = User(first_name="Jean", last_name="Mbarga", username="Jean.MBARGA",
                  email="agent1@eoliscameroun.com", phone="+237690000003",
                  password_hash=hash_password("Agent@2026!"), role="AGENT", status="ACTIVE", language="fr")

    agent2 = User(first_name="Marie", last_name="Nguema", username="Marie.NGUEMA",
                  email="agent2@eoliscameroun.com", phone="+237690000004",
                  password_hash=hash_password("Agent@2026!"), role="AGENT", status="ACTIVE", language="fr")

    client1 = User(first_name="Thomas", last_name="Kamga", username="Thomas.KAMGA",
                   email="client1@example.com", phone="+237699000001",
                   password_hash=hash_password("Client@2026!"), role="CLIENT", status="ACTIVE", language="fr")

    client2 = User(first_name="Alice", last_name="Fono", username="Alice.FONO",
                   email="client2@example.com", phone="+237699000002",
                   password_hash=hash_password("Client@2026!"), role="CLIENT", status="ACTIVE", language="en")

    pending = User(first_name="Robert", last_name="Etoa", username="Robert.ETOA",
                   email="pending@example.com", phone="+237699000003",
                   password_hash=hash_password("Client@2026!"), role="CLIENT", status="PENDING", language="fr")

    for u in [admin, ops, agent1, agent2, client1, client2, pending]:
        db.add(u)
    db.commit()

    print("[3/4] Creating tickets...")
    t1 = Ticket(ref="REF-2026-0001", client_id=client1.id, agent_id=agent1.id,
                category="Livraison", subcategory="Conteneur bloqué", equipment_type="Conteneur 40 pieds",
                ship_line="MSC", ship_name="MSC Cameroun", voyage_number="CM2026-04", ship_date="2026-04-15",
                description="Mon conteneur 40 pieds est bloqué au port depuis 3 jours sans explication.",
                urgency="HIGH", status="TREATED",
                taken_at=datetime(2026, 4, 16, 9, 0), closed_at=datetime(2026, 4, 16, 14, 30))
    db.add(t1)
    db.commit()

    for content, sender_id, sender_type in [
        ("Bonjour M. Kamga, nous avons bien reçu votre demande. Nous vérifions la situation de votre conteneur.", agent1.id, "AGENT"),
        ("Merci de votre retour rapide. J'attends votre confirmation.", client1.id, "CLIENT"),
        ("Bonne nouvelle ! Votre conteneur a été libéré. Référence de mainlevée : ML-2026-789.", agent1.id, "AGENT"),
    ]:
        db.add(Message(ticket_id=t1.id, sender_id=sender_id, sender_type=sender_type, content=content, is_read=True))
    db.add(SatisfactionRating(ticket_id=t1.id, client_id=client1.id, agent_id=agent1.id, score=5, comment="Service très rapide et efficace !"))
    db.commit()

    t2 = Ticket(ref="REF-2026-0002", client_id=client1.id, agent_id=agent1.id,
                category="Facturation", subcategory="Retard de paiement",
                description="Je n'ai pas encore reçu ma facture pour la livraison du mois dernier.",
                urgency="MEDIUM", status="IN_PROGRESS", taken_at=datetime.utcnow())
    db.add(t2)
    db.commit()
    db.add(Message(ticket_id=t2.id, sender_id=agent1.id, sender_type="AGENT",
                   content="Bonjour, nous vérifions votre dossier de facturation. Pouvez-vous nous fournir votre numéro de commande ?"))
    db.add(Notification(user_id=client1.id, ticket_id=t2.id, type="NEW_MESSAGE",
                        title="Nouveau message", message=f"Nouveau message dans le dossier REF-2026-0002."))
    db.commit()

    t3 = Ticket(ref="REF-2026-0003", client_id=client2.id,
                category="Delivery", subcategory="Delivery delay", equipment_type="20ft Container",
                ship_line="CMA-CGM", ship_name="CMA Douala", voyage_number="DLA2026-07",
                description="My 20ft container delivery is 5 days late. The expected date was April 20th.",
                urgency="HIGH", status="PENDING")
    db.add(t3)
    db.commit()

    t4 = Ticket(ref="REF-2026-0004", client_id=client2.id, agent_id=agent2.id,
                category="Billing", subcategory="Refund",
                description="I was charged twice for my last delivery. I need a refund for the duplicate charge.",
                urgency="LOW", status="TREATED",
                taken_at=datetime(2026, 4, 20, 10, 0), closed_at=datetime(2026, 4, 21, 16, 0))
    db.add(t4)
    db.commit()
    db.add(SatisfactionRating(ticket_id=t4.id, client_id=client2.id, agent_id=agent2.id, score=4, comment="Good service, resolved my issue."))
    db.commit()

    print("[4/4] Creating FAQs...")
    faqs_fr = [
        ("Livraison", "Comment suivre ma livraison ?", "Connectez-vous à votre espace Eolis Connect et consultez vos demandes."),
        ("Livraison", "Que faire si mon conteneur est bloqué au port ?", "Créez une demande dans la catégorie \"Livraison > Conteneur bloqué\"."),
        ("Livraison", "Quels documents faut-il pour récupérer un conteneur ?", "Facture commerciale, connaissement, déclaration en douane, pièce d'identité."),
        ("Facturation", "Comment obtenir ma facture ?", "Vos factures sont disponibles dans votre espace client."),
        ("Facturation", "Comment contester une facture ?", "Créez une demande dans \"Facturation > Paiement incomplet\" ou \"Facturation > Remboursement\"."),
        ("Information", "Quels services propose Eolis Cameroun ?", "Manutention portuaire, transport de conteneurs, fret conventionnel, gestion documentaire."),
        ("Information", "Quels sont les horaires du service client ?", "Lundi au vendredi de 8h00 à 18h00."),
    ]
    for i, (cat, q, a) in enumerate(faqs_fr):
        db.add(FAQ(locale="fr", category=cat, question=q, answer=a, order=i))

    faqs_en = [
        ("Delivery", "How do I track my delivery?", "Log in to your Eolis Connect account and check your requests."),
        ("Delivery", "What should I do if my container is blocked at the port?", "Create a request under \"Delivery > Blocked container\"."),
        ("Delivery", "What documents are needed to pick up a container?", "Commercial invoice, Bill of Lading, customs declaration, and a valid ID."),
        ("Billing", "How do I get my invoice?", "Your invoices are available in your client area."),
        ("Billing", "How do I dispute an invoice?", "Create a request under \"Billing > Incomplete payment\" or \"Billing > Refund\"."),
        ("Information", "What services does Eolis Cameroun offer?", "Port handling, container transport (20ft and 40ft), conventional freight, and document management."),
        ("Information", "What are customer service hours?", "Monday to Friday from 8:00 AM to 6:00 PM."),
    ]
    for i, (cat, q, a) in enumerate(faqs_en):
        db.add(FAQ(locale="en", category=cat, question=q, answer=a, order=i))

    db.commit()
    db.close()

    print("\nDatabase seeded successfully!")
    print("\nTest accounts:")
    print("  System Admin : Christian.DENMEKO / Admin@2026!")
    print("  Ops Admin    : Debora.DENMEKO    / Ops@2026!")
    print("  Agent 1      : Jean.MBARGA       / Agent@2026!")
    print("  Agent 2      : Marie.NGUEMA      / Agent@2026!")
    print("  Client 1     : Thomas.KAMGA      / Client@2026!")
    print("  Client 2 (EN): Alice.FONO        / Client@2026!")
    print("  Pending      : Robert.ETOA       / Client@2026!")

if __name__ == "__main__":
    seed()
