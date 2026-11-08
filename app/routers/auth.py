from fastapi import APIRouter, HTTPException, Request
from app.models.schemas import LoginRequest, TokenResponse
from app.services.auth import authenticate_user, create_access_token

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication & RBAC"])

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    user = authenticate_user(
        username_or_code=req.username_or_code,
        password=req.password,
        smart_card_uid=req.smart_card_uid,
        ip_address=client_ip
    )
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials or inactive card")

    token = create_access_token(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user["id"],
        "member_code": user["member_code"],
        "full_name": user["full_name"],
        "role": user["role"]
    }

@router.post("/smart-card-tap", response_model=TokenResponse)
def smart_card_tap(smart_card_uid: str, request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    user = authenticate_user(smart_card_uid=smart_card_uid, ip_address=client_ip)
    if not user:
        raise HTTPException(status_code=401, detail="Smart card not recognized or blocked")

    token = create_access_token(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user["id"],
        "member_code": user["member_code"],
        "full_name": user["full_name"],
        "role": user["role"]
    }
