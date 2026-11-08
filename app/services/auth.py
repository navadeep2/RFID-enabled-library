import hashlib
import hmac
import json
import base64
import time
from typing import Optional, Dict, Any
from app.config import settings
from app.database import db_session
from app.services.audit import record_audit

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_access_token(user_data: Dict[str, Any]) -> str:
    payload = {
        "sub": str(user_data["id"]),
        "member_code": user_data["member_code"],
        "full_name": user_data["full_name"],
        "role": user_data["role"],
        "exp": int(time.time()) + (settings.token_expire_hours * 3600)
    }
    header = {"alg": "HS256", "typ": "JWT"}
    hdr_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    pay_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    signature = hmac.new(
        settings.secret_key.encode(),
        f"{hdr_b64}.{pay_b64}".encode(),
        hashlib.sha256
    ).digest()
    sig_b64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    return f"{hdr_b64}.{pay_b64}.{sig_b64}"

def verify_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        hdr_b64, pay_b64, sig_b64 = parts
        expected_sig = hmac.new(
            settings.secret_key.encode(),
            f"{hdr_b64}.{pay_b64}".encode(),
            hashlib.sha256
        ).digest()
        # Add padding back if necessary
        sig_padding = len(sig_b64) % 4
        if sig_padding:
            sig_b64 += "=" * (4 - sig_padding)
        actual_sig = base64.urlsafe_b64decode(sig_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        pay_padding = len(pay_b64) % 4
        if pay_padding:
            pay_b64 += "=" * (4 - pay_padding)
        payload = json.loads(base64.urlsafe_b64decode(pay_b64).decode())
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None

def authenticate_user(
    username_or_code: Optional[str] = None,
    password: Optional[str] = None,
    smart_card_uid: Optional[str] = None,
    ip_address: str = "127.0.0.1",
    db_path: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    with db_session(db_path) as conn:
        cursor = conn.cursor()
        user_row = None
        # Smart Card Authentication (AC 07)
        if smart_card_uid:
            cursor.execute(
                "SELECT * FROM members WHERE smart_card_uid = ? AND is_blocked = 0",
                (smart_card_uid.strip(),)
            )
            user_row = cursor.fetchone()
            auth_type = "SMART_CARD"
        elif username_or_code and password:
            cursor.execute(
                "SELECT * FROM members WHERE (member_code = ? OR email = ?) AND is_blocked = 0",
                (username_or_code.strip(), username_or_code.strip())
            )
            candidate = cursor.fetchone()
            if candidate and candidate["password_hash"] == hash_password(password):
                user_row = candidate
            auth_type = "PASSWORD"
        else:
            return None

        if user_row:
            user = dict(user_row)
            record_audit(
                actor_id=user["member_code"],
                action=f"LOGIN_{auth_type}",
                entity_type="MEMBER",
                entity_id=str(user["id"]),
                details={"role": user["role"], "method": auth_type},
                ip_address=ip_address,
                db_path=db_path
            )
            return user
        return None

def check_permission(user_role: str, allowed_roles: list[str]) -> bool:
    role_hierarchy = {
        "ADMIN": 4,
        "LIBRARIAN": 3,
        "STAFF": 2,
        "PATRON": 1
    }
    user_level = role_hierarchy.get(user_role.upper(), 0)
    for allowed in allowed_roles:
        if user_level >= role_hierarchy.get(allowed.upper(), 99):
            return True
    return False
