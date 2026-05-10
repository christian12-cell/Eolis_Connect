"""
Reset DB: delete all data, create 1 seed account (SYSTEM_ADMIN).
Usage: python reset_db.py  OR  python reset_db.py --force
The full reset is also available in the admin dashboard (Admin > Systeme).
"""
import sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models import (
    User, Ticket, Message, Notification, Attachment,
    SatisfactionRating, OtpCode, PasswordReset, Log,
)
from app.security import hash_password

PHONE = '+33748523385'

SEED = [
    dict(first_name='Christian', last_name='DENMEKO', username='Christian.DENMEKO',
         email='christian.denmeko@eoliscameroun.com', phone=PHONE,
         role='SYSTEM_ADMIN', status='ACTIVE', language='fr', raw_pw='Admin@2026!'),
]


def reset():
    import uuid
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    db = SessionLocal()
    try:
        print('Deleting all data...')
        db.query(SatisfactionRating).delete()
        db.query(Attachment).delete()
        db.query(Message).delete()
        db.query(Notification).delete()
        db.query(OtpCode).delete()
        db.query(PasswordReset).delete()
        db.query(Log).delete()
        db.query(Ticket).delete()
        db.query(User).delete()
        db.commit()
        print('All data deleted.\n')

        print('Creating seed account...')
        for acc in SEED:
            u = User(
                id=str(uuid.uuid4()),
                first_name=acc['first_name'],
                last_name=acc['last_name'],
                username=acc['username'],
                email=acc['email'],
                phone=acc['phone'],
                phone_verified=False,
                password_hash=hash_password(acc['raw_pw']),
                role=acc['role'],
                status=acc['status'],
                language=acc['language'],
                created_at=now,
                updated_at=now,
            )
            db.add(u)
            db.commit()

            found = db.query(User).filter(User.username == acc['username']).first()
            if found:
                print(f'  + {acc["username"]} ({acc["role"]}) — OK')
            else:
                print(f'  ! {acc["username"]} — WARNING: not found after commit')

        print('\nDone.')
        print('  Christian.DENMEKO / Admin@2026!  (SYSTEM_ADMIN)')
        print('  --> Creer les autres comptes via le dashboard admin')

    except Exception as e:
        db.rollback()
        print(f'ERROR: {e}')
        raise
    finally:
        db.close()


if __name__ == '__main__':
    if '--force' not in sys.argv:
        confirm = input('This will DELETE ALL DATA. Type "yes" to confirm: ')
        if confirm.strip().lower() != 'yes':
            print('Aborted.')
            sys.exit(0)
    reset()
