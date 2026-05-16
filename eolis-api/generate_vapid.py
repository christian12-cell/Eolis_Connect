"""
Run once to generate VAPID keys for Web Push:
    python generate_vapid.py

Copy the output into your .env / Railway env vars.
"""
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
import base64

key = ec.generate_private_key(ec.SECP256R1(), default_backend())

# Private key: raw 32-byte scalar, base64url-encoded (no padding)
private_bytes = key.private_numbers().private_value.to_bytes(32, 'big')
private_b64 = base64.urlsafe_b64encode(private_bytes).rstrip(b'=').decode()

# Public key: uncompressed point (65 bytes), base64url-encoded (no padding)
public_bytes = key.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
public_b64 = base64.urlsafe_b64encode(public_bytes).rstrip(b'=').decode()

print("# Colle ces 3 lignes dans ton .env / Railway :")
print(f"VAPID_PRIVATE_KEY={private_b64}")
print(f"VAPID_PUBLIC_KEY={public_b64}")
print(f"VAPID_CLAIMS_EMAIL=noreply@eolisconnect.online")
