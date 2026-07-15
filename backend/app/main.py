from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import cases, extractions, query, reports, search
from app.config import settings
from app.database import init_db

app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cases.router, prefix="/api")
app.include_router(extractions.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(query.router, prefix="/api")
app.include_router(reports.router, prefix="/api")


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name}
