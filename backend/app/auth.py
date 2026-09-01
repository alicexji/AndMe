import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import Settings, get_settings

bearer = HTTPBearer(auto_error=False)


def require_ingestion_key(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.ingestion_api_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="Ingestion API key is not configured")
    if (credentials is None or credentials.scheme.lower() != "bearer" or
            not secrets.compare_digest(credentials.credentials, settings.ingestion_api_key)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid or missing ingestion API key",
                            headers={"WWW-Authenticate": "Bearer"})

