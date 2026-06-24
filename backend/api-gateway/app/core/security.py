from jose import JWTError, jwt
from fastapi import HTTPException, status
from .config import settings


def decode_token(token: str) -> str:
    """Returns the user_id (sub claim) or raises 401."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        sub: str = payload.get("sub")
        if sub is None:
            raise ValueError("missing sub")
        return sub
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
