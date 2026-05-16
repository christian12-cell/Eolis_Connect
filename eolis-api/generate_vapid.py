"""
Run once to generate VAPID keys for Web Push:
    python generate_vapid.py

Copy the output into your .env / Railway env vars.
"""
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.serialization import (
    Encoding, PrivateFormat, NoEncryption, PublicFormat
)
import base64

key = ec.generate_private_key(ec.SECP256R1(), default_backend())

private_pem = key.private_bytes(Encoding.PEM, PrivateFormat.TraditionalOpenSSL, NoEncryption()).decode()
private_oneline = private_pem.replace('\n', '\\n')

public_bytes = key.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
public_b64 = base64.urlsafe_b64encode(public_bytes).rstrip(b'=').decode()

print("# Colle ces 3 lignes dans ton .env / Railway :")
print(f"VAPID_PRIVATE_KEY={private_oneline}")
print(f"VAPID_PUBLIC_KEY={public_b64}")
print(f"VAPID_CLAIMS_EMAIL=noreply@eolisconnect.online")
