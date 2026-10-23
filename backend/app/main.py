
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import APP_NAME, APP_VERSION
from app.database.models import initialize_database

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="A context-aware workflow assistant with approval safeguards.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    initialize_database()


@app.get("/")
def root():
    return {
        "name": APP_NAME,
        "version": APP_VERSION,
        "message": "ContextWeave API is running.",
    }


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(router)
