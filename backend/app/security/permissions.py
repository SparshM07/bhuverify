from typing import List, Callable
from fastapi import Depends, HTTPException, status
from backend.app.models.entities import User, Document
from backend.app.security.auth import get_current_user

def require_roles(allowed_roles: List[str]) -> Callable:
    """Dependency that checks if the current user has one of the allowed roles."""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}. Your role: {current_user.role}"
            )
        return current_user
    return role_checker

def verify_document_object_access(document: Document, user: User) -> None:
    """
    Object-level access check.
    Enforces that viewers cannot see restricted documents.
    Returns 404 instead of 403 to prevent metadata/existence leakage.
    """
    if document.is_restricted and user.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found."
        )
