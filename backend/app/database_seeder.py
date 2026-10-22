from sqlalchemy.orm import Session
from backend.app.database import SessionLocal
from backend.app.models.entities import User
from backend.app.security.auth import get_password_hash

def seed_default_users():
    """Seed synthetic demo accounts for Clerk, Admin, Viewer, and Reviewer roles."""
    db: Session = SessionLocal()
    try:
        demo_users = [
            {
                "email": "clerk@bhuverify.test",
                "password": "ClerkPass123!",
                "role": "clerk"
            },
            {
                "email": "admin@bhuverify.test",
                "password": "AdminPass123!",
                "role": "admin"
            },
            {
                "email": "viewer@bhuverify.test",
                "password": "ViewerPass123!",
                "role": "viewer"
            },
            {
                "email": "reviewer@bhuverify.test",
                "password": "ReviewerPass123!",
                "role": "reviewer"
            }
        ]

        for u in demo_users:
            existing = db.query(User).filter(User.email == u["email"]).first()
            if not existing:
                user = User(
                    email=u["email"],
                    hashed_password=get_password_hash(u["password"]),
                    role=u["role"],
                    is_active=True
                )
                db.add(user)
        db.commit()
    finally:
        db.close()
