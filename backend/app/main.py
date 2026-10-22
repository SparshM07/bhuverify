from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.database import engine, Base
from backend.app.api.endpoints import auth, documents, public_verify, dashboard, cases, admin
from backend.app.database_seeder import seed_default_users

# Initialize SQLite database tables and seed demo accounts
Base.metadata.create_all(bind=engine)
seed_default_users()

app = FastAPI(
    title="BhuVerify API",
    description="AI-assisted land-record digitisation and verification prototype for UP-style khatauni records.",
    version="0.1.0"
)

# Configure CORS for Vite frontend
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(public_verify.router)
app.include_router(dashboard.router)
app.include_router(cases.router)
app.include_router(admin.router)

@app.get("/health")
def health_check():
    """Health check endpoint displaying system operational status and synthetic prototype disclaimer."""
    return {
        "status": "ok",
        "app": "BhuVerify",
        "version": "0.1.0",
        "environment": settings.ENVIRONMENT,
        "disclaimer": settings.DEMO_DISCLAIMER
    }

